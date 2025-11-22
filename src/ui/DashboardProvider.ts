import * as vscode from 'vscode';
import { IContextService, DeveloperContext } from '../services/interfaces';

export class DashboardProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'contextkeeper.dashboard';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _contextService: IContextService
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Listen for messages from the UI
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'refreshContext':
                    await this.refreshContext();
                    break;
            }
        });

        // Initial refresh
        this.refreshContext();
    }

    private async refreshContext() {
        if (this._view) {
            const context = await this._contextService.collectContext();
            this._view.webview.postMessage({ type: 'updateContext', payload: context });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Simple "Thin Path" HTML
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ContextKeeper Dashboard</title>
            <style>
                body { font-family: var(--vscode-font-family); padding: 10px; color: var(--vscode-editor-foreground); }
                .card { background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border); padding: 10px; margin-bottom: 10px; border-radius: 4px; }
                h2 { font-size: 14px; margin-top: 0; }
                .stat { font-size: 24px; font-weight: bold; }
                button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 5px 10px; cursor: pointer; }
                button:hover { background: var(--vscode-button-hoverBackground); }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Current Session</h2>
                <div id="session-stats">Loading...</div>
            </div>
            <div class="card">
                <h2>Active Context</h2>
                <div id="active-file">None</div>
            </div>
            <button id="refresh-btn">Refresh Context</button>

            <script>
                const vscode = acquireVsCodeApi();
                
                document.getElementById('refresh-btn').addEventListener('click', () => {
                    vscode.postMessage({ type: 'refreshContext' });
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'updateContext':
                            const context = message.payload;
                            document.getElementById('active-file').innerText = context.files.activeFile || 'None';
                            document.getElementById('session-stats').innerText = \`\${context.session.totalEdits} edits\`;
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
    }
}
