import { EventEmitter } from 'events';
import * as vscode from 'vscode';
import {
	IContextService,
	IStorageService,
	IAIService,
	DeveloperContext,
	GitCommit,
	FileDiff,
	FileEdit,
	EditEvent,
	FileEvent,
} from '../interfaces';
import { getDocumentSymbols, findFunctionAtPosition } from '../../utils/symbolUtils';

export class ContextService extends EventEmitter implements IContextService {
	private storage: IStorageService;
	private aiService?: IAIService;

	constructor(storage: IStorageService, aiService?: IAIService) {
		super();
		this.storage = storage;
		this.aiService = aiService;
	}

	/**
	 * Collect comprehensive developer context from workspace and LanceDB
	 */
	async collectContext(): Promise<DeveloperContext> {
		try {
			// Ensure storage is connected (if needed, though usually initialized in extension)
			// await this.storage.connect(); // Assuming connection is handled externally or implicitly

			// 1. Fetch recent events from LanceDB
			const recentEvents = await this.storage.getRecentEvents(100);

			// 2. Process events into context structures
			const gitContext = this.processGitEvents(recentEvents);
			const fileContext = await this.collectFileContext(recentEvents);
			const timeline = this.processTimeline(recentEvents);
			const session = this.processSession(recentEvents);

			const context: DeveloperContext = {
				git: gitContext,
				files: fileContext,
				cursor: await this.collectCursorContext(),
				timeline: timeline,
				session: session,
			};

			this.emit('contextCollected', context);
			return context;

		} catch (error: any) {
			console.error('Error collecting context:', error);
			this.emit('error', error);
			throw error;
		}
	}

	// ...

	async getLatestContextSummary(): Promise<string> {
		try {
			// 1. Get last active file
			const lastFile = await this.storage.getLastActiveFile();

			// 2. Get recent actions (chronological)
			const recentActions = await this.storage.getRecentActions(5);

			if (!lastFile && recentActions.length === 0) {
				return "I don't see any recent activity. Ready to start something new?";
			}

			// 3. If AI Service is available, generate a smart summary
			if (this.aiService && recentActions.length > 0) {
				const activityLog = recentActions.map(a => 
					`- [${new Date(a.timestamp).toLocaleTimeString()}] ${a.description}`
				).join('\n');
				
				try {
					return await this.aiService.summarize(activityLog);
				} catch (error) {
					console.warn('AI summary failed, falling back to simple summary:', error);
				}
			}

			// 4. Fallback: Simple string concatenation
			let message = "Welcome back. ";

			if (lastFile) {
				message += `You were last working on ${lastFile}.`;
			}

			if (recentActions.length > 0) {
				const lastAction = recentActions[0];
				message += ` It looks like you were: ${lastAction.description}`;
			}

			return message;

		} catch (error: any) {
			console.error('Error getting context summary:', error);
			return "Welcome back. I had some trouble retrieving your exact context, but I'm ready to help.";
		}
	}

	getCurrentFile(): string {
		return vscode.window.activeTextEditor?.document.fileName || '';
	}

	getRiskyFiles(): string[] {
		// This will be re-calculated during collectContext, but we can also expose a cached version if needed.
		// For now, let's just return what we can calculate from a fresh fetch or cache.
		// To keep it simple and stateless, we'll fetch. 
		// Optimization: Cache this if performance is an issue.
		return []; // Placeholder, actual logic is in processSession/collectContext
	}

	/**
	 * Process Git events from logs
	 */
	private processGitEvents(events: any[]): DeveloperContext['git'] {
		const commits: GitCommit[] = events
			.filter(e => e.event_type === 'git_commit')
			.map(e => {
				const meta = JSON.parse(e.metadata);
				return {
					hash: meta.hash || 'unknown',
					message: meta.message || 'No message',
					author: meta.author || 'Unknown',
					date: new Date(e.timestamp),
				};
			});

		return {
			recentCommits: commits,
			currentBranch: 'main', // TODO: Use simple-git or VS Code Git extension API for real branch
			uncommittedChanges: [], // TODO: Use simple-git for status
		};
	}

