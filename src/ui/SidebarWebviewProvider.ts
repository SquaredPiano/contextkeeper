/**
 * Sidebar Dashboard Webview Provider
 * 
 * Manages the main dashboard webview in the sidebar.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
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
		_context: vscode.WebviewViewResolveContext,
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

	private getHtmlContent(_webview: vscode.Webview): string {
		// Load the actual dashboard.html file from the webview directory
		const htmlPath = path.join(
			this.extensionUri.fsPath,
			'src',
			'ui',
			'webview',
			'dashboard.html'
		);

		try {
			const htmlContent = fs.readFileSync(htmlPath, 'utf8');
			return htmlContent;
		} catch (error) {
			console.error('Failed to load dashboard.html:', error);
			// Fallback to a simple error message
			return `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="UTF-8">
					<title>Error</title>
				</head>
				<body>
					<h1>Failed to load dashboard</h1>
					<p>Could not find dashboard.html at: ${htmlPath}</p>
					<p>Error: ${error}</p>
				</body>
				</html>
			`;
		}
	}
}
