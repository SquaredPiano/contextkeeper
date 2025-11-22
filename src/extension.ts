// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { LintingService } from "./modules/gitlogs/LintingService";
import { ContextIngestionService } from "./services/ingestion/ContextIngestionService";
import { IngestionVerifier } from "./services/ingestion/IngestionVerifier";
import { AutonomousAgent } from './modules/autonomous/AutonomousAgent';
import { DashboardProvider } from './ui/DashboardProvider';
import { IdleService } from './modules/idle-detector/idle-service';
import { registerTestCommand } from './test/test-autonomous-pipeline';

// Import real services
import { ContextService } from './services/real/ContextService';
import { GeminiService } from './services/real/GeminiService';
import { GitService } from './services/real/GitService';
import { ElevenLabsService } from './modules/elevenlabs/elevenlabs';
import { LanceDBStorage } from './services/storage/storage';
// The ContextIngestionService is already imported above, so we don't duplicate it here.

// Import UI components
import { StatusBarManager } from "./ui/StatusBarManager";
import { SidebarWebviewProvider } from "./ui/SidebarWebviewProvider";
import { IssuesTreeProvider } from "./ui/IssuesTreeProvider";
import { NotificationManager } from './ui/NotificationManager';

// Import interfaces
import {
  DeveloperContext,
  AIAnalysis,
  ExtensionState,
  UIToExtensionMessage,
  IAIService,
  IGitService,
  IVoiceService,
} from "./services/interfaces";

import { CommandManager } from "./managers/CommandManager";
import { SessionManager } from "./managers/SessionManager";

// Global state
let statusBar: StatusBarManager;
let sidebarProvider: SidebarWebviewProvider;
let issuesTreeProvider: IssuesTreeProvider;
let commandManager: CommandManager;

// Services (INTEGRATION POINT: Swap mock with real services)
let contextService: ContextService;
let aiService: IAIService;
let gitService: IGitService;
let voiceService: IVoiceService;
let lintingService: LintingService;
let ingestionService: ContextIngestionService;
let idleService: IdleService;
let autonomousAgent: AutonomousAgent;

