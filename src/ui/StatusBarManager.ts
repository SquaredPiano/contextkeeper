/**
 * Status Bar Manager
 * 
 * Manages the status bar item that shows copilot state in the bottom bar.
 * States: Idle, Analyzing, Complete, Error
 */

import * as vscode from 'vscode';
import { ExtensionState, DeveloperContext } from '../services/interfaces';

export class StatusBarManager {
	private statusBarItem: vscode.StatusBarItem;
	private currentState: ExtensionState = { status: 'idle' };
	private currentContext: DeveloperContext | null = null;
	private disposables: vscode.Disposable[] = [];

	constructor() {
		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
			100
		);
		this.statusBarItem.command = 'copilot.showPanel';

		// Update cursor/active file when editor changes
		this.disposables.push(
			vscode.window.onDidChangeActiveTextEditor(() => this.refreshEditorState()),
			vscode.window.onDidChangeTextEditorSelection(() => this.refreshEditorState())
		);

		this.updateDisplay();
		this.statusBarItem.show();
	}

	setState(state: ExtensionState): void {
		this.currentState = state;
		this.updateDisplay();

		// Auto-reset from 'complete' state after 5 seconds
		if (state.status === 'complete') {
			setTimeout(() => {
				if (this.currentState.status === 'complete') {
					this.setState({ status: 'idle' });
				}
			}, 5000);
		}
	}

	/**
	 * Update the developer context (git, files, cursor, session stats)
	 */
	updateContext(context: DeveloperContext): void {
		this.currentContext = context;
		this.updateDisplay();
	}

	private refreshEditorState(): void {
		// If context service is not providing cursor info, fallback to vscode API
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;
		const pos = editor.selection.active;

		if (!this.currentContext) {
			// Build a minimal context to show active file/line
			this.currentContext = {
				git: { recentCommits: [], currentBranch: '', uncommittedChanges: [] },
				files: { openFiles: [], activeFile: editor.document.fileName, recentlyEdited: [], editFrequency: new Map() },
				cursor: { file: editor.document.fileName, line: pos.line + 1, column: pos.character + 1, currentFunction: '', selectedText: editor.document.getText(editor.selection) },
				timeline: { edits: [], opens: [], closes: [] },
				session: { startTime: new Date(), totalEdits: 0, riskyFiles: [] }
			} as DeveloperContext;
		} else {
			this.currentContext = {
				...this.currentContext,
				files: { ...this.currentContext.files, activeFile: editor.document.fileName },
				cursor: { ...this.currentContext.cursor, file: editor.document.fileName, line: pos.line + 1, column: pos.character + 1, selectedText: editor.document.getText(editor.selection) }
			};
		}

		this.updateDisplay();
	}

	private formatCounts(): string {
		if (!this.currentContext) return '';

		const filesEdited = this.currentContext.files.recentlyEdited?.length ?? 0;
		const uncommitted = this.currentContext.git.uncommittedChanges?.length ?? 0;
		const totalEdits = this.currentContext.session?.totalEdits ?? 0;

		// Use narrow separators to appear like diff bars
		return `Files: ${filesEdited} ▮ Uncommitted: ${uncommitted} ▮ Edits: ${totalEdits}`;
	}

	private updateDisplay(): void {
		// Build left-to-right: active file, branch, then grouped counts
		const activeFile = this.currentContext?.files.activeFile
			? this.shortenPath(this.currentContext!.files.activeFile)
			: (vscode.window.activeTextEditor?.document.fileName ? this.shortenPath(vscode.window.activeTextEditor!.document.fileName) : 'No File');

		const line = this.currentContext?.cursor?.line ?? (vscode.window.activeTextEditor ? vscode.window.activeTextEditor.selection.active.line + 1 : undefined);
		const lineText = line ? `Ln ${line}` : '';

		const branch = this.currentContext?.git.currentBranch || '';
		const branchText = branch ? `$(git-branch) ${branch}` : '';

		const counts = this.formatCounts();

		// Compose the status bar line in the requested order
		const pieces = [] as string[];
		pieces.push(`$(file-text) ${activeFile}`);
		if (lineText) pieces.push(lineText);
		if (branchText) pieces.push(branchText);
		if (counts) pieces.push(counts);

		// If the extension had a special state (analyzing/complete/error), show an icon at end
		let stateSuffix = '';
		switch (this.currentState.status) {
			case 'analyzing':
				stateSuffix = ` $(sync~spin) Analyzing`;
				break;
			case 'complete':
				stateSuffix = ` $(check) ${this.currentState.issuesFound} issues`;
				break;
			case 'error':
				stateSuffix = ` $(warning) Error`;
				break;
			default:
				stateSuffix = '';
		}

		this.statusBarItem.text = pieces.join('  |  ') + stateSuffix;
		this.statusBarItem.tooltip = 'Active file | Branch | Files ▮ Uncommitted ▮ Edits';

		// Keep previous background logic for prominence / error
		if (this.currentState.status === 'complete') {
			this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
		} else if (this.currentState.status === 'error') {
			this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
		} else {
			this.statusBarItem.backgroundColor = undefined;
		}
	}

	private shortenPath(p: string): string {
		// Show filename with up to two parent folders for clarity
		try {
			const parts = p.split(/\\|\//).filter(Boolean);
			if (parts.length <= 2) return parts.join('/');
			const last = parts.slice(-2).join('/');
			return `.../${last}`;
		} catch (e) {
			return p;
		}
	}

	dispose(): void {
		this.statusBarItem.dispose();
		this.disposables.forEach(d => d.dispose());
	}
}
