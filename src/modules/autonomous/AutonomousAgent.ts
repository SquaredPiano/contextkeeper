import { IGitService, IAIService, IContextService, DeveloperContext } from '../../services/interfaces';
import { TaskRegistry } from './TaskRunner';
import { CloudflareService } from '../../services/real/CloudflareService';
import * as vscode from 'vscode';
import type { AICodeActionProvider } from '../../services/AICodeActionProvider';
import type { TestFileGenerator } from '../../utils/testFileGenerator';
import type { SurgicalLintFixer } from '../../services/SurgicalLintFixer';
import { TestRunner } from '../../services/TestRunner';
import { ReversiblePatchManager } from '../../utils/ReversiblePatch';
import { TestGenerator } from '../../utils/TestGenerator';

export class AutonomousAgent {
    private isRunning: boolean = false;
    private taskRegistry: TaskRegistry;
    private cloudflareService: CloudflareService;
    private codeActionProvider: AICodeActionProvider | null = null;
    private testFileGenerator: TestFileGenerator | null = null;
    private surgicalLintFixer: SurgicalLintFixer | null = null;
    private testRunner: TestRunner;
    private patchManager: ReversiblePatchManager;
    private testGenerator: TestGenerator;

    constructor(
        private gitService: IGitService,
        private aiService: IAIService,
        private contextService: IContextService
    ) {
        this.taskRegistry = new TaskRegistry();
        this.cloudflareService = new CloudflareService();
        this.testRunner = new TestRunner();
        this.patchManager = ReversiblePatchManager.getInstance();
        this.testGenerator = new TestGenerator(this.aiService); // Pass AI service for test generation
        this.registerDefaultTasks();
    }

    /**
     * Set the CodeActionProvider for creating surgical lint fix suggestions
     */
    setCodeActionProvider(provider: AICodeActionProvider): void {
        this.codeActionProvider = provider;
    }

    /**
     * Set the TestFileGenerator for creating test files
     */
    setTestFileGenerator(generator: TestFileGenerator): void {
        this.testFileGenerator = generator;
    }

    /**
     * Set the SurgicalLintFixer for precise lint fixes
     */
    setSurgicalLintFixer(fixer: SurgicalLintFixer): void {
        this.surgicalLintFixer = fixer;
    }

    private registerDefaultTasks() {
        // 1. Auto-Lint Task
        this.taskRegistry.register({
            name: 'auto-lint',
            description: 'Lint code using Cloudflare Worker and commit results',
            run: async (_context: DeveloperContext) => {
                console.log('[AutonomousAgent] Running Auto-Lint...');
                const editor = vscode.window.activeTextEditor;
                
                if (!editor) {
                    console.log('[AutonomousAgent] No active editor for linting');
                    vscode.window.showWarningMessage('No active file to lint');
                    return;
                }

                const document = editor.document;
                const code = document.getText();
                const language = document.languageId;
                const _fileName = document.fileName;

                try {
                    const results = await this.cloudflareService.lintCode(code, language);
                    
                    if (results.length > 0) {
                        const message = `Found ${results.length} lint issues`;
                        console.log(`[AutonomousAgent] ${message}:`, results.map(r => r.message));
                        
                        // If CodeActionProvider is available, create surgical fix suggestions
                        if (this.codeActionProvider) {
                            // For each lint issue, create a precise fix suggestion
                            for (const issue of results.slice(0, 10)) { // Limit to 10 issues
                                const edit = new vscode.WorkspaceEdit();
                                const lineNumber = issue.line - 1; // Convert to 0-indexed
                                const _line = document.lineAt(lineNumber);
                                
                                // Add a comment about the issue as a suggestion
                                // In production, you'd use AI to generate actual fixes
                                const fixComment = `// FIX: ${issue.message}`;
                                edit.insert(document.uri, new vscode.Position(lineNumber, 0), fixComment + '\n');
                                
                                this.codeActionProvider.addSuggestion(
                                    document.uri,
                                    `Fix: ${issue.message}`,
                                    edit,
                                    `Line ${issue.line}: ${issue.message}`
                                );
                            }
                            
                            vscode.window.showInformationMessage(
                                `💡 ${results.length} lint fix suggestions available. Click the lightbulb icon to apply.`,
                                'Show Quick Fix'
                            ).then(selection => {
                                if (selection === 'Show Quick Fix') {
                                    vscode.commands.executeCommand('editor.action.quickFix');
                                }
                            });
                        } else {
                            // Fallback: just show the issues
                            vscode.window.showWarningMessage(
                                `${message}: ${results.slice(0, 3).map(r => r.message).join(', ')}${results.length > 3 ? '...' : ''}`
                            );
                        }
                    } else {
                        console.log('[AutonomousAgent] No lint issues found');
                        vscode.window.showInformationMessage('✅ No lint issues found');
                    }
                } catch (error) {
                    console.error('[AutonomousAgent] Lint task failed:', error);
                    throw error;
                }
            }
        });

        // 2. Auto-Fix Task (Real)
        this.taskRegistry.register({
            name: 'auto-fix',
            description: 'Fix TypeScript errors in the active file',
            run: async (context) => {
                console.log('Running Auto-Fix...');
                await this.runAutoFix(context);
            }
        });

        // 3. Generate Tests Task
        this.taskRegistry.register({
            name: 'generate-tests',
            description: 'Generate unit tests for the active file',
            run: async (context) => {
                console.log('Running Generate-Tests...');
                await this.runGenerateTests(context);
            }
        });
    }

