// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { getLogsWithGitlog } from "./modules/gitlogs/gitlog";
import { FileWatcher } from "./modules/gitlogs/fileWatcher";

// Import mock services (INTEGRATION POINT: Replace with real services here)
import { MockContextService } from "./services/mock/MockContextService";
import { MockAIService } from "./services/mock/MockAIService";
import { MockGitService } from "./services/mock/MockGitService";
import { MockVoiceService } from "./services/mock/MockVoiceService";

// Import UI components
import { StatusBarManager } from "./ui/StatusBarManager";
import { SidebarWebviewProvider } from "./ui/SidebarWebviewProvider";
import { IssuesTreeProvider } from "./ui/IssuesTreeProvider";
import { NotificationManager } from "./ui/NotificationManager";

// Import interfaces
import {
  DeveloperContext,
  AIAnalysis,
  ExtensionState,
  UIToExtensionMessage,
} from "./services/interfaces";

// Global state
let statusBar: StatusBarManager;
let sidebarProvider: SidebarWebviewProvider;
let issuesTreeProvider: IssuesTreeProvider;

// Services (INTEGRATION POINT: Swap mock with real services)
let contextService: MockContextService;
let aiService: MockAIService;
let gitService: MockGitService;
let voiceService: MockVoiceService;

// State
let currentContext: DeveloperContext | null = null;
let currentAnalysis: AIAnalysis | null = null;
let isAutonomousMode = false;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('Autonomous Copilot extension is now active!');
  let fileWatcher: FileWatcher | null = null;

  // Initialize services with MOCK implementations
  // INTEGRATION: Replace these with real service instances when backend is ready
  contextService = new MockContextService();
  aiService = new MockAIService();
  gitService = new MockGitService();
  voiceService = new MockVoiceService();

  // Initialize UI components
  statusBar = new StatusBarManager();
  
  issuesTreeProvider = new IssuesTreeProvider();
  const treeView = vscode.window.registerTreeDataProvider(
    'copilot.issuesTree',
    issuesTreeProvider
  );

  sidebarProvider = new SidebarWebviewProvider(
    context.extensionUri,
    handleWebviewMessage
  );
  const webviewProvider = vscode.window.registerWebviewViewProvider(
    'copilot.mainView',
    sidebarProvider
  );

  // Set up service event listeners
  setupServiceListeners();

  // Register commands
  registerCommands(context);

  // Add to subscriptions
  context.subscriptions.push(
    statusBar,
    treeView,
    webviewProvider,
  );

  // Load autonomous mode from settings
  const config = vscode.workspace.getConfiguration('copilot');
  isAutonomousMode = config.get('autonomous.enabled', false);

  // Show welcome notification
  NotificationManager.showSuccess(
    '🤖 Autonomous Copilot is ready!',
    'Open Dashboard'
  ).then(action => {
    if (action === 'Open Dashboard') {
      vscode.commands.executeCommand('copilot.showPanel');
    }
  });

  // Legacy commands for backwards compatibility
  const disposable = vscode.commands.registerCommand(
    "contextkeeper.helloWorld",
    () => {
      vscode.window.showInformationMessage("Hello World from contextkeeper!");
    }
  );

  const testGitlog = vscode.commands.registerCommand(
    "contextkeeper.testGitlog",
    async () => {
      try {
        vscode.window.showInformationMessage("Fetching git logs...");

        const logs = await getLogsWithGitlog();

        const outputChannel =
          vscode.window.createOutputChannel("ContextKeeper");
        outputChannel.clear();
        outputChannel.appendLine("=== Recent Git Commits ===");
        logs.forEach((commit: any, i: number) => {
          outputChannel.appendLine(`\n${i + 1}. ${commit.subject}`);
          outputChannel.appendLine(`   Author: ${commit.authorName}`);
          outputChannel.appendLine(`   Hash: ${commit.hash}`);
          outputChannel.appendLine(`   Date: ${commit.authorDate}`);
        });
        outputChannel.show();

        vscode.window.showInformationMessage(
          `✅ Found ${logs.length} commits!`
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`❌ Error: ${err.message}`);
        console.error("Gitlog error:", err);
      }
    }
  );

  const startWatcher = vscode.commands.registerCommand(
    "contextkeeper.startAutoLint",
    () => {
      if (fileWatcher) {
        vscode.window.showWarningMessage("Auto-lint is already running!");
        return;
      }

      // Get the linting endpoint from settings (or use default)
      const config = vscode.workspace.getConfiguration("contextkeeper");
      const endpoint =
        config.get<string>("lintingEndpoint") ||
        "https://contextkeeper-worker.workers.dev/lint";

      fileWatcher = new FileWatcher(endpoint);
      fileWatcher.start();

      vscode.window.showInformationMessage(
        "🔍 Auto-lint enabled! Files will be checked on save."
      );
    }
  );

  // Command to stop auto-linting
  const stopWatcher = vscode.commands.registerCommand(
    "contextkeeper.stopAutoLint",
    () => {
      if (!fileWatcher) {
        vscode.window.showWarningMessage("Auto-lint is not running!");
        return;
      }

      fileWatcher.stop();
      fileWatcher = null;

      vscode.window.showInformationMessage("⏸️ Auto-lint disabled.");
    }
  );

  context.subscriptions.push(startWatcher);
  context.subscriptions.push(stopWatcher);
  context.subscriptions.push(testGitlog);
  context.subscriptions.push(disposable);
}