	/**
	 * Collect file-related context (VS Code API + DB History)
	 */
	private async collectFileContext(events: any[]): Promise<DeveloperContext['files']> {
		// Current Open Files (VS Code API)
		const openFiles = vscode.workspace.textDocuments
			.filter(doc => doc.uri.scheme === 'file')
			.map(doc => doc.fileName);

		const activeFile = vscode.window.activeTextEditor?.document.fileName || '';

		// Recently Edited (DB History)
		const editEvents = events.filter(e => e.event_type === 'file_edit');
		const recentlyEditedMap = new Map<string, FileEdit>();

		editEvents.forEach(e => {
			if (!recentlyEditedMap.has(e.file_path)) {
				const meta = JSON.parse(e.metadata);
				recentlyEditedMap.set(e.file_path, {
					file: e.file_path,
					timestamp: new Date(e.timestamp),
					changes: meta.changeCount || 0
				});
			}
		});

		// Edit Frequency (DB History)
		const editFrequency = new Map<string, number>();
		editEvents.forEach(e => {
			const count = editFrequency.get(e.file_path) || 0;
			editFrequency.set(e.file_path, count + 1);
		});

		return {
			openFiles,
			activeFile,
			recentlyEdited: Array.from(recentlyEditedMap.values()),
			editFrequency,
		};
	}

	/**
	 * Process Timeline (DB History)
	 */
	private processTimeline(events: any[]): DeveloperContext['timeline'] {
		const edits: EditEvent[] = events
			.filter(e => e.event_type === 'file_edit')
			.map(e => {
				const meta = JSON.parse(e.metadata);
				return {
					file: e.file_path,
					timestamp: new Date(e.timestamp),
					line: 0, // LanceDB metadata might not have line number for every edit yet, need to improve ingestion if needed
					chars: meta.changeCount || 0 // Using changeCount as proxy for "chars" or magnitude
				};
			});

		const opens: FileEvent[] = events
			.filter(e => e.event_type === 'file_open')
			.map(e => ({
				file: e.file_path,
				timestamp: new Date(e.timestamp)
			}));

		const closes: FileEvent[] = events
			.filter(e => e.event_type === 'file_close')
			.map(e => ({
				file: e.file_path,
				timestamp: new Date(e.timestamp)
			}));

		return {
			edits: edits.slice(0, 20),
			opens: opens.slice(0, 10),
			closes: closes.slice(0, 10)
		};
	}

	/**
	 * Process Session Stats
	 */
	private processSession(events: any[]): DeveloperContext['session'] {
		const editEvents = events.filter(e => e.event_type === 'file_edit');

		// Calculate risky files (edited frequently)
		const frequency = new Map<string, number>();
		editEvents.forEach(e => {
			frequency.set(e.file_path, (frequency.get(e.file_path) || 0) + 1);
		});

		const riskyFiles = Array.from(frequency.entries())
			.filter(([_, count]) => count > 5) // Threshold
			.map(([file]) => file);

		// Estimate start time (timestamp of last event in the batch, or now if empty)
		const startTime = events.length > 0 ? new Date(events[events.length - 1].timestamp) : new Date();

		return {
			startTime,
			totalEdits: editEvents.length,
			riskyFiles
		};
	}

	/**
	 * Collect cursor/selection context (VS Code API)
	 */
	private async collectCursorContext(): Promise<DeveloperContext['cursor']> {
		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			return {
				file: '',
				line: 0,
				column: 0,
				currentFunction: '',
				selectedText: '',
			};
		}

		const position = editor.selection.active;
		const selectedText = editor.document.getText(editor.selection);
		let currentFunction = '';

		try {
			// Attempt to find current function using symbols
			const symbols = await getDocumentSymbols(editor.document.uri);
			if (symbols) {
				currentFunction = findFunctionAtPosition(symbols, position) || '';
			}
		} catch (e) {
			// Ignore symbol provider errors
		}

		return {
			file: editor.document.fileName,
			line: position.line + 1,
			column: position.character + 1,
			currentFunction,
			selectedText,
		};
	}
}
