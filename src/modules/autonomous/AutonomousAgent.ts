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
            description: 'Lint code using Cloudflare Worker',
            run: async (context: DeveloperContext) => {
                console.log('Running Auto-Lint...');
                // In a real app, we'd read the active file from context
                const editor = vscode.window.activeTextEditor;
                const code = editor ? editor.document.getText() : "console.log('hello');"; 
                const language = editor ? editor.document.languageId : 'typescript';

                const results = await this.cloudflareService.lintCode(code, language);
                if (results.length > 0) {
                    vscode.window.showWarningMessage(`Lint Issues: ${results.map(r => r.message).join(', ')}`);
                } else {
                    console.log('No lint issues found.');
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
            await this.gitService.createBranch(branchName);
            vscode.window.showInformationMessage(`Started autonomous session on branch: ${branchName}`);

            // 4. Execute goal -> Map goal to tasks
            // Simple heuristic for "Thin Path":
            const lowerGoal = sessionGoal.toLowerCase();
            if (lowerGoal.includes('lint')) {
                await this.runTask('auto-lint', context);
            } else if (lowerGoal.includes('fix') || lowerGoal.includes('repair')) {
                await this.runTask('auto-fix', context);
            } else if (lowerGoal.includes('test')) {
                await this.runTask('generate-tests', context);
            } else {
                // Default: Run all
                await this.runTask('auto-lint', context);
                await this.runTask('auto-fix', context);
            }

        } catch (error: any) {
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
}
