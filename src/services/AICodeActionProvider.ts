import * as vscode from 'vscode';

/**
 * Provides AI-generated code actions (Quick Fixes) that users can accept/reject
 * Similar to how GitHub Copilot shows suggestions
 */
export class AICodeActionProvider implements vscode.CodeActionProvider {
    private pendingSuggestions: Map<string, PendingSuggestion> = new Map();
    
    provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range | vscode.Selection,
        _context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<Array<vscode.CodeAction | vscode.Command>> {
        const actions: vscode.CodeAction[] = [];
        
        // Check if we have pending suggestions for this file
        const fileKey = document.uri.toString();
        const suggestion = this.pendingSuggestions.get(fileKey);
        
        if (suggestion) {
            // Create a CodeAction for applying the AI suggestion
            const applyAction = new vscode.CodeAction(
                `✨ Apply AI Suggestion: ${suggestion.title}`,
                vscode.CodeActionKind.RefactorRewrite
            );
            
            applyAction.edit = suggestion.edit;
            applyAction.isPreferred = true; // Shows at top of list
            
            actions.push(applyAction);
            
            // Also add a dismiss action
            const dismissAction = new vscode.CodeAction(
                '❌ Dismiss AI Suggestion',
                vscode.CodeActionKind.Empty
            );
            
            dismissAction.command = {
                command: 'contextkeeper.dismissAISuggestion',
                title: 'Dismiss',
                arguments: [fileKey]
            };
            
            actions.push(dismissAction);
        }
        
        return actions;
    }
    
    /**
     * Add a new AI suggestion for a file
     * This will show up as a lightbulb Quick Fix
     */
    addSuggestion(
        uri: vscode.Uri,
        title: string,
        edit: vscode.WorkspaceEdit,
        description?: string
    ): void {
        const fileKey = uri.toString();
        
        this.pendingSuggestions.set(fileKey, {
            title,
            edit,
            description,
            timestamp: Date.now()
        });
        
        // Show a subtle notification
        vscode.window.showInformationMessage(
            `💡 AI suggestion available: ${title}`,
            'Show',
            'Dismiss'
        ).then(selection => {
            if (selection === 'Show') {
                // Open the file and show Quick Fix
                vscode.workspace.openTextDocument(uri).then(doc => {
                    vscode.window.showTextDocument(doc).then(() => {
                        vscode.commands.executeCommand('editor.action.quickFix');
                    });
                });
            } else if (selection === 'Dismiss') {
                this.dismissSuggestion(fileKey);
            }
        });
    }
    
    /**
     * Dismiss a suggestion
     */
    dismissSuggestion(fileKey: string): void {
        this.pendingSuggestions.delete(fileKey);
        console.log(`[AICodeActionProvider] Dismissed suggestion for ${fileKey}`);
    }
    
    /**
     * Clear all pending suggestions
     */
    clearAll(): void {
        this.pendingSuggestions.clear();
    }
    
    /**
     * Get count of pending suggestions
     */
    getPendingCount(): number {
        return this.pendingSuggestions.size;
    }
}

interface PendingSuggestion {
    title: string;
    edit: vscode.WorkspaceEdit;
    description?: string;
    timestamp: number;
}
