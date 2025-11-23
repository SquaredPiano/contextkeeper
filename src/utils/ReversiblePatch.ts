import * as vscode from 'vscode';

/**
 * Represents a reversible fix that can be undone
 */
export interface ReversibleFix {
    file: vscode.Uri;
    originalText: string;
    newText: string;
    range: vscode.Range;
    documentVersion?: number; // Track document version when fix was applied
}

/**
 * Global singleton manager for reversible patches.
 * Provides undo/keep functionality similar to Cursor AI or Copilot.
 */
export class ReversiblePatchManager {
    private static instance: ReversiblePatchManager | null = null;
    private lastFix: ReversibleFix | null = null;

    private constructor() {
        // Private constructor for singleton pattern
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): ReversiblePatchManager {
        if (!ReversiblePatchManager.instance) {
            ReversiblePatchManager.instance = new ReversiblePatchManager();
        }
        return ReversiblePatchManager.instance;
    }

    /**
     * Apply a fix and show Undo/Keep prompt
     * Uses TextEditor.edit() when possible for automatic undo support,
     * falls back to WorkspaceEdit with manual tracking.
     * @param fileUri - The file URI where the fix is applied
     * @param range - The range of text to replace
     * @param newText - The new text to replace with
     * @returns Promise that resolves when the fix is applied and user makes a choice
     */
    public async applyFix(
        fileUri: vscode.Uri,
        range: vscode.Range,
        newText: string
    ): Promise<void> {
        try {
            // Open the document to get current content
            const document = await vscode.workspace.openTextDocument(fileUri);
            
            // Save the original text at the range BEFORE applying
            const originalText = document.getText(range);
            
            // Check if we have an active editor for this file (better undo support)
            const activeEditor = vscode.window.activeTextEditor;
            const isActiveEditor = activeEditor && activeEditor.document.uri.toString() === fileUri.toString();
            
            if (isActiveEditor && activeEditor) {
                // Use TextEditor.edit() - this automatically goes into VS Code's undo stack
                const success = await activeEditor.edit((editBuilder: vscode.TextEditorEdit) => {
                    editBuilder.replace(range, newText);
                });
                
                if (!success) {
                    console.error('[ReversiblePatchManager] Failed to apply edit via TextEditor');
                    vscode.window.showErrorMessage('Failed to apply fix');
                    return;
                }
                
                // Store fix info for potential manual undo (if user wants to undo via our system)
                this.lastFix = {
                    file: fileUri,
                    originalText,
                    newText,
                    range,
                    documentVersion: document.version
                };
                
                // Show Undo/Keep prompt
                // Note: VS Code's built-in undo (Cmd+Z) will also work
                try {
                    const choice = await vscode.window.showInformationMessage(
                        'Fix applied',
                        'Undo',
                        'Keep'
                    );
                    
                    if (choice === 'Undo') {
                        // Use VS Code's built-in undo command (most reliable)
                        await vscode.commands.executeCommand('undo');
                        this.clearLastFix();
                    } else if (choice === 'Keep' || choice === undefined) {
                        // User chose to keep, or dismissed (treat as keep)
                        this.clearLastFix();
                    }
                } catch (error) {
                    // Handle cancellation gracefully
                    if (error && typeof error === 'object' && 'name' in error && error.name === 'Canceled') {
                        console.log('[ReversiblePatchManager] User dismissed fix prompt - keeping fix');
                        this.clearLastFix();
                    } else {
                        throw error;
                    }
                }
            } else {
                // No active editor - use WorkspaceEdit with manual tracking
                // Create the reversible fix record BEFORE applying
            const fix: ReversibleFix = {
                file: fileUri,
                originalText,
                newText,
                    range,
                    documentVersion: document.version
            };
            
            // Store as the last fix
            this.lastFix = fix;
            
            // Create and apply the WorkspaceEdit
            const edit = new vscode.WorkspaceEdit();
            edit.replace(fileUri, range, newText);
            
            const applied = await vscode.workspace.applyEdit(edit);
            
            if (!applied) {
                console.error('[ReversiblePatchManager] Failed to apply edit');
                vscode.window.showErrorMessage('Failed to apply fix');
                    this.clearLastFix();
                return;
            }
            
                // Show Undo/Keep prompt
                try {
                    const choice = await vscode.window.showInformationMessage(
                        'Fix applied',
                        'Undo',
                        'Keep'
                    );
                    
                    if (choice === 'Undo') {
                        await this.undo();
                    } else if (choice === 'Keep' || choice === undefined) {
                        // User chose to keep, or dismissed (treat as keep)
                        this.clearLastFix();
                    }
                } catch (error) {
                    // Handle cancellation gracefully
                    if (error && typeof error === 'object' && 'name' in error && error.name === 'Canceled') {
                        console.log('[ReversiblePatchManager] User dismissed fix prompt - keeping fix');
                        this.clearLastFix();
                    } else {
                        throw error;
                    }
                }
            }
            
        } catch (error) {
            console.error('[ReversiblePatchManager] Error applying fix:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to apply fix: ${errorMsg}`);
            this.clearLastFix();
        }
    }

    /**
     * Apply a fix using a WorkspaceEdit directly (for more complex edits)
     * @param fileUri - The file URI where the fix is applied
     * @param edit - The WorkspaceEdit to apply
     * @param originalText - The original text that will be replaced (for undo)
     * @param range - The range where the edit applies
     */
    public async applyFixWithEdit(
        fileUri: vscode.Uri,
        edit: vscode.WorkspaceEdit,
        originalText: string,
        range: vscode.Range
    ): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            
            // Extract newText from the WorkspaceEdit if possible
            const edits = edit.get(fileUri);
            let newText = '';
            if (edits && edits.length > 0) {
                // Find the edit that matches our range
                for (const textEdit of edits) {
                    if (textEdit.range.intersection(range) || textEdit.range.isEqual(range)) {
                        newText = textEdit.newText;
                        break;
                    }
                }
                // If no match, use first edit's newText
                if (!newText && edits.length > 0) {
                    newText = edits[0].newText;
                }
            }
            
            // Store the fix
            const fix: ReversibleFix = {
                file: fileUri,
                originalText,
                newText,
                range,
                documentVersion: document.version
            };
            
            this.lastFix = fix;
            
            // Apply the edit
            const applied = await vscode.workspace.applyEdit(edit);
            
            if (!applied) {
                console.error('[ReversiblePatchManager] Failed to apply edit');
                vscode.window.showErrorMessage('Failed to apply fix');
                this.clearLastFix();
                return;
            }
            
            // Show Undo/Keep prompt
            try {
                const choice = await vscode.window.showInformationMessage(
                    'Fix applied',
                    'Undo',
                    'Keep'
                );
                
                if (choice === 'Undo') {
                    await this.undo();
                } else if (choice === 'Keep' || choice === undefined) {
                    // Clear after user chooses to keep, or dismissed (treat as keep)
                    this.clearLastFix();
                }
            } catch (error) {
                // Handle cancellation gracefully
                if (error && typeof error === 'object' && 'name' in error && error.name === 'Canceled') {
                    console.log('[ReversiblePatchManager] User dismissed fix prompt - keeping fix');
                    this.clearLastFix();
                } else {
                    throw error;
                }
            }
            
        } catch (error) {
            console.error('[ReversiblePatchManager] Error applying fix:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to apply fix: ${errorMsg}`);
            this.clearLastFix();
        }
    }

