/**
 * Status Bar Manager
 * 
 * Manages the status bar item that shows copilot state in the bottom bar.
 * States: Idle, Analyzing, Complete, Error
 */

import * as vscode from 'vscode';
import { ExtensionState } from '../services/interfaces';

export class StatusBarManager {
	private statusBarItem: vscode.StatusBarItem;
	private currentState: ExtensionState = { status: 'idle' };

	constructor() {
		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
			100
		);
		this.statusBarItem.command = 'copilot.showPanel';
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

	private updateDisplay(): void {
		switch (this.currentState.status) {
			case 'idle':
				this.statusBarItem.text = '$(robot) Copilot: Ready';
				this.statusBarItem.backgroundColor = undefined;
				this.statusBarItem.tooltip = 'Click to open Autonomous Copilot dashboard';
				break;

			case 'analyzing':
				this.statusBarItem.text = `$(sync~spin) Copilot: ${this.currentState.message || 'Analyzing'}...`;
				this.statusBarItem.backgroundColor = undefined;
				this.statusBarItem.tooltip = `Progress: ${this.currentState.progress}%`;
				break;

			case 'complete':
				const issueText = this.currentState.issuesFound === 1 ? 'issue' : 'issues';
				this.statusBarItem.text = `$(check) Copilot: Found ${this.currentState.issuesFound} ${issueText}`;
				this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
				this.statusBarItem.tooltip = 'Analysis complete! Click to view results';
				break;

			case 'error':
				this.statusBarItem.text = '$(warning) Copilot: Error';
				this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
				this.statusBarItem.tooltip = `Error: ${this.currentState.error}`;
				break;
		}
	}

	dispose(): void {
		this.statusBarItem.dispose();
	}
}
