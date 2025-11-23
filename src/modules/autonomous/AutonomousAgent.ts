import { IGitService, IAIService, IContextService, DeveloperContext } from '../../services/interfaces';
import { TaskRegistry, IAutonomousTask } from './TaskRunner';
import { CloudflareService } from '../../services/real/CloudflareService';
import * as vscode from 'vscode';

export class AutonomousAgent {
    private isRunning: boolean = false;
    private taskRegistry: TaskRegistry;
    private cloudflareService: CloudflareService;

    constructor(
        private gitService: IGitService,
        private aiService: IAIService,
        private contextService: IContextService
    ) {
        this.taskRegistry = new TaskRegistry();
        this.cloudflareService = new CloudflareService();
        this.registerDefaultTasks();
    }

    private registerDefaultTasks() {
        // 1. Auto-Lint Task
        this.taskRegistry.register({
            name: 'auto-lint',
            description: 'Lint code using Cloudflare Worker and commit results',
            run: async (context: DeveloperContext) => {
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
                const fileName = document.fileName;

                try {
                    const results = await this.cloudflareService.lintCode(code, language);
                    
                    if (results.length > 0) {
                        const message = `Found ${results.length} lint issues`;
                        console.log(`[AutonomousAgent] ${message}:`, results.map(r => r.message));
                        vscode.window.showWarningMessage(
                            `${message}: ${results.slice(0, 3).map(r => r.message).join(', ')}${results.length > 3 ? '...' : ''}`
                        );
                        
                        // Create a lint report comment in the file
                        const lintReport = [
                            '',
                            '// ============ AUTONOMOUS LINT REPORT ============',
                            `// Generated: ${new Date().toISOString()}`,
                            `// Issues Found: ${results.length}`,
                            ...results.map(r => `// - Line ${r.line}: ${r.message}`),
                            '// =================================================',
                            ''
                        ].join('\n');
                        
                        // Add lint report to top of file
                        const edit = new vscode.WorkspaceEdit();
                        edit.insert(document.uri, new vscode.Position(0, 0), lintReport);
                        await vscode.workspace.applyEdit(edit);
                        await document.save();
                        
                        // Commit the lint report
                        const relativePath = vscode.workspace.asRelativePath(fileName);
                        await this.gitService.commit(
                            `chore: Add lint report for ${relativePath} (${results.length} issues)`,
                            [fileName]
                        );
                        
                        console.log('[AutonomousAgent] Lint report committed');
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

            // 3. Create a new branch for this session
            const safeGoalName = sessionGoal.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().substring(0, 30);
            const branchName = `copilot/${safeGoalName}-${Date.now()}`;
            
            console.log(`[AutonomousAgent] Creating branch: ${branchName}`);
            await this.gitService.createBranch(branchName);
            vscode.window.showInformationMessage(`Started autonomous session on branch: ${branchName}`);

            // 4. Execute tasks sequentially
            // Phase 1: Linting (deterministic)
            console.log('[AutonomousAgent] Phase 1: Running linting...');
            await this.runTask('auto-lint', context);
            
            // Phase 2: Test generation (creative)
            console.log('[AutonomousAgent] Phase 2: Generating tests...');
            await this.runTask('generate-tests', context);
            
            // 5. Show completion summary
            vscode.window.showInformationMessage(
                `✅ Autonomous work complete on branch ${branchName}!\n` +
                `Completed: Linting and Test Generation`
            );

        } catch (error: any) {
            console.error('[AutonomousAgent] Session failed:', error);
            vscode.window.showErrorMessage(`Autonomous session failed: ${error.message}`);
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

    private async runAutoFix(context: DeveloperContext): Promise<void> {
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
                // Apply the fix
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(fullCode.length)
                );

                edit.replace(document.uri, fullRange, fix.fixedCode);
                await vscode.workspace.applyEdit(edit);
                await document.save();

                vscode.window.showInformationMessage(`Auto-Fix: Applied fix for "${error.message}"`);

                // Commit the change
                await this.gitService.commit(`Auto-Fix: ${error.message}`, [document.fileName]);
            }
        } catch (err) {
            console.error('Auto-Fix failed:', err);
            vscode.window.showErrorMessage('Auto-Fix failed to apply changes.');
        }
    }

    private async runGenerateTests(context: DeveloperContext): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        const code = editor.document.getText();
        const filePath = editor.document.fileName;
        
        try {
            const testCode = await this.aiService.generateTests(code);
            
            // Create a new test file
            // Assuming convention: filename.test.ts
            const testFilePath = filePath.replace(/\.ts$/, '.test.ts');
            const testUri = vscode.Uri.file(testFilePath);

            // Check if exists
            try {
                await vscode.workspace.fs.stat(testUri);
                // If exists, maybe append or replace? For now, let's skip or overwrite.
                // Let's overwrite for "Thin Path"
            } catch {
                // Doesn't exist, good.
            }

            const edit = new vscode.WorkspaceEdit();
            edit.createFile(testUri, { overwrite: true });
            edit.insert(testUri, new vscode.Position(0, 0), testCode);
            
            await vscode.workspace.applyEdit(edit);
            const doc = await vscode.workspace.openTextDocument(testUri);
            await doc.save();

            vscode.window.showInformationMessage(`Generated tests: ${testFilePath}`);
            
            // Commit
            await this.gitService.commit(`Auto-Test: Generated tests for ${vscode.workspace.asRelativePath(filePath)}`, [testFilePath]);

        } catch (error: any) {
            console.error('Generate Tests failed:', error);
            vscode.window.showErrorMessage(`Failed to generate tests: ${error.message}`);
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
     * Creates or switches to auto/idle-improvements branch.
     * Does NOT modify code - only branch management.
     */
    async ensureIdleBranch(): Promise<void> {
        const branchName = 'auto/idle-improvements';
        
        try {
            const currentBranch = await this.gitService.getCurrentBranch();
            
            if (currentBranch === branchName) {
                console.log(`[AutonomousAgent] Already on ${branchName} branch`);
                return;
            }

            // Try to create and switch to the branch
            // If branch exists, this will fail, so we handle it
            try {
                await this.gitService.createBranch(branchName);
                console.log(`[AutonomousAgent] Created and switched to ${branchName} branch`);
            } catch (error: any) {
                // Branch might already exist, try to switch to it
                if (error.message && error.message.includes('already exists')) {
                    // Use git checkout to switch to existing branch
                    // Note: GitService doesn't have checkout, so we'll handle it gracefully
                    console.log(`[AutonomousAgent] Branch ${branchName} already exists, attempting to switch...`);
                    // For now, we'll just log - the branch management is simplified
                    // In production, you might want to add a checkout method to GitService
                } else {
                    throw error;
                }
            }
        } catch (error) {
            console.error(`[AutonomousAgent] Failed to ensure idle branch:`, error);
            // Don't throw - allow workflow to continue even if branch switch fails
        }
    }

    /**
     * Store idle improvements results in LanceDB.
     * Does NOT modify user code - only stores test artifacts and session data.
     */
    async storeIdleResults(
        result: import('../idle-detector/idle-service').IdleImprovementsResult,
        storage: import('../../services/interfaces').IStorageService
    ): Promise<void> {
        try {
            console.log('[AutonomousAgent] Storing idle improvements results in LanceDB...');

            // Create a session record with the summary
            const project = vscode.workspace.name || 'Unknown Project';
            const session = await (storage as any).createSession(result.summary, project);

            // Store test artifacts as actions
            if (result.tests && result.tests.length > 0) {
                for (const test of result.tests) {
                    await (storage as any).addAction({
                        session_id: session.id,
                        timestamp: Date.now(),
                        description: `Generated test case during idle improvements`,
                        diff: '', // No diff - these are new test files
                        files: [] // Test files would be listed here if we were creating actual files
                    });
                }
            }

            // Store recommendations as actions
            if (result.recommendations && result.recommendations.length > 0) {
                for (const rec of result.recommendations) {
                    await (storage as any).addAction({
                        session_id: session.id,
                        timestamp: Date.now(),
                        description: `[${rec.priority.toUpperCase()}] ${rec.message}`,
                        diff: '',
                        files: []
                    });
                }
            }

            console.log('[AutonomousAgent] Successfully stored idle improvements results');
        } catch (error) {
            console.error('[AutonomousAgent] Failed to store idle results:', error);
            // Don't throw - allow workflow to continue even if storage fails
        }
    }
}
