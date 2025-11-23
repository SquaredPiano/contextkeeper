import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Manages test file creation in a safe, non-destructive way
 * Creates test files in proper locations and uses VS Code's edit mechanism
 */
export class TestFileManager {
    private codeActionProvider: any; // Will be AICodeActionProvider
    
    constructor(codeActionProvider?: any) {
        this.codeActionProvider = codeActionProvider;
    }
    
    /**
     * Propose a test file creation (non-destructive)
     * User can accept/reject via CodeAction
     */
    async proposeTestFile(
        sourceFilePath: string,
        testContent: string,
        testFileName?: string
    ): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }
        
        // Determine test directory: workspace/tests or workspace/src/tests
        const srcExists = await this.directoryExists(path.join(workspaceRoot, 'src'));
        const testDir = srcExists 
            ? path.join(workspaceRoot, 'src', 'tests')
            : path.join(workspaceRoot, 'tests');
        
        // Generate test filename if not provided
        const finalTestFileName = testFileName || this.generateTestFileName(sourceFilePath);
        const testFilePath = path.join(testDir, finalTestFileName);
        const testUri = vscode.Uri.file(testFilePath);
        
        // Check if test file already exists
        const exists = await this.fileExists(testUri);
        
        if (exists) {
            // File exists - propose as an update/addition
            const choice = await vscode.window.showWarningMessage(
                `Test file ${finalTestFileName} already exists. What would you like to do?`,
                'View Existing',
                'Create New Version',
                'Cancel'
            );
            
            if (choice === 'View Existing') {
                const doc = await vscode.workspace.openTextDocument(testUri);
                await vscode.window.showTextDocument(doc);
                return;
            } else if (choice === 'Create New Version') {
                // Add timestamp to filename
                const timestamp = Date.now();
                const newFileName = finalTestFileName.replace(/\.test\./, `.test.${timestamp}.`);
                await this.proposeTestFile(sourceFilePath, testContent, newFileName);
                return;
            } else {
                return; // Cancel
            }
        }
        
        // Create WorkspaceEdit for new file
        const edit = new vscode.WorkspaceEdit();
        
        // Ensure test directory exists
        await this.ensureDirectory(testDir);
        
        // Create the file with content
        edit.createFile(testUri, {
            ignoreIfExists: true,
            contents: Buffer.from(testContent, 'utf8')
        });
        
        // Use CodeAction to make it accept/reject-able
        if (this.codeActionProvider) {
            this.codeActionProvider.addSuggestion(
                testUri,
                `Create test file: ${finalTestFileName}`,
                edit,
                `Generated ${testContent.split('\n').length} lines of test code`
            );
        } else {
            // Fallback: Show confirmation dialog
            const choice = await vscode.window.showInformationMessage(
                `Create test file ${finalTestFileName}?`,
                { modal: true },
                'Create',
                'Preview',
                'Cancel'
            );
            
            if (choice === 'Create') {
                const success = await vscode.workspace.applyEdit(edit);
                if (success) {
                    vscode.window.showInformationMessage(`✅ Created ${finalTestFileName}`);
                    // Open the new file
                    const doc = await vscode.workspace.openTextDocument(testUri);
                    await vscode.window.showTextDocument(doc);
                }
            } else if (choice === 'Preview') {
                // Show in new untitled document for preview
                const doc = await vscode.workspace.openTextDocument({
                    content: testContent,
                    language: this.getLanguageFromFileName(finalTestFileName)
                });
                await vscode.window.showTextDocument(doc);
            }
        }
    }
    
    /**
     * Generate test filename from source file
     */
    private generateTestFileName(sourceFilePath: string): string {
        const baseName = path.basename(sourceFilePath);
        const ext = path.extname(baseName);
        const nameWithoutExt = baseName.slice(0, -ext.length);
        
        // Common test naming conventions
        if (ext === '.ts' || ext === '.tsx') {
            return `${nameWithoutExt}.test.ts`;
        } else if (ext === '.js' || ext === '.jsx') {
            return `${nameWithoutExt}.test.js`;
        } else if (ext === '.py') {
            return `test_${nameWithoutExt}.py`;
        } else {
            return `${nameWithoutExt}.test${ext}`;
        }
    }
    
    /**
     * Get language ID from filename
     */
    private getLanguageFromFileName(fileName: string): string {
        const ext = path.extname(fileName);
        const langMap: Record<string, string> = {
            '.ts': 'typescript',
            '.tsx': 'typescriptreact',
            '.js': 'javascript',
            '.jsx': 'javascriptreact',
            '.py': 'python',
            '.java': 'java',
            '.go': 'go'
        };
        return langMap[ext] || 'plaintext';
    }
    
    /**
     * Check if file exists
     */
    private async fileExists(uri: vscode.Uri): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Check if directory exists
     */
    private async directoryExists(dirPath: string): Promise<boolean> {
        try {
            const uri = vscode.Uri.file(dirPath);
            const stat = await vscode.workspace.fs.stat(uri);
            return stat.type === vscode.FileType.Directory;
        } catch {
            return false;
        }
    }
    
    /**
     * Ensure directory exists (create if needed)
     */
    private async ensureDirectory(dirPath: string): Promise<void> {
        const uri = vscode.Uri.file(dirPath);
        try {
            await vscode.workspace.fs.createDirectory(uri);
        } catch (error) {
            // Directory might already exist, that's ok
            console.log(`[TestFileManager] Directory may already exist: ${dirPath}`);
        }
    }
}
