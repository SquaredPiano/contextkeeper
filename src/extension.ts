// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { getLogsWithGitlog } from "./modules/gitlogs/gitlog";
import { FileWatcher } from "./modules/gitlogs/fileWatcher";
import { LintingService } from "./modules/gitlogs/LintingService";
import { ContextIngestionService } from "./services/ingestion/ContextIngestionService";
import { storage } from "./services/storage";

// Import real services
import { ContextService } from "./services/real/ContextService";
import { GeminiService } from "./services/real/GeminiService"; // Real AI Service
import { ElevenLabsService } from "./modules/elevenlabs/elevenlabs"; // Real Voice Service
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
  IAIService,
  IVoiceService,
} from "./services/interfaces";

import { CommandManager } from "./managers/CommandManager";

// Global state
let statusBar: StatusBarManager;
let sidebarProvider: SidebarWebviewProvider;
let issuesTreeProvider: IssuesTreeProvider;
let commandManager: CommandManager;

// Services (INTEGRATION POINT: Swap mock with real services)
let contextService: ContextService;
let aiService: IAIService;
let gitService: MockGitService;
let voiceService: IVoiceService;
let lintingService: LintingService;
let ingestionService: ContextIngestionService;

// State
let currentContext: DeveloperContext | null = null;
let currentAnalysis: AIAnalysis | null = null;
let isAutonomousMode = false;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('Autonomous Copilot extension is now active!');
  
  try {
    // Initialize services
    contextService = new ContextService();
    
    // Initialize Linting Service
    lintingService = new LintingService();
    lintingService.initialize(contextService);

    // Initialize Context Ingestion Service (Real Persistence)
    const outputChannel = vscode.window.createOutputChannel("ContextKeeper Ingestion");
    ingestionService = new ContextIngestionService();
    // Don't await here to avoid blocking activation
    ingestionService.initialize(context, outputChannel).catch(err => {
      console.error("Failed to initialize ingestion service:", err);
      outputChannel.appendLine(`Error initializing ingestion: ${err.message}`);
    });
    
    // Initialize Gemini Service
    const geminiService = new GeminiService();
    aiService = geminiService;
    
    // Try to get API key from settings
    const ckConfig = vscode.workspace.getConfiguration('copilot');
    const apiKey = ckConfig.get<string>('gemini.apiKey') || process.env.GEMINI_API_KEY || "";
    
    if (apiKey) {
      geminiService.initialize(apiKey).then(() => {
        console.log("Gemini Service initialized with API Key");
      }).catch(err => {
        console.error("Failed to initialize Gemini Service:", err);
        NotificationManager.showError("Failed to connect to Gemini AI. Check your API Key.");
      });
    } else {
      console.warn("No Gemini API Key found. AI features will be disabled or mocked.");
      NotificationManager.showError("Gemini API Key missing. Please set 'contextkeeper.gemini.apiKey' in settings.");
    }

    gitService = new MockGitService();
    
    // Initialize Voice Service (Real or Mock)
    const elevenLabsApiKey = ckConfig.get<string>('elevenlabs.apiKey') || process.env.ELEVEN_LABS_API_KEY || process.env.ELEVENLABS_API_KEY || "";
    const voiceEnabled = ckConfig.get<boolean>('voice.enabled', true);

    if (voiceEnabled && elevenLabsApiKey) {
      const realVoiceService = new ElevenLabsService();
      realVoiceService.initialize(elevenLabsApiKey).then(() => {
        console.log("ElevenLabs Service initialized");
      }).catch(err => {
        console.error("Failed to initialize ElevenLabs:", err);
      });
      voiceService = realVoiceService;
    } else {
      console.log("Using Mock Voice Service (Voice disabled or no API key)");
      voiceService = new MockVoiceService();
    }

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

    // Initialize Command Manager
    commandManager = new CommandManager(
      context,
      contextService,
      aiService,
      sidebarProvider,
      statusBar,
      issuesTreeProvider
    );
    commandManager.registerCommands();

    // Add to subscriptions
    context.subscriptions.push(
      statusBar,
      treeView,
      webviewProvider,
      lintingService,
    );

    // Load autonomous mode from settings
    const config = vscode.workspace.getConfiguration('copilot');
    isAutonomousMode = config.get('autonomous.enabled', false);

    // Show welcome notification
    NotificationManager.showSuccess(
      'Autonomous Copilot is ready!',
      'Open Dashboard'
    ).then(action => {
      if (action === 'Open Dashboard') {
        vscode.commands.executeCommand('copilot.showPanel');
      }
    });

  } catch (error: any) {
    console.error("Extension activation failed:", error);
    vscode.window.showErrorMessage(`Autonomous Copilot failed to activate: ${error.message}`);
  }
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
        NotificationManager.showSuccess('Autonomous mode disabled');
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
  // Clean up linting service
  if (lintingService) {
    lintingService.dispose();
  }
  // Clean up ingestion service
  if (ingestionService) {
    ingestionService.dispose();
  }
}

