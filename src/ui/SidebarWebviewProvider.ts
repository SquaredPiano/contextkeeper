/**
 * Sidebar Dashboard Webview Provider
 * 
 * Manages the main dashboard webview in the sidebar.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { dashboardHtml } from './webview/dashboard';
import {
	DeveloperContext,
	AIAnalysis,
	ExtensionToUIMessage,
	UIToExtensionMessage,
	ExtensionState,
} from '../services/interfaces';

export class SidebarWebviewProvider implements vscode.WebviewViewProvider {
	private _view?: vscode.WebviewView;

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly onMessage: (message: UIToExtensionMessage) => void
	) {}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	): void | Thenable<void> {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri],
		};

		webviewView.webview.html = this.getHtmlContent(webviewView.webview);

		// Handle messages from webview
		webviewView.webview.onDidReceiveMessage((message: UIToExtensionMessage) => {
			this.onMessage(message);
		});
	}

	/**
	 * Post a message to the webview
	 */
	postMessage(message: ExtensionToUIMessage): void {
		if (this._view) {
			this._view.webview.postMessage(message);
		}
	}

	/**
	 * Update context in the webview
	 */
	updateContext(context: DeveloperContext): void {
		this.postMessage({
			type: 'contextUpdate',
			payload: context,
		});
	}

	/**
	 * Update analysis results in the webview
	 */
	updateAnalysis(analysis: AIAnalysis): void {
		this.postMessage({
			type: 'analysisComplete',
			payload: analysis,
		});
	}

	/**
	 * Update extension state
	 */
	updateState(state: ExtensionState): void {
		this.postMessage({
			type: 'stateChanged',
			state,
		});
	}

	/**
	 * Show error in webview
	 */
	showError(message: string): void {
		this.postMessage({
			type: 'error',
			message,
		});
	}

	/**
	 * Reveal the webview
	 */
	reveal(): void {
		if (this._view) {
			this._view.show(true);
		}
	}

	private getHtmlContent(webview: vscode.Webview): string {
		return dashboardHtml;
	}
}
