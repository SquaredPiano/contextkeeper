// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import simpleGit from "simple-git";

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
import { MockVoiceService } from './services/mock/MockVoiceService';
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
  ExtensionToUIMessage,
  IAIService,
  IGitService,
  IVoiceService,
  CopilotBranch,
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
// autonomous mode is enforced by design; UI toggle removed

// Recent changes recorded by the extension (to show what ran while UI was closed)
const extensionChanges: Array<{ time: number; description: string; action?: string; actor?: string }> = [];

function recordChange(description: string, action: string = 'action', actor: string = 'extension'){
  try{
    extensionChanges.unshift({ time: Date.now(), description, action, actor });
    if (extensionChanges.length > 200) {
      extensionChanges.pop();
    }
    // push to webview if available
    try {
      sidebarProvider.postMessage({ type: 'extensionChanges', payload: extensionChanges });
    } catch{}
  } catch{}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  console.log('Autonomous Copilot extension is now active!');

  // Load environment variables from .env.local (use extensionPath for proper path resolution)
  try {
    const envPath = path.join(context.extensionPath, '.env.local');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      console.log('Loaded .env.local from extension path');
    } else {
      // Fallback to workspace root
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (workspaceRoot) {
        const fallbackEnvPath = path.join(workspaceRoot, '.env.local');
        if (fs.existsSync(fallbackEnvPath)) {
          dotenv.config({ path: fallbackEnvPath });
          console.log('Loaded .env.local from workspace root');
        }
      }
    }
  } catch (error) {
    console.warn('Failed to load .env.local:', error);
  }

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
        // Fallback to mock service if initialization fails
        voiceService = new MockVoiceService();
        console.log("Fell back to Mock Voice Service");
      }
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

  // Send initial ElevenLabs voice state to the webview so UI reflects settings
  try {
    // Reuse the config variable declared earlier (line 89)
    // Ensure sound is enabled when the extension starts
    config.update('voice.elevenEnabled', true, true).then(() => {}, () => {});
    // send initial UI state
    sidebarProvider.postMessage({ type: 'elevenVoiceState', enabled: true });
    try {
      recordChange('ElevenLabs voice enabled on startup', 'voice');
    } catch {}
    // send initial notifications state
    try {
      const notifEnabled = config.get<boolean>('notifications.enabled', true);
      sidebarProvider.postMessage({ type: 'notificationsState', enabled: Boolean(notifEnabled) });
    } catch {}
  } catch {
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

    // Note: autonomous mode is always ON; no UI toggle required

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

    // 5. Initialize Orchestrator for idle improvements
    const cloudflareWorkerUrl = config.get<string>('cloudflare.workerUrl') || process.env.CLOUDFLARE_WORKER_URL || '';
    const orchestratorConfig = {
      cloudflareWorkerUrl,
      geminiApiKey: geminiApiKey || '',
      analyzeAllFiles: false,
      maxFilesToAnalyze: 10
    };
    
    // Only initialize Orchestrator if we have required config
    let orchestrator: any = null;
    if (cloudflareWorkerUrl && geminiApiKey) {
      try {
        const orchestratorModule = await import('./modules/orchestrator/orchestrator');
        const { Orchestrator } = orchestratorModule;
        orchestrator = new Orchestrator(orchestratorConfig);
        await orchestrator.initialize();
        console.log('Orchestrator initialized for idle improvements');
      } catch (error) {
        console.warn('Failed to initialize Orchestrator:', error);
        orchestrator = null;
      }
    } else {
      console.warn('Orchestrator not initialized: missing cloudflare.workerUrl or gemini.apiKey');
    }

    // 6. Initialize Idle Detection Service
    // SAFETY: Check if autonomous mode is enabled before starting
    const autonomousEnabled = config.get<boolean>('autonomous.enabled', false);
    
    idleService = new IdleService(storageService, { thresholdMs: 15000 }, geminiService); // 15 seconds threshold
    
    // Only wire up autonomous features if explicitly enabled
    if (autonomousEnabled && orchestrator && autonomousAgent) {
      idleService.setWorkflowServices(orchestrator, autonomousAgent);
      
      // NEW: Wire up UI callback to display idle improvements
      idleService.onIdleImprovementsComplete((result) => {
        console.log('[Extension] Idle improvements complete, updating UI...');
        
        // Send result to sidebar webview
        try {
          const message: ExtensionToUIMessage = {
            type: 'idleImprovementsComplete',
            payload: {
              summary: result.summary,
              testsGenerated: result.tests.length,
              recommendations: result.recommendations,
              timestamp: Date.now()
            }
          };
          
          sidebarProvider.postMessage(message);
          recordChange(`Idle analysis: ${result.summary}`, 'idle-improvements', 'autonomous');
          
          if (result.tests.length > 0) {
            recordChange(`Generated ${result.tests.length} test file(s)`, 'test-generation', 'autonomous');
          }
          
          result.recommendations.slice(0, 5).forEach(rec => {
            recordChange(`[${rec.priority.toUpperCase()}] ${rec.message}`, 'recommendation', 'autonomous');
          });
        } catch (error) {
          console.error('[Extension] Failed to send idle improvements to UI:', error);
        }
      });
    } else if (autonomousEnabled) {
      // Fallback to legacy callback if orchestrator not available (only if enabled)
      idleService.onIdle(async () => {
        console.log('ContextKeeper: Idle detected, triggering legacy autonomous work...');
        try {
          await autonomousAgent.startSession('auto-lint');
          
          if (voiceService && voiceService.isEnabled()) {
            voiceService.speak("I've completed autonomous work while you were away.", 'casual');
          }
        } catch (error) {
          console.error('Autonomous task failed:', error);
          vscode.window.showErrorMessage(`Autonomous work failed: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'}`);
        }
      });
    } else {
      console.log('[Extension] Autonomous mode is disabled. Set copilot.autonomous.enabled to true to enable.');
    }
    
    await idleService.initialize();
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
  // Safety check: ensure services are initialized
  if (!contextService || !aiService) {
    console.warn('setupServiceListeners: Services not fully initialized yet');
    return;
  }

  // Listen to context service events
  contextService.on('contextCollected', (context: DeveloperContext) => {
    currentContext = context;
    sidebarProvider.updateContext(context);
    // Update the status bar with fresh developer context
    try {
      statusBar.updateContext(context);
    } catch {
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
    if (voiceService && voiceService.isEnabled()) {
      const message = analysis.issues.length > 0
        ? `Found ${analysis.issues.length} issues in your code.`
        : 'No issues found. Your code looks great!';
      voiceService.speak(message, 'professional');
    }

    // Record this action so the webview can show it later
    try {
      recordChange(`Analysis completed — ${analysis.issues.length} issues`, 'analysis');
    } catch {}
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
      // Note: IVoiceService doesn't define setEnabled, so we skip runtime updates

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

    case 'setAutonomyDelay':
      try {
        // Update idle service threshold
        if (idleService) {
          idleService.updateThreshold(message.seconds * 1000);
        }
        // Store in settings for persistence
        const config = vscode.workspace.getConfiguration('copilot');
        await config.update('autonomous.idleTimeout', message.seconds, true);
        console.log(`[Extension] Updated autonomy delay to ${message.seconds}s`);
      } catch (error) {
        console.error('Failed to update autonomy delay:', error);
      }
      break;

    case 'setElevenVoice':
      try {
        const cfg = vscode.workspace.getConfiguration('copilot');
        await cfg.update('voice.elevenEnabled', message.enabled, true);
        if (voiceService && (voiceService as any).setEnabled) {
          (voiceService as any).setEnabled(message.enabled);
        }
        vscode.window.showInformationMessage(`Sound ${message.enabled ? 'enabled' : 'disabled'}`);
        recordChange(`ElevenLabs voice ${message.enabled ? 'enabled' : 'disabled'}`, 'voice');
        // Send state back to webview
        sidebarProvider.postMessage({ type: 'elevenVoiceState', enabled: message.enabled });
      } catch (error) {
        console.error('Failed to update voice setting:', error);
      }
      break;

    case 'setNotifications':
      try {
        const cfg = vscode.workspace.getConfiguration('copilot');
        await cfg.update('notifications.enabled', message.enabled, true);
        if ((NotificationManager as any)?.setEnabled) {
          (NotificationManager as any).setEnabled(message.enabled);
        }
        vscode.window.showInformationMessage(`Notifications ${message.enabled ? 'enabled' : 'disabled'}`);
        recordChange(`Notifications ${message.enabled ? 'enabled' : 'disabled'}`, 'notifications');
        // Send state back to webview
        sidebarProvider.postMessage({ type: 'notificationsState', enabled: message.enabled });
      } catch (error) {
        console.error('Failed to update notifications setting:', error);
      }
      break;

    case 'ensureSoundOn':
      try {
        const cfg = vscode.workspace.getConfiguration('copilot');
        await cfg.update('voice.elevenEnabled', true, true);
        if (voiceService && (voiceService as any).setEnabled) {
          (voiceService as any).setEnabled(true);
        }
        sidebarProvider.postMessage({ type: 'elevenVoiceState', enabled: true });
      } catch (error) {
        console.error('Failed to ensure sound on:', error);
      }
      break;

    case 'requestCopilotBranches':
      await refreshCopilotBranches();
      break;

    case 'checkoutCopilotBranch':
      await checkoutCopilotBranch(message.branchName);
      break;

    case 'mergeCopilotBranch':
      console.log('[Extension] Received mergeCopilotBranch message:', message.branchName);
      await mergeCopilotBranch(message.branchName);
      break;

    case 'deleteCopilotBranch':
      console.log('[Extension] Received deleteCopilotBranch message:', message.branchName);
      await deleteCopilotBranch(message.branchName);
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

/**
 * Refresh copilot branches and send to webview
 */
async function refreshCopilotBranches(): Promise<void> {
  try {
    if (!gitService) {
      console.warn('GitService not available');
      return;
    }

    const allBranches = await gitService.getBranches();
    const currentBranch = await gitService.getCurrentBranch();
    const copilotBranches = allBranches.filter(b => b.startsWith('copilot/'));

    // Get commit info for each branch using git log with branch name
    const branchInfo: CopilotBranch[] = await Promise.all(
      copilotBranches.map(async (branchName) => {
        try {
          // Use simple-git to get log for specific branch without checking out
          const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
          const git = simpleGit(workspaceRoot);
          const log = await git.log({ from: branchName, maxCount: 1 });
          
          return {
            name: branchName,
            lastCommit: log.latest?.message || 'No commits',
            lastCommitDate: log.latest?.date ? new Date(log.latest.date) : new Date(),
            commitCount: log.total || 0,
            isCurrent: branchName === currentBranch
          };
        } catch (error) {
          console.warn(`Failed to get info for branch ${branchName}:`, error);
          return {
            name: branchName,
            lastCommit: 'Unknown',
            lastCommitDate: new Date(),
            commitCount: 0,
            isCurrent: branchName === currentBranch
          };
        }
      })
    );

    // sort by date, newest first
    branchInfo.sort((a, b) => b.lastCommitDate.getTime() - a.lastCommitDate.getTime());

    sidebarProvider.postMessage({ type: 'copilotBranches', payload: branchInfo });
  } catch (error) {
    console.error('Failed to refresh copilot branches:', error);
    NotificationManager.showError(`Failed to load branches: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Checkout a copilot branch
 */
async function checkoutCopilotBranch(branchName: string): Promise<void> {
  try {
    if (!gitService) {
      throw new Error('GitService not available');
    }

    await gitService.checkoutBranch(branchName);
    NotificationManager.showSuccess(`Switched to branch ${branchName}`);
    recordChange(`Checked out branch ${branchName}`, 'git');
    
    // Refresh branches list to update current branch indicator
    await refreshCopilotBranches();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    NotificationManager.showError(`Failed to checkout branch: ${errorMsg}`);
    console.error('Failed to checkout branch:', error);
  }
}

/**
 * Merge a copilot branch into current branch
 */
async function mergeCopilotBranch(branchName: string): Promise<void> {
  try {
    if (!gitService) {
      throw new Error('GitService not available');
    }

    const currentBranch = await gitService.getCurrentBranch();
    
    // Confirm merge
    const confirm = await vscode.window.showWarningMessage(
      `Merge branch "${branchName}" into "${currentBranch}"?`,
      { modal: true },
      'Merge'
    );

    if (confirm !== 'Merge') {
      return;
    }

    // Merge the branch into current branch
    await gitService.mergeBranch(branchName);
    NotificationManager.showSuccess(`Successfully merged ${branchName} into ${currentBranch}`);
    recordChange(`Merged branch ${branchName} into ${currentBranch}`, 'git');
    
    // Refresh branches list
    await refreshCopilotBranches();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    NotificationManager.showError(`Failed to merge branch: ${errorMsg}`);
    console.error('Failed to merge branch:', error);
  }
}

/**
 * Delete a copilot branch
 */
async function deleteCopilotBranch(branchName: string): Promise<void> {
  try {
    if (!gitService) {
      throw new Error('GitService not available');
    }

    const currentBranch = await gitService.getCurrentBranch();
    
    if (branchName === currentBranch) {
      NotificationManager.showError('Cannot delete the current branch. Please switch to another branch first.');
      return;
    }

    // Confirm deletion
    const confirm = await vscode.window.showWarningMessage(
      `Delete branch "${branchName}"? This action cannot be undone.`,
      { modal: true },
      'Delete'
    );

    if (confirm !== 'Delete') {
      return;
    }

    await gitService.deleteBranch(branchName, true); // Force delete
    NotificationManager.showSuccess(`Successfully deleted ${branchName}`);
    recordChange(`Deleted branch ${branchName}`, 'git');
    
    // Refresh branches list
    await refreshCopilotBranches();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    NotificationManager.showError(`Failed to delete branch: ${errorMsg}`);
    console.error('Failed to delete branch:', error);
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