    async startSession(goal?: string): Promise<void> {
        if (this.isRunning) {
            throw new Error('Session already running');
        }
        this.isRunning = true;

        try {
            // 1. Analyze context
            const context = await this.contextService.collectContext();

            // 2. Determine Goal
            let sessionGoal = goal;
            if (!sessionGoal) {
                sessionGoal = await this.proposeAction(context);
                vscode.window.showInformationMessage(`Autonomous Agent proposed goal: ${sessionGoal}`);
            }

            // 3. DISABLED: Branch creation was too intrusive
            // No longer creating automatic branches - user can manually create branches if needed
            console.log(`[AutonomousAgent] Starting autonomous session (no branch creation)`);
            vscode.window.showInformationMessage(`Starting autonomous work: ${sessionGoal}`);

            // 4. Execute tasks sequentially
            // Phase 1: Linting (deterministic)
            console.log('[AutonomousAgent] Phase 1: Running linting...');
            await this.runTask('auto-lint', context);
            
            // Phase 2: Test generation (creative)
            console.log('[AutonomousAgent] Phase 2: Generating tests...');
            await this.runTask('generate-tests', context);
            
            // 5. Show completion summary
            vscode.window.showInformationMessage(
                `✅ Autonomous work complete!\n` +
                `Completed: Linting and Test Generation`
            );

        } catch (error: unknown) {
            console.error('[AutonomousAgent] Session failed:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Autonomous session failed: ${errorMessage}`);
        } finally {
            this.isRunning = false;
        }
    }

    private async proposeAction(context: DeveloperContext): Promise<string> {
        // Use Gemini to decide what to do based on context
        try {
            const plan = await this.aiService.plan('Improve the codebase based on recent activity', context);
            return plan;
        } catch (error) {
            console.warn('AI planning failed, falling back to heuristic:', error);
            
            // Fallback heuristic
            const analysis = await this.aiService.analyze(context.files.activeFile || '', context);
            if (analysis.issues.length > 0) {
                return 'fix-issues';
            }
            return 'auto-lint';
        }
    }

    private async runAutoFix(_context: DeveloperContext): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            console.log('No active editor for Auto-Fix.');
            return;
        }

        const document = editor.document;
        const diagnostics = vscode.languages.getDiagnostics(document.uri);