/**
 * Set up event listeners for service events
 */
function setupServiceListeners() {
  // Listen to context service events
  contextService.on('contextCollected', (context: DeveloperContext) => {
    currentContext = context;
    sidebarProvider.updateContext(context);
  });

  // Listen to AI service events
  aiService.on('analysisStarted', () => {
    const state: ExtensionState = {
      status: 'analyzing',
      progress: 0,
      message: 'Starting analysis',
    };
    statusBar.setState(state);
    sidebarProvider.updateState(state);
  });

  aiService.on('analysisProgress', (progress: number, message: string) => {
    const state: ExtensionState = {
      status: 'analyzing',
      progress,
      message,
    };
    statusBar.setState(state);
    sidebarProvider.updateState(state);
  });

  aiService.on('analysisComplete', (analysis: AIAnalysis) => {
    currentAnalysis = analysis;
    
    // Update UI components
    const state: ExtensionState = {
      status: 'complete',
      issuesFound: analysis.issues.length,
    };
    statusBar.setState(state);
    sidebarProvider.updateState(state);
    sidebarProvider.updateAnalysis(analysis);
    issuesTreeProvider.updateAnalysis(analysis);

    // Show notification
    NotificationManager.showAnalysisComplete(analysis.issues.length);

    // Voice notification if enabled
    if (voiceService.isEnabled()) {
      const message = analysis.issues.length > 0
        ? `Found ${analysis.issues.length} issues in your code.`
        : 'No issues found. Your code looks great!';
      voiceService.speak(message, 'professional');
    }
  });

  aiService.on('error', (error: Error) => {
    const state: ExtensionState = {
      status: 'error',
      error: error.message,
    };
    statusBar.setState(state);
    sidebarProvider.showError(error.message);
    NotificationManager.showError(`Analysis failed: ${error.message}`);
  });
}

/**
 * Register all extension commands
 */
function registerCommands(context: vscode.ExtensionContext) {
  // Analyze command
  context.subscriptions.push(
    vscode.commands.registerCommand('copilot.analyze', async () => {
      await runAnalysis();
    })
  );

  // Toggle autonomous mode
  context.subscriptions.push(
    vscode.commands.registerCommand('copilot.toggleAutonomous', async () => {
      isAutonomousMode = !isAutonomousMode;
      const config = vscode.workspace.getConfiguration('copilot');
      await config.update('autonomous.enabled', isAutonomousMode, true);

      if (isAutonomousMode) {
        NotificationManager.showAutonomousStarted();
      } else {
        NotificationManager.showSuccess('🤖 Autonomous mode disabled');
      }
    })
  );

  // Show panel
  context.subscriptions.push(
    vscode.commands.registerCommand('copilot.showPanel', () => {
      sidebarProvider.reveal();
    })
  );

  // Refresh context
  context.subscriptions.push(
    vscode.commands.registerCommand('copilot.refreshContext', async () => {
      await refreshContext();
    })
  );

  // Navigate to issue
  context.subscriptions.push(
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

  // Apply fix (placeholder for future implementation)
  context.subscriptions.push(
    vscode.commands.registerCommand('copilot.applyFix', async (issueId: string) => {
      NotificationManager.showSuccess('Fix application coming soon!');
    })
  );
}

/**
 * Handle messages from webview
 */
async function handleWebviewMessage(message: UIToExtensionMessage) {
  switch (message.type) {
    case 'requestContext':
      await refreshContext();
      break;

    case 'triggerAnalysis':
      await runAnalysis();
      break;

    case 'toggleAutonomous':
      await vscode.commands.executeCommand('copilot.toggleAutonomous');
      break;

    case 'navigateToIssue':
      await vscode.commands.executeCommand(
        'copilot.navigateToIssue',
        message.file,
        message.line
      );
      break;

    case 'applyFix':
      await vscode.commands.executeCommand('copilot.applyFix', message.issueId);
      break;

    case 'dismissIssue':
      // Future: implement issue dismissal
      break;
  }
}

/**
 * Refresh developer context
 */
async function refreshContext(): Promise<void> {
  try {
    const context = await contextService.collectContext();
    currentContext = context;
    sidebarProvider.updateContext(context);
  } catch (error: any) {
    NotificationManager.showError(`Failed to collect context: ${error.message}`);
  }
}

/**
 * Run code analysis
 */
async function runAnalysis(): Promise<void> {
  try {
    // Collect context first if needed
    if (!currentContext) {
      await refreshContext();
    }

    if (!currentContext) {
      throw new Error('No context available');
    }

    // Get current file content
    const editor = vscode.window.activeTextEditor;
    const code = editor ? editor.document.getText() : '';

    // Run analysis with progress
    await NotificationManager.withProgress(
      'Analyzing code...',
      async (progress) => {
        progress.report({ increment: 0, message: 'Collecting context' });
        
        // The AI service will emit progress events that update the UI
        const analysis = await aiService.analyze(code, currentContext!);
        
        progress.report({ increment: 100, message: 'Complete!' });
        return analysis;
      }
    );

  } catch (error: any) {
    const state: ExtensionState = {
      status: 'error',
      error: error.message,
    };
    statusBar.setState(state);
    sidebarProvider.showError(error.message);
    
    await NotificationManager.showErrorWithRetry(
      `Analysis failed: ${error.message}`,
      () => runAnalysis()
    );
  }
}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log('Autonomous Copilot extension is being deactivated');
}

