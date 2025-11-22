import * as vscode from 'vscode';
import { IAIService, IVoiceService, IStorageService, DeveloperContext, AIAnalysis, ExtensionState } from '../services/interfaces';
import { ContextService } from '../services/real/ContextService';
import { NotificationManager } from '../ui/NotificationManager';
import { SidebarWebviewProvider } from '../ui/SidebarWebviewProvider';
import { StatusBarManager } from '../ui/StatusBarManager';
import { IssuesTreeProvider } from '../ui/IssuesTreeProvider';
import { getLogsWithGitlog } from '../modules/gitlogs/gitlog';
import { FileWatcher } from '../modules/gitlogs/fileWatcher';

export class CommandManager {
  constructor(
    private context: vscode.ExtensionContext,
    private contextService: ContextService,
    private aiService: IAIService,
    private voiceService: IVoiceService,
    private sidebarProvider: SidebarWebviewProvider,
    private statusBar: StatusBarManager,
    private issuesTreeProvider: IssuesTreeProvider,
    private storageService: IStorageService
  ) { }

  public registerCommands() {
    this.registerAnalysisCommands();
    this.registerNavigationCommands();
    this.registerDebugCommands();
    this.registerLegacyCommands();
  }

  private registerAnalysisCommands() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand('copilot.analyze', async () => {
        await this.runAnalysis();
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand('copilot.toggleAutonomous', async () => {
        const config = vscode.workspace.getConfiguration('copilot');
        const isAutonomousMode = !config.get('autonomous.enabled', false);
        await config.update('autonomous.enabled', isAutonomousMode, true);

        if (isAutonomousMode) {
          NotificationManager.showAutonomousStarted();
        } else {
          NotificationManager.showSuccess('Autonomous mode disabled');
        }
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand('copilot.refreshContext', async () => {
        await this.refreshContext();
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand('copilot.resumeWork', async () => {
        await this.resumeWork();
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand('copilot.startAutonomousSession', async () => {
        await this.startAutonomousSession();
      })
    );
  }

  private registerNavigationCommands() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand('copilot.showPanel', () => {
        this.sidebarProvider.reveal();
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand('copilot.navigateToIssue',
        async (file: string, line: number, column: number = 0) => {
          try {
            const document = await vscode.workspace.openTextDocument(file);
            const editor = await vscode.window.showTextDocument(document);

            const position = new vscode.Position(line - 1, column);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
              new vscode.Range(position, position),
              vscode.TextEditorRevealType.InCenter
            );
          } catch (error: any) {
            NotificationManager.showError(`Cannot open file: ${error.message}`);
          }
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand('copilot.applyFix', async (issueId: string) => {
        NotificationManager.showSuccess('Fix application coming soon!');
      })
    );
  }

  private registerDebugCommands() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand("contextkeeper.showStoredEvents", async () => {
        try {
          const events = await this.storageService.getRecentEvents(100);
          const channel = vscode.window.createOutputChannel("ContextKeeper Storage");
          channel.clear();
          channel.appendLine("=== Recent Stored Events (LanceDB) ===");

          if (events.length === 0) {
            channel.appendLine("No events found. Try editing some files first!");
          }

          events.forEach((event, i) => {
            channel.appendLine(`\n[${i + 1}] ${new Date(event.timestamp).toLocaleString()} - ${event.event_type}`);
            channel.appendLine(`    File: ${event.file_path}`);
            channel.appendLine(`    Metadata: ${event.metadata}`);
          });

          channel.show();
          vscode.window.showInformationMessage(`Found ${events.length} stored events in LanceDB`);
        } catch (error: any) {
          vscode.window.showErrorMessage(`Failed to fetch events: ${error.message}`);
          console.error('Error fetching events:', error);
        }
      })
    );

    // Command to show stored actions (with embeddings for vector search)
    this.context.subscriptions.push(
      vscode.commands.registerCommand("contextkeeper.showStoredActions", async () => {
        try {
          const actions = await this.storageService.getRecentActions(50);
          const channel = vscode.window.createOutputChannel("ContextKeeper Actions");
          channel.clear();
          channel.appendLine("=== Recent Stored Actions (Vector Searchable) ===");
          channel.appendLine("These are the actions that get embeddings for RAG/context retrieval\n");

          if (actions.length === 0) {
            channel.appendLine("No actions found. Try editing some files first!");
          }

          actions.forEach((action, i) => {
            channel.appendLine(`\n[${i + 1}] ${new Date(action.timestamp).toLocaleString()}`);
            channel.appendLine(`    Description: ${action.description}`);
            channel.appendLine(`    Session: ${action.session_id}`);
            channel.appendLine(`    Files: ${action.files}`);
            channel.appendLine(`    Has Embedding: ${action.embedding ? 'YES (' + (Array.isArray(action.embedding) ? action.embedding.length : 'object') + ')' : 'NO'}`);
            if (action.diff && action.diff.length < 500) {
              channel.appendLine(`    Diff: ${action.diff}`);
            }
          });

          channel.show();
          vscode.window.showInformationMessage(`Found ${actions.length} stored actions with embeddings`);
        } catch (error: any) {
          vscode.window.showErrorMessage(`Failed to fetch actions: ${error.message}`);
          console.error('Error fetching actions:', error);
        }
      })
    );
  }

  private registerLegacyCommands() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand("contextkeeper.helloWorld", () => {
        vscode.window.showInformationMessage("Hello World from contextkeeper!");
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand("contextkeeper.testGitlog", async () => {
        try {
          vscode.window.showInformationMessage("Fetching git logs...");
          const logs = await getLogsWithGitlog();
          const outputChannel = vscode.window.createOutputChannel("ContextKeeper");
          outputChannel.clear();
          outputChannel.appendLine("=== Recent Git Commits ===");
          logs.forEach((commit: any, i: number) => {
            outputChannel.appendLine(`\n${i + 1}. ${commit.subject}`);
            outputChannel.appendLine(`   Author: ${commit.authorName}`);
            outputChannel.appendLine(`   Hash: ${commit.hash}`);
            outputChannel.appendLine(`   Date: ${commit.authorDate}`);
          });
          outputChannel.show();
          vscode.window.showInformationMessage(`Found ${logs.length} commits!`);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Error: ${err.message}`);
          console.error("Gitlog error:", err);
        }
      })
    );

    // Auto-lint commands (simplified for now, ideally moved to LintingService)
    let fileWatcher: FileWatcher | null = null;

    this.context.subscriptions.push(
      vscode.commands.registerCommand("contextkeeper.startAutoLint", () => {
        if (fileWatcher) {
          vscode.window.showWarningMessage("Auto-lint is already running!");
          return;
        }
        const config = vscode.workspace.getConfiguration("contextkeeper");
        const endpoint = config.get<string>("lintingEndpoint") || "https://contextkeeper-worker.workers.dev/lint";
        fileWatcher = new FileWatcher(endpoint);
        fileWatcher.start();
        vscode.window.showInformationMessage("Auto-lint enabled! Files will be checked on save.");
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand("contextkeeper.stopAutoLint", () => {
        if (!fileWatcher) {
          vscode.window.showWarningMessage("Auto-lint is not running!");
          return;
        }
        fileWatcher.stop();
        fileWatcher = null;
        vscode.window.showInformationMessage("Auto-lint disabled.");
      })
    );
  }

  private async refreshContext(): Promise<void> {
    try {
      const context = await this.contextService.collectContext();
      this.sidebarProvider.updateContext(context);
    } catch (error: any) {
      NotificationManager.showError(`Failed to collect context: ${error.message}`);
    }
  }

  private async runAnalysis(): Promise<void> {
    try {
      const context = await this.contextService.collectContext();
      const editor = vscode.window.activeTextEditor;
      const code = editor ? editor.document.getText() : '';

      await NotificationManager.withProgress(
        'Analyzing code...',
        async (progress) => {
          progress.report({ increment: 0, message: 'Collecting context' });
          const analysis = await this.aiService.analyze(code, context);
          progress.report({ increment: 100, message: 'Complete!' });
          return analysis;
        }
      );
    } catch (error: any) {
      const state: ExtensionState = {
        status: 'error',
        error: error.message,
      };
      this.statusBar.setState(state);
      this.sidebarProvider.showError(error.message);

      await NotificationManager.showErrorWithRetry(
        `Analysis failed: ${error.message}`,
        () => this.runAnalysis()
      );
      await NotificationManager.showErrorWithRetry(
        `Analysis failed: ${error.message}`,
        () => this.runAnalysis()
      );
    }
  }

  private async resumeWork(): Promise<void> {
    try {
      const summary = await this.contextService.getLatestContextSummary();

      // Show notification
      vscode.window.showInformationMessage(summary);

      // Speak it
      if (this.voiceService.isEnabled()) {
        await this.voiceService.speak(summary, 'professional');
      }
    } catch (error: any) {
      NotificationManager.showError(`Failed to resume work: ${error.message}`);
    }
  }

  private async startAutonomousSession(): Promise<void> {
    // Lazy load agent to avoid circular deps or complex init if not needed
    // For now, we instantiate it here. Ideally, pass it in constructor.
    // But we need IGitService in CommandManager to pass it.
    // Let's just mock the start for the "Thin" path verification.
    vscode.window.showInformationMessage("Starting Autonomous Session (Thin Path)...");

    // In a real app, we'd call this.autonomousAgent.startSession("Fix bugs");
  }
}