// State
let currentContext: DeveloperContext | null = null;
let currentAnalysis: AIAnalysis | null = null;
// autonomous mode is enforced by design; UI toggle removed

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  console.log('Autonomous Copilot extension is now active!');

  try {
    const geminiService = new GeminiService();
    aiService = geminiService;

    // Try to get API key from settings
    const config = vscode.workspace.getConfiguration('copilot');
    const geminiApiKey = config.get<string>('gemini.apiKey') || process.env.GEMINI_API_KEY || "";

    if (geminiApiKey) {
      await geminiService.initialize(geminiApiKey);
      console.log("Gemini Service initialized with API Key");
    } else {
      console.warn("No Gemini API Key found. AI features will be disabled.");
      NotificationManager.showError("Gemini API Key missing. Please set 'copilot.gemini.apiKey' in settings.");
    }

    // 1. Initialize Services with proper sequencing
    const storageService = new LanceDBStorage();
    
    // Initialize storage with embedding service
    await storageService.connect(geminiService);
    console.log("Storage Service initialized");
    
    contextService = new ContextService(storageService, aiService);
    const sessionManager = new SessionManager(storageService);

    // Initialize Session (Async)
    await sessionManager.initialize();
    console.log("Session Manager initialized");

    // Initialize Linting Service
    lintingService = new LintingService(); 
    lintingService.initialize(contextService);

    // Initialize Context Ingestion Service (Real Persistence)
    const outputChannel = vscode.window.createOutputChannel("ContextKeeper Ingestion");
    ingestionService = new ContextIngestionService(storageService, contextService, sessionManager);

    // Initialize ingestion service
    await ingestionService.initialize(context, outputChannel);
    console.log("Ingestion Service initialized");

    // Initialize Git Service
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    gitService = new GitService(workspaceRoot);

    // Initialize Voice Service (Real or Mock)
    const elevenLabsApiKey = config.get<string>('elevenlabs.apiKey') || process.env.ELEVEN_LABS_API_KEY || process.env.ELEVENLABS_API_KEY || "";
    const voiceEnabled = config.get<boolean>('voice.enabled', true);

    if (voiceEnabled && elevenLabsApiKey) {
      const realVoiceService = new ElevenLabsService();
      try {
        realVoiceService.initialize(elevenLabsApiKey);
        console.log("ElevenLabs Service initialized");
        voiceService = realVoiceService;
      } catch (err) {
        console.error("Failed to initialize ElevenLabs:", err);
      }
    } else {
      console.log("Using Mock Voice Service (Voice disabled or no API key)");

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

  // Send initial ElevenLabs voice state to the webview so UI reflects settings
  try {
    const config = vscode.workspace.getConfiguration('copilot');
    // Ensure sound is enabled when the extension starts
    config.update('voice.elevenEnabled', true, true).then(() => {}, () => {});
    try {
      if (voiceService && (voiceService as any).setEnabled) {
        (voiceService as any).setEnabled(true);
      }
    } catch (e) {}
    // send initial UI state (cast to any since webview message union is limited)
    (sidebarProvider as any).postMessage({ type: 'elevenVoiceState', enabled: true });
  } catch (e) {
    // ignore if webview not ready
  }

    // Set up service event listeners
    setupServiceListeners();

    // Initialize Command Manager
    commandManager = new CommandManager(
      context,
      contextService,
      aiService,
      voiceService,
      sidebarProvider,
      statusBar,
      issuesTreeProvider,
      storageService
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
    isAutonomousMode = config.get('autonomous.enabled', false);
  // Note: autonomous mode is always ON; no UI toggle required
    const config = vscode.workspace.getConfiguration('copilot');

    // Show welcome notification
    NotificationManager.showSuccess(
      'Autonomous Copilot is ready!',
      'Open Dashboard'
    ).then(async action => {
      if (action === 'Open Dashboard') {
        vscode.commands.executeCommand('copilot.showPanel');
      }

      // Announce context summary
      if (voiceService && voiceService.isEnabled()) {
        const summary = await contextService.getLatestContextSummary();
        voiceService.speak(summary, 'casual');
        NotificationManager.showSuccess(summary);
      }
    });

    // 3. Register UI Providers
    const dashboardProvider = new DashboardProvider(context.extensionUri, contextService);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(DashboardProvider.viewType, dashboardProvider)
    );

    // 4. Initialize Autonomous Agent
    autonomousAgent = new AutonomousAgent(gitService, geminiService, contextService);

    // 5. Initialize Idle Detection Service
    idleService = new IdleService(storageService, { thresholdMs: 15000 }, geminiService); // 15 seconds for demo, pass Gemini
    await idleService.initialize();
    
    // Wire idle detection to autonomous agent
    idleService.onIdle(async () => {
      console.log('ContextKeeper: Idle detected, triggering autonomous work...');
      try {
        // Run both linting and test generation when idle
        await autonomousAgent.startSession('auto-lint');
        
        if (voiceService && voiceService.isEnabled()) {
          voiceService.speak("I've completed autonomous work while you were away.", 'casual');
        }
      } catch (error) {
        console.error('Autonomous task failed:', error);
        vscode.window.showErrorMessage(`Autonomous work failed: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'}`);
      }
    });

    context.subscriptions.push(idleService);

    // Register Test Command
    registerTestCommand(context);

    // Register Verification Command
    context.subscriptions.push(
      vscode.commands.registerCommand('copilot.verifyIngestion', async () => {
        const verifier = new IngestionVerifier(ingestionService, storageService);
        await verifier.runVerification();
      })
    );

    console.log('ContextKeeper: Extension Activated');
  } catch (error) {
    console.error("Extension activation failed:", error);
    vscode.window.showErrorMessage(`Autonomous Copilot failed to activate: ${(error instanceof Error ? error.message : String(error))}`);
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
    // Update the status bar with fresh developer context
    try {
      statusBar.updateContext(context);
    } catch (e) {
      // ignore if status bar not available
    }
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
function _registerCommands(context: vscode.ExtensionContext) {
  // Analyze command
  context.subscriptions.push(
    vscode.commands.registerCommand('copilot.analyze', async () => {
      await runAnalysis();
    })
  );

  // Autonomous mode is always enabled; UI toggle removed.

  // Toggle ElevenLabs voice playback
  context.subscriptions.push(
    vscode.commands.registerCommand('copilot.toggleElevenVoice', async () => {
      const config = vscode.workspace.getConfiguration('copilot');
      const current = config.get<boolean>('voice.elevenEnabled', true);
      const next = !current;
      await config.update('voice.elevenEnabled', next, true);

      // If the runtime voice service exposes `setEnabled`, update it too
      try {
        if (voiceService && (voiceService as any).setEnabled) {
          (voiceService as any).setEnabled(next);
        }
      } catch (e) {
        // ignore
      }

      vscode.window.showInformationMessage(`ElevenLabs voice ${next ? 'enabled' : 'disabled'}`);
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
        } catch (error) {
          const errorMsg = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error);
          NotificationManager.showError(`Cannot open file: ${errorMsg}`);
        }
      }
    )
  );

  // Apply fix (placeholder for future implementation)
  context.subscriptions.push(
    vscode.commands.registerCommand('copilot.applyFix', async (_issueId: string) => {
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

  // Handle non-typed UI messages (from webview) like sound toggles
  const m = (message as any);
  if (m && m.type) {
    if (m.type === 'setElevenVoice') {
      try {
        const cfg = vscode.workspace.getConfiguration('copilot');
        cfg.update('voice.elevenEnabled', Boolean(m.enabled), true).then(() => {}, () => {});
        try { if (voiceService && (voiceService as any).setEnabled) (voiceService as any).setEnabled(Boolean(m.enabled)); } catch (e) {}
        vscode.window.showInformationMessage(`Sound ${m.enabled ? 'enabled' : 'disabled'}`);
      } catch (e) {}
    }

    if (m.type === 'ensureSoundOn') {
      try {
        const cfg = vscode.workspace.getConfiguration('copilot');
        cfg.update('voice.elevenEnabled', true, true).then(() => {}, () => {});
        try { if (voiceService && (voiceService as any).setEnabled) (voiceService as any).setEnabled(true); } catch (e) {}
        (sidebarProvider as any).postMessage({ type: 'elevenVoiceState', enabled: true });
      } catch (e) {}
    }
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
  } catch (error) {
    NotificationManager.showError(`Failed to collect context: ${(error instanceof Error ? error.message : String(error))}`);
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

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const state: ExtensionState = {
      status: 'error',
      error: errorMsg,
    };
    statusBar.setState(state);
    sidebarProvider.showError(errorMsg);

    await NotificationManager.showErrorWithRetry(
      `Analysis failed: ${errorMsg}`,
      () => runAnalysis()
    );
  }
}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log('Autonomous Copilot extension is being deactivated');
  // Clean up linting service
  // if (lintingService) {
  //     lintingService.dispose();
  // }
  // Clean up ingestion service
  if (ingestionService) {
    ingestionService.dispose();
  }
}