    /**
     * Undo the last fix by applying the reverse edit
     * Uses a robust method to find and reverse the change even if the file was modified
     */
    public async undo(): Promise<boolean> {
        if (!this.lastFix) {
            console.warn('[ReversiblePatchManager] No fix to undo');
            vscode.window.showWarningMessage('No fix to undo');
            return false;
        }

        try {
            // Re-open the document to get current state
            const document = await vscode.workspace.openTextDocument(this.lastFix.file);
            const currentText = document.getText();
            
            // Strategy 1: Try to find the newText at the original range location
            // This works if the file hasn't changed elsewhere
            const rangeStart = document.offsetAt(this.lastFix.range.start);
            const rangeEnd = document.offsetAt(this.lastFix.range.end);
            const textAtRange = currentText.substring(rangeStart, rangeEnd);
            
            if (textAtRange === this.lastFix.newText) {
                // Perfect match - the range is still valid
                const reverseEdit = new vscode.WorkspaceEdit();
                reverseEdit.replace(this.lastFix.file, this.lastFix.range, this.lastFix.originalText);
                const applied = await vscode.workspace.applyEdit(reverseEdit);
                
                if (applied) {
                    this.clearLastFix();
                    vscode.window.showInformationMessage('Fix undone');
                    return true;
                }
            }
            
            // Strategy 2: Search for the newText in the document and replace it
            // This works even if the file changed elsewhere
                const newTextIndex = currentText.indexOf(this.lastFix.newText);
                if (newTextIndex !== -1) {
                // Found the newText - replace it with originalText
                    const startPos = document.positionAt(newTextIndex);
                    const endPos = document.positionAt(newTextIndex + this.lastFix.newText.length);
                const reverseEdit = new vscode.WorkspaceEdit();
                    reverseEdit.replace(this.lastFix.file, new vscode.Range(startPos, endPos), this.lastFix.originalText);
                
                const applied = await vscode.workspace.applyEdit(reverseEdit);
                
                if (applied) {
                    this.clearLastFix();
                    vscode.window.showInformationMessage('Fix undone');
                    return true;
                }
            }
            
            // Strategy 3: Try using VS Code's undo command if we have an active editor
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document.uri.toString() === this.lastFix.file.toString()) {
                // Check if document version suggests this is still recent
                const versionDiff = activeEditor.document.version - (this.lastFix.documentVersion || 0);
                if (versionDiff <= 2) { // Only 1-2 edits since our fix
                    await vscode.commands.executeCommand('undo');
                    this.clearLastFix();
                    vscode.window.showInformationMessage('Fix undone');
                    return true;
                }
            }
            
            // Strategy 4: Fallback - try the original range anyway (might work if file is unchanged)
            const reverseEdit = new vscode.WorkspaceEdit();
                reverseEdit.replace(this.lastFix.file, this.lastFix.range, this.lastFix.originalText);
            const applied = await vscode.workspace.applyEdit(reverseEdit);
            
            if (applied) {
                this.clearLastFix();
                vscode.window.showInformationMessage('Fix undone');
                return true;
            } else {
                vscode.window.showWarningMessage('Could not undo fix - file may have been modified');
                console.warn('[ReversiblePatchManager] Undo failed - could not find or reverse the change');
                return false;
            }
            
        } catch (error) {
            console.error('[ReversiblePatchManager] Error undoing fix:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to undo fix: ${errorMsg}`);
            return false;
        }
    }

    /**
     * Check if there's a fix available to undo
     */
    public hasUndoableFix(): boolean {
        return this.lastFix !== null;
    }

    /**
     * Clear the last fix (called when user explicitly keeps the change)
     */
    public clearLastFix(): void {
        this.lastFix = null;
    }
}

