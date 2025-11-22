/**
 * TEMPLATE: Real Context Service
 * 
 * Copy this file and implement the TODOs to create your real ContextService.
 * This service collects actual developer context from the VSCode workspace.
 * 
 * INTEGRATION: Replace MockContextService with this in extension.ts
 */

import { EventEmitter } from 'events';
import * as vscode from 'vscode';
// import simpleGit from 'simple-git'; // TODO: npm install simple-git
import {
	IContextService,
	DeveloperContext,
	GitCommit,
	FileDiff,
	FileEdit,
	EditEvent,
	FileEvent,
} from '../interfaces';

export class ContextService extends EventEmitter implements IContextService {
	// TODO: Initialize simple-git
	// private git = simpleGit(vscode.workspace.workspaceFolders?.[0].uri.fsPath);
	
	private editFrequency: Map<string, number> = new Map();
	private editTimeline: EditEvent[] = [];
	private fileOpens: FileEvent[] = [];
	private fileCloses: FileEvent[] = [];

	constructor() {
		super();
		this.setupFileWatchers();
	}

	/**
	 * Collect comprehensive developer context from workspace
	 */
	async collectContext(): Promise<DeveloperContext> {
		try {
			// TODO: Implement real context collection
			const context: DeveloperContext = {
				git: await this.collectGitContext(),
				files: await this.collectFileContext(),
				cursor: this.collectCursorContext(),
				timeline: {
					edits: this.editTimeline.slice(-50), // Last 50 edits
					opens: this.fileOpens.slice(-20),
					closes: this.fileCloses.slice(-20),
				},
				session: {
					startTime: new Date(), // TODO: Track actual session start
					totalEdits: this.editTimeline.length,
					riskyFiles: this.getRiskyFiles(),
				},
			};

			this.emit('contextCollected', context);
			return context;

		} catch (error: any) {
			this.emit('error', error);
			throw error;
		}
	}

	getCurrentFile(): string {
		return vscode.window.activeTextEditor?.document.fileName || '';
	}

	getRiskyFiles(): string[] {
		// TODO: Return files with edit frequency > threshold (e.g., 10 edits)
		const riskyFiles: string[] = [];
		for (const [file, count] of this.editFrequency.entries()) {
			if (count >= 10) {
				riskyFiles.push(file);
			}
		}
		return riskyFiles;
	}

	/**
	 * Collect git-related context
	 */
	private async collectGitContext(): Promise<DeveloperContext['git']> {
		// TODO: Implement using simple-git
		// Example:
		// const log = await this.git.log({ maxCount: 10 });
		// const status = await this.git.status();
		
		return {
			recentCommits: [], // TODO: Map from git log
			currentBranch: 'main', // TODO: Get from status.current
			uncommittedChanges: [], // TODO: Parse status.files
		};
	}

	/**
	 * Collect file-related context
	 */
	private async collectFileContext(): Promise<DeveloperContext['files']> {
		const openFiles = vscode.workspace.textDocuments
			.filter(doc => doc.uri.scheme === 'file')
			.map(doc => doc.fileName);

		const activeFile = vscode.window.activeTextEditor?.document.fileName || '';

		// TODO: Track recently edited files with timestamps
		const recentlyEdited: FileEdit[] = [];

		return {
			openFiles,
			activeFile,
			recentlyEdited,
			editFrequency: this.editFrequency,
		};
	}

	/**
	 * Collect cursor/selection context
	 */
	private collectCursorContext(): DeveloperContext['cursor'] {
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

		// TODO: Determine current function name using symbol provider
		// const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
		//   'vscode.executeDocumentSymbolProvider',
		//   editor.document.uri
		// );

		return {
			file: editor.document.fileName,
			line: position.line + 1,
			column: position.character + 1,
			currentFunction: '', // TODO: Find function containing cursor
			selectedText,
		};
	}

	/**
	 * Set up file watchers to track edits, opens, closes
	 */
	private setupFileWatchers(): void {
		// TODO: Track document changes
		vscode.workspace.onDidChangeTextDocument(event => {
			const file = event.document.fileName;
			
			// Update edit frequency
			const count = this.editFrequency.get(file) || 0;
			this.editFrequency.set(file, count + 1);

			// Add to timeline
			event.contentChanges.forEach(change => {
				this.editTimeline.push({
					file,
					line: change.range.start.line + 1,
					timestamp: new Date(),
					chars: change.text.length,
				});
			});

			// Emit event for real-time updates
			this.emit('fileChanged', file);
		});

		// TODO: Track file opens
		vscode.workspace.onDidOpenTextDocument(doc => {
			if (doc.uri.scheme === 'file') {
				this.fileOpens.push({
					file: doc.fileName,
					timestamp: new Date(),
				});
			}
		});

		// TODO: Track file closes
		vscode.workspace.onDidCloseTextDocument(doc => {
			if (doc.uri.scheme === 'file') {
				this.fileCloses.push({
					file: doc.fileName,
					timestamp: new Date(),
				});
			}
		});
	}
}