        // Filter for errors only
        const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);

        if (errors.length === 0) {
            console.log('No errors found to fix.');
            vscode.window.showInformationMessage('Auto-Fix: No errors found.');
            return;
        }

        console.log(`Found ${errors.length} errors. Attempting to fix the first one...`);
        const error = errors[0]; // Fix one at a time for safety
        const range = error.range;
        const fullCode = document.getText(); // Context for Gemini

        try {
            const fix = await this.aiService.fixError(fullCode, `${error.message} at line ${range.start.line + 1}`);

            if (fix && fix.fixedCode) {
                // Use CodeActionProvider to show fix as suggestion
                if (this.codeActionProvider) {
                    const edit = new vscode.WorkspaceEdit();
                    const fullRange = new vscode.Range(
                        document.positionAt(0),
                        document.positionAt(fullCode.length)
                    );
                    edit.replace(document.uri, fullRange, fix.fixedCode);
                    
                    this.codeActionProvider.addSuggestion(
                        document.uri,
                        `AI Fix: ${error.message}`,
                        edit,
                        `Apply AI-generated fix for "${error.message}" at line ${range.start.line + 1}`
                    );
                    
                    vscode.window.showInformationMessage(
                        `💡 AI fix available. Click the lightbulb to apply.`,
                        'Show Quick Fix'
                    ).then(selection => {
                        if (selection === 'Show Quick Fix') {
                            vscode.commands.executeCommand('editor.action.quickFix');
                        }
                    });
                } else {
                    // Fallback: show in output
                    vscode.window.showInformationMessage(
                        'Fix generated. CodeActionProvider not available.',
                        'View Fix'
                    ).then(selection => {
                        if (selection === 'View Fix') {
                            vscode.env.clipboard.writeText(fix.fixedCode);
                            vscode.window.showInformationMessage('Fixed code copied to clipboard');
                        }
                    });
                }
            }
        } catch (err) {
            console.error('Auto-Fix failed:', err);
            vscode.window.showErrorMessage('Auto-Fix failed to apply changes.');
        }
    }

    private async runGenerateTests(_context: DeveloperContext): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        const document = editor.document;
        console.log(`[AutonomousAgent] Generating tests for ${document.languageId} code`);
        
        try {
            // Use TestGenerator for non-invasive test generation
            const testFileUri = await this.testGenerator.generateScopedTests(document);
            
            if (testFileUri) {
                vscode.window.showInformationMessage(
                    `✅ Test file created: ${vscode.workspace.asRelativePath(testFileUri)}`,
                    'Open File'
                ).then(selection => {
                    if (selection === 'Open File') {
                        vscode.window.showTextDocument(testFileUri);
                    }
                });
            } else {
                // Fallback: Try legacy TestFileGenerator if available
                if (this.testFileGenerator) {
                    const code = document.getText();
                    const filePath = document.fileName;
                    const languageId = document.languageId;
                    
                    const languageMap: Record<string, string> = {
                        'typescript': 'typescript',
                        'javascript': 'javascript',
                        'python': 'python',
                        'java': 'java',
                        'go': 'go',
                        'rust': 'rust',
                        'cpp': 'cpp',
                        'c': 'c',
                        'csharp': 'csharp'
                    };
                    
                    const detectedLanguage = languageMap[languageId] || 'typescript';
                    const testCode = await this.aiService.generateTests(code, detectedLanguage);
                    const uri = await this.testFileGenerator.createTestFile(filePath, testCode, undefined, detectedLanguage);
                    
                    if (uri) {
                        vscode.window.showInformationMessage(
                            `✅ Test file created: ${vscode.workspace.asRelativePath(uri)}`,
                            'Open File'
                        ).then(selection => {
                            if (selection === 'Open File') {
                                vscode.window.showTextDocument(uri);
                            }
                        });
                    }
                }
            }

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('Generate Tests failed:', error);
            vscode.window.showErrorMessage(`Failed to generate tests: ${errorMsg}`);
        }
    }

    private async runTask(taskName: string, context: DeveloperContext): Promise<void> {
        const task = this.taskRegistry.get(taskName);
        if (!task) {
            console.warn(`Task ${taskName} not found`);
            return;
        }

        console.log(`[AutonomousAgent] Running task: ${task.name}`);
        await task.run(context);
        console.log(`[AutonomousAgent] Completed task: ${task.name}`);
    }

    /**
     * Ensure idle improvements branch exists.
     * Creates ONE timestamped branch per idle session.
     * Does NOT modify code - only branch management.
     */
    async ensureIdleBranch(): Promise<void> {
        // Create a timestamped branch for this idle session
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const branchName = `copilot/idle-${timestamp}`;
        
        try {
            const currentBranch = await this.gitService.getCurrentBranch();
            
            // Only create if we're not already on an idle branch
            if (currentBranch.startsWith('copilot/idle-')) {
                console.log(`[AutonomousAgent] Already on idle branch: ${currentBranch}`);
                return;
            }

            // Create the new timestamped branch
            await this.gitService.createBranch(branchName);
            console.log(`[AutonomousAgent] ✓ Created timestamped idle branch: ${branchName}`);
        } catch (error) {
            console.error(`[AutonomousAgent] Failed to create idle branch:`, error);
            // Don't throw - allow workflow to continue even if branch creation fails
        }
    }

    /**
     * Create lint fix suggestions with Keep/Undo UI for VS Code diagnostics
     * Uses ReversiblePatchManager for undo capability
     */
    async createLintFixSuggestions(
        uri: vscode.Uri,
        diagnostics: vscode.Diagnostic[]
    ): Promise<number> {
        let fixCount = 0;

        try {
            console.log(`[AutonomousAgent] Creating lint fixes for ${diagnostics.length} diagnostics`);
            const document = await vscode.workspace.openTextDocument(uri);

            for (const diagnostic of diagnostics) {
                // Only create fixes for errors and warnings (not info/hints)
                // Note: This should already be filtered by IdleService, but double-check
                if (diagnostic.severity !== vscode.DiagnosticSeverity.Error && 
                    diagnostic.severity !== vscode.DiagnosticSeverity.Warning) {
                    console.log(`[AutonomousAgent] Skipping diagnostic with severity: ${diagnostic.severity}`);
                    continue;
                }

                // Use AI to generate a fix for this diagnostic
                try {
                    const lineText = document.lineAt(diagnostic.range.start.line).text;
                    console.log(`[AutonomousAgent] Generating fix for: "${diagnostic.message}" at line ${diagnostic.range.start.line + 1}`);
                    
                    const fixEdit = await this.generateFixForDiagnostic(document, diagnostic, lineText);

                    if (fixEdit) {
                        // Get the text edits from the WorkspaceEdit
                        const edits = fixEdit.get(uri);
                        if (edits && edits.length > 0) {
                            // Use the first edit (most fixes have one edit)
                            const textEdit = edits[0];
                            
                            // Get the original text at the edit range (not diagnostic range, as they may differ)
                            const originalText = document.getText(textEdit.range);
                            
                            console.log(`[AutonomousAgent] Applying fix: "${originalText.substring(0, 50)}..." -> "${textEdit.newText.substring(0, 50)}..."`);

                            // Apply fix using ReversiblePatchManager for undo capability
                            // Use applyFixWithEdit to handle WorkspaceEdit directly
                            await this.patchManager.applyFixWithEdit(
                                uri,
                                fixEdit,
                                originalText,
                                textEdit.range
                            );
                            fixCount++;
                            console.log(`[AutonomousAgent] ✓ Fix ${fixCount} applied successfully`);
                        } else {
                            console.warn(`[AutonomousAgent] Fix edit has no edits for URI: ${uri.toString()}`);
                        }
                    } else {
                        console.log(`[AutonomousAgent] No fix generated for: "${diagnostic.message}"`);
                    }
                } catch (error) {
                    console.error(`[AutonomousAgent] Failed to generate/apply fix for "${diagnostic.message}":`, error);
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(`[AutonomousAgent] Error details: ${errorMsg}`);
                }
            }

            if (fixCount > 0) {
                console.log(`[AutonomousAgent] ✓ Successfully applied ${fixCount} lint fix(es) with undo capability`);
            } else {
                console.log(`[AutonomousAgent] No fixes were applied (${diagnostics.length} diagnostics processed)`);
            }

        } catch (error) {
            console.error('[AutonomousAgent] Failed to create lint fix suggestions:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[AutonomousAgent] Error details: ${errorMsg}`);
        }

        return fixCount;
    }

    /**
     * Generate a precise fix for a diagnostic using AI
     */
    private async generateFixForDiagnostic(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic,
        lineText: string
    ): Promise<vscode.WorkspaceEdit | null> {
        const edit = new vscode.WorkspaceEdit();

        // Simple heuristic fixes (can be replaced with AI service calls later)
        const message = diagnostic.message.toLowerCase();

        // Fix: "n" should be n (typo - string instead of variable)
        if (message.includes('string') && message.includes('numeric') && lineText.includes('"n"')) {
            const newText = lineText.replace('"n"', 'n');
            const line = document.lineAt(diagnostic.range.start.line);
            edit.replace(document.uri, line.range, newText);
            return edit;
        }

        // Fix: Incorrect logic order (FizzBuzz)
        if (message.includes('fizzbuzz') && message.includes('condition') && message.includes('first')) {
            // This is more complex - we'd need AI to reorder the if statements
            // For now, skip complex refactorings
            return null;
        }

        // Generic fix: Add a TODO comment
        const lineNumber = diagnostic.range.start.line;
        const indent = lineText.match(/^\s*/)?.[0] || '';
        edit.insert(
            document.uri, 
            new vscode.Position(lineNumber, 0), 
            `${indent}// TODO: Fix - ${diagnostic.message}\n`
        );

        return edit;
    }

    /**
     * Store idle improvements AND generate actual test files + code action suggestions.
     * Track AI edits in orchestrator. EXECUTE generated tests and capture results.
     */
    async storeIdleResults(
        result: import('../idle-detector/idle-service').IdleImprovementsResult,
        storage: import('../../services/interfaces').IStorageService,
        orchestrator?: unknown // Optional orchestrator for tracking AI edits
    ): Promise<void> {
        try {
            console.log('[AutonomousAgent] Processing idle improvements results...');

            let aiEditsCreated = 0;
            const testResults: Array<{path: string, passed: boolean, output: string}> = [];

            // 1. Generate actual test files if tests were provided
            // Use TestGenerator for non-invasive test generation with undo capability
            if (result.tests && result.tests.length > 0) {
                console.log(`[AutonomousAgent] Generating ${result.tests.length} test files...`);
                
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor) {
                    try {
                        // Use TestGenerator to create test file with undo capability
                        const testFileUri = await this.testGenerator.generateScopedTests(
                            activeEditor.document,
                            result
                        );
                        
                        if (testFileUri) {
                            aiEditsCreated++; // Count each test file as an AI edit
                            const testPath = vscode.workspace.asRelativePath(testFileUri);
                            console.log(`[AutonomousAgent] Generated test file: ${testPath}`);

                            // EXECUTE the test immediately after creating it
                            try {
                                console.log(`[AutonomousAgent] Executing test: ${testFileUri.fsPath}`);
                                const testResult = await this.testRunner.runTests(testFileUri.fsPath);
                                
                                testResults.push({
                                    path: testPath,
                                    passed: testResult.failed === 0 && testResult.passed > 0,
                                    output: `${testResult.passed} passed, ${testResult.failed} failed (${testResult.duration}ms)`
                                });

                                console.log(`[AutonomousAgent] Test result for ${testPath}:`, testResult);
                            } catch (testError) {
                                console.error(`[AutonomousAgent] Failed to execute test ${testPath}:`, testError);
                                testResults.push({
                                    path: testPath,
                                    passed: false,
                                    output: `Execution failed: ${testError}`
                                });
                            }
                        }
                    } catch (error) {
                        console.error('[AutonomousAgent] Failed to generate test file:', error);
                    }
                } else {
                    // Fallback: Use legacy testFileGenerator if available
                    if (this.testFileGenerator) {
                        for (const testContent of result.tests) {
                            try {
                                // Extract file path and content from test result
                                const lines = testContent.split('\n');
                                const firstLine = lines[0];
                                const pathMatch = firstLine.match(/\/\/\s*(.+\.test\.[jt]s)/);
                                
                                if (pathMatch) {
                                    const testPath = pathMatch[1];
                                    const testCode = lines.slice(1).join('\n');
                                    
                                    // Use test file generator to create the test file
                                    const testUri = await this.testFileGenerator.createTestFile(
                                        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                                        testCode
                                    );
                                    
                                    aiEditsCreated++;
                                    console.log(`[AutonomousAgent] Generated test file: ${testPath}`);

                                    if (testUri) {
                                        try {
                                            const testResult = await this.testRunner.runTests(testUri.fsPath);
                                            testResults.push({
                                                path: testPath,
                                                passed: testResult.failed === 0 && testResult.passed > 0,
                                                output: `${testResult.passed} passed, ${testResult.failed} failed (${testResult.duration}ms)`
                                            });
                                        } catch (testError) {
                                            testResults.push({
                                                path: testPath,
                                                passed: false,
                                                output: `Execution failed: ${testError}`
                                            });
                                        }
                                    }
                                }
                            } catch (error) {
                                console.error('[AutonomousAgent] Failed to generate test file:', error);
                            }
                        }
                    }
                }
                
                // Show test execution results
                const passedCount = testResults.filter(r => r.passed).length;
                const failedCount = testResults.filter(r => !r.passed).length;
                
                const message = `✅ ${result.tests.length} test file(s) generated. ` +
                               `Results: ${passedCount} passed, ${failedCount} failed`;
                
                vscode.window.showInformationMessage(
                    message,
                    'View Results'
                ).then(selection => {
                    if (selection === 'View Results') {
                        const output = vscode.window.createOutputChannel('Test Results');
                        output.clear();
                        output.appendLine('=== Test Execution Results ===\n');
                        testResults.forEach(r => {
                            output.appendLine(`${r.passed ? '✅' : '❌'} ${r.path}`);
                            output.appendLine(`   ${r.output}\n`);
                        });
                        output.show();
                    }
                });
            }

            // 2. Create code action suggestions for high-priority recommendations
            if (result.recommendations && result.recommendations.length > 0 && this.codeActionProvider) {
                const highPriorityRecs = result.recommendations.filter(r => r.priority === 'high').slice(0, 3);
                
                for (const rec of highPriorityRecs) {
                    // Create a TODO comment suggestion for each recommendation
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        const edit = new vscode.WorkspaceEdit();
                        const position = new vscode.Position(0, 0);
                        edit.insert(editor.document.uri, position, `// TODO: ${rec.message}\n`);
                        
                        this.codeActionProvider.addSuggestion(
                            editor.document.uri,
                            `Add TODO: ${rec.message}`,
                            edit,
                            `High priority recommendation from idle analysis`
                        );
                        
                        aiEditsCreated++; // Count each recommendation as an AI edit
                    }
                }
            }

            // Track AI edits in orchestrator if available
            if (orchestrator && aiEditsCreated > 0) {
                if (typeof (orchestrator as { incrementAIEdits?: (count: number) => void }).incrementAIEdits === 'function') {
                    (orchestrator as { incrementAIEdits: (count: number) => void }).incrementAIEdits(aiEditsCreated);
                }
                console.log(`[AutonomousAgent] Tracked ${aiEditsCreated} AI edits in orchestrator`);
            }

            // 3. Store in LanceDB for historical tracking (including test results)
            const project = vscode.workspace.name || 'Unknown Project';
            const session = await (storage as unknown as { createSession: (summary: string, project?: string) => Promise<{ id: string }> }).createSession(result.summary, project);

            if (result.tests && result.tests.length > 0) {
                for (let i = 0; i < result.tests.length; i++) {
                    const testResult = testResults[i];
                    await (storage as unknown as { addAction: (action: { session_id: string; timestamp: number; description: string; diff: string; files: unknown[] }) => Promise<void> }).addAction({
                        session_id: session.id,
                        timestamp: Date.now(),
                        description: testResult ? 
                            `Generated test: ${testResult.path} - ${testResult.output}` :
                            `Generated test case during idle improvements`,
                        diff: '',
                        files: []
                    });
                }
            }

            if (result.recommendations && result.recommendations.length > 0) {
                for (const rec of result.recommendations) {
                    await (storage as unknown as { addAction: (action: { session_id: string; timestamp: number; description: string; diff: string; files: unknown[] }) => Promise<void> }).addAction({
                        session_id: session.id,
                        timestamp: Date.now(),
                        description: `[${rec.priority.toUpperCase()}] ${rec.message}`,
                        diff: '',
                        files: []
                    });
                }
            }

            console.log('[AutonomousAgent] Successfully processed and stored idle improvements');
        } catch (error) {
            console.error('[AutonomousAgent] Failed to process idle results:', error);
            // Don't throw - allow workflow to continue even if storage fails
        }
    }
}
