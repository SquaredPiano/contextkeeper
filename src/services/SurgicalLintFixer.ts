import * as vscode from 'vscode';
import type { AICodeActionProvider } from './AICodeActionProvider';

export interface LintIssue {
    file: string;
    line: number;
    column: number;
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestedFix?: string;
}

/**
 * Surgical Lint Fixer - creates precise CodeActions for each lint issue
 * Works only on files in the user's recent context (what they were actually editing)
 */
export class SurgicalLintFixer {
    constructor(private codeActionProvider: AICodeActionProvider) {}

    /**
     * Create surgical fix suggestions for lint issues
     * @param issues - Lint issues from Cloudflare worker or local linter
     * @param recentFiles - Files the user was actually working on (from context)
     */
    async createFixSuggestions(issues: LintIssue[], recentFiles: string[]): Promise<number> {
        let fixCount = 0;

        // Group issues by file
        const issuesByFile = new Map<string, LintIssue[]>();
        for (const issue of issues) {
            // Only process files in user's recent context
            const isRecentFile = recentFiles.some(f => f.includes(issue.file) || issue.file.includes(f));
            if (!isRecentFile) {
                console.log(`[SurgicalLintFixer] Skipping ${issue.file} - not in recent context`);
                continue;
            }

            if (!issuesByFile.has(issue.file)) {
                issuesByFile.set(issue.file, []);
            }
            issuesByFile.get(issue.file)!.push(issue);
        }

        // Create CodeAction for each issue
        for (const [filePath, fileIssues] of issuesByFile) {
            const uri = vscode.Uri.file(filePath);
            
            // Open document to create precise edits
            let document: vscode.TextDocument;
            try {
                document = await vscode.workspace.openTextDocument(uri);
            } catch (error) {
                console.warn(`[SurgicalLintFixer] Could not open ${filePath}:`, error);
                continue;
            }

            for (const issue of fileIssues) {
                try {
                    const fix = await this.generateSurgicalFix(document, issue);
                    if (fix) {
                        this.codeActionProvider.addSuggestion(
                            uri,
                            `Fix: ${issue.message}`,
                            fix,
                            `Line ${issue.line}: ${issue.message}`
                        );
                        fixCount++;
                    }
                } catch (error) {
                    console.warn(`[SurgicalLintFixer] Failed to generate fix for ${issue.message}:`, error);
                }
            }
        }

        console.log(`[SurgicalLintFixer] Created ${fixCount} surgical fix suggestions`);
        return fixCount;
    }

    /**
     * Generate a precise WorkspaceEdit for a single lint issue
     * This is the "surgical" part - we edit only the specific line/range, not the whole file
     */
    private async generateSurgicalFix(
        document: vscode.TextDocument, 
        issue: LintIssue
    ): Promise<vscode.WorkspaceEdit | null> {
        const edit = new vscode.WorkspaceEdit();
        const lineNumber = issue.line - 1; // Convert to 0-indexed

        if (lineNumber < 0 || lineNumber >= document.lineCount) {
            console.warn(`[SurgicalLintFixer] Invalid line number ${issue.line}`);
            return null;
        }

        const line = document.lineAt(lineNumber);
        const lineText = line.text;

        // Apply specific fixes based on the issue message
        let fixedText: string | null = null;

        // 1. Remove console.log
        if (issue.message.includes('console.log')) {
            fixedText = lineText.replace(/console\.log\([^)]*\);?/, '// Removed console.log');
        }
        
        // 2. Add missing semicolon
        else if (issue.message.includes('semicolon') || issue.message.includes('Missing semicolon')) {
            fixedText = lineText.trimEnd() + ';';
        }
        
        // 3. Fix unused variable (comment it out)
        else if (issue.message.includes('unused') || issue.message.includes('never used')) {
            fixedText = '// ' + lineText;
        }
        
        // 4. Use suggested fix if provided
        else if (issue.suggestedFix) {
            fixedText = issue.suggestedFix;
        }
        
        // 5. Generic fix: add comment explaining the issue
        else {
            const indent = lineText.match(/^\s*/)?.[0] || '';
            fixedText = `${indent}// TODO: Fix lint issue - ${issue.message}\n${lineText}`;
        }

        if (fixedText !== null) {
            // Replace the entire line
            const range = new vscode.Range(
                new vscode.Position(lineNumber, 0),
                new vscode.Position(lineNumber, lineText.length)
            );
            edit.replace(document.uri, range, fixedText);
            return edit;
        }

        return null;
    }

    /**
     * Analyze VS Code diagnostics (TypeScript errors, ESLint, etc.) and create fix suggestions
     * This allows us to fix real compile errors, not just custom lint rules
     */
    async analyzeVSCodeDiagnostics(recentFiles: string[]): Promise<number> {
        let fixCount = 0;

        for (const filePath of recentFiles) {
            const uri = vscode.Uri.file(filePath);
            const diagnostics = vscode.languages.getDiagnostics(uri);

            if (diagnostics.length === 0) {
                continue;
            }

            // Filter to errors and warnings only
            const relevantDiagnostics = diagnostics.filter(d => 
                d.severity === vscode.DiagnosticSeverity.Error || 
                d.severity === vscode.DiagnosticSeverity.Warning
            );

            if (relevantDiagnostics.length === 0) {
                continue;
            }

            let document: vscode.TextDocument;
            try {
                document = await vscode.workspace.openTextDocument(uri);
            } catch (error) {
                console.warn(`[SurgicalLintFixer] Could not open ${filePath}:`, error);
                continue;
            }

            // Create a CodeAction for each diagnostic
            for (const diagnostic of relevantDiagnostics.slice(0, 10)) { // Limit to 10 per file
                const edit = new vscode.WorkspaceEdit();
                
                // For now, just add a comment about the issue
                // In production, you'd use AI to generate actual fixes
                const line = document.lineAt(diagnostic.range.start.line);
                const indent = line.text.match(/^\s*/)?.[0] || '';
                const comment = `${indent}// FIX: ${diagnostic.message}`;
                
                edit.insert(
                    uri, 
                    new vscode.Position(diagnostic.range.start.line, 0), 
                    comment + '\n'
                );

                this.codeActionProvider.addSuggestion(
                    uri,
                    `Fix: ${diagnostic.message.slice(0, 60)}`,
                    edit,
                    `Line ${diagnostic.range.start.line + 1}: ${diagnostic.message}`
                );
                
                fixCount++;
            }
        }

        console.log(`[SurgicalLintFixer] Created ${fixCount} fixes from VS Code diagnostics`);
        return fixCount;
    }
}
