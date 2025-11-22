/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(__webpack_require__(1));
const dotenv = __importStar(__webpack_require__(2));
const path = __importStar(__webpack_require__(4));
// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
const gitlog_1 = __webpack_require__(8);
const fileWatcher_1 = __webpack_require__(23);
const LintingService_1 = __webpack_require__(24);
const ContextIngestionService_1 = __webpack_require__(27);
const storage_1 = __webpack_require__(28);
// Import mock services (INTEGRATION POINT: Replace with real services here)
const MockContextService_1 = __webpack_require__(51);
const GeminiService_1 = __webpack_require__(52); // Real AI Service
const MockGitService_1 = __webpack_require__(56);
const MockVoiceService_1 = __webpack_require__(57);
// Import UI components
const StatusBarManager_1 = __webpack_require__(58);
const SidebarWebviewProvider_1 = __webpack_require__(59);
const IssuesTreeProvider_1 = __webpack_require__(60);
const NotificationManager_1 = __webpack_require__(61);
// Global state
let statusBar;
let sidebarProvider;
let issuesTreeProvider;
// Services (INTEGRATION POINT: Swap mock with real services)
let contextService;
let aiService;
let gitService;
let voiceService;
let lintingService;
let ingestionService;
// State
let currentContext = null;
let currentAnalysis = null;
let isAutonomousMode = false;
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    console.log('Autonomous Copilot extension is now active!');
    try {
        let fileWatcher = null;
        // Initialize services
        contextService = new MockContextService_1.MockContextService();
        // Initialize Linting Service
        lintingService = new LintingService_1.LintingService();
        lintingService.initialize(contextService);
        // Initialize Context Ingestion Service (Real Persistence)
        const outputChannel = vscode.window.createOutputChannel("ContextKeeper Ingestion");
        ingestionService = new ContextIngestionService_1.ContextIngestionService();
        // Don't await here to avoid blocking activation
        ingestionService.initialize(context, outputChannel).catch(err => {
            console.error("Failed to initialize ingestion service:", err);
            outputChannel.appendLine(`Error initializing ingestion: ${err.message}`);
        });
        // Initialize Gemini Service
        const geminiService = new GeminiService_1.GeminiService();
        aiService = geminiService;
        // Try to get API key from settings
        const ckConfig = vscode.workspace.getConfiguration('copilot');
        const apiKey = ckConfig.get('gemini.apiKey') || process.env.GEMINI_API_KEY || "";
        if (apiKey) {
            geminiService.initialize(apiKey).then(() => {
                console.log("Gemini Service initialized with API Key");
            }).catch(err => {
                console.error("Failed to initialize Gemini Service:", err);
                NotificationManager_1.NotificationManager.showError("Failed to connect to Gemini AI. Check your API Key.");
            });
        }
        else {
            console.warn("No Gemini API Key found. AI features will be disabled or mocked.");
            NotificationManager_1.NotificationManager.showError("Gemini API Key missing. Please set 'contextkeeper.gemini.apiKey' in settings.");
        }
        gitService = new MockGitService_1.MockGitService();
        voiceService = new MockVoiceService_1.MockVoiceService();
        // Initialize UI components
        statusBar = new StatusBarManager_1.StatusBarManager();
        issuesTreeProvider = new IssuesTreeProvider_1.IssuesTreeProvider();
        const treeView = vscode.window.registerTreeDataProvider('copilot.issuesTree', issuesTreeProvider);
        sidebarProvider = new SidebarWebviewProvider_1.SidebarWebviewProvider(context.extensionUri, handleWebviewMessage);
        const webviewProvider = vscode.window.registerWebviewViewProvider('copilot.mainView', sidebarProvider);
        // Set up service event listeners
        setupServiceListeners();
        // Register commands
        registerCommands(context);
        // Add to subscriptions
        context.subscriptions.push(statusBar, treeView, webviewProvider, lintingService);
        // Load autonomous mode from settings
        const config = vscode.workspace.getConfiguration('copilot');
        isAutonomousMode = config.get('autonomous.enabled', false);
        // Show welcome notification
        NotificationManager_1.NotificationManager.showSuccess('🤖 Autonomous Copilot is ready!', 'Open Dashboard').then(action => {
            if (action === 'Open Dashboard') {
                vscode.commands.executeCommand('copilot.showPanel');
            }
        });
        // Legacy commands for backwards compatibility
        const disposable = vscode.commands.registerCommand("contextkeeper.helloWorld", () => {
            vscode.window.showInformationMessage("Hello World from contextkeeper!");
        });
        const testGitlog = vscode.commands.registerCommand("contextkeeper.testGitlog", async () => {
            try {
                vscode.window.showInformationMessage("Fetching git logs...");
                const logs = await (0, gitlog_1.getLogsWithGitlog)();
                const outputChannel = vscode.window.createOutputChannel("ContextKeeper");
                outputChannel.clear();
                outputChannel.appendLine("=== Recent Git Commits ===");
                logs.forEach((commit, i) => {
                    outputChannel.appendLine(`\n${i + 1}. ${commit.subject}`);
                    outputChannel.appendLine(`   Author: ${commit.authorName}`);
                    outputChannel.appendLine(`   Hash: ${commit.hash}`);
                    outputChannel.appendLine(`   Date: ${commit.authorDate}`);
                });
                outputChannel.show();
                vscode.window.showInformationMessage(`✅ Found ${logs.length} commits!`);
            }
            catch (err) {
                vscode.window.showErrorMessage(`❌ Error: ${err.message}`);
                console.error("Gitlog error:", err);
            }
        });
        const showStoredEvents = vscode.commands.registerCommand("contextkeeper.showStoredEvents", async () => {
            try {
                const events = await storage_1.storage.getRecentEvents(20);
                const channel = vscode.window.createOutputChannel("ContextKeeper Storage");
                channel.clear();
                channel.appendLine("=== Recent Stored Events (LanceDB) ===");
                if (events.length === 0) {
                    channel.appendLine("No events found.");
                }
                events.forEach((event, i) => {
                    channel.appendLine(`\n[${i + 1}] ${new Date(event.timestamp).toLocaleString()} - ${event.event_type}`);
                    channel.appendLine(`    File: ${event.file_path}`);
                    channel.appendLine(`    Metadata: ${event.metadata}`);
                });
                channel.show();
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to fetch events: ${error.message}`);
            }
        });
        const startWatcher = vscode.commands.registerCommand("contextkeeper.startAutoLint", () => {
            if (fileWatcher) {
                vscode.window.showWarningMessage("Auto-lint is already running!");
                return;
            }
            // Get the linting endpoint from settings (or use default)
            const config = vscode.workspace.getConfiguration("contextkeeper");
            const endpoint = config.get("lintingEndpoint") ||
                "https://contextkeeper-worker.workers.dev/lint";
            fileWatcher = new fileWatcher_1.FileWatcher(endpoint);
            fileWatcher.start();
            vscode.window.showInformationMessage("🔍 Auto-lint enabled! Files will be checked on save.");
        });
        // Command to stop auto-linting
        const stopWatcher = vscode.commands.registerCommand("contextkeeper.stopAutoLint", () => {
            if (!fileWatcher) {
                vscode.window.showWarningMessage("Auto-lint is not running!");
                return;
            }
            fileWatcher.stop();
            fileWatcher = null;
            vscode.window.showInformationMessage("⏸️ Auto-lint disabled.");
        });
        context.subscriptions.push(startWatcher);
        context.subscriptions.push(stopWatcher);
        context.subscriptions.push(testGitlog);
        context.subscriptions.push(showStoredEvents);
        context.subscriptions.push(disposable);
    }
    catch (error) {
        console.error("Extension activation failed:", error);
        vscode.window.showErrorMessage(`Autonomous Copilot failed to activate: ${error.message}`);
    }
}
/**
 * Set up event listeners for service events
 */
function setupServiceListeners() {
    // Listen to context service events
    contextService.on('contextCollected', (context) => {
        currentContext = context;
        sidebarProvider.updateContext(context);
    });
    // Listen to AI service events
    aiService.on('analysisStarted', () => {
        const state = {
            status: 'analyzing',
            progress: 0,
            message: 'Starting analysis',
        };
        statusBar.setState(state);
        sidebarProvider.updateState(state);
    });
    aiService.on('analysisProgress', (progress, message) => {
        const state = {
            status: 'analyzing',
            progress,
            message,
        };
        statusBar.setState(state);
        sidebarProvider.updateState(state);
    });
    aiService.on('analysisComplete', (analysis) => {
        currentAnalysis = analysis;
        // Update UI components
        const state = {
            status: 'complete',
            issuesFound: analysis.issues.length,
        };
        statusBar.setState(state);
        sidebarProvider.updateState(state);
        sidebarProvider.updateAnalysis(analysis);
        issuesTreeProvider.updateAnalysis(analysis);
        // Show notification
        NotificationManager_1.NotificationManager.showAnalysisComplete(analysis.issues.length);
        // Voice notification if enabled
        if (voiceService.isEnabled()) {
            const message = analysis.issues.length > 0
                ? `Found ${analysis.issues.length} issues in your code.`
                : 'No issues found. Your code looks great!';
            voiceService.speak(message, 'professional');
        }
    });
    aiService.on('error', (error) => {
        const state = {
            status: 'error',
            error: error.message,
        };
        statusBar.setState(state);
        sidebarProvider.showError(error.message);
        NotificationManager_1.NotificationManager.showError(`Analysis failed: ${error.message}`);
    });
}
/**
 * Register all extension commands
 */
function registerCommands(context) {
    // Analyze command
    context.subscriptions.push(vscode.commands.registerCommand('copilot.analyze', async () => {
        await runAnalysis();
    }));
    // Toggle autonomous mode
    context.subscriptions.push(vscode.commands.registerCommand('copilot.toggleAutonomous', async () => {
        isAutonomousMode = !isAutonomousMode;
        const config = vscode.workspace.getConfiguration('copilot');
        await config.update('autonomous.enabled', isAutonomousMode, true);
        if (isAutonomousMode) {
            NotificationManager_1.NotificationManager.showAutonomousStarted();
        }
        else {
            NotificationManager_1.NotificationManager.showSuccess('🤖 Autonomous mode disabled');
        }
    }));
    // Show panel
    context.subscriptions.push(vscode.commands.registerCommand('copilot.showPanel', () => {
        sidebarProvider.reveal();
    }));
    // Refresh context
    context.subscriptions.push(vscode.commands.registerCommand('copilot.refreshContext', async () => {
        await refreshContext();
    }));
    // Navigate to issue
    context.subscriptions.push(vscode.commands.registerCommand('copilot.navigateToIssue', async (file, line, column = 0) => {
        try {
            const document = await vscode.workspace.openTextDocument(file);
            const editor = await vscode.window.showTextDocument(document);
            const position = new vscode.Position(line - 1, column);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        }
        catch (error) {
            NotificationManager_1.NotificationManager.showError(`Cannot open file: ${error.message}`);
        }
    }));
    // Apply fix (placeholder for future implementation)
    context.subscriptions.push(vscode.commands.registerCommand('copilot.applyFix', async (issueId) => {
        NotificationManager_1.NotificationManager.showSuccess('Fix application coming soon!');
    }));
}
/**
 * Handle messages from webview
 */
async function handleWebviewMessage(message) {
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
            await vscode.commands.executeCommand('copilot.navigateToIssue', message.file, message.line);
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
async function refreshContext() {
    try {
        const context = await contextService.collectContext();
        currentContext = context;
        sidebarProvider.updateContext(context);
    }
    catch (error) {
        NotificationManager_1.NotificationManager.showError(`Failed to collect context: ${error.message}`);
    }
}
/**
 * Run code analysis
 */
async function runAnalysis() {
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
        await NotificationManager_1.NotificationManager.withProgress('Analyzing code...', async (progress) => {
            progress.report({ increment: 0, message: 'Collecting context' });
            // The AI service will emit progress events that update the UI
            const analysis = await aiService.analyze(code, currentContext);
            progress.report({ increment: 100, message: 'Complete!' });
            return analysis;
        });
    }
    catch (error) {
        const state = {
            status: 'error',
            error: error.message,
        };
        statusBar.setState(state);
        sidebarProvider.showError(error.message);
        await NotificationManager_1.NotificationManager.showErrorWithRetry(`Analysis failed: ${error.message}`, () => runAnalysis());
    }
}
// This method is called when your extension is deactivated
function deactivate() {
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


/***/ }),
/* 1 */
/***/ ((module) => {

"use strict";
module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const fs = __webpack_require__(3)
const path = __webpack_require__(4)
const os = __webpack_require__(5)
const crypto = __webpack_require__(6)
const packageJson = __webpack_require__(7)

const version = packageJson.version

// Array of tips to display randomly
const TIPS = [
  '🔐 encrypt with Dotenvx: https://dotenvx.com',
  '🔐 prevent committing .env to code: https://dotenvx.com/precommit',
  '🔐 prevent building .env in docker: https://dotenvx.com/prebuild',
  '📡 add observability to secrets: https://dotenvx.com/ops',
  '👥 sync secrets across teammates & machines: https://dotenvx.com/ops',
  '🗂️ backup and recover secrets: https://dotenvx.com/ops',
  '✅ audit secrets and track compliance: https://dotenvx.com/ops',
  '🔄 add secrets lifecycle management: https://dotenvx.com/ops',
  '🔑 add access controls to secrets: https://dotenvx.com/ops',
  '🛠️  run anywhere with `dotenvx run -- yourcommand`',
  '⚙️  specify custom .env file path with { path: \'/custom/path/.env\' }',
  '⚙️  enable debug logging with { debug: true }',
  '⚙️  override existing env vars with { override: true }',
  '⚙️  suppress all logs with { quiet: true }',
  '⚙️  write to custom object with { processEnv: myObject }',
  '⚙️  load multiple .env files with { path: [\'.env.local\', \'.env\'] }'
]

// Get a random tip from the tips array
function _getRandomTip () {
  return TIPS[Math.floor(Math.random() * TIPS.length)]
}

function parseBoolean (value) {
  if (typeof value === 'string') {
    return !['false', '0', 'no', 'off', ''].includes(value.toLowerCase())
  }
  return Boolean(value)
}

function supportsAnsi () {
  return process.stdout.isTTY // && process.env.TERM !== 'dumb'
}

function dim (text) {
  return supportsAnsi() ? `\x1b[2m${text}\x1b[0m` : text
}

const LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg

// Parse src into an Object
function parse (src) {
  const obj = {}

  // Convert buffer to string
  let lines = src.toString()

  // Convert line breaks to same format
  lines = lines.replace(/\r\n?/mg, '\n')

  let match
  while ((match = LINE.exec(lines)) != null) {
    const key = match[1]

    // Default undefined or null to empty string
    let value = (match[2] || '')

    // Remove whitespace
    value = value.trim()

    // Check if double quoted
    const maybeQuote = value[0]

    // Remove surrounding quotes
    value = value.replace(/^(['"`])([\s\S]*)\1$/mg, '$2')

    // Expand newlines if double quoted
    if (maybeQuote === '"') {
      value = value.replace(/\\n/g, '\n')
      value = value.replace(/\\r/g, '\r')
    }

    // Add to object
    obj[key] = value
  }

  return obj
}

function _parseVault (options) {
  options = options || {}

  const vaultPath = _vaultPath(options)
  options.path = vaultPath // parse .env.vault
  const result = DotenvModule.configDotenv(options)
  if (!result.parsed) {
    const err = new Error(`MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`)
    err.code = 'MISSING_DATA'
    throw err
  }

  // handle scenario for comma separated keys - for use with key rotation
  // example: DOTENV_KEY="dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=prod,dotenv://:key_7890@dotenvx.com/vault/.env.vault?environment=prod"
  const keys = _dotenvKey(options).split(',')
  const length = keys.length

  let decrypted
  for (let i = 0; i < length; i++) {
    try {
      // Get full key
      const key = keys[i].trim()

      // Get instructions for decrypt
      const attrs = _instructions(result, key)

      // Decrypt
      decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key)

      break
    } catch (error) {
      // last key
      if (i + 1 >= length) {
        throw error
      }
      // try next key
    }
  }

  // Parse decrypted .env string
  return DotenvModule.parse(decrypted)
}

function _warn (message) {
  console.error(`[dotenv@${version}][WARN] ${message}`)
}

function _debug (message) {
  console.log(`[dotenv@${version}][DEBUG] ${message}`)
}

function _log (message) {
  console.log(`[dotenv@${version}] ${message}`)
}

function _dotenvKey (options) {
  // prioritize developer directly setting options.DOTENV_KEY
  if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0) {
    return options.DOTENV_KEY
  }

  // secondary infra already contains a DOTENV_KEY environment variable
  if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) {
    return process.env.DOTENV_KEY
  }

  // fallback to empty string
  return ''
}

function _instructions (result, dotenvKey) {
  // Parse DOTENV_KEY. Format is a URI
  let uri
  try {
    uri = new URL(dotenvKey)
  } catch (error) {
    if (error.code === 'ERR_INVALID_URL') {
      const err = new Error('INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development')
      err.code = 'INVALID_DOTENV_KEY'
      throw err
    }

    throw error
  }

  // Get decrypt key
  const key = uri.password
  if (!key) {
    const err = new Error('INVALID_DOTENV_KEY: Missing key part')
    err.code = 'INVALID_DOTENV_KEY'
    throw err
  }

  // Get environment
  const environment = uri.searchParams.get('environment')
  if (!environment) {
    const err = new Error('INVALID_DOTENV_KEY: Missing environment part')
    err.code = 'INVALID_DOTENV_KEY'
    throw err
  }

  // Get ciphertext payload
  const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`
  const ciphertext = result.parsed[environmentKey] // DOTENV_VAULT_PRODUCTION
  if (!ciphertext) {
    const err = new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`)
    err.code = 'NOT_FOUND_DOTENV_ENVIRONMENT'
    throw err
  }

  return { ciphertext, key }
}

function _vaultPath (options) {
  let possibleVaultPath = null

  if (options && options.path && options.path.length > 0) {
    if (Array.isArray(options.path)) {
      for (const filepath of options.path) {
        if (fs.existsSync(filepath)) {
          possibleVaultPath = filepath.endsWith('.vault') ? filepath : `${filepath}.vault`
        }
      }
    } else {
      possibleVaultPath = options.path.endsWith('.vault') ? options.path : `${options.path}.vault`
    }
  } else {
    possibleVaultPath = path.resolve(process.cwd(), '.env.vault')
  }

  if (fs.existsSync(possibleVaultPath)) {
    return possibleVaultPath
  }

  return null
}

function _resolveHome (envPath) {
  return envPath[0] === '~' ? path.join(os.homedir(), envPath.slice(1)) : envPath
}

function _configVault (options) {
  const debug = parseBoolean(process.env.DOTENV_CONFIG_DEBUG || (options && options.debug))
  const quiet = parseBoolean(process.env.DOTENV_CONFIG_QUIET || (options && options.quiet))

  if (debug || !quiet) {
    _log('Loading env from encrypted .env.vault')
  }

  const parsed = DotenvModule._parseVault(options)

  let processEnv = process.env
  if (options && options.processEnv != null) {
    processEnv = options.processEnv
  }

  DotenvModule.populate(processEnv, parsed, options)

  return { parsed }
}

function configDotenv (options) {
  const dotenvPath = path.resolve(process.cwd(), '.env')
  let encoding = 'utf8'
  let processEnv = process.env
  if (options && options.processEnv != null) {
    processEnv = options.processEnv
  }
  let debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || (options && options.debug))
  let quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || (options && options.quiet))

  if (options && options.encoding) {
    encoding = options.encoding
  } else {
    if (debug) {
      _debug('No encoding is specified. UTF-8 is used by default')
    }
  }

  let optionPaths = [dotenvPath] // default, look for .env
  if (options && options.path) {
    if (!Array.isArray(options.path)) {
      optionPaths = [_resolveHome(options.path)]
    } else {
      optionPaths = [] // reset default
      for (const filepath of options.path) {
        optionPaths.push(_resolveHome(filepath))
      }
    }
  }

  // Build the parsed data in a temporary object (because we need to return it).  Once we have the final
  // parsed data, we will combine it with process.env (or options.processEnv if provided).
  let lastError
  const parsedAll = {}
  for (const path of optionPaths) {
    try {
      // Specifying an encoding returns a string instead of a buffer
      const parsed = DotenvModule.parse(fs.readFileSync(path, { encoding }))

      DotenvModule.populate(parsedAll, parsed, options)
    } catch (e) {
      if (debug) {
        _debug(`Failed to load ${path} ${e.message}`)
      }
      lastError = e
    }
  }

  const populated = DotenvModule.populate(processEnv, parsedAll, options)

  // handle user settings DOTENV_CONFIG_ options inside .env file(s)
  debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || debug)
  quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || quiet)

  if (debug || !quiet) {
    const keysCount = Object.keys(populated).length
    const shortPaths = []
    for (const filePath of optionPaths) {
      try {
        const relative = path.relative(process.cwd(), filePath)
        shortPaths.push(relative)
      } catch (e) {
        if (debug) {
          _debug(`Failed to load ${filePath} ${e.message}`)
        }
        lastError = e
      }
    }

    _log(`injecting env (${keysCount}) from ${shortPaths.join(',')} ${dim(`-- tip: ${_getRandomTip()}`)}`)
  }

  if (lastError) {
    return { parsed: parsedAll, error: lastError }
  } else {
    return { parsed: parsedAll }
  }
}

// Populates process.env from .env file
function config (options) {
  // fallback to original dotenv if DOTENV_KEY is not set
  if (_dotenvKey(options).length === 0) {
    return DotenvModule.configDotenv(options)
  }

  const vaultPath = _vaultPath(options)

  // dotenvKey exists but .env.vault file does not exist
  if (!vaultPath) {
    _warn(`You set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}. Did you forget to build it?`)

    return DotenvModule.configDotenv(options)
  }

  return DotenvModule._configVault(options)
}

function decrypt (encrypted, keyStr) {
  const key = Buffer.from(keyStr.slice(-64), 'hex')
  let ciphertext = Buffer.from(encrypted, 'base64')

  const nonce = ciphertext.subarray(0, 12)
  const authTag = ciphertext.subarray(-16)
  ciphertext = ciphertext.subarray(12, -16)

  try {
    const aesgcm = crypto.createDecipheriv('aes-256-gcm', key, nonce)
    aesgcm.setAuthTag(authTag)
    return `${aesgcm.update(ciphertext)}${aesgcm.final()}`
  } catch (error) {
    const isRange = error instanceof RangeError
    const invalidKeyLength = error.message === 'Invalid key length'
    const decryptionFailed = error.message === 'Unsupported state or unable to authenticate data'

    if (isRange || invalidKeyLength) {
      const err = new Error('INVALID_DOTENV_KEY: It must be 64 characters long (or more)')
      err.code = 'INVALID_DOTENV_KEY'
      throw err
    } else if (decryptionFailed) {
      const err = new Error('DECRYPTION_FAILED: Please check your DOTENV_KEY')
      err.code = 'DECRYPTION_FAILED'
      throw err
    } else {
      throw error
    }
  }
}

// Populate process.env with parsed values
function populate (processEnv, parsed, options = {}) {
  const debug = Boolean(options && options.debug)
  const override = Boolean(options && options.override)
  const populated = {}

  if (typeof parsed !== 'object') {
    const err = new Error('OBJECT_REQUIRED: Please check the processEnv argument being passed to populate')
    err.code = 'OBJECT_REQUIRED'
    throw err
  }

  // Set process.env
  for (const key of Object.keys(parsed)) {
    if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
      if (override === true) {
        processEnv[key] = parsed[key]
        populated[key] = parsed[key]
      }

      if (debug) {
        if (override === true) {
          _debug(`"${key}" is already defined and WAS overwritten`)
        } else {
          _debug(`"${key}" is already defined and was NOT overwritten`)
        }
      }
    } else {
      processEnv[key] = parsed[key]
      populated[key] = parsed[key]
    }
  }

  return populated
}

const DotenvModule = {
  configDotenv,
  _configVault,
  _parseVault,
  config,
  decrypt,
  parse,
  populate
}

module.exports.configDotenv = DotenvModule.configDotenv
module.exports._configVault = DotenvModule._configVault
module.exports._parseVault = DotenvModule._parseVault
module.exports.config = DotenvModule.config
module.exports.decrypt = DotenvModule.decrypt
module.exports.parse = DotenvModule.parse
module.exports.populate = DotenvModule.populate

module.exports = DotenvModule


/***/ }),
/* 3 */
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),
/* 4 */
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ }),
/* 5 */
/***/ ((module) => {

"use strict";
module.exports = require("os");

/***/ }),
/* 6 */
/***/ ((module) => {

"use strict";
module.exports = require("crypto");

/***/ }),
/* 7 */
/***/ ((module) => {

"use strict";
module.exports = /*#__PURE__*/JSON.parse('{"name":"dotenv","version":"17.2.3","description":"Loads environment variables from .env file","main":"lib/main.js","types":"lib/main.d.ts","exports":{".":{"types":"./lib/main.d.ts","require":"./lib/main.js","default":"./lib/main.js"},"./config":"./config.js","./config.js":"./config.js","./lib/env-options":"./lib/env-options.js","./lib/env-options.js":"./lib/env-options.js","./lib/cli-options":"./lib/cli-options.js","./lib/cli-options.js":"./lib/cli-options.js","./package.json":"./package.json"},"scripts":{"dts-check":"tsc --project tests/types/tsconfig.json","lint":"standard","pretest":"npm run lint && npm run dts-check","test":"tap run tests/**/*.js --allow-empty-coverage --disable-coverage --timeout=60000","test:coverage":"tap run tests/**/*.js --show-full-coverage --timeout=60000 --coverage-report=text --coverage-report=lcov","prerelease":"npm test","release":"standard-version"},"repository":{"type":"git","url":"git://github.com/motdotla/dotenv.git"},"homepage":"https://github.com/motdotla/dotenv#readme","funding":"https://dotenvx.com","keywords":["dotenv","env",".env","environment","variables","config","settings"],"readmeFilename":"README.md","license":"BSD-2-Clause","devDependencies":{"@types/node":"^18.11.3","decache":"^4.6.2","sinon":"^14.0.1","standard":"^17.0.0","standard-version":"^9.5.0","tap":"^19.2.0","typescript":"^4.8.4"},"engines":{"node":">=12"},"browser":{"fs":false}}');

/***/ }),
/* 8 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getLogsWithGitlog = getLogsWithGitlog;
// @ts-ignore
const gitlog = __importStar(__webpack_require__(9));
const vscode = __importStar(__webpack_require__(1));
async function getLogsWithGitlog(repoPath) {
    const workspaceFolder = repoPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
        throw new Error("No workspace folder found");
    }
    // Dynamic import to handle ESM/CJS interop issues in different environments
    // @ts-ignore
    const gl = gitlog.default || gitlog;
    // @ts-ignore
    const promiseFunc = gl.gitlogPromise || gl;
    const commits = await promiseFunc({
        repo: workspaceFolder,
        number: 10,
        fields: ["hash", "authorName", "authorDate", "subject"],
    });
    return commits;
}


/***/ }),
/* 9 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var node_child_process__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(10);
/* harmony import */ var node_util__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(11);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3);
/* harmony import */ var debug__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(12);
var __assign = (undefined && undefined.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};




var debug = debug__WEBPACK_IMPORTED_MODULE_3__("gitlog");
var execFilePromise = (0,node_util__WEBPACK_IMPORTED_MODULE_1__.promisify)(node_child_process__WEBPACK_IMPORTED_MODULE_0__.execFile);
var delimiter = "\x1E";
var fieldMap = {
    hash: "%H",
    abbrevHash: "%h",
    treeHash: "%T",
    abbrevTreeHash: "%t",
    parentHashes: "%P",
    abbrevParentHashes: "%P",
    authorName: "%an",
    authorEmail: "%ae",
    authorDate: "%ai",
    authorDateRel: "%ar",
    committerName: "%cn",
    committerEmail: "%ce",
    committerDate: "%cd",
    committerDateRel: "%cr",
    subject: "%s",
    body: "%b",
    rawBody: "%B",
    tag: "%D",
};
var notOptFields = ["status", "files"];
var defaultFields = [
    "abbrevHash",
    "hash",
    "subject",
    "authorName",
    "authorDate",
];
var defaultOptions = {
    number: 10,
    fields: defaultFields,
    nameStatus: true,
    includeMergeCommitFiles: false,
    follow: false,
    findCopiesHarder: false,
    all: false,
};
/** Add optional parameter to command */
function addOptionalArguments(command, options) {
    var commandWithOptions = command;
    var cmdOptional = [
        "author",
        "since",
        "after",
        "until",
        "before",
        "committer",
    ];
    for (var i = cmdOptional.length; i--;) {
        if (options[cmdOptional[i]]) {
            commandWithOptions.push("--".concat(cmdOptional[i], "=").concat(options[cmdOptional[i]]));
        }
    }
    return commandWithOptions;
}
/** Parse the output of "git log" for commit information */
var parseCommits = function (commits, fields, nameStatus) {
    return commits.map(function (rawCommit) {
        var parts = rawCommit.split("@end@");
        var commit = parts[0].split(delimiter);
        if (parts[1]) {
            var parseNameStatus = parts[1].trimLeft().split("\n");
            // Removes last empty char if exists
            if (parseNameStatus[parseNameStatus.length - 1] === "") {
                parseNameStatus.pop();
            }
            // Split each line into it's own delimited array
            // Using tab character here because the name status output is always tab separated
            var nameAndStatusDelimited = parseNameStatus.map(function (d) { return d.split("\t"); });
            // 0 will always be status, last will be the filename as it is in the commit,
            // anything in between could be the old name if renamed or copied
            nameAndStatusDelimited.forEach(function (item) {
                var status = item[0];
                var tempArr = [status, item[item.length - 1]];
                // If any files in between loop through them
                for (var i = 1, len = item.length - 1; i < len; i++) {
                    // If status R then add the old filename as a deleted file + status
                    // Other potentials are C for copied but this wouldn't require the original deleting
                    if (status.slice(0, 1) === "R") {
                        tempArr.push("D", item[i]);
                    }
                }
                commit.push.apply(commit, tempArr);
            });
        }
        debug("commit", commit);
        // Remove the first empty char from the array
        commit.shift();
        var parsed = {};
        if (nameStatus) {
            // Create arrays for non optional fields if turned on
            notOptFields.forEach(function (d) {
                parsed[d] = [];
            });
        }
        commit.forEach(function (commitField, index) {
            if (fields[index]) {
                parsed[fields[index]] = commitField;
            }
            else if (nameStatus) {
                var pos = (index - fields.length) % notOptFields.length;
                debug("nameStatus", index - fields.length, notOptFields.length, pos, commitField);
                var arr = parsed[notOptFields[pos]];
                if (Array.isArray(arr)) {
                    arr.push(commitField);
                }
            }
        });
        return parsed;
    });
};
/** Run "git log" and return the result as JSON */
function createCommandArguments(options) {
    // Start constructing command
    var command = ["log", "-l0"];
    if (options.findCopiesHarder) {
        command.push("--find-copies-harder");
    }
    if (options.all) {
        command.push("--all");
    }
    if (options.includeMergeCommitFiles) {
        command.push("-m");
    }
    if (options.follow) {
        command.push("--follow");
    }
    command.push("-n ".concat(options.number));
    command = addOptionalArguments(command, options);
    // Start of custom format
    var prettyArgument = "--pretty=@begin@";
    // Iterating through the fields and adding them to the custom format
    if (options.fields) {
        options.fields.forEach(function (field) {
            if (!fieldMap[field] && !notOptFields.includes(field)) {
                throw new Error("Unknown field: ".concat(field));
            }
            prettyArgument += delimiter + fieldMap[field];
        });
    }
    // Close custom format
    prettyArgument += "@end@";
    command.push(prettyArgument);
    // Append branch (revision range) if specified
    if (options.branch) {
        command.push(options.branch);
    }
    // File and file status
    if (options.nameStatus && !options.fileLineRange) {
        command.push("--name-status");
    }
    if (options.fileLineRange) {
        command.push("-L ".concat(options.fileLineRange.startLine, ",").concat(options.fileLineRange.endLine, ":").concat(options.fileLineRange.file));
    }
    if (options.file) {
        command.push("--");
        command.push(options.file);
    }
    debug("command", options.execOptions, command);
    return command;
}
function gitlog(userOptions) {
    return __awaiter(this, void 0, void 0, function () {
        var options, execOptions, commandArguments, stdout, commits;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!userOptions.repo) {
                        throw new Error("Repo required!");
                    }
                    if (!(0,fs__WEBPACK_IMPORTED_MODULE_2__.existsSync)(userOptions.repo)) {
                        throw new Error("Repo location does not exist");
                    }
                    options = __assign(__assign({}, defaultOptions), userOptions);
                    execOptions = __assign({ cwd: userOptions.repo }, userOptions.execOptions);
                    commandArguments = createCommandArguments(options);
                    return [4 /*yield*/, execFilePromise("git", commandArguments, execOptions)];
                case 1:
                    stdout = (_a.sent()).stdout;
                    commits = stdout.split("@begin@");
                    if (commits[0] === "") {
                        commits.shift();
                    }
                    debug("commits", commits);
                    return [2 /*return*/, parseCommits(commits, options.fields, options.nameStatus)];
            }
        });
    });
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (gitlog);
//# sourceMappingURL=index.js.map

/***/ }),
/* 10 */
/***/ ((module) => {

"use strict";
module.exports = require("node:child_process");

/***/ }),
/* 11 */
/***/ ((module) => {

"use strict";
module.exports = require("node:util");

/***/ }),
/* 12 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/**
 * Detect Electron renderer / nwjs process, which is node, but we should
 * treat as a browser.
 */

if (typeof process === 'undefined' || process.type === 'renderer' || process.browser === true || process.__nwjs) {
	module.exports = __webpack_require__(13);
} else {
	module.exports = __webpack_require__(16);
}


/***/ }),
/* 13 */
/***/ ((module, exports, __webpack_require__) => {

/* eslint-env browser */

/**
 * This is the web browser implementation of `debug()`.
 */

exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = localstorage();
exports.destroy = (() => {
	let warned = false;

	return () => {
		if (!warned) {
			warned = true;
			console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
		}
	};
})();

/**
 * Colors.
 */

exports.colors = [
	'#0000CC',
	'#0000FF',
	'#0033CC',
	'#0033FF',
	'#0066CC',
	'#0066FF',
	'#0099CC',
	'#0099FF',
	'#00CC00',
	'#00CC33',
	'#00CC66',
	'#00CC99',
	'#00CCCC',
	'#00CCFF',
	'#3300CC',
	'#3300FF',
	'#3333CC',
	'#3333FF',
	'#3366CC',
	'#3366FF',
	'#3399CC',
	'#3399FF',
	'#33CC00',
	'#33CC33',
	'#33CC66',
	'#33CC99',
	'#33CCCC',
	'#33CCFF',
	'#6600CC',
	'#6600FF',
	'#6633CC',
	'#6633FF',
	'#66CC00',
	'#66CC33',
	'#9900CC',
	'#9900FF',
	'#9933CC',
	'#9933FF',
	'#99CC00',
	'#99CC33',
	'#CC0000',
	'#CC0033',
	'#CC0066',
	'#CC0099',
	'#CC00CC',
	'#CC00FF',
	'#CC3300',
	'#CC3333',
	'#CC3366',
	'#CC3399',
	'#CC33CC',
	'#CC33FF',
	'#CC6600',
	'#CC6633',
	'#CC9900',
	'#CC9933',
	'#CCCC00',
	'#CCCC33',
	'#FF0000',
	'#FF0033',
	'#FF0066',
	'#FF0099',
	'#FF00CC',
	'#FF00FF',
	'#FF3300',
	'#FF3333',
	'#FF3366',
	'#FF3399',
	'#FF33CC',
	'#FF33FF',
	'#FF6600',
	'#FF6633',
	'#FF9900',
	'#FF9933',
	'#FFCC00',
	'#FFCC33'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

// eslint-disable-next-line complexity
function useColors() {
	// NB: In an Electron preload script, document will be defined but not fully
	// initialized. Since we know we're in Chrome, we'll just detect this case
	// explicitly
	if (typeof window !== 'undefined' && window.process && (window.process.type === 'renderer' || window.process.__nwjs)) {
		return true;
	}

	// Internet Explorer and Edge do not support colors.
	if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
		return false;
	}

	let m;

	// Is webkit? http://stackoverflow.com/a/16459606/376773
	// document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
	// eslint-disable-next-line no-return-assign
	return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
		// Is firebug? http://stackoverflow.com/a/398120/376773
		(typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
		// Is firefox >= v31?
		// https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
		(typeof navigator !== 'undefined' && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31) ||
		// Double check webkit in userAgent just in case we are in a worker
		(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
	args[0] = (this.useColors ? '%c' : '') +
		this.namespace +
		(this.useColors ? ' %c' : ' ') +
		args[0] +
		(this.useColors ? '%c ' : ' ') +
		'+' + module.exports.humanize(this.diff);

	if (!this.useColors) {
		return;
	}

	const c = 'color: ' + this.color;
	args.splice(1, 0, c, 'color: inherit');

	// The final "%c" is somewhat tricky, because there could be other
	// arguments passed either before or after the %c, so we need to
	// figure out the correct index to insert the CSS into
	let index = 0;
	let lastC = 0;
	args[0].replace(/%[a-zA-Z%]/g, match => {
		if (match === '%%') {
			return;
		}
		index++;
		if (match === '%c') {
			// We only are interested in the *last* %c
			// (the user may have provided their own)
			lastC = index;
		}
	});

	args.splice(lastC, 0, c);
}

/**
 * Invokes `console.debug()` when available.
 * No-op when `console.debug` is not a "function".
 * If `console.debug` is not available, falls back
 * to `console.log`.
 *
 * @api public
 */
exports.log = console.debug || console.log || (() => {});

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */
function save(namespaces) {
	try {
		if (namespaces) {
			exports.storage.setItem('debug', namespaces);
		} else {
			exports.storage.removeItem('debug');
		}
	} catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
	}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */
function load() {
	let r;
	try {
		r = exports.storage.getItem('debug') || exports.storage.getItem('DEBUG') ;
	} catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
	}

	// If debug isn't set in LS, and we're in Electron, try to load $DEBUG
	if (!r && typeof process !== 'undefined' && 'env' in process) {
		r = process.env.DEBUG;
	}

	return r;
}

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
	try {
		// TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
		// The Browser also has localStorage in the global context.
		return localStorage;
	} catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
	}
}

module.exports = __webpack_require__(14)(exports);

const {formatters} = module.exports;

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

formatters.j = function (v) {
	try {
		return JSON.stringify(v);
	} catch (error) {
		return '[UnexpectedJSONParseError]: ' + error.message;
	}
};


/***/ }),
/* 14 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 */

function setup(env) {
	createDebug.debug = createDebug;
	createDebug.default = createDebug;
	createDebug.coerce = coerce;
	createDebug.disable = disable;
	createDebug.enable = enable;
	createDebug.enabled = enabled;
	createDebug.humanize = __webpack_require__(15);
	createDebug.destroy = destroy;

	Object.keys(env).forEach(key => {
		createDebug[key] = env[key];
	});

	/**
	* The currently active debug mode names, and names to skip.
	*/

	createDebug.names = [];
	createDebug.skips = [];

	/**
	* Map of special "%n" handling functions, for the debug "format" argument.
	*
	* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
	*/
	createDebug.formatters = {};

	/**
	* Selects a color for a debug namespace
	* @param {String} namespace The namespace string for the debug instance to be colored
	* @return {Number|String} An ANSI color code for the given namespace
	* @api private
	*/
	function selectColor(namespace) {
		let hash = 0;

		for (let i = 0; i < namespace.length; i++) {
			hash = ((hash << 5) - hash) + namespace.charCodeAt(i);
			hash |= 0; // Convert to 32bit integer
		}

		return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
	}
	createDebug.selectColor = selectColor;

	/**
	* Create a debugger with the given `namespace`.
	*
	* @param {String} namespace
	* @return {Function}
	* @api public
	*/
	function createDebug(namespace) {
		let prevTime;
		let enableOverride = null;
		let namespacesCache;
		let enabledCache;

		function debug(...args) {
			// Disabled?
			if (!debug.enabled) {
				return;
			}

			const self = debug;

			// Set `diff` timestamp
			const curr = Number(new Date());
			const ms = curr - (prevTime || curr);
			self.diff = ms;
			self.prev = prevTime;
			self.curr = curr;
			prevTime = curr;

			args[0] = createDebug.coerce(args[0]);

			if (typeof args[0] !== 'string') {
				// Anything else let's inspect with %O
				args.unshift('%O');
			}

			// Apply any `formatters` transformations
			let index = 0;
			args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
				// If we encounter an escaped % then don't increase the array index
				if (match === '%%') {
					return '%';
				}
				index++;
				const formatter = createDebug.formatters[format];
				if (typeof formatter === 'function') {
					const val = args[index];
					match = formatter.call(self, val);

					// Now we need to remove `args[index]` since it's inlined in the `format`
					args.splice(index, 1);
					index--;
				}
				return match;
			});

			// Apply env-specific formatting (colors, etc.)
			createDebug.formatArgs.call(self, args);

			const logFn = self.log || createDebug.log;
			logFn.apply(self, args);
		}

		debug.namespace = namespace;
		debug.useColors = createDebug.useColors();
		debug.color = createDebug.selectColor(namespace);
		debug.extend = extend;
		debug.destroy = createDebug.destroy; // XXX Temporary. Will be removed in the next major release.

		Object.defineProperty(debug, 'enabled', {
			enumerable: true,
			configurable: false,
			get: () => {
				if (enableOverride !== null) {
					return enableOverride;
				}
				if (namespacesCache !== createDebug.namespaces) {
					namespacesCache = createDebug.namespaces;
					enabledCache = createDebug.enabled(namespace);
				}

				return enabledCache;
			},
			set: v => {
				enableOverride = v;
			}
		});

		// Env-specific initialization logic for debug instances
		if (typeof createDebug.init === 'function') {
			createDebug.init(debug);
		}

		return debug;
	}

	function extend(namespace, delimiter) {
		const newDebug = createDebug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
		newDebug.log = this.log;
		return newDebug;
	}

	/**
	* Enables a debug mode by namespaces. This can include modes
	* separated by a colon and wildcards.
	*
	* @param {String} namespaces
	* @api public
	*/
	function enable(namespaces) {
		createDebug.save(namespaces);
		createDebug.namespaces = namespaces;

		createDebug.names = [];
		createDebug.skips = [];

		const split = (typeof namespaces === 'string' ? namespaces : '')
			.trim()
			.replace(/\s+/g, ',')
			.split(',')
			.filter(Boolean);

		for (const ns of split) {
			if (ns[0] === '-') {
				createDebug.skips.push(ns.slice(1));
			} else {
				createDebug.names.push(ns);
			}
		}
	}

	/**
	 * Checks if the given string matches a namespace template, honoring
	 * asterisks as wildcards.
	 *
	 * @param {String} search
	 * @param {String} template
	 * @return {Boolean}
	 */
	function matchesTemplate(search, template) {
		let searchIndex = 0;
		let templateIndex = 0;
		let starIndex = -1;
		let matchIndex = 0;

		while (searchIndex < search.length) {
			if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === '*')) {
				// Match character or proceed with wildcard
				if (template[templateIndex] === '*') {
					starIndex = templateIndex;
					matchIndex = searchIndex;
					templateIndex++; // Skip the '*'
				} else {
					searchIndex++;
					templateIndex++;
				}
			} else if (starIndex !== -1) { // eslint-disable-line no-negated-condition
				// Backtrack to the last '*' and try to match more characters
				templateIndex = starIndex + 1;
				matchIndex++;
				searchIndex = matchIndex;
			} else {
				return false; // No match
			}
		}

		// Handle trailing '*' in template
		while (templateIndex < template.length && template[templateIndex] === '*') {
			templateIndex++;
		}

		return templateIndex === template.length;
	}

	/**
	* Disable debug output.
	*
	* @return {String} namespaces
	* @api public
	*/
	function disable() {
		const namespaces = [
			...createDebug.names,
			...createDebug.skips.map(namespace => '-' + namespace)
		].join(',');
		createDebug.enable('');
		return namespaces;
	}

	/**
	* Returns true if the given mode name is enabled, false otherwise.
	*
	* @param {String} name
	* @return {Boolean}
	* @api public
	*/
	function enabled(name) {
		for (const skip of createDebug.skips) {
			if (matchesTemplate(name, skip)) {
				return false;
			}
		}

		for (const ns of createDebug.names) {
			if (matchesTemplate(name, ns)) {
				return true;
			}
		}

		return false;
	}

	/**
	* Coerce `val`.
	*
	* @param {Mixed} val
	* @return {Mixed}
	* @api private
	*/
	function coerce(val) {
		if (val instanceof Error) {
			return val.stack || val.message;
		}
		return val;
	}

	/**
	* XXX DO NOT USE. This is a temporary stub function.
	* XXX It WILL be removed in the next major release.
	*/
	function destroy() {
		console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
	}

	createDebug.enable(createDebug.load());

	return createDebug;
}

module.exports = setup;


/***/ }),
/* 15 */
/***/ ((module) => {

/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var w = d * 7;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

module.exports = function (val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isFinite(val)) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'weeks':
    case 'week':
    case 'w':
      return n * w;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  var msAbs = Math.abs(ms);
  if (msAbs >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (msAbs >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (msAbs >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (msAbs >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  var msAbs = Math.abs(ms);
  if (msAbs >= d) {
    return plural(ms, msAbs, d, 'day');
  }
  if (msAbs >= h) {
    return plural(ms, msAbs, h, 'hour');
  }
  if (msAbs >= m) {
    return plural(ms, msAbs, m, 'minute');
  }
  if (msAbs >= s) {
    return plural(ms, msAbs, s, 'second');
  }
  return ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, msAbs, n, name) {
  var isPlural = msAbs >= n * 1.5;
  return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
}


/***/ }),
/* 16 */
/***/ ((module, exports, __webpack_require__) => {

/**
 * Module dependencies.
 */

const tty = __webpack_require__(17);
const util = __webpack_require__(18);

/**
 * This is the Node.js implementation of `debug()`.
 */

exports.init = init;
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.destroy = util.deprecate(
	() => {},
	'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.'
);

/**
 * Colors.
 */

exports.colors = [6, 2, 3, 4, 5, 1];

try {
	// Optional dependency (as in, doesn't need to be installed, NOT like optionalDependencies in package.json)
	// eslint-disable-next-line import/no-extraneous-dependencies
	const supportsColor = __webpack_require__(19);

	if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
		exports.colors = [
			20,
			21,
			26,
			27,
			32,
			33,
			38,
			39,
			40,
			41,
			42,
			43,
			44,
			45,
			56,
			57,
			62,
			63,
			68,
			69,
			74,
			75,
			76,
			77,
			78,
			79,
			80,
			81,
			92,
			93,
			98,
			99,
			112,
			113,
			128,
			129,
			134,
			135,
			148,
			149,
			160,
			161,
			162,
			163,
			164,
			165,
			166,
			167,
			168,
			169,
			170,
			171,
			172,
			173,
			178,
			179,
			184,
			185,
			196,
			197,
			198,
			199,
			200,
			201,
			202,
			203,
			204,
			205,
			206,
			207,
			208,
			209,
			214,
			215,
			220,
			221
		];
	}
} catch (error) {
	// Swallow - we only care if `supports-color` is available; it doesn't have to be.
}

/**
 * Build up the default `inspectOpts` object from the environment variables.
 *
 *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
 */

exports.inspectOpts = Object.keys(process.env).filter(key => {
	return /^debug_/i.test(key);
}).reduce((obj, key) => {
	// Camel-case
	const prop = key
		.substring(6)
		.toLowerCase()
		.replace(/_([a-z])/g, (_, k) => {
			return k.toUpperCase();
		});

	// Coerce string value into JS value
	let val = process.env[key];
	if (/^(yes|on|true|enabled)$/i.test(val)) {
		val = true;
	} else if (/^(no|off|false|disabled)$/i.test(val)) {
		val = false;
	} else if (val === 'null') {
		val = null;
	} else {
		val = Number(val);
	}

	obj[prop] = val;
	return obj;
}, {});

/**
 * Is stdout a TTY? Colored output is enabled when `true`.
 */

function useColors() {
	return 'colors' in exports.inspectOpts ?
		Boolean(exports.inspectOpts.colors) :
		tty.isatty(process.stderr.fd);
}

/**
 * Adds ANSI color escape codes if enabled.
 *
 * @api public
 */

function formatArgs(args) {
	const {namespace: name, useColors} = this;

	if (useColors) {
		const c = this.color;
		const colorCode = '\u001B[3' + (c < 8 ? c : '8;5;' + c);
		const prefix = `  ${colorCode};1m${name} \u001B[0m`;

		args[0] = prefix + args[0].split('\n').join('\n' + prefix);
		args.push(colorCode + 'm+' + module.exports.humanize(this.diff) + '\u001B[0m');
	} else {
		args[0] = getDate() + name + ' ' + args[0];
	}
}

function getDate() {
	if (exports.inspectOpts.hideDate) {
		return '';
	}
	return new Date().toISOString() + ' ';
}

/**
 * Invokes `util.formatWithOptions()` with the specified arguments and writes to stderr.
 */

function log(...args) {
	return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + '\n');
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */
function save(namespaces) {
	if (namespaces) {
		process.env.DEBUG = namespaces;
	} else {
		// If you set a process.env field to null or undefined, it gets cast to the
		// string 'null' or 'undefined'. Just delete instead.
		delete process.env.DEBUG;
	}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
	return process.env.DEBUG;
}

/**
 * Init logic for `debug` instances.
 *
 * Create a new `inspectOpts` object in case `useColors` is set
 * differently for a particular `debug` instance.
 */

function init(debug) {
	debug.inspectOpts = {};

	const keys = Object.keys(exports.inspectOpts);
	for (let i = 0; i < keys.length; i++) {
		debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
	}
}

module.exports = __webpack_require__(14)(exports);

const {formatters} = module.exports;

/**
 * Map %o to `util.inspect()`, all on a single line.
 */

formatters.o = function (v) {
	this.inspectOpts.colors = this.useColors;
	return util.inspect(v, this.inspectOpts)
		.split('\n')
		.map(str => str.trim())
		.join(' ');
};

/**
 * Map %O to `util.inspect()`, allowing multiple lines if needed.
 */

formatters.O = function (v) {
	this.inspectOpts.colors = this.useColors;
	return util.inspect(v, this.inspectOpts);
};


/***/ }),
/* 17 */
/***/ ((module) => {

"use strict";
module.exports = require("tty");

/***/ }),
/* 18 */
/***/ ((module) => {

"use strict";
module.exports = require("util");

/***/ }),
/* 19 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createSupportsColor: () => (/* binding */ createSupportsColor),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var node_process__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(20);
/* harmony import */ var node_os__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(21);
/* harmony import */ var node_tty__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(22);




// From: https://github.com/sindresorhus/has-flag/blob/main/index.js
/// function hasFlag(flag, argv = globalThis.Deno?.args ?? process.argv) {
function hasFlag(flag, argv = globalThis.Deno ? globalThis.Deno.args : node_process__WEBPACK_IMPORTED_MODULE_0__.argv) {
	const prefix = flag.startsWith('-') ? '' : (flag.length === 1 ? '-' : '--');
	const position = argv.indexOf(prefix + flag);
	const terminatorPosition = argv.indexOf('--');
	return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
}

const {env} = node_process__WEBPACK_IMPORTED_MODULE_0__;

let flagForceColor;
if (
	hasFlag('no-color')
	|| hasFlag('no-colors')
	|| hasFlag('color=false')
	|| hasFlag('color=never')
) {
	flagForceColor = 0;
} else if (
	hasFlag('color')
	|| hasFlag('colors')
	|| hasFlag('color=true')
	|| hasFlag('color=always')
) {
	flagForceColor = 1;
}

function envForceColor() {
	if (!('FORCE_COLOR' in env)) {
		return;
	}

	if (env.FORCE_COLOR === 'true') {
		return 1;
	}

	if (env.FORCE_COLOR === 'false') {
		return 0;
	}

	if (env.FORCE_COLOR.length === 0) {
		return 1;
	}

	const level = Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);

	if (![0, 1, 2, 3].includes(level)) {
		return;
	}

	return level;
}

function translateLevel(level) {
	if (level === 0) {
		return false;
	}

	return {
		level,
		hasBasic: true,
		has256: level >= 2,
		has16m: level >= 3,
	};
}

function _supportsColor(haveStream, {streamIsTTY, sniffFlags = true} = {}) {
	const noFlagForceColor = envForceColor();
	if (noFlagForceColor !== undefined) {
		flagForceColor = noFlagForceColor;
	}

	const forceColor = sniffFlags ? flagForceColor : noFlagForceColor;

	if (forceColor === 0) {
		return 0;
	}

	if (sniffFlags) {
		if (hasFlag('color=16m')
			|| hasFlag('color=full')
			|| hasFlag('color=truecolor')) {
			return 3;
		}

		if (hasFlag('color=256')) {
			return 2;
		}
	}

	// Check for Azure DevOps pipelines.
	// Has to be above the `!streamIsTTY` check.
	if ('TF_BUILD' in env && 'AGENT_NAME' in env) {
		return 1;
	}

	if (haveStream && !streamIsTTY && forceColor === undefined) {
		return 0;
	}

	const min = forceColor || 0;

	if (env.TERM === 'dumb') {
		return min;
	}

	if (node_process__WEBPACK_IMPORTED_MODULE_0__.platform === 'win32') {
		// Windows 10 build 10586 is the first Windows release that supports 256 colors.
		// Windows 10 build 14931 is the first release that supports 16m/TrueColor.
		const osRelease = node_os__WEBPACK_IMPORTED_MODULE_1__.release().split('.');
		if (
			Number(osRelease[0]) >= 10
			&& Number(osRelease[2]) >= 10_586
		) {
			return Number(osRelease[2]) >= 14_931 ? 3 : 2;
		}

		return 1;
	}

	if ('CI' in env) {
		if (['GITHUB_ACTIONS', 'GITEA_ACTIONS', 'CIRCLECI'].some(key => key in env)) {
			return 3;
		}

		if (['TRAVIS', 'APPVEYOR', 'GITLAB_CI', 'BUILDKITE', 'DRONE'].some(sign => sign in env) || env.CI_NAME === 'codeship') {
			return 1;
		}

		return min;
	}

	if ('TEAMCITY_VERSION' in env) {
		return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
	}

	if (env.COLORTERM === 'truecolor') {
		return 3;
	}

	if (env.TERM === 'xterm-kitty') {
		return 3;
	}

	if (env.TERM === 'xterm-ghostty') {
		return 3;
	}

	if (env.TERM === 'wezterm') {
		return 3;
	}

	if ('TERM_PROGRAM' in env) {
		const version = Number.parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);

		switch (env.TERM_PROGRAM) {
			case 'iTerm.app': {
				return version >= 3 ? 3 : 2;
			}

			case 'Apple_Terminal': {
				return 2;
			}
			// No default
		}
	}

	if (/-256(color)?$/i.test(env.TERM)) {
		return 2;
	}

	if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
		return 1;
	}

	if ('COLORTERM' in env) {
		return 1;
	}

	return min;
}

function createSupportsColor(stream, options = {}) {
	const level = _supportsColor(stream, {
		streamIsTTY: stream && stream.isTTY,
		...options,
	});

	return translateLevel(level);
}

const supportsColor = {
	stdout: createSupportsColor({isTTY: node_tty__WEBPACK_IMPORTED_MODULE_2__.isatty(1)}),
	stderr: createSupportsColor({isTTY: node_tty__WEBPACK_IMPORTED_MODULE_2__.isatty(2)}),
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (supportsColor);


/***/ }),
/* 20 */
/***/ ((module) => {

"use strict";
module.exports = require("node:process");

/***/ }),
/* 21 */
/***/ ((module) => {

"use strict";
module.exports = require("node:os");

/***/ }),
/* 22 */
/***/ ((module) => {

"use strict";
module.exports = require("node:tty");

/***/ }),
/* 23 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FileWatcher = void 0;
const vscode = __importStar(__webpack_require__(1));
class FileWatcher {
    watcher = null;
    disposables = [];
    lintingEndpoint;
    outputChannel;
    constructor(lintingEndpoint = "https://your-worker.workers.dev/lint") {
        this.lintingEndpoint = lintingEndpoint;
        this.outputChannel = vscode.window.createOutputChannel("Auto-Linter");
    }
    /**
     * Start watching files in the workspace
     */
    start() {
        this.outputChannel.appendLine("[FileWatcher] Starting file monitoring...");
        // Method 1: Watch specific file patterns (glob patterns)
        // This creates a watcher for TypeScript and JavaScript files
        this.watcher = vscode.workspace.createFileSystemWatcher("**/*.{ts,js,tsx,jsx}", // Watch these file types
        false, // Don't ignore creates
        false, // Don't ignore changes
        false // Don't ignore deletes
        );
        // React to file creation
        this.watcher.onDidCreate((uri) => {
            this.outputChannel.appendLine(`[FileWatcher] File created: ${uri.fsPath}`);
        });
        // React to file changes
        this.watcher.onDidChange((uri) => {
            // console.log(`[FileWatcher] File changed: ${uri.fsPath}`);
        });
        // React to file deletion
        this.watcher.onDidDelete((uri) => {
            this.outputChannel.appendLine(`[FileWatcher] File deleted: ${uri.fsPath}`);
        });
        // Method 2: Watch for document saves (best for auto-linting)
        const saveWatcher = vscode.workspace.onDidSaveTextDocument(async (document) => {
            await this.onFileSaved(document);
        });
        this.disposables.push(saveWatcher);
    }
    /**
     * Handle file save event - auto-lint the file
     */
    async onFileSaved(document) {
        // Only process certain file types
        const validExtensions = [".ts", ".js", ".tsx", ".jsx"];
        const fileExt = document.fileName.substring(document.fileName.lastIndexOf("."));
        if (!validExtensions.includes(fileExt)) {
            return; // Skip non-code files
        }
        this.outputChannel.appendLine(`[FileWatcher] Auto-linting: ${document.fileName}`);
        try {
            const code = document.getText();
            // Call your Cloudflare worker to lint the code
            const response = await fetch(this.lintingEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
            });
            if (!response.ok) {
                throw new Error(`Linting failed: ${response.status} ${response.statusText}`);
            }
            const result = await response.json();
            // Show results to user
            if (result.warnings && result.warnings.length > 0) {
                const message = `⚠️ ${result.warnings.length} issue(s) found in ${path.basename(document.fileName)}`;
                vscode.window.showWarningMessage(message);
                this.outputChannel.appendLine(`=== Linting Results for ${document.fileName} ===`);
                result.warnings.forEach((warning) => {
                    this.outputChannel.appendLine(`[${warning.severity}] ${warning.message}`);
                });
                this.outputChannel.show(true);
            }
            else {
                this.outputChannel.appendLine(`✅ No issues found in ${document.fileName}`);
            }
            // If linting produced a fixed version, optionally apply it
            if (result.linted && result.fixed && result.fixed !== code) {
                const applyFix = await vscode.window.showInformationMessage("Apply auto-fix?", "Yes", "No");
                if (applyFix === "Yes") {
                    await this.applyFix(document, result.fixed);
                }
            }
        }
        catch (error) {
            const msg = `[FileWatcher] Linting error: ${error instanceof Error ? error.message : String(error)}`;
            console.error(msg);
            this.outputChannel.appendLine(msg);
        }
    }
    /**
     * Apply the fixed code to the document
     */
    async applyFix(document, fixedCode) {
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        edit.replace(document.uri, fullRange, fixedCode);
        await vscode.workspace.applyEdit(edit);
        await document.save();
        vscode.window.showInformationMessage("✅ Auto-fix applied!");
    }
    /**
     * Stop watching files and clean up
     */
    stop() {
        if (this.watcher) {
            this.watcher.dispose();
            this.watcher = null;
        }
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
        this.outputChannel.appendLine("[FileWatcher] Stopped file monitoring");
        this.outputChannel.dispose();
    }
}
exports.FileWatcher = FileWatcher;
// Helper for path.basename since we don't import path
const path = __importStar(__webpack_require__(4));


/***/ }),
/* 24 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.LintingService = void 0;
const vscode = __importStar(__webpack_require__(1));
const events_1 = __webpack_require__(25);
const linting_1 = __webpack_require__(26);
/**
 * LintingService manages VS Code diagnostics and triggers linting
 * on various events: git logs, file edits, opens, closes, function closes
 */
class LintingService extends events_1.EventEmitter {
    diagnosticCollection;
    contextService = null;
    disposables = [];
    isEnabled = true;
    lintingDebounceTimer = null;
    DEBOUNCE_DELAY = 500; // ms
    constructor() {
        super();
        // Create a diagnostic collection for our extension
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection("contextkeeper");
    }
    /**
     * Initialize the linting service with context service
     */
    initialize(contextService) {
        this.contextService = contextService;
        this.setupEventListeners();
    }
    /**
     * Enable or disable linting
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (!enabled) {
            // Clear all diagnostics when disabled
            this.diagnosticCollection.clear();
        }
    }
    /**
     * Set up event listeners for all linting triggers
     */
    setupEventListeners() {
        // 1. Git logs refresh - lint when git context is updated
        if (this.contextService) {
            // Listen for context collection events (which includes git refresh)
            this.contextService.on("contextCollected", () => {
                if (this.isEnabled) {
                    this.debouncedLintAll();
                }
            });
            // Also listen for direct git context refresh events
            this.contextService.on("gitContextRefreshed", () => {
                if (this.isEnabled) {
                    this.debouncedLintAll();
                }
            });
        }
        // 2. File edits - lint on document changes
        const changeListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
            if (!this.isEnabled)
                return;
            if (event.contentChanges.length === 0)
                return;
            // Debounce linting to avoid excessive calls
            this.debouncedLint(event.document);
        });
        // 3. Files opened - lint when a file is opened
        const openListener = vscode.workspace.onDidOpenTextDocument(async (doc) => {
            if (!this.isEnabled)
                return;
            await (0, linting_1.refreshDiagnostics)(doc, this.diagnosticCollection);
        });
        // 4. Files closed - lint related files when a file is closed
        const closeListener = vscode.workspace.onDidCloseTextDocument(async (doc) => {
            if (!this.isEnabled)
                return;
            // Remove diagnostics for closed file
            this.diagnosticCollection.delete(doc.uri);
            // Optionally lint other open files that might be affected
            this.debouncedLintAll();
        });
        // 5. Function/Component closed - lint when function is closed
        if (this.contextService && "on" in this.contextService) {
            this.contextService.on("functionClosed", async (file) => {
                if (!this.isEnabled)
                    return;
                const doc = vscode.workspace.textDocuments.find((d) => d.fileName === file);
                if (doc) {
                    await (0, linting_1.refreshDiagnostics)(doc, this.diagnosticCollection);
                }
            });
        }
        // 6. File context changes - lint when active editor changes
        const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (!this.isEnabled)
                return;
            if (editor) {
                await (0, linting_1.refreshDiagnostics)(editor.document, this.diagnosticCollection);
            }
        });
        // Also lint on save
        const saveListener = vscode.workspace.onDidSaveTextDocument(async (doc) => {
            if (!this.isEnabled)
                return;
            await (0, linting_1.refreshDiagnostics)(doc, this.diagnosticCollection);
        });
        // Store all disposables
        this.disposables.push(changeListener, openListener, closeListener, editorChangeListener, saveListener);
    }
    /**
     * Debounced linting for a single document
     */
    debouncedLint(doc) {
        if (this.lintingDebounceTimer) {
            clearTimeout(this.lintingDebounceTimer);
        }
        this.lintingDebounceTimer = setTimeout(async () => {
            await (0, linting_1.refreshDiagnostics)(doc, this.diagnosticCollection);
            this.lintingDebounceTimer = null;
        }, this.DEBOUNCE_DELAY);
    }
    /**
     * Debounced linting for all open documents
     */
    debouncedLintAll() {
        if (this.lintingDebounceTimer) {
            clearTimeout(this.lintingDebounceTimer);
        }
        this.lintingDebounceTimer = setTimeout(async () => {
            await (0, linting_1.refreshAllDiagnostics)(this.diagnosticCollection);
            this.lintingDebounceTimer = null;
        }, this.DEBOUNCE_DELAY);
    }
    /**
     * Manually trigger linting for a specific document
     */
    async lintDocument(doc) {
        if (!this.isEnabled)
            return;
        await (0, linting_1.refreshDiagnostics)(doc, this.diagnosticCollection);
    }
    /**
     * Manually trigger linting for all open documents
     */
    async lintAllDocuments() {
        if (!this.isEnabled)
            return;
        await (0, linting_1.refreshAllDiagnostics)(this.diagnosticCollection);
    }
    /**
     * Get the diagnostic collection (for external access if needed)
     */
    getDiagnosticCollection() {
        return this.diagnosticCollection;
    }
    /**
     * Clean up and dispose of all listeners
     */
    dispose() {
        if (this.lintingDebounceTimer) {
            clearTimeout(this.lintingDebounceTimer);
        }
        this.disposables.forEach((d) => d.dispose());
        this.diagnosticCollection.dispose();
        this.disposables = [];
    }
}
exports.LintingService = LintingService;


/***/ }),
/* 25 */
/***/ ((module) => {

"use strict";
module.exports = require("events");

/***/ }),
/* 26 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.refreshDiagnostics = refreshDiagnostics;
exports.refreshAllDiagnostics = refreshAllDiagnostics;
const vscode = __importStar(__webpack_require__(1));
/**
 * Lint a document and update the diagnostic collection
 * This function performs linting and creates VS Code diagnostics
 */
async function refreshDiagnostics(doc, collection) {
    // Only lint certain file types
    const validExtensions = [".ts", ".js", ".tsx", ".jsx", ".py"];
    const fileExt = doc.fileName.substring(doc.fileName.lastIndexOf("."));
    if (!validExtensions.includes(fileExt)) {
        // Clear diagnostics for non-code files
        collection.delete(doc.uri);
        return;
    }
    try {
        const code = doc.getText();
        const diagnostics = [];
        // Get linting endpoint from settings
        const config = vscode.workspace.getConfiguration("contextkeeper");
        const endpoint = config.get("lintingEndpoint") ||
            "https://contextkeeper-worker.workers.dev/lint";
        // Call linting endpoint
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
        });
        if (!response.ok) {
            throw new Error(`Linting failed: ${response.statusText}`);
        }
        const result = await response.json();
        // Convert warnings to VS Code diagnostics
        if (result.warnings && Array.isArray(result.warnings)) {
            for (const warning of result.warnings) {
                const line = Math.max(0, (warning.line || 1) - 1); // Convert to 0-based
                const column = Math.max(0, (warning.column || 1) - 1);
                const range = new vscode.Range(line, column, line, Math.max(column + 1, doc.lineAt(line).range.end.character));
                const severity = mapSeverityToDiagnostic(warning.severity);
                const diagnostic = new vscode.Diagnostic(range, warning.message || "Linting issue", severity);
                // Add source and code if available
                diagnostic.source = "ContextKeeper";
                if (warning.code) {
                    diagnostic.code = warning.code;
                }
                // Add related information if available
                if (warning.suggestedFix) {
                    diagnostic.relatedInformation = [
                        new vscode.DiagnosticRelatedInformation(new vscode.Location(doc.uri, range), `Suggested fix: ${warning.suggestedFix}`),
                    ];
                }
                diagnostics.push(diagnostic);
            }
        }
        // Update the diagnostic collection
        collection.set(doc.uri, diagnostics);
        // Log results
        if (diagnostics.length > 0) {
            console.log(`[Linting] Found ${diagnostics.length} issue(s) in ${doc.fileName}`);
        }
    }
    catch (error) {
        console.error(`[Linting] Error linting ${doc.fileName}:`, error);
        // On error, clear diagnostics to avoid stale data
        collection.delete(doc.uri);
    }
}
/**
 * Map severity string to VS Code DiagnosticSeverity
 */
function mapSeverityToDiagnostic(severity) {
    switch (severity?.toLowerCase()) {
        case "error":
            return vscode.DiagnosticSeverity.Error;
        case "warning":
            return vscode.DiagnosticSeverity.Warning;
        case "info":
            return vscode.DiagnosticSeverity.Information;
        default:
            return vscode.DiagnosticSeverity.Warning;
    }
}
/**
 * Lint all open documents
 */
async function refreshAllDiagnostics(collection) {
    const openDocuments = vscode.workspace.textDocuments;
    for (const doc of openDocuments) {
        await refreshDiagnostics(doc, collection);
    }
}


/***/ }),
/* 27 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ContextIngestionService = void 0;
const vscode = __importStar(__webpack_require__(1));
const storage_1 = __webpack_require__(28);
const GitWatcher_1 = __webpack_require__(50);
class ContextIngestionService {
    gitWatcher = null;
    disposables = [];
    pendingEdits = new Map();
    EDIT_DEBOUNCE_MS = 2000;
    outputChannel = null;
    constructor() { }
    async initialize(context, outputChannel) {
        console.log('Initializing Context Ingestion Service...');
        if (outputChannel) {
            this.outputChannel = outputChannel;
            this.outputChannel.appendLine('ContextIngestionService: Initializing...');
        }
        // 1. Setup Git Watcher
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
            this.gitWatcher = new GitWatcher_1.GitWatcher(workspaceRoot);
            this.gitWatcher.on('commit', (commit) => this.handleGitCommit(commit));
            this.gitWatcher.start();
        }
        else {
            console.warn('No workspace root found, Git ingestion disabled.');
        }
        // 2. Setup VS Code Listeners
        this.setupListeners();
        // 3. Ensure Storage is Connected
        try {
            await storage_1.storage.connect();
            console.log('Storage connected for ingestion.');
        }
        catch (error) {
            console.error('Failed to connect storage for ingestion:', error);
        }
    }
    dispose() {
        this.gitWatcher?.stop();
        this.disposables.forEach(d => d.dispose());
        this.pendingEdits.forEach(timeout => clearTimeout(timeout));
    }
    setupListeners() {
        // File Open
        this.disposables.push(vscode.workspace.onDidOpenTextDocument(doc => this.handleFileOpen(doc)));
        // File Close
        this.disposables.push(vscode.workspace.onDidCloseTextDocument(doc => this.handleFileClose(doc)));
        // File Edit
        this.disposables.push(vscode.workspace.onDidChangeTextDocument(event => this.handleFileEdit(event)));
    }
    async handleFileOpen(document) {
        if (this.shouldIgnoreFile(document.uri)) {
            return;
        }
        try {
            await storage_1.storage.logEvent({
                timestamp: Date.now(),
                event_type: 'file_open',
                file_path: vscode.workspace.asRelativePath(document.uri),
                metadata: JSON.stringify({
                    languageId: document.languageId,
                    lineCount: document.lineCount
                })
            });
            this.logToOutput(`[FILE_OPEN] ${vscode.workspace.asRelativePath(document.uri)}`);
        }
        catch (error) {
            console.error('Error logging file_open:', error);
        }
    }
    async handleFileClose(document) {
        if (this.shouldIgnoreFile(document.uri)) {
            return;
        }
        try {
            await storage_1.storage.logEvent({
                timestamp: Date.now(),
                event_type: 'file_close',
                file_path: vscode.workspace.asRelativePath(document.uri),
                metadata: JSON.stringify({
                    languageId: document.languageId
                })
            });
            this.logToOutput(`[FILE_CLOSE] ${vscode.workspace.asRelativePath(document.uri)}`);
        }
        catch (error) {
            console.error('Error logging file_close:', error);
        }
    }
    handleFileEdit(event) {
        const document = event.document;
        if (this.shouldIgnoreFile(document.uri)) {
            return;
        }
        if (event.contentChanges.length === 0) {
            return;
        }
        const filePath = document.uri.fsPath;
        // Debounce edits
        if (this.pendingEdits.has(filePath)) {
            clearTimeout(this.pendingEdits.get(filePath));
        }
        const timeout = setTimeout(async () => {
            this.pendingEdits.delete(filePath);
            await this.processFileEdit(document, event.contentChanges);
        }, this.EDIT_DEBOUNCE_MS);
        this.pendingEdits.set(filePath, timeout);
    }
    async processFileEdit(document, changes) {
        try {
            // Calculate a rough "diff" or summary of changes
            const changeSummary = changes.map(c => ({
                range: c.range,
                textLength: c.text.length,
                textPreview: c.text.substring(0, 50).replace(/\n/g, '\\n')
            }));
            await storage_1.storage.logEvent({
                timestamp: Date.now(),
                event_type: 'file_edit',
                file_path: vscode.workspace.asRelativePath(document.uri),
                metadata: JSON.stringify({
                    languageId: document.languageId,
                    changeCount: changes.length,
                    changes: changeSummary
                })
            });
            this.logToOutput(`[FILE_EDIT] ${vscode.workspace.asRelativePath(document.uri)} (${changes.length} changes)`);
        }
        catch (error) {
            console.error('Error logging file_edit:', error);
        }
    }
    async handleGitCommit(commit) {
        try {
            await storage_1.storage.logEvent({
                timestamp: Date.now(), // Or parse commit.date
                event_type: 'git_commit',
                file_path: 'root', // Commits affect the repo
                metadata: JSON.stringify({
                    hash: commit.hash,
                    message: commit.message,
                    author: commit.author,
                    files: commit.files
                })
            });
            this.logToOutput(`[GIT_COMMIT] ${commit.hash} - ${commit.message}`);
            console.log(`Logged git commit: ${commit.hash}`);
        }
        catch (error) {
            console.error('Error logging git_commit:', error);
        }
    }
    shouldIgnoreFile(uri) {
        return uri.scheme !== 'file' || uri.fsPath.includes('.git') || uri.fsPath.includes('node_modules');
    }
    logToOutput(message) {
        if (this.outputChannel) {
            this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
        }
    }
}
exports.ContextIngestionService = ContextIngestionService;


/***/ }),
/* 28 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.storage = void 0;
const storage_1 = __webpack_require__(29);
exports.storage = new storage_1.LanceDBStorage();
__exportStar(__webpack_require__(49), exports);
__exportStar(__webpack_require__(29), exports);
__exportStar(__webpack_require__(47), exports);


/***/ }),
/* 29 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.LanceDBStorage = void 0;
const lancedb = __importStar(__webpack_require__(30));
const uuid_1 = __webpack_require__(31);
const embeddings_1 = __webpack_require__(47);
class LanceDBStorage {
    db = null;
    eventsTable = null;
    sessionsTable = null;
    actionsTable = null;
    async connect() {
        const uri = `db://${process.env.LANCEDB_DB_NAME}`;
        this.db = await lancedb.connect(uri, {
            apiKey: process.env.LANCE_DB_API_KEY,
            region: 'us-east-1'
        });
        await this.initializeTables();
    }
    async initializeTables() {
        if (!this.db) {
            throw new Error('Database not connected');
        }
        // Create or open events table
        const tableNames = await this.db.tableNames();
        if (!tableNames.includes('events')) {
            this.eventsTable = await this.db.createTable('events', [
                {
                    id: (0, uuid_1.v4)(),
                    timestamp: 0, // Old timestamp to avoid interfering with queries
                    event_type: 'file_open',
                    file_path: '/init',
                    metadata: '{}'
                }
            ]);
        }
        else {
            this.eventsTable = await this.db.openTable('events');
        }
        if (!tableNames.includes('sessions')) {
            this.sessionsTable = await this.db.createTable('sessions', [
                {
                    id: (0, uuid_1.v4)(),
                    timestamp: 0,
                    summary: 'init',
                    embedding: new Array(768).fill(0),
                    project: 'init',
                    event_count: 0
                }
            ]);
        }
        else {
            this.sessionsTable = await this.db.openTable('sessions');
        }
        if (!tableNames.includes('actions')) {
            this.actionsTable = await this.db.createTable('actions', [
                {
                    id: (0, uuid_1.v4)(),
                    session_id: 'init',
                    timestamp: 0,
                    description: 'init',
                    diff: '',
                    files: '[]',
                    embedding: new Array(768).fill(0)
                }
            ]);
        }
        else {
            this.actionsTable = await this.db.openTable('actions');
        }
    }
    async logEvent(event) {
        if (!this.eventsTable) {
            throw new Error('Events table not initialized');
        }
        const record = {
            id: (0, uuid_1.v4)(),
            ...event,
            metadata: typeof event.metadata === 'string' ? event.metadata : JSON.stringify(event.metadata || {})
        };
        await this.eventsTable.add([record]);
    }
    async createSession(summary, project) {
        if (!this.sessionsTable) {
            throw new Error('Sessions table not initialized');
        }
        const embedding = await (0, embeddings_1.generateEmbedding)(summary);
        const session = {
            id: (0, uuid_1.v4)(),
            timestamp: Date.now(),
            summary,
            embedding,
            project,
            event_count: 0
        };
        await this.sessionsTable.add([session]);
        return session;
    }
    async addAction(action) {
        if (!this.actionsTable) {
            throw new Error('Actions table not initialized');
        }
        const embedding = await (0, embeddings_1.generateEmbedding)(action.description);
        const record = {
            id: (0, uuid_1.v4)(),
            ...action,
            embedding,
            files: typeof action.files === 'string' ? action.files : JSON.stringify(action.files || [])
        };
        await this.actionsTable.add([record]);
    }
    async getLastSession() {
        if (!this.sessionsTable) {
            throw new Error('Sessions table not initialized');
        }
        // Assuming append-only, we want the last inserted. 
        // Ideally we sort by timestamp DESC.
        // LanceDB JS SDK might not support sort() directly in all versions, 
        // but let's try to fetch more and sort in memory if needed, or rely on insertion order.
        // For robustness, let's fetch the last few and sort.
        const results = await this.sessionsTable
            .query()
            .limit(10) // Fetch last 10 to be safe
            .toArray();
        if (results.length === 0) {
            return null;
        }
        // Sort by timestamp descending
        const sorted = results.sort((a, b) => b.timestamp - a.timestamp);
        return sorted[0];
    }
    async getSimilarSessions(queryText, topK = 5) {
        if (!this.sessionsTable) {
            throw new Error('Sessions table not initialized');
        }
        const embedding = await (0, embeddings_1.generateEmbedding)(queryText);
        const results = await this.sessionsTable
            .vectorSearch(embedding)
            .limit(topK)
            .toArray();
        return results;
    }
    async getRecentEvents(limit = 50) {
        if (!this.eventsTable) {
            throw new Error('Events table not initialized');
        }
        // Fetch more than limit to ensure we get the absolute latest if they are not strictly ordered on disk
        // But usually they are.
        const results = await this.eventsTable
            .query()
            .limit(limit * 2)
            .toArray();
        // Sort by timestamp descending
        const sorted = results.sort((a, b) => b.timestamp - a.timestamp);
        return sorted.slice(0, limit);
    }
    /**
     * Retrieves the file path of the most recent file edit or open event.
     * Useful for determining where the user left off.
     */
    async getLastActiveFile() {
        if (!this.eventsTable) {
            throw new Error('Events table not initialized');
        }
        const results = await this.eventsTable
            .query()
            .where("event_type IN ('file_edit', 'file_open')")
            .limit(10)
            .toArray();
        if (results.length === 0) {
            return null;
        }
        const sorted = results.sort((a, b) => b.timestamp - a.timestamp);
        return sorted[0].file_path;
    }
    // Helper for testing/cleanup
    async clearAllTables() {
        if (!this.db) {
            throw new Error('Database not connected');
        }
        const tables = ['events', 'sessions', 'actions'];
        for (const table of tables) {
            try {
                await this.db.dropTable(table);
            }
            catch (e) {
                // Ignore if table doesn't exist
            }
        }
        // Re-initialize to create empty tables
        await this.initializeTables();
    }
}
exports.LanceDBStorage = LanceDBStorage;


/***/ }),
/* 30 */
/***/ ((module) => {

"use strict";
module.exports = require("@lancedb/lancedb");

/***/ }),
/* 31 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   NIL: () => (/* reexport safe */ _nil_js__WEBPACK_IMPORTED_MODULE_4__["default"]),
/* harmony export */   parse: () => (/* reexport safe */ _parse_js__WEBPACK_IMPORTED_MODULE_8__["default"]),
/* harmony export */   stringify: () => (/* reexport safe */ _stringify_js__WEBPACK_IMPORTED_MODULE_7__["default"]),
/* harmony export */   v1: () => (/* reexport safe */ _v1_js__WEBPACK_IMPORTED_MODULE_0__["default"]),
/* harmony export */   v3: () => (/* reexport safe */ _v3_js__WEBPACK_IMPORTED_MODULE_1__["default"]),
/* harmony export */   v4: () => (/* reexport safe */ _v4_js__WEBPACK_IMPORTED_MODULE_2__["default"]),
/* harmony export */   v5: () => (/* reexport safe */ _v5_js__WEBPACK_IMPORTED_MODULE_3__["default"]),
/* harmony export */   validate: () => (/* reexport safe */ _validate_js__WEBPACK_IMPORTED_MODULE_6__["default"]),
/* harmony export */   version: () => (/* reexport safe */ _version_js__WEBPACK_IMPORTED_MODULE_5__["default"])
/* harmony export */ });
/* harmony import */ var _v1_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(32);
/* harmony import */ var _v3_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(37);
/* harmony import */ var _v4_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(41);
/* harmony import */ var _v5_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(43);
/* harmony import */ var _nil_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(45);
/* harmony import */ var _version_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(46);
/* harmony import */ var _validate_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(35);
/* harmony import */ var _stringify_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(34);
/* harmony import */ var _parse_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(39);










/***/ }),
/* 32 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _rng_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(33);
/* harmony import */ var _stringify_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(34);

 // **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html

let _nodeId;

let _clockseq; // Previous uuid creation time


let _lastMSecs = 0;
let _lastNSecs = 0; // See https://github.com/uuidjs/uuid for API details

function v1(options, buf, offset) {
  let i = buf && offset || 0;
  const b = buf || new Array(16);
  options = options || {};
  let node = options.node || _nodeId;
  let clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq; // node and clockseq need to be initialized to random values if they're not
  // specified.  We do this lazily to minimize issues related to insufficient
  // system entropy.  See #189

  if (node == null || clockseq == null) {
    const seedBytes = options.random || (options.rng || _rng_js__WEBPACK_IMPORTED_MODULE_0__["default"])();

    if (node == null) {
      // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
      node = _nodeId = [seedBytes[0] | 0x01, seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];
    }

    if (clockseq == null) {
      // Per 4.2.2, randomize (14 bit) clockseq
      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
    }
  } // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.


  let msecs = options.msecs !== undefined ? options.msecs : Date.now(); // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock

  let nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1; // Time since last uuid creation (in msecs)

  const dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 10000; // Per 4.2.1.2, Bump clockseq on clock regression

  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  } // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval


  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  } // Per 4.2.1.2 Throw error if too many uuids are requested


  if (nsecs >= 10000) {
    throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq; // Per 4.1.4 - Convert from unix epoch to Gregorian epoch

  msecs += 12219292800000; // `time_low`

  const tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff; // `time_mid`

  const tmh = msecs / 0x100000000 * 10000 & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff; // `time_high_and_version`

  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version

  b[i++] = tmh >>> 16 & 0xff; // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)

  b[i++] = clockseq >>> 8 | 0x80; // `clock_seq_low`

  b[i++] = clockseq & 0xff; // `node`

  for (let n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }

  return buf || (0,_stringify_js__WEBPACK_IMPORTED_MODULE_1__.unsafeStringify)(b);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (v1);

/***/ }),
/* 33 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ rng)
/* harmony export */ });
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6);
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(crypto__WEBPACK_IMPORTED_MODULE_0__);

const rnds8Pool = new Uint8Array(256); // # of random values to pre-allocate

let poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    crypto__WEBPACK_IMPORTED_MODULE_0___default().randomFillSync(rnds8Pool);
    poolPtr = 0;
  }

  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}

/***/ }),
/* 34 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   unsafeStringify: () => (/* binding */ unsafeStringify)
/* harmony export */ });
/* harmony import */ var _validate_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(35);

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */

const byteToHex = [];

for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 0x100).toString(16).slice(1));
}

function unsafeStringify(arr, offset = 0) {
  // Note: Be careful editing this code!  It's been tuned for performance
  // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
  return byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]];
}

function stringify(arr, offset = 0) {
  const uuid = unsafeStringify(arr, offset); // Consistency check for valid UUID.  If this throws, it's likely due to one
  // of the following:
  // - One or more input array values don't map to a hex octet (leading to
  // "undefined" in the uuid)
  // - Invalid input values for the RFC `version` or `variant` fields

  if (!(0,_validate_js__WEBPACK_IMPORTED_MODULE_0__["default"])(uuid)) {
    throw TypeError('Stringified UUID is invalid');
  }

  return uuid;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (stringify);

/***/ }),
/* 35 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _regex_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(36);


function validate(uuid) {
  return typeof uuid === 'string' && _regex_js__WEBPACK_IMPORTED_MODULE_0__["default"].test(uuid);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (validate);

/***/ }),
/* 36 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i);

/***/ }),
/* 37 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _v35_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(38);
/* harmony import */ var _md5_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(40);


const v3 = (0,_v35_js__WEBPACK_IMPORTED_MODULE_0__["default"])('v3', 0x30, _md5_js__WEBPACK_IMPORTED_MODULE_1__["default"]);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (v3);

/***/ }),
/* 38 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DNS: () => (/* binding */ DNS),
/* harmony export */   URL: () => (/* binding */ URL),
/* harmony export */   "default": () => (/* binding */ v35)
/* harmony export */ });
/* harmony import */ var _stringify_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(34);
/* harmony import */ var _parse_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(39);



function stringToBytes(str) {
  str = unescape(encodeURIComponent(str)); // UTF8 escape

  const bytes = [];

  for (let i = 0; i < str.length; ++i) {
    bytes.push(str.charCodeAt(i));
  }

  return bytes;
}

const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
function v35(name, version, hashfunc) {
  function generateUUID(value, namespace, buf, offset) {
    var _namespace;

    if (typeof value === 'string') {
      value = stringToBytes(value);
    }

    if (typeof namespace === 'string') {
      namespace = (0,_parse_js__WEBPACK_IMPORTED_MODULE_1__["default"])(namespace);
    }

    if (((_namespace = namespace) === null || _namespace === void 0 ? void 0 : _namespace.length) !== 16) {
      throw TypeError('Namespace must be array-like (16 iterable integer values, 0-255)');
    } // Compute hash of namespace and value, Per 4.3
    // Future: Use spread syntax when supported on all platforms, e.g. `bytes =
    // hashfunc([...namespace, ... value])`


    let bytes = new Uint8Array(16 + value.length);
    bytes.set(namespace);
    bytes.set(value, namespace.length);
    bytes = hashfunc(bytes);
    bytes[6] = bytes[6] & 0x0f | version;
    bytes[8] = bytes[8] & 0x3f | 0x80;

    if (buf) {
      offset = offset || 0;

      for (let i = 0; i < 16; ++i) {
        buf[offset + i] = bytes[i];
      }

      return buf;
    }

    return (0,_stringify_js__WEBPACK_IMPORTED_MODULE_0__.unsafeStringify)(bytes);
  } // Function#name is not settable on some platforms (#270)


  try {
    generateUUID.name = name; // eslint-disable-next-line no-empty
  } catch (err) {} // For CommonJS default export support


  generateUUID.DNS = DNS;
  generateUUID.URL = URL;
  return generateUUID;
}

/***/ }),
/* 39 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _validate_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(35);


function parse(uuid) {
  if (!(0,_validate_js__WEBPACK_IMPORTED_MODULE_0__["default"])(uuid)) {
    throw TypeError('Invalid UUID');
  }

  let v;
  const arr = new Uint8Array(16); // Parse ########-....-....-....-............

  arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
  arr[1] = v >>> 16 & 0xff;
  arr[2] = v >>> 8 & 0xff;
  arr[3] = v & 0xff; // Parse ........-####-....-....-............

  arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
  arr[5] = v & 0xff; // Parse ........-....-####-....-............

  arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
  arr[7] = v & 0xff; // Parse ........-....-....-####-............

  arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
  arr[9] = v & 0xff; // Parse ........-....-....-....-############
  // (Use "/" to avoid 32-bit truncation when bit-shifting high-order bytes)

  arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000 & 0xff;
  arr[11] = v / 0x100000000 & 0xff;
  arr[12] = v >>> 24 & 0xff;
  arr[13] = v >>> 16 & 0xff;
  arr[14] = v >>> 8 & 0xff;
  arr[15] = v & 0xff;
  return arr;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (parse);

/***/ }),
/* 40 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6);
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(crypto__WEBPACK_IMPORTED_MODULE_0__);


function md5(bytes) {
  if (Array.isArray(bytes)) {
    bytes = Buffer.from(bytes);
  } else if (typeof bytes === 'string') {
    bytes = Buffer.from(bytes, 'utf8');
  }

  return crypto__WEBPACK_IMPORTED_MODULE_0___default().createHash('md5').update(bytes).digest();
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (md5);

/***/ }),
/* 41 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _native_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(42);
/* harmony import */ var _rng_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(33);
/* harmony import */ var _stringify_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(34);




function v4(options, buf, offset) {
  if (_native_js__WEBPACK_IMPORTED_MODULE_0__["default"].randomUUID && !buf && !options) {
    return _native_js__WEBPACK_IMPORTED_MODULE_0__["default"].randomUUID();
  }

  options = options || {};
  const rnds = options.random || (options.rng || _rng_js__WEBPACK_IMPORTED_MODULE_1__["default"])(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`

  rnds[6] = rnds[6] & 0x0f | 0x40;
  rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided

  if (buf) {
    offset = offset || 0;

    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }

    return buf;
  }

  return (0,_stringify_js__WEBPACK_IMPORTED_MODULE_2__.unsafeStringify)(rnds);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (v4);

/***/ }),
/* 42 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6);
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(crypto__WEBPACK_IMPORTED_MODULE_0__);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
  randomUUID: (crypto__WEBPACK_IMPORTED_MODULE_0___default().randomUUID)
});

/***/ }),
/* 43 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _v35_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(38);
/* harmony import */ var _sha1_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(44);


const v5 = (0,_v35_js__WEBPACK_IMPORTED_MODULE_0__["default"])('v5', 0x50, _sha1_js__WEBPACK_IMPORTED_MODULE_1__["default"]);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (v5);

/***/ }),
/* 44 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6);
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(crypto__WEBPACK_IMPORTED_MODULE_0__);


function sha1(bytes) {
  if (Array.isArray(bytes)) {
    bytes = Buffer.from(bytes);
  } else if (typeof bytes === 'string') {
    bytes = Buffer.from(bytes, 'utf8');
  }

  return crypto__WEBPACK_IMPORTED_MODULE_0___default().createHash('sha1').update(bytes).digest();
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (sha1);

/***/ }),
/* 45 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ('00000000-0000-0000-0000-000000000000');

/***/ }),
/* 46 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _validate_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(35);


function version(uuid) {
  if (!(0,_validate_js__WEBPACK_IMPORTED_MODULE_0__["default"])(uuid)) {
    throw TypeError('Invalid UUID');
  }

  return parseInt(uuid.slice(14, 15), 16);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (version);

/***/ }),
/* 47 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.generateEmbedding = generateEmbedding;
exports.generateEmbeddings = generateEmbeddings;
const generative_ai_1 = __webpack_require__(48);
let genAI = null;
function getGenAI() {
    if (!genAI) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not set');
        }
        genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAI;
}
async function generateEmbedding(text) {
    const model = getGenAI().getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
}
async function generateEmbeddings(texts) {
    return Promise.all(texts.map(generateEmbedding));
}


/***/ }),
/* 48 */
/***/ ((__unused_webpack_module, exports) => {

"use strict";


/**
 * Contains the list of OpenAPI data types
 * as defined by https://swagger.io/docs/specification/data-models/data-types/
 * @public
 */
exports.SchemaType = void 0;
(function (SchemaType) {
    /** String type. */
    SchemaType["STRING"] = "string";
    /** Number type. */
    SchemaType["NUMBER"] = "number";
    /** Integer type. */
    SchemaType["INTEGER"] = "integer";
    /** Boolean type. */
    SchemaType["BOOLEAN"] = "boolean";
    /** Array type. */
    SchemaType["ARRAY"] = "array";
    /** Object type. */
    SchemaType["OBJECT"] = "object";
})(exports.SchemaType || (exports.SchemaType = {}));

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * @public
 */
exports.ExecutableCodeLanguage = void 0;
(function (ExecutableCodeLanguage) {
    ExecutableCodeLanguage["LANGUAGE_UNSPECIFIED"] = "language_unspecified";
    ExecutableCodeLanguage["PYTHON"] = "python";
})(exports.ExecutableCodeLanguage || (exports.ExecutableCodeLanguage = {}));
/**
 * Possible outcomes of code execution.
 * @public
 */
exports.Outcome = void 0;
(function (Outcome) {
    /**
     * Unspecified status. This value should not be used.
     */
    Outcome["OUTCOME_UNSPECIFIED"] = "outcome_unspecified";
    /**
     * Code execution completed successfully.
     */
    Outcome["OUTCOME_OK"] = "outcome_ok";
    /**
     * Code execution finished but with a failure. `stderr` should contain the
     * reason.
     */
    Outcome["OUTCOME_FAILED"] = "outcome_failed";
    /**
     * Code execution ran for too long, and was cancelled. There may or may not
     * be a partial output present.
     */
    Outcome["OUTCOME_DEADLINE_EXCEEDED"] = "outcome_deadline_exceeded";
})(exports.Outcome || (exports.Outcome = {}));

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Possible roles.
 * @public
 */
const POSSIBLE_ROLES = ["user", "model", "function", "system"];
/**
 * Harm categories that would cause prompts or candidates to be blocked.
 * @public
 */
exports.HarmCategory = void 0;
(function (HarmCategory) {
    HarmCategory["HARM_CATEGORY_UNSPECIFIED"] = "HARM_CATEGORY_UNSPECIFIED";
    HarmCategory["HARM_CATEGORY_HATE_SPEECH"] = "HARM_CATEGORY_HATE_SPEECH";
    HarmCategory["HARM_CATEGORY_SEXUALLY_EXPLICIT"] = "HARM_CATEGORY_SEXUALLY_EXPLICIT";
    HarmCategory["HARM_CATEGORY_HARASSMENT"] = "HARM_CATEGORY_HARASSMENT";
    HarmCategory["HARM_CATEGORY_DANGEROUS_CONTENT"] = "HARM_CATEGORY_DANGEROUS_CONTENT";
    HarmCategory["HARM_CATEGORY_CIVIC_INTEGRITY"] = "HARM_CATEGORY_CIVIC_INTEGRITY";
})(exports.HarmCategory || (exports.HarmCategory = {}));
/**
 * Threshold above which a prompt or candidate will be blocked.
 * @public
 */
exports.HarmBlockThreshold = void 0;
(function (HarmBlockThreshold) {
    /** Threshold is unspecified. */
    HarmBlockThreshold["HARM_BLOCK_THRESHOLD_UNSPECIFIED"] = "HARM_BLOCK_THRESHOLD_UNSPECIFIED";
    /** Content with NEGLIGIBLE will be allowed. */
    HarmBlockThreshold["BLOCK_LOW_AND_ABOVE"] = "BLOCK_LOW_AND_ABOVE";
    /** Content with NEGLIGIBLE and LOW will be allowed. */
    HarmBlockThreshold["BLOCK_MEDIUM_AND_ABOVE"] = "BLOCK_MEDIUM_AND_ABOVE";
    /** Content with NEGLIGIBLE, LOW, and MEDIUM will be allowed. */
    HarmBlockThreshold["BLOCK_ONLY_HIGH"] = "BLOCK_ONLY_HIGH";
    /** All content will be allowed. */
    HarmBlockThreshold["BLOCK_NONE"] = "BLOCK_NONE";
})(exports.HarmBlockThreshold || (exports.HarmBlockThreshold = {}));
/**
 * Probability that a prompt or candidate matches a harm category.
 * @public
 */
exports.HarmProbability = void 0;
(function (HarmProbability) {
    /** Probability is unspecified. */
    HarmProbability["HARM_PROBABILITY_UNSPECIFIED"] = "HARM_PROBABILITY_UNSPECIFIED";
    /** Content has a negligible chance of being unsafe. */
    HarmProbability["NEGLIGIBLE"] = "NEGLIGIBLE";
    /** Content has a low chance of being unsafe. */
    HarmProbability["LOW"] = "LOW";
    /** Content has a medium chance of being unsafe. */
    HarmProbability["MEDIUM"] = "MEDIUM";
    /** Content has a high chance of being unsafe. */
    HarmProbability["HIGH"] = "HIGH";
})(exports.HarmProbability || (exports.HarmProbability = {}));
/**
 * Reason that a prompt was blocked.
 * @public
 */
exports.BlockReason = void 0;
(function (BlockReason) {
    // A blocked reason was not specified.
    BlockReason["BLOCKED_REASON_UNSPECIFIED"] = "BLOCKED_REASON_UNSPECIFIED";
    // Content was blocked by safety settings.
    BlockReason["SAFETY"] = "SAFETY";
    // Content was blocked, but the reason is uncategorized.
    BlockReason["OTHER"] = "OTHER";
})(exports.BlockReason || (exports.BlockReason = {}));
/**
 * Reason that a candidate finished.
 * @public
 */
exports.FinishReason = void 0;
(function (FinishReason) {
    // Default value. This value is unused.
    FinishReason["FINISH_REASON_UNSPECIFIED"] = "FINISH_REASON_UNSPECIFIED";
    // Natural stop point of the model or provided stop sequence.
    FinishReason["STOP"] = "STOP";
    // The maximum number of tokens as specified in the request was reached.
    FinishReason["MAX_TOKENS"] = "MAX_TOKENS";
    // The candidate content was flagged for safety reasons.
    FinishReason["SAFETY"] = "SAFETY";
    // The candidate content was flagged for recitation reasons.
    FinishReason["RECITATION"] = "RECITATION";
    // The candidate content was flagged for using an unsupported language.
    FinishReason["LANGUAGE"] = "LANGUAGE";
    // Token generation stopped because the content contains forbidden terms.
    FinishReason["BLOCKLIST"] = "BLOCKLIST";
    // Token generation stopped for potentially containing prohibited content.
    FinishReason["PROHIBITED_CONTENT"] = "PROHIBITED_CONTENT";
    // Token generation stopped because the content potentially contains Sensitive Personally Identifiable Information (SPII).
    FinishReason["SPII"] = "SPII";
    // The function call generated by the model is invalid.
    FinishReason["MALFORMED_FUNCTION_CALL"] = "MALFORMED_FUNCTION_CALL";
    // Unknown reason.
    FinishReason["OTHER"] = "OTHER";
})(exports.FinishReason || (exports.FinishReason = {}));
/**
 * Task type for embedding content.
 * @public
 */
exports.TaskType = void 0;
(function (TaskType) {
    TaskType["TASK_TYPE_UNSPECIFIED"] = "TASK_TYPE_UNSPECIFIED";
    TaskType["RETRIEVAL_QUERY"] = "RETRIEVAL_QUERY";
    TaskType["RETRIEVAL_DOCUMENT"] = "RETRIEVAL_DOCUMENT";
    TaskType["SEMANTIC_SIMILARITY"] = "SEMANTIC_SIMILARITY";
    TaskType["CLASSIFICATION"] = "CLASSIFICATION";
    TaskType["CLUSTERING"] = "CLUSTERING";
})(exports.TaskType || (exports.TaskType = {}));
/**
 * @public
 */
exports.FunctionCallingMode = void 0;
(function (FunctionCallingMode) {
    // Unspecified function calling mode. This value should not be used.
    FunctionCallingMode["MODE_UNSPECIFIED"] = "MODE_UNSPECIFIED";
    // Default model behavior, model decides to predict either a function call
    // or a natural language repspose.
    FunctionCallingMode["AUTO"] = "AUTO";
    // Model is constrained to always predicting a function call only.
    // If "allowed_function_names" are set, the predicted function call will be
    // limited to any one of "allowed_function_names", else the predicted
    // function call will be any one of the provided "function_declarations".
    FunctionCallingMode["ANY"] = "ANY";
    // Model will not predict any function call. Model behavior is same as when
    // not passing any function declarations.
    FunctionCallingMode["NONE"] = "NONE";
})(exports.FunctionCallingMode || (exports.FunctionCallingMode = {}));
/**
 * The mode of the predictor to be used in dynamic retrieval.
 * @public
 */
exports.DynamicRetrievalMode = void 0;
(function (DynamicRetrievalMode) {
    // Unspecified function calling mode. This value should not be used.
    DynamicRetrievalMode["MODE_UNSPECIFIED"] = "MODE_UNSPECIFIED";
    // Run retrieval only when system decides it is necessary.
    DynamicRetrievalMode["MODE_DYNAMIC"] = "MODE_DYNAMIC";
})(exports.DynamicRetrievalMode || (exports.DynamicRetrievalMode = {}));

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Basic error type for this SDK.
 * @public
 */
class GoogleGenerativeAIError extends Error {
    constructor(message) {
        super(`[GoogleGenerativeAI Error]: ${message}`);
    }
}
/**
 * Errors in the contents of a response from the model. This includes parsing
 * errors, or responses including a safety block reason.
 * @public
 */
class GoogleGenerativeAIResponseError extends GoogleGenerativeAIError {
    constructor(message, response) {
        super(message);
        this.response = response;
    }
}
/**
 * Error class covering HTTP errors when calling the server. Includes HTTP
 * status, statusText, and optional details, if provided in the server response.
 * @public
 */
class GoogleGenerativeAIFetchError extends GoogleGenerativeAIError {
    constructor(message, status, statusText, errorDetails) {
        super(message);
        this.status = status;
        this.statusText = statusText;
        this.errorDetails = errorDetails;
    }
}
/**
 * Errors in the contents of a request originating from user input.
 * @public
 */
class GoogleGenerativeAIRequestInputError extends GoogleGenerativeAIError {
}
/**
 * Error thrown when a request is aborted, either due to a timeout or
 * intentional cancellation by the user.
 * @public
 */
class GoogleGenerativeAIAbortError extends GoogleGenerativeAIError {
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_API_VERSION = "v1beta";
/**
 * We can't `require` package.json if this runs on web. We will use rollup to
 * swap in the version number here at build time.
 */
const PACKAGE_VERSION = "0.24.1";
const PACKAGE_LOG_HEADER = "genai-js";
var Task;
(function (Task) {
    Task["GENERATE_CONTENT"] = "generateContent";
    Task["STREAM_GENERATE_CONTENT"] = "streamGenerateContent";
    Task["COUNT_TOKENS"] = "countTokens";
    Task["EMBED_CONTENT"] = "embedContent";
    Task["BATCH_EMBED_CONTENTS"] = "batchEmbedContents";
})(Task || (Task = {}));
class RequestUrl {
    constructor(model, task, apiKey, stream, requestOptions) {
        this.model = model;
        this.task = task;
        this.apiKey = apiKey;
        this.stream = stream;
        this.requestOptions = requestOptions;
    }
    toString() {
        var _a, _b;
        const apiVersion = ((_a = this.requestOptions) === null || _a === void 0 ? void 0 : _a.apiVersion) || DEFAULT_API_VERSION;
        const baseUrl = ((_b = this.requestOptions) === null || _b === void 0 ? void 0 : _b.baseUrl) || DEFAULT_BASE_URL;
        let url = `${baseUrl}/${apiVersion}/${this.model}:${this.task}`;
        if (this.stream) {
            url += "?alt=sse";
        }
        return url;
    }
}
/**
 * Simple, but may become more complex if we add more versions to log.
 */
function getClientHeaders(requestOptions) {
    const clientHeaders = [];
    if (requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.apiClient) {
        clientHeaders.push(requestOptions.apiClient);
    }
    clientHeaders.push(`${PACKAGE_LOG_HEADER}/${PACKAGE_VERSION}`);
    return clientHeaders.join(" ");
}
async function getHeaders(url) {
    var _a;
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    headers.append("x-goog-api-client", getClientHeaders(url.requestOptions));
    headers.append("x-goog-api-key", url.apiKey);
    let customHeaders = (_a = url.requestOptions) === null || _a === void 0 ? void 0 : _a.customHeaders;
    if (customHeaders) {
        if (!(customHeaders instanceof Headers)) {
            try {
                customHeaders = new Headers(customHeaders);
            }
            catch (e) {
                throw new GoogleGenerativeAIRequestInputError(`unable to convert customHeaders value ${JSON.stringify(customHeaders)} to Headers: ${e.message}`);
            }
        }
        for (const [headerName, headerValue] of customHeaders.entries()) {
            if (headerName === "x-goog-api-key") {
                throw new GoogleGenerativeAIRequestInputError(`Cannot set reserved header name ${headerName}`);
            }
            else if (headerName === "x-goog-api-client") {
                throw new GoogleGenerativeAIRequestInputError(`Header name ${headerName} can only be set using the apiClient field`);
            }
            headers.append(headerName, headerValue);
        }
    }
    return headers;
}
async function constructModelRequest(model, task, apiKey, stream, body, requestOptions) {
    const url = new RequestUrl(model, task, apiKey, stream, requestOptions);
    return {
        url: url.toString(),
        fetchOptions: Object.assign(Object.assign({}, buildFetchOptions(requestOptions)), { method: "POST", headers: await getHeaders(url), body }),
    };
}
async function makeModelRequest(model, task, apiKey, stream, body, requestOptions = {}, 
// Allows this to be stubbed for tests
fetchFn = fetch) {
    const { url, fetchOptions } = await constructModelRequest(model, task, apiKey, stream, body, requestOptions);
    return makeRequest(url, fetchOptions, fetchFn);
}
async function makeRequest(url, fetchOptions, fetchFn = fetch) {
    let response;
    try {
        response = await fetchFn(url, fetchOptions);
    }
    catch (e) {
        handleResponseError(e, url);
    }
    if (!response.ok) {
        await handleResponseNotOk(response, url);
    }
    return response;
}
function handleResponseError(e, url) {
    let err = e;
    if (err.name === "AbortError") {
        err = new GoogleGenerativeAIAbortError(`Request aborted when fetching ${url.toString()}: ${e.message}`);
        err.stack = e.stack;
    }
    else if (!(e instanceof GoogleGenerativeAIFetchError ||
        e instanceof GoogleGenerativeAIRequestInputError)) {
        err = new GoogleGenerativeAIError(`Error fetching from ${url.toString()}: ${e.message}`);
        err.stack = e.stack;
    }
    throw err;
}
async function handleResponseNotOk(response, url) {
    let message = "";
    let errorDetails;
    try {
        const json = await response.json();
        message = json.error.message;
        if (json.error.details) {
            message += ` ${JSON.stringify(json.error.details)}`;
            errorDetails = json.error.details;
        }
    }
    catch (e) {
        // ignored
    }
    throw new GoogleGenerativeAIFetchError(`Error fetching from ${url.toString()}: [${response.status} ${response.statusText}] ${message}`, response.status, response.statusText, errorDetails);
}
/**
 * Generates the request options to be passed to the fetch API.
 * @param requestOptions - The user-defined request options.
 * @returns The generated request options.
 */
function buildFetchOptions(requestOptions) {
    const fetchOptions = {};
    if ((requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.signal) !== undefined || (requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.timeout) >= 0) {
        const controller = new AbortController();
        if ((requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.timeout) >= 0) {
            setTimeout(() => controller.abort(), requestOptions.timeout);
        }
        if (requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.signal) {
            requestOptions.signal.addEventListener("abort", () => {
                controller.abort();
            });
        }
        fetchOptions.signal = controller.signal;
    }
    return fetchOptions;
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Adds convenience helper methods to a response object, including stream
 * chunks (as long as each chunk is a complete GenerateContentResponse JSON).
 */
function addHelpers(response) {
    response.text = () => {
        if (response.candidates && response.candidates.length > 0) {
            if (response.candidates.length > 1) {
                console.warn(`This response had ${response.candidates.length} ` +
                    `candidates. Returning text from the first candidate only. ` +
                    `Access response.candidates directly to use the other candidates.`);
            }
            if (hadBadFinishReason(response.candidates[0])) {
                throw new GoogleGenerativeAIResponseError(`${formatBlockErrorMessage(response)}`, response);
            }
            return getText(response);
        }
        else if (response.promptFeedback) {
            throw new GoogleGenerativeAIResponseError(`Text not available. ${formatBlockErrorMessage(response)}`, response);
        }
        return "";
    };
    /**
     * TODO: remove at next major version
     */
    response.functionCall = () => {
        if (response.candidates && response.candidates.length > 0) {
            if (response.candidates.length > 1) {
                console.warn(`This response had ${response.candidates.length} ` +
                    `candidates. Returning function calls from the first candidate only. ` +
                    `Access response.candidates directly to use the other candidates.`);
            }
            if (hadBadFinishReason(response.candidates[0])) {
                throw new GoogleGenerativeAIResponseError(`${formatBlockErrorMessage(response)}`, response);
            }
            console.warn(`response.functionCall() is deprecated. ` +
                `Use response.functionCalls() instead.`);
            return getFunctionCalls(response)[0];
        }
        else if (response.promptFeedback) {
            throw new GoogleGenerativeAIResponseError(`Function call not available. ${formatBlockErrorMessage(response)}`, response);
        }
        return undefined;
    };
    response.functionCalls = () => {
        if (response.candidates && response.candidates.length > 0) {
            if (response.candidates.length > 1) {
                console.warn(`This response had ${response.candidates.length} ` +
                    `candidates. Returning function calls from the first candidate only. ` +
                    `Access response.candidates directly to use the other candidates.`);
            }
            if (hadBadFinishReason(response.candidates[0])) {
                throw new GoogleGenerativeAIResponseError(`${formatBlockErrorMessage(response)}`, response);
            }
            return getFunctionCalls(response);
        }
        else if (response.promptFeedback) {
            throw new GoogleGenerativeAIResponseError(`Function call not available. ${formatBlockErrorMessage(response)}`, response);
        }
        return undefined;
    };
    return response;
}
/**
 * Returns all text found in all parts of first candidate.
 */
function getText(response) {
    var _a, _b, _c, _d;
    const textStrings = [];
    if ((_b = (_a = response.candidates) === null || _a === void 0 ? void 0 : _a[0].content) === null || _b === void 0 ? void 0 : _b.parts) {
        for (const part of (_d = (_c = response.candidates) === null || _c === void 0 ? void 0 : _c[0].content) === null || _d === void 0 ? void 0 : _d.parts) {
            if (part.text) {
                textStrings.push(part.text);
            }
            if (part.executableCode) {
                textStrings.push("\n```" +
                    part.executableCode.language +
                    "\n" +
                    part.executableCode.code +
                    "\n```\n");
            }
            if (part.codeExecutionResult) {
                textStrings.push("\n```\n" + part.codeExecutionResult.output + "\n```\n");
            }
        }
    }
    if (textStrings.length > 0) {
        return textStrings.join("");
    }
    else {
        return "";
    }
}
/**
 * Returns functionCall of first candidate.
 */
function getFunctionCalls(response) {
    var _a, _b, _c, _d;
    const functionCalls = [];
    if ((_b = (_a = response.candidates) === null || _a === void 0 ? void 0 : _a[0].content) === null || _b === void 0 ? void 0 : _b.parts) {
        for (const part of (_d = (_c = response.candidates) === null || _c === void 0 ? void 0 : _c[0].content) === null || _d === void 0 ? void 0 : _d.parts) {
            if (part.functionCall) {
                functionCalls.push(part.functionCall);
            }
        }
    }
    if (functionCalls.length > 0) {
        return functionCalls;
    }
    else {
        return undefined;
    }
}
const badFinishReasons = [
    exports.FinishReason.RECITATION,
    exports.FinishReason.SAFETY,
    exports.FinishReason.LANGUAGE,
];
function hadBadFinishReason(candidate) {
    return (!!candidate.finishReason &&
        badFinishReasons.includes(candidate.finishReason));
}
function formatBlockErrorMessage(response) {
    var _a, _b, _c;
    let message = "";
    if ((!response.candidates || response.candidates.length === 0) &&
        response.promptFeedback) {
        message += "Response was blocked";
        if ((_a = response.promptFeedback) === null || _a === void 0 ? void 0 : _a.blockReason) {
            message += ` due to ${response.promptFeedback.blockReason}`;
        }
        if ((_b = response.promptFeedback) === null || _b === void 0 ? void 0 : _b.blockReasonMessage) {
            message += `: ${response.promptFeedback.blockReasonMessage}`;
        }
    }
    else if ((_c = response.candidates) === null || _c === void 0 ? void 0 : _c[0]) {
        const firstCandidate = response.candidates[0];
        if (hadBadFinishReason(firstCandidate)) {
            message += `Candidate was blocked due to ${firstCandidate.finishReason}`;
            if (firstCandidate.finishMessage) {
                message += `: ${firstCandidate.finishMessage}`;
            }
        }
    }
    return message;
}

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol */


function __await(v) {
    return this instanceof __await ? (this.v = v, this) : new __await(v);
}

function __asyncGenerator(thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const responseLineRE = /^data\: (.*)(?:\n\n|\r\r|\r\n\r\n)/;
/**
 * Process a response.body stream from the backend and return an
 * iterator that provides one complete GenerateContentResponse at a time
 * and a promise that resolves with a single aggregated
 * GenerateContentResponse.
 *
 * @param response - Response from a fetch call
 */
function processStream(response) {
    const inputStream = response.body.pipeThrough(new TextDecoderStream("utf8", { fatal: true }));
    const responseStream = getResponseStream(inputStream);
    const [stream1, stream2] = responseStream.tee();
    return {
        stream: generateResponseSequence(stream1),
        response: getResponsePromise(stream2),
    };
}
async function getResponsePromise(stream) {
    const allResponses = [];
    const reader = stream.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            return addHelpers(aggregateResponses(allResponses));
        }
        allResponses.push(value);
    }
}
function generateResponseSequence(stream) {
    return __asyncGenerator(this, arguments, function* generateResponseSequence_1() {
        const reader = stream.getReader();
        while (true) {
            const { value, done } = yield __await(reader.read());
            if (done) {
                break;
            }
            yield yield __await(addHelpers(value));
        }
    });
}
/**
 * Reads a raw stream from the fetch response and join incomplete
 * chunks, returning a new stream that provides a single complete
 * GenerateContentResponse in each iteration.
 */
function getResponseStream(inputStream) {
    const reader = inputStream.getReader();
    const stream = new ReadableStream({
        start(controller) {
            let currentText = "";
            return pump();
            function pump() {
                return reader
                    .read()
                    .then(({ value, done }) => {
                    if (done) {
                        if (currentText.trim()) {
                            controller.error(new GoogleGenerativeAIError("Failed to parse stream"));
                            return;
                        }
                        controller.close();
                        return;
                    }
                    currentText += value;
                    let match = currentText.match(responseLineRE);
                    let parsedResponse;
                    while (match) {
                        try {
                            parsedResponse = JSON.parse(match[1]);
                        }
                        catch (e) {
                            controller.error(new GoogleGenerativeAIError(`Error parsing JSON response: "${match[1]}"`));
                            return;
                        }
                        controller.enqueue(parsedResponse);
                        currentText = currentText.substring(match[0].length);
                        match = currentText.match(responseLineRE);
                    }
                    return pump();
                })
                    .catch((e) => {
                    let err = e;
                    err.stack = e.stack;
                    if (err.name === "AbortError") {
                        err = new GoogleGenerativeAIAbortError("Request aborted when reading from the stream");
                    }
                    else {
                        err = new GoogleGenerativeAIError("Error reading from the stream");
                    }
                    throw err;
                });
            }
        },
    });
    return stream;
}
/**
 * Aggregates an array of `GenerateContentResponse`s into a single
 * GenerateContentResponse.
 */
function aggregateResponses(responses) {
    const lastResponse = responses[responses.length - 1];
    const aggregatedResponse = {
        promptFeedback: lastResponse === null || lastResponse === void 0 ? void 0 : lastResponse.promptFeedback,
    };
    for (const response of responses) {
        if (response.candidates) {
            let candidateIndex = 0;
            for (const candidate of response.candidates) {
                if (!aggregatedResponse.candidates) {
                    aggregatedResponse.candidates = [];
                }
                if (!aggregatedResponse.candidates[candidateIndex]) {
                    aggregatedResponse.candidates[candidateIndex] = {
                        index: candidateIndex,
                    };
                }
                // Keep overwriting, the last one will be final
                aggregatedResponse.candidates[candidateIndex].citationMetadata =
                    candidate.citationMetadata;
                aggregatedResponse.candidates[candidateIndex].groundingMetadata =
                    candidate.groundingMetadata;
                aggregatedResponse.candidates[candidateIndex].finishReason =
                    candidate.finishReason;
                aggregatedResponse.candidates[candidateIndex].finishMessage =
                    candidate.finishMessage;
                aggregatedResponse.candidates[candidateIndex].safetyRatings =
                    candidate.safetyRatings;
                /**
                 * Candidates should always have content and parts, but this handles
                 * possible malformed responses.
                 */
                if (candidate.content && candidate.content.parts) {
                    if (!aggregatedResponse.candidates[candidateIndex].content) {
                        aggregatedResponse.candidates[candidateIndex].content = {
                            role: candidate.content.role || "user",
                            parts: [],
                        };
                    }
                    const newPart = {};
                    for (const part of candidate.content.parts) {
                        if (part.text) {
                            newPart.text = part.text;
                        }
                        if (part.functionCall) {
                            newPart.functionCall = part.functionCall;
                        }
                        if (part.executableCode) {
                            newPart.executableCode = part.executableCode;
                        }
                        if (part.codeExecutionResult) {
                            newPart.codeExecutionResult = part.codeExecutionResult;
                        }
                        if (Object.keys(newPart).length === 0) {
                            newPart.text = "";
                        }
                        aggregatedResponse.candidates[candidateIndex].content.parts.push(newPart);
                    }
                }
            }
            candidateIndex++;
        }
        if (response.usageMetadata) {
            aggregatedResponse.usageMetadata = response.usageMetadata;
        }
    }
    return aggregatedResponse;
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function generateContentStream(apiKey, model, params, requestOptions) {
    const response = await makeModelRequest(model, Task.STREAM_GENERATE_CONTENT, apiKey, 
    /* stream */ true, JSON.stringify(params), requestOptions);
    return processStream(response);
}
async function generateContent(apiKey, model, params, requestOptions) {
    const response = await makeModelRequest(model, Task.GENERATE_CONTENT, apiKey, 
    /* stream */ false, JSON.stringify(params), requestOptions);
    const responseJson = await response.json();
    const enhancedResponse = addHelpers(responseJson);
    return {
        response: enhancedResponse,
    };
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function formatSystemInstruction(input) {
    // null or undefined
    if (input == null) {
        return undefined;
    }
    else if (typeof input === "string") {
        return { role: "system", parts: [{ text: input }] };
    }
    else if (input.text) {
        return { role: "system", parts: [input] };
    }
    else if (input.parts) {
        if (!input.role) {
            return { role: "system", parts: input.parts };
        }
        else {
            return input;
        }
    }
}
function formatNewContent(request) {
    let newParts = [];
    if (typeof request === "string") {
        newParts = [{ text: request }];
    }
    else {
        for (const partOrString of request) {
            if (typeof partOrString === "string") {
                newParts.push({ text: partOrString });
            }
            else {
                newParts.push(partOrString);
            }
        }
    }
    return assignRoleToPartsAndValidateSendMessageRequest(newParts);
}
/**
 * When multiple Part types (i.e. FunctionResponsePart and TextPart) are
 * passed in a single Part array, we may need to assign different roles to each
 * part. Currently only FunctionResponsePart requires a role other than 'user'.
 * @private
 * @param parts Array of parts to pass to the model
 * @returns Array of content items
 */
function assignRoleToPartsAndValidateSendMessageRequest(parts) {
    const userContent = { role: "user", parts: [] };
    const functionContent = { role: "function", parts: [] };
    let hasUserContent = false;
    let hasFunctionContent = false;
    for (const part of parts) {
        if ("functionResponse" in part) {
            functionContent.parts.push(part);
            hasFunctionContent = true;
        }
        else {
            userContent.parts.push(part);
            hasUserContent = true;
        }
    }
    if (hasUserContent && hasFunctionContent) {
        throw new GoogleGenerativeAIError("Within a single message, FunctionResponse cannot be mixed with other type of part in the request for sending chat message.");
    }
    if (!hasUserContent && !hasFunctionContent) {
        throw new GoogleGenerativeAIError("No content is provided for sending chat message.");
    }
    if (hasUserContent) {
        return userContent;
    }
    return functionContent;
}
function formatCountTokensInput(params, modelParams) {
    var _a;
    let formattedGenerateContentRequest = {
        model: modelParams === null || modelParams === void 0 ? void 0 : modelParams.model,
        generationConfig: modelParams === null || modelParams === void 0 ? void 0 : modelParams.generationConfig,
        safetySettings: modelParams === null || modelParams === void 0 ? void 0 : modelParams.safetySettings,
        tools: modelParams === null || modelParams === void 0 ? void 0 : modelParams.tools,
        toolConfig: modelParams === null || modelParams === void 0 ? void 0 : modelParams.toolConfig,
        systemInstruction: modelParams === null || modelParams === void 0 ? void 0 : modelParams.systemInstruction,
        cachedContent: (_a = modelParams === null || modelParams === void 0 ? void 0 : modelParams.cachedContent) === null || _a === void 0 ? void 0 : _a.name,
        contents: [],
    };
    const containsGenerateContentRequest = params.generateContentRequest != null;
    if (params.contents) {
        if (containsGenerateContentRequest) {
            throw new GoogleGenerativeAIRequestInputError("CountTokensRequest must have one of contents or generateContentRequest, not both.");
        }
        formattedGenerateContentRequest.contents = params.contents;
    }
    else if (containsGenerateContentRequest) {
        formattedGenerateContentRequest = Object.assign(Object.assign({}, formattedGenerateContentRequest), params.generateContentRequest);
    }
    else {
        // Array or string
        const content = formatNewContent(params);
        formattedGenerateContentRequest.contents = [content];
    }
    return { generateContentRequest: formattedGenerateContentRequest };
}
function formatGenerateContentInput(params) {
    let formattedRequest;
    if (params.contents) {
        formattedRequest = params;
    }
    else {
        // Array or string
        const content = formatNewContent(params);
        formattedRequest = { contents: [content] };
    }
    if (params.systemInstruction) {
        formattedRequest.systemInstruction = formatSystemInstruction(params.systemInstruction);
    }
    return formattedRequest;
}
function formatEmbedContentInput(params) {
    if (typeof params === "string" || Array.isArray(params)) {
        const content = formatNewContent(params);
        return { content };
    }
    return params;
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// https://ai.google.dev/api/rest/v1beta/Content#part
const VALID_PART_FIELDS = [
    "text",
    "inlineData",
    "functionCall",
    "functionResponse",
    "executableCode",
    "codeExecutionResult",
];
const VALID_PARTS_PER_ROLE = {
    user: ["text", "inlineData"],
    function: ["functionResponse"],
    model: ["text", "functionCall", "executableCode", "codeExecutionResult"],
    // System instructions shouldn't be in history anyway.
    system: ["text"],
};
function validateChatHistory(history) {
    let prevContent = false;
    for (const currContent of history) {
        const { role, parts } = currContent;
        if (!prevContent && role !== "user") {
            throw new GoogleGenerativeAIError(`First content should be with role 'user', got ${role}`);
        }
        if (!POSSIBLE_ROLES.includes(role)) {
            throw new GoogleGenerativeAIError(`Each item should include role field. Got ${role} but valid roles are: ${JSON.stringify(POSSIBLE_ROLES)}`);
        }
        if (!Array.isArray(parts)) {
            throw new GoogleGenerativeAIError("Content should have 'parts' property with an array of Parts");
        }
        if (parts.length === 0) {
            throw new GoogleGenerativeAIError("Each Content should have at least one part");
        }
        const countFields = {
            text: 0,
            inlineData: 0,
            functionCall: 0,
            functionResponse: 0,
            fileData: 0,
            executableCode: 0,
            codeExecutionResult: 0,
        };
        for (const part of parts) {
            for (const key of VALID_PART_FIELDS) {
                if (key in part) {
                    countFields[key] += 1;
                }
            }
        }
        const validParts = VALID_PARTS_PER_ROLE[role];
        for (const key of VALID_PART_FIELDS) {
            if (!validParts.includes(key) && countFields[key] > 0) {
                throw new GoogleGenerativeAIError(`Content with role '${role}' can't contain '${key}' part`);
            }
        }
        prevContent = true;
    }
}
/**
 * Returns true if the response is valid (could be appended to the history), flase otherwise.
 */
function isValidResponse(response) {
    var _a;
    if (response.candidates === undefined || response.candidates.length === 0) {
        return false;
    }
    const content = (_a = response.candidates[0]) === null || _a === void 0 ? void 0 : _a.content;
    if (content === undefined) {
        return false;
    }
    if (content.parts === undefined || content.parts.length === 0) {
        return false;
    }
    for (const part of content.parts) {
        if (part === undefined || Object.keys(part).length === 0) {
            return false;
        }
        if (part.text !== undefined && part.text === "") {
            return false;
        }
    }
    return true;
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Do not log a message for this error.
 */
const SILENT_ERROR = "SILENT_ERROR";
/**
 * ChatSession class that enables sending chat messages and stores
 * history of sent and received messages so far.
 *
 * @public
 */
class ChatSession {
    constructor(apiKey, model, params, _requestOptions = {}) {
        this.model = model;
        this.params = params;
        this._requestOptions = _requestOptions;
        this._history = [];
        this._sendPromise = Promise.resolve();
        this._apiKey = apiKey;
        if (params === null || params === void 0 ? void 0 : params.history) {
            validateChatHistory(params.history);
            this._history = params.history;
        }
    }
    /**
     * Gets the chat history so far. Blocked prompts are not added to history.
     * Blocked candidates are not added to history, nor are the prompts that
     * generated them.
     */
    async getHistory() {
        await this._sendPromise;
        return this._history;
    }
    /**
     * Sends a chat message and receives a non-streaming
     * {@link GenerateContentResult}.
     *
     * Fields set in the optional {@link SingleRequestOptions} parameter will
     * take precedence over the {@link RequestOptions} values provided to
     * {@link GoogleGenerativeAI.getGenerativeModel }.
     */
    async sendMessage(request, requestOptions = {}) {
        var _a, _b, _c, _d, _e, _f;
        await this._sendPromise;
        const newContent = formatNewContent(request);
        const generateContentRequest = {
            safetySettings: (_a = this.params) === null || _a === void 0 ? void 0 : _a.safetySettings,
            generationConfig: (_b = this.params) === null || _b === void 0 ? void 0 : _b.generationConfig,
            tools: (_c = this.params) === null || _c === void 0 ? void 0 : _c.tools,
            toolConfig: (_d = this.params) === null || _d === void 0 ? void 0 : _d.toolConfig,
            systemInstruction: (_e = this.params) === null || _e === void 0 ? void 0 : _e.systemInstruction,
            cachedContent: (_f = this.params) === null || _f === void 0 ? void 0 : _f.cachedContent,
            contents: [...this._history, newContent],
        };
        const chatSessionRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        let finalResult;
        // Add onto the chain.
        this._sendPromise = this._sendPromise
            .then(() => generateContent(this._apiKey, this.model, generateContentRequest, chatSessionRequestOptions))
            .then((result) => {
            var _a;
            if (isValidResponse(result.response)) {
                this._history.push(newContent);
                const responseContent = Object.assign({ parts: [], 
                    // Response seems to come back without a role set.
                    role: "model" }, (_a = result.response.candidates) === null || _a === void 0 ? void 0 : _a[0].content);
                this._history.push(responseContent);
            }
            else {
                const blockErrorMessage = formatBlockErrorMessage(result.response);
                if (blockErrorMessage) {
                    console.warn(`sendMessage() was unsuccessful. ${blockErrorMessage}. Inspect response object for details.`);
                }
            }
            finalResult = result;
        })
            .catch((e) => {
            // Resets _sendPromise to avoid subsequent calls failing and throw error.
            this._sendPromise = Promise.resolve();
            throw e;
        });
        await this._sendPromise;
        return finalResult;
    }
    /**
     * Sends a chat message and receives the response as a
     * {@link GenerateContentStreamResult} containing an iterable stream
     * and a response promise.
     *
     * Fields set in the optional {@link SingleRequestOptions} parameter will
     * take precedence over the {@link RequestOptions} values provided to
     * {@link GoogleGenerativeAI.getGenerativeModel }.
     */
    async sendMessageStream(request, requestOptions = {}) {
        var _a, _b, _c, _d, _e, _f;
        await this._sendPromise;
        const newContent = formatNewContent(request);
        const generateContentRequest = {
            safetySettings: (_a = this.params) === null || _a === void 0 ? void 0 : _a.safetySettings,
            generationConfig: (_b = this.params) === null || _b === void 0 ? void 0 : _b.generationConfig,
            tools: (_c = this.params) === null || _c === void 0 ? void 0 : _c.tools,
            toolConfig: (_d = this.params) === null || _d === void 0 ? void 0 : _d.toolConfig,
            systemInstruction: (_e = this.params) === null || _e === void 0 ? void 0 : _e.systemInstruction,
            cachedContent: (_f = this.params) === null || _f === void 0 ? void 0 : _f.cachedContent,
            contents: [...this._history, newContent],
        };
        const chatSessionRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        const streamPromise = generateContentStream(this._apiKey, this.model, generateContentRequest, chatSessionRequestOptions);
        // Add onto the chain.
        this._sendPromise = this._sendPromise
            .then(() => streamPromise)
            // This must be handled to avoid unhandled rejection, but jump
            // to the final catch block with a label to not log this error.
            .catch((_ignored) => {
            throw new Error(SILENT_ERROR);
        })
            .then((streamResult) => streamResult.response)
            .then((response) => {
            if (isValidResponse(response)) {
                this._history.push(newContent);
                const responseContent = Object.assign({}, response.candidates[0].content);
                // Response seems to come back without a role set.
                if (!responseContent.role) {
                    responseContent.role = "model";
                }
                this._history.push(responseContent);
            }
            else {
                const blockErrorMessage = formatBlockErrorMessage(response);
                if (blockErrorMessage) {
                    console.warn(`sendMessageStream() was unsuccessful. ${blockErrorMessage}. Inspect response object for details.`);
                }
            }
        })
            .catch((e) => {
            // Errors in streamPromise are already catchable by the user as
            // streamPromise is returned.
            // Avoid duplicating the error message in logs.
            if (e.message !== SILENT_ERROR) {
                // Users do not have access to _sendPromise to catch errors
                // downstream from streamPromise, so they should not throw.
                console.error(e);
            }
        });
        return streamPromise;
    }
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function countTokens(apiKey, model, params, singleRequestOptions) {
    const response = await makeModelRequest(model, Task.COUNT_TOKENS, apiKey, false, JSON.stringify(params), singleRequestOptions);
    return response.json();
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function embedContent(apiKey, model, params, requestOptions) {
    const response = await makeModelRequest(model, Task.EMBED_CONTENT, apiKey, false, JSON.stringify(params), requestOptions);
    return response.json();
}
async function batchEmbedContents(apiKey, model, params, requestOptions) {
    const requestsWithModel = params.requests.map((request) => {
        return Object.assign(Object.assign({}, request), { model });
    });
    const response = await makeModelRequest(model, Task.BATCH_EMBED_CONTENTS, apiKey, false, JSON.stringify({ requests: requestsWithModel }), requestOptions);
    return response.json();
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Class for generative model APIs.
 * @public
 */
class GenerativeModel {
    constructor(apiKey, modelParams, _requestOptions = {}) {
        this.apiKey = apiKey;
        this._requestOptions = _requestOptions;
        if (modelParams.model.includes("/")) {
            // Models may be named "models/model-name" or "tunedModels/model-name"
            this.model = modelParams.model;
        }
        else {
            // If path is not included, assume it's a non-tuned model.
            this.model = `models/${modelParams.model}`;
        }
        this.generationConfig = modelParams.generationConfig || {};
        this.safetySettings = modelParams.safetySettings || [];
        this.tools = modelParams.tools;
        this.toolConfig = modelParams.toolConfig;
        this.systemInstruction = formatSystemInstruction(modelParams.systemInstruction);
        this.cachedContent = modelParams.cachedContent;
    }
    /**
     * Makes a single non-streaming call to the model
     * and returns an object containing a single {@link GenerateContentResponse}.
     *
     * Fields set in the optional {@link SingleRequestOptions} parameter will
     * take precedence over the {@link RequestOptions} values provided to
     * {@link GoogleGenerativeAI.getGenerativeModel }.
     */
    async generateContent(request, requestOptions = {}) {
        var _a;
        const formattedParams = formatGenerateContentInput(request);
        const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        return generateContent(this.apiKey, this.model, Object.assign({ generationConfig: this.generationConfig, safetySettings: this.safetySettings, tools: this.tools, toolConfig: this.toolConfig, systemInstruction: this.systemInstruction, cachedContent: (_a = this.cachedContent) === null || _a === void 0 ? void 0 : _a.name }, formattedParams), generativeModelRequestOptions);
    }
    /**
     * Makes a single streaming call to the model and returns an object
     * containing an iterable stream that iterates over all chunks in the
     * streaming response as well as a promise that returns the final
     * aggregated response.
     *
     * Fields set in the optional {@link SingleRequestOptions} parameter will
     * take precedence over the {@link RequestOptions} values provided to
     * {@link GoogleGenerativeAI.getGenerativeModel }.
     */
    async generateContentStream(request, requestOptions = {}) {
        var _a;
        const formattedParams = formatGenerateContentInput(request);
        const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        return generateContentStream(this.apiKey, this.model, Object.assign({ generationConfig: this.generationConfig, safetySettings: this.safetySettings, tools: this.tools, toolConfig: this.toolConfig, systemInstruction: this.systemInstruction, cachedContent: (_a = this.cachedContent) === null || _a === void 0 ? void 0 : _a.name }, formattedParams), generativeModelRequestOptions);
    }
    /**
     * Gets a new {@link ChatSession} instance which can be used for
     * multi-turn chats.
     */
    startChat(startChatParams) {
        var _a;
        return new ChatSession(this.apiKey, this.model, Object.assign({ generationConfig: this.generationConfig, safetySettings: this.safetySettings, tools: this.tools, toolConfig: this.toolConfig, systemInstruction: this.systemInstruction, cachedContent: (_a = this.cachedContent) === null || _a === void 0 ? void 0 : _a.name }, startChatParams), this._requestOptions);
    }
    /**
     * Counts the tokens in the provided request.
     *
     * Fields set in the optional {@link SingleRequestOptions} parameter will
     * take precedence over the {@link RequestOptions} values provided to
     * {@link GoogleGenerativeAI.getGenerativeModel }.
     */
    async countTokens(request, requestOptions = {}) {
        const formattedParams = formatCountTokensInput(request, {
            model: this.model,
            generationConfig: this.generationConfig,
            safetySettings: this.safetySettings,
            tools: this.tools,
            toolConfig: this.toolConfig,
            systemInstruction: this.systemInstruction,
            cachedContent: this.cachedContent,
        });
        const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        return countTokens(this.apiKey, this.model, formattedParams, generativeModelRequestOptions);
    }
    /**
     * Embeds the provided content.
     *
     * Fields set in the optional {@link SingleRequestOptions} parameter will
     * take precedence over the {@link RequestOptions} values provided to
     * {@link GoogleGenerativeAI.getGenerativeModel }.
     */
    async embedContent(request, requestOptions = {}) {
        const formattedParams = formatEmbedContentInput(request);
        const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        return embedContent(this.apiKey, this.model, formattedParams, generativeModelRequestOptions);
    }
    /**
     * Embeds an array of {@link EmbedContentRequest}s.
     *
     * Fields set in the optional {@link SingleRequestOptions} parameter will
     * take precedence over the {@link RequestOptions} values provided to
     * {@link GoogleGenerativeAI.getGenerativeModel }.
     */
    async batchEmbedContents(batchEmbedContentRequest, requestOptions = {}) {
        const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
        return batchEmbedContents(this.apiKey, this.model, batchEmbedContentRequest, generativeModelRequestOptions);
    }
}

/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Top-level class for this SDK
 * @public
 */
class GoogleGenerativeAI {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    /**
     * Gets a {@link GenerativeModel} instance for the provided model name.
     */
    getGenerativeModel(modelParams, requestOptions) {
        if (!modelParams.model) {
            throw new GoogleGenerativeAIError(`Must provide a model name. ` +
                `Example: genai.getGenerativeModel({ model: 'my-model-name' })`);
        }
        return new GenerativeModel(this.apiKey, modelParams, requestOptions);
    }
    /**
     * Creates a {@link GenerativeModel} instance from provided content cache.
     */
    getGenerativeModelFromCachedContent(cachedContent, modelParams, requestOptions) {
        if (!cachedContent.name) {
            throw new GoogleGenerativeAIRequestInputError("Cached content must contain a `name` field.");
        }
        if (!cachedContent.model) {
            throw new GoogleGenerativeAIRequestInputError("Cached content must contain a `model` field.");
        }
        /**
         * Not checking tools and toolConfig for now as it would require a deep
         * equality comparison and isn't likely to be a common case.
         */
        const disallowedDuplicates = ["model", "systemInstruction"];
        for (const key of disallowedDuplicates) {
            if ((modelParams === null || modelParams === void 0 ? void 0 : modelParams[key]) &&
                cachedContent[key] &&
                (modelParams === null || modelParams === void 0 ? void 0 : modelParams[key]) !== cachedContent[key]) {
                if (key === "model") {
                    const modelParamsComp = modelParams.model.startsWith("models/")
                        ? modelParams.model.replace("models/", "")
                        : modelParams.model;
                    const cachedContentComp = cachedContent.model.startsWith("models/")
                        ? cachedContent.model.replace("models/", "")
                        : cachedContent.model;
                    if (modelParamsComp === cachedContentComp) {
                        continue;
                    }
                }
                throw new GoogleGenerativeAIRequestInputError(`Different value for "${key}" specified in modelParams` +
                    ` (${modelParams[key]}) and cachedContent (${cachedContent[key]})`);
            }
        }
        const modelParamsFromCache = Object.assign(Object.assign({}, modelParams), { model: cachedContent.model, tools: cachedContent.tools, toolConfig: cachedContent.toolConfig, systemInstruction: cachedContent.systemInstruction, cachedContent });
        return new GenerativeModel(this.apiKey, modelParamsFromCache, requestOptions);
    }
}

exports.ChatSession = ChatSession;
exports.GenerativeModel = GenerativeModel;
exports.GoogleGenerativeAI = GoogleGenerativeAI;
exports.GoogleGenerativeAIAbortError = GoogleGenerativeAIAbortError;
exports.GoogleGenerativeAIError = GoogleGenerativeAIError;
exports.GoogleGenerativeAIFetchError = GoogleGenerativeAIFetchError;
exports.GoogleGenerativeAIRequestInputError = GoogleGenerativeAIRequestInputError;
exports.GoogleGenerativeAIResponseError = GoogleGenerativeAIResponseError;
exports.POSSIBLE_ROLES = POSSIBLE_ROLES;
//# sourceMappingURL=index.js.map


/***/ }),
/* 49 */
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));


/***/ }),
/* 50 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GitWatcher = void 0;
const events_1 = __webpack_require__(25);
const gitlog_1 = __webpack_require__(8);
class GitWatcher extends events_1.EventEmitter {
    workspaceRoot;
    intervalMs;
    lastCommitHash = null;
    pollInterval = null;
    isPolling = false;
    constructor(workspaceRoot, intervalMs = 30000) {
        super();
        this.workspaceRoot = workspaceRoot;
        this.intervalMs = intervalMs;
    }
    start() {
        if (this.pollInterval) {
            return;
        }
        // Initial check
        this.checkGitLog();
        // Start polling
        this.pollInterval = setInterval(() => {
            this.checkGitLog();
        }, this.intervalMs);
        console.log('GitWatcher started.');
    }
    stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        console.log('GitWatcher stopped.');
    }
    async checkGitLog() {
        if (this.isPolling) {
            return;
        }
        this.isPolling = true;
        try {
            const logs = await (0, gitlog_1.getLogsWithGitlog)(this.workspaceRoot);
            if (!logs || logs.length === 0) {
                this.isPolling = false;
                return;
            }
            // If it's the first run, just set the last commit and return (or process all? let's process latest)
            if (!this.lastCommitHash) {
                this.lastCommitHash = logs[0].hash;
                this.isPolling = false;
                return;
            }
            // Find new commits since last hash
            const newCommits = [];
            for (const log of logs) {
                if (log.hash === this.lastCommitHash) {
                    break;
                }
                newCommits.push({
                    hash: log.hash,
                    message: log.subject,
                    author: log.authorName,
                    date: log.authorDate,
                    files: log.files || []
                });
            }
            // Emit events for new commits (oldest to newest)
            if (newCommits.length > 0) {
                this.lastCommitHash = newCommits[0].hash; // Update to the newest
                for (let i = newCommits.length - 1; i >= 0; i--) {
                    this.emit('commit', newCommits[i]);
                }
            }
        }
        catch (error) {
            console.warn('GitWatcher error:', error);
        }
        finally {
            this.isPolling = false;
        }
    }
}
exports.GitWatcher = GitWatcher;


/***/ }),
/* 51 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

/**
 * Mock Context Service
 *
 * Provides fake developer context data for UI development.
 * INTEGRATION: Replace with real ContextService that uses vscode API.
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MockContextService = void 0;
const events_1 = __webpack_require__(25);
class MockContextService extends events_1.EventEmitter {
    mockContext;
    constructor() {
        super();
        this.mockContext = this.generateMockContext();
    }
    async collectContext() {
        // Simulate network delay
        await this.delay(500);
        // Update some fields to simulate real-time changes
        this.mockContext.session.totalEdits += Math.floor(Math.random() * 5);
        this.mockContext.files.activeFile = this.mockContext.files.openFiles[Math.floor(Math.random() * this.mockContext.files.openFiles.length)];
        this.emit('contextCollected', this.mockContext);
        return this.mockContext;
    }
    getCurrentFile() {
        return this.mockContext.files.activeFile;
    }
    getRiskyFiles() {
        return this.mockContext.session.riskyFiles;
    }
    generateMockContext() {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 3600000);
        return {
            git: {
                recentCommits: [
                    {
                        hash: 'abc1234',
                        message: 'feat: Add user authentication flow',
                        author: 'You',
                        date: new Date(now.getTime() - 7200000), // 2 hours ago
                    },
                    {
                        hash: 'def5678',
                        message: 'fix: Handle null reference in login',
                        author: 'You',
                        date: new Date(now.getTime() - 3600000), // 1 hour ago
                    },
                    {
                        hash: '9ab0cde',
                        message: 'refactor: Extract validation logic',
                        author: 'Teammate',
                        date: new Date(now.getTime() - 1800000), // 30 min ago
                    },
                ],
                currentBranch: 'feature/autonomous-copilot',
                uncommittedChanges: [
                    { file: 'src/extension.ts', linesAdded: 47, linesRemoved: 12 },
                    { file: 'src/services/mock/MockAIService.ts', linesAdded: 89, linesRemoved: 3 },
                    { file: 'src/ui/StatusBarManager.ts', linesAdded: 25, linesRemoved: 0 },
                ],
            },
            files: {
                openFiles: [
                    'src/extension.ts',
                    'src/services/interfaces.ts',
                    'src/services/mock/MockAIService.ts',
                    'src/ui/StatusBarManager.ts',
                    'README.md',
                ],
                activeFile: 'src/extension.ts',
                recentlyEdited: [
                    { file: 'src/extension.ts', timestamp: new Date(now.getTime() - 300000), changes: 15 },
                    { file: 'src/services/mock/MockAIService.ts', timestamp: new Date(now.getTime() - 600000), changes: 23 },
                    { file: 'src/ui/StatusBarManager.ts', timestamp: new Date(now.getTime() - 900000), changes: 8 },
                ],
                editFrequency: new Map([
                    ['src/extension.ts', 27],
                    ['src/services/interfaces.ts', 8],
                    ['src/services/mock/MockAIService.ts', 15],
                    ['src/ui/StatusBarManager.ts', 12],
                    ['README.md', 3],
                ]),
            },
            cursor: {
                file: 'src/extension.ts',
                line: 42,
                column: 15,
                currentFunction: 'activate',
                selectedText: '',
            },
            timeline: {
                edits: [
                    { file: 'src/extension.ts', line: 42, timestamp: new Date(now.getTime() - 120000), chars: 25 },
                    { file: 'src/extension.ts', line: 45, timestamp: new Date(now.getTime() - 180000), chars: 43 },
                    { file: 'src/services/mock/MockAIService.ts', line: 67, timestamp: new Date(now.getTime() - 300000), chars: 18 },
                ],
                opens: [
                    { file: 'src/extension.ts', timestamp: oneHourAgo },
                    { file: 'src/services/interfaces.ts', timestamp: new Date(oneHourAgo.getTime() + 600000) },
                ],
                closes: [
                    { file: 'package.json', timestamp: new Date(oneHourAgo.getTime() + 300000) },
                ],
            },
            session: {
                startTime: oneHourAgo,
                totalEdits: 47,
                riskyFiles: ['src/extension.ts', 'src/services/mock/MockAIService.ts'], // High edit frequency
            },
        };
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.MockContextService = MockContextService;


/***/ }),
/* 52 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GeminiService = void 0;
const gemini_client_1 = __webpack_require__(53);
const context_builder_1 = __webpack_require__(55);
const events_1 = __webpack_require__(25);
class GeminiService extends events_1.EventEmitter {
    client;
    isInitialized = false;
    batchCache = new Map();
    constructor() {
        super();
        this.client = new gemini_client_1.GeminiClient();
    }
    async initialize(apiKey) {
        await this.client.initialize(apiKey);
        this.isInitialized = true;
    }
    /**
     * Runs a batch analysis on the active file and potentially related files.
     * This leverages the large context window to get analysis, tests, and fixes in one go.
     */
    async analyze(code, context) {
        if (!this.isInitialized) {
            const error = new Error("GeminiService not initialized. Please check your API key settings.");
            this.emit('error', error);
            throw error;
        }
        this.emit('analysisStarted');
        try {
            const geminiContext = context_builder_1.ContextBuilder.build({
                gitLogs: context.git.recentCommits.map(c => `${c.hash.substring(0, 7)} - ${c.message}`),
                gitDiff: "",
                openFiles: context.files.openFiles,
                activeFile: context.files.activeFile,
                errors: [],
                editHistory: context.files.recentlyEdited.map(e => ({
                    file: e.file,
                    timestamp: e.timestamp.getTime()
                }))
            });
            // Prepare batch payload
            const filesToAnalyze = new Map();
            filesToAnalyze.set(context.files.activeFile, code);
            // In a real scenario, we would read related files here and add them to the map
            // For now, we focus on the active file but use the batch endpoint structure
            this.emit('analysisProgress', 20, 'Sending batch context to Gemini...');
            // Use runBatch instead of analyzeCode
            const batchResult = await this.client.runBatch(filesToAnalyze, geminiContext);
            // Cache the result for future use (e.g. generateTests calls)
            this.batchCache.set(context.files.activeFile, batchResult);
            this.emit('analysisProgress', 80, 'Processing batch results...');
            // Extract analysis for the active file
            const fileResult = batchResult.files.find(f => f.file === context.files.activeFile) || batchResult.files[0];
            if (!fileResult) {
                throw new Error("No analysis result found for active file");
            }
            const analysis = {
                issues: fileResult.analysis.issues.map((i, idx) => ({
                    id: `issue-${idx}`,
                    file: context.files.activeFile,
                    line: i.line,
                    column: 0,
                    severity: i.severity || 'warning',
                    message: i.message
                })),
                suggestions: fileResult.analysis.suggestions.map(s => ({
                    type: 'refactor',
                    message: s
                })),
                riskLevel: fileResult.analysis.risk_level || 'low',
                confidence: 0.9,
                timestamp: new Date()
            };
            this.emit('analysisComplete', analysis);
            return analysis;
        }
        catch (error) {
            console.error("GeminiService Analysis Error:", error);
            this.emit('error', error);
            throw error;
        }
    }
    async generateTests(code) {
        if (!this.isInitialized) {
            throw new Error("GeminiService not initialized");
        }
        // Check cache first
        // Note: In a real app, we'd need a better cache key than just the file content or path
        // For now, we assume the last analysis run populated the cache for the active file
        for (const [key, batch] of this.batchCache.entries()) {
            const fileResult = batch.files.find(f => f.generatedTests);
            if (fileResult && fileResult.generatedTests) {
                console.log("Returning cached tests from batch analysis");
                return fileResult.generatedTests;
            }
        }
        // Fallback to single call if not cached
        return this.client.generateTests(code);
    }
    async fixError(code, error) {
        if (!this.isInitialized) {
            throw new Error("GeminiService not initialized");
        }
        // Check cache for pre-calculated fixes
        // This is a simplification; matching specific errors to cached fixes is complex
        // For now, we'll fall back to the direct call for specific error fixes
        const fix = await this.client.fixError(code, error);
        return {
            fixedCode: fix.fixedCode,
            explanation: "Fixed by Gemini AI",
            diff: ""
        };
    }
    async explainCode(code) {
        return "Explanation not implemented yet";
    }
}
exports.GeminiService = GeminiService;


/***/ }),
/* 53 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GeminiClient = void 0;
const prompts_1 = __webpack_require__(54);
class GeminiClient {
    apiKey = "";
    model = "gemini-2.5-flash";
    ready = false;
    lastRequestTime = 0;
    minRequestInterval = 2000; // 2 seconds between requests to be safe
    async initialize(apiKey, model = "gemini-2.5-flash") {
        this.apiKey = apiKey;
        this.model = model;
        this.ready = true;
    }
    isReady() {
        return this.ready;
    }
    enableMockMode() {
        this.model = "mock";
    }
    async rateLimit() {
        const now = Date.now();
        const timeSinceLast = now - this.lastRequestTime;
        if (timeSinceLast < this.minRequestInterval) {
            const wait = this.minRequestInterval - timeSinceLast;
            await new Promise(resolve => setTimeout(resolve, wait));
        }
        this.lastRequestTime = Date.now();
    }
    parseJsonFromText(text, fallback) {
        try {
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace === -1 || lastBrace === -1) {
                throw new Error("No JSON object found in response");
            }
            const jsonStr = text.substring(firstBrace, lastBrace + 1);
            return JSON.parse(jsonStr);
        }
        catch (e) {
            console.warn("Failed to parse Gemini JSON response:", e);
            return fallback;
        }
    }
    async runBatch(files, context) {
        if (!this.ready) {
            throw new Error("GeminiClient not initialized");
        }
        await this.rateLimit();
        if (this.model === "mock") {
            return {
                globalSummary: "Mock batch analysis",
                files: Array.from(files.keys()).map(f => ({
                    file: f,
                    analysis: { issues: [], suggestions: [], risk_level: 'low' },
                    generatedTests: "// Mock tests",
                    suggestedFixes: []
                }))
            };
        }
        const prompt = prompts_1.PromptTemplates.batchProcess(files, context);
        try {
            const response = await this.fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });
            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.statusText}`);
            }
            const data = await response.json();
            return this.parseBatchResponse(data);
        }
        catch (error) {
            console.error("Gemini batch analysis failed:", error);
            throw error;
        }
    }
    parseBatchResponse(data) {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return this.parseJsonFromText(text, {
            globalSummary: "Failed to parse AI response",
            files: []
        });
    }
    async analyzeCode(code, context) {
        if (!this.ready) {
            throw new Error("GeminiClient not initialized");
        }
        await this.rateLimit();
        if (this.model === "mock") {
            return {
                issues: [
                    { line: 1, severity: "warning", message: "Mock issue: Variable might be undefined" }
                ],
                suggestions: ["Add a null check"],
                risk_level: "low",
                summary: "Mock analysis result"
            };
        }
        const prompt = prompts_1.PromptTemplates.codeAnalysis(code, context);
        try {
            const response = await this.fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });
            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.statusText}`);
            }
            const data = await response.json();
            return this.parseAnalysis(data);
        }
        catch (error) {
            console.error("Gemini analysis failed:", error);
            throw error;
        }
    }
    async fetchWithRetry(url, options, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.ok) {
                    return response;
                }
                console.warn(`Gemini API attempt ${i + 1} failed: ${response.status} ${response.statusText}`);
                // If 429 (Too Many Requests) or 5xx, retry
                if (response.status === 429 || response.status >= 500) {
                    const delay = Math.pow(2, i) * 1000; // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                return response;
            }
            catch (error) {
                console.warn(`Gemini API network error attempt ${i + 1}:`, error);
                if (i === retries - 1) {
                    throw error;
                }
                const delay = Math.pow(2, i) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw new Error("Max retries exceeded");
    }
    parseAnalysis(data) {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const fallback = {
            issues: [],
            suggestions: ["Failed to parse AI response. Please try again."],
            risk_level: 'low',
            summary: "Error parsing AI response."
        };
        const parsed = this.parseJsonFromText(text, fallback);
        // Ensure structure even if parsed correctly but missing fields
        return {
            issues: Array.isArray(parsed.issues) ? parsed.issues : [],
            suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
            risk_level: parsed.risk_level || 'low',
            summary: parsed.summary,
            context_analysis: parsed.context_analysis
        };
    }
    async generateTests(functionCode) {
        if (!this.ready) {
            throw new Error("GeminiClient not initialized");
        }
        await this.rateLimit();
        if (this.model === "mock") {
            return `
describe('generatedTest', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});`;
        }
        const prompt = prompts_1.PromptTemplates.testGeneration(functionCode);
        try {
            const response = await this.fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });
            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.statusText}`);
            }
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return text;
        }
        catch (error) {
            console.error("Gemini test generation failed:", error);
            throw error;
        }
    }
    async fixError(code, error) {
        if (!this.ready) {
            throw new Error("GeminiClient not initialized");
        }
        await this.rateLimit();
        if (this.model === "mock") {
            return {
                fixedCode: code + "\n// Fixed by mock",
                confidence: 0.9,
                explanation: "Mock fix applied"
            };
        }
        const prompt = prompts_1.PromptTemplates.errorFix(code, error);
        try {
            const response = await this.fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });
            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.statusText}`);
            }
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const fallback = {
                fixedCode: code,
                confidence: 0,
                explanation: "Failed to parse fix response"
            };
            return this.parseJsonFromText(text, fallback);
        }
        catch (error) {
            console.error("Gemini error fix failed:", error);
            throw error;
        }
    }
}
exports.GeminiClient = GeminiClient;


/***/ }),
/* 54 */
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PromptTemplates = void 0;
class PromptTemplates {
    static codeAnalysis(code, context) {
        const relatedFilesStr = context.relatedFiles.length > 0
            ? context.relatedFiles.join(", ")
            : "None";
        const commitsStr = context.recentCommits.length > 0
            ? context.recentCommits.join("\n- ")
            : "None";
        const errorsStr = context.recentErrors.length > 0
            ? context.recentErrors.join("\n- ")
            : "None";
        return `
You are an expert AI coding assistant. Your task is to analyze the provided code within the context of the user's current workflow.

CONTEXT:
- Active File: ${context.activeFile || "Unknown"}
- Related Open Files: ${relatedFilesStr}
- Recent Git Commits:
- ${commitsStr}
- Recent Workspace Errors:
- ${errorsStr}
- Edit Frequency: ${context.editCount} edits in session

GIT DIFF SUMMARY (Recent changes):
${context.gitDiffSummary}

CODE TO ANALYZE:
\`\`\`
${code}
\`\`\`

INSTRUCTIONS:
Analyze the code for:
1.  **Correctness**: Logic errors, bugs, potential runtime issues.
2.  **Quality**: Code smells, maintainability, readability.
3.  **Contextual Relevance**: Does this code align with the recent commits and changes?
4.  **Security**: Potential vulnerabilities.

Respond in valid JSON format ONLY:
{
  "issues": [
    { "line": number, "severity": "error"|"warning"|"info", "message": "string" }
  ],
  "suggestions": ["string"],
  "risk_level": "low"|"medium"|"high",
  "summary": "Brief summary of what the user seems to be working on based on this code and context",
  "context_analysis": "Analysis of how this code fits into the broader project context"
}
    `.trim();
    }
    static testGeneration(functionCode) {
        return `
Generate comprehensive unit tests for the following function using Vitest.
Include imports, describe blocks, and it blocks covering happy paths and edge cases.

Code:
\`\`\`
${functionCode}
\`\`\`
    `.trim();
    }
    static batchProcess(files, context) {
        const fileList = Array.from(files.entries()).map(([name, content]) => `
--- FILE: ${name} ---
${content}
---------------------
`).join("\n");
        const commitsStr = context.recentCommits.length > 0
            ? context.recentCommits.join("\n- ")
            : "None";
        return `
You are an expert AI coding assistant. Perform a deep, batched analysis on the following files.

CONTEXT:
- Recent Git Commits:
- ${commitsStr}
- Git Diff Summary:
${context.gitDiffSummary}

FILES TO PROCESS:
${fileList}

INSTRUCTIONS:
For EACH file provided above, perform the following:
1.  **Analyze**: Find bugs, logic errors, and code smells.
2.  **Generate Tests**: Create a comprehensive unit test suite (Vitest) for the file.
3.  **Suggest Fixes**: For any "error" or "high" severity issue found, provide a corrected code snippet.

Respond in valid JSON format ONLY with this structure:
{
  "globalSummary": "Overview of the changes and health of these files",
  "files": [
    {
      "file": "filename",
      "analysis": {
        "issues": [ { "line": number, "severity": "error"|"warning"|"info", "message": "string" } ],
        "suggestions": ["string"],
        "risk_level": "low"|"medium"|"high",
        "summary": "File specific summary"
      },
      "generatedTests": "string (full test file content)",
      "suggestedFixes": [
        {
          "issueId": "issue-index (0, 1, etc)",
          "fix": { "fixedCode": "string", "confidence": number, "explanation": "string" }
        }
      ]
    }
  ]
}
    `.trim();
    }
    static errorFix(code, error) {
        return `
Fix the following error in the code.

Error:
${error}

Code:
\`\`\`
${code}
\`\`\`

INSTRUCTIONS:
Analyze the error and the code. Provide a corrected version of the code.
Respond in valid JSON format ONLY:
{
  "fixedCode": "string (the complete fixed code)",
  "confidence": number (0.0 to 1.0),
  "explanation": "string (brief explanation of the fix)"
}
    `.trim();
    }
}
exports.PromptTemplates = PromptTemplates;


/***/ }),
/* 55 */
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ContextBuilder = void 0;
class ContextBuilder {
    static build(raw) {
        const { gitLogs = [], gitDiff = "", openFiles = [], activeFile = null, errors = [], editHistory = [], fileContents = new Map(), projectStructure, dependencies } = raw;
        // 1. Identify related files based on active file
        // Simple heuristic: same directory or imported (mock logic for imports)
        const relatedFiles = openFiles.filter(f => f !== activeFile);
        // 2. Summarize Git Diff (don't just truncate, maybe prioritize modified files)
        let diffSummary = gitDiff || "";
        if (diffSummary.length > 8000) {
            diffSummary = diffSummary.substring(0, 8000) + "\n... [truncated]";
        }
        // 3. Build open file contents map for context
        const openFileContents = new Map();
        if (activeFile && fileContents.has(activeFile)) {
            openFileContents.set(activeFile, fileContents.get(activeFile));
        }
        // Add other open files if small enough? For now just active.
        return {
            activeFile: activeFile || null,
            recentCommits: gitLogs.slice(0, 10), // Increased context
            recentErrors: errors.slice(0, 5),
            gitDiffSummary: diffSummary,
            editCount: editHistory.length,
            relatedFiles: relatedFiles,
            openFileContents: openFileContents,
            projectStructure,
            dependencies
        };
    }
}
exports.ContextBuilder = ContextBuilder;


/***/ }),
/* 56 */
/***/ ((__unused_webpack_module, exports) => {

"use strict";

/**
 * Mock Git Service
 *
 * Simulates git operations for UI development.
 * INTEGRATION: Replace with real GitService that uses simple-git.
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MockGitService = void 0;
class MockGitService {
    currentBranch = 'feature/autonomous-copilot';
    commits = [];
    async createBranch(name) {
        console.log(`[Mock Git] Creating branch: ${name}`);
        await this.delay(300);
        this.currentBranch = name;
    }
    async commit(message, files) {
        console.log(`[Mock Git] Committing: ${message}`);
        console.log(`[Mock Git] Files: ${files?.join(', ') || 'all changes'}`);
        await this.delay(500);
        const commit = {
            hash: this.generateHash(),
            message,
            author: 'You',
            date: new Date(),
        };
        this.commits.unshift(commit);
    }
    async applyDiff(diff) {
        console.log(`[Mock Git] Applying diff:\n${diff}`);
        await this.delay(400);
    }
    async getCurrentBranch() {
        await this.delay(100);
        return this.currentBranch;
    }
    async getRecentCommits(count) {
        await this.delay(200);
        // Return mock commits if none exist
        if (this.commits.length === 0) {
            return this.generateMockCommits(count);
        }
        return this.commits.slice(0, count);
    }
    generateMockCommits(count) {
        const messages = [
            'feat: Add autonomous analysis mode',
            'fix: Handle edge case in context collection',
            'refactor: Simplify issue detection logic',
            'docs: Update README with usage examples',
            'test: Add unit tests for AIService',
            'style: Format code with prettier',
            'chore: Update dependencies',
        ];
        const commits = [];
        const now = Date.now();
        for (let i = 0; i < Math.min(count, messages.length); i++) {
            commits.push({
                hash: this.generateHash(),
                message: messages[i],
                author: i % 3 === 0 ? 'Teammate' : 'You',
                date: new Date(now - i * 3600000), // 1 hour apart
            });
        }
        return commits;
    }
    generateHash() {
        return Math.random().toString(36).substring(2, 9);
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.MockGitService = MockGitService;


/***/ }),
/* 57 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

/**
 * Mock Voice Service
 *
 * Simulates voice notifications by showing console logs.
 * INTEGRATION: Replace with real VoiceService that calls ElevenLabs API.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MockVoiceService = void 0;
const vscode = __importStar(__webpack_require__(1));
class MockVoiceService {
    enabled;
    constructor() {
        // Read from configuration
        this.enabled = vscode.workspace.getConfiguration('copilot').get('voice.enabled', true);
    }
    async speak(text, voice = 'professional') {
        if (!this.enabled) {
            console.log('[Mock Voice] Voice disabled, skipping notification');
            return;
        }
        console.log(`[Mock Voice] 🔊 Would speak: "${text}" (${voice} voice)`);
        // Show notification as visual feedback
        const icon = this.getIconForVoice(voice);
        vscode.window.showInformationMessage(`${icon} ${text}`);
        // Simulate speech duration
        await this.delay(text.length * 50); // ~50ms per character
    }
    isEnabled() {
        return this.enabled;
    }
    setEnabled(enabled) {
        this.enabled = enabled;
        vscode.workspace.getConfiguration('copilot').update('voice.enabled', enabled, true);
    }
    getIconForVoice(voice) {
        switch (voice) {
            case 'casual':
                return '😎';
            case 'encouraging':
                return '🎉';
            case 'professional':
            default:
                return '🤖';
        }
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.MockVoiceService = MockVoiceService;


/***/ }),
/* 58 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

/**
 * Status Bar Manager
 *
 * Manages the status bar item that shows copilot state in the bottom bar.
 * States: Idle, Analyzing, Complete, Error
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.StatusBarManager = void 0;
const vscode = __importStar(__webpack_require__(1));
class StatusBarManager {
    statusBarItem;
    currentState = { status: 'idle' };
    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = 'copilot.showPanel';
        this.updateDisplay();
        this.statusBarItem.show();
    }
    setState(state) {
        this.currentState = state;
        this.updateDisplay();
        // Auto-reset from 'complete' state after 5 seconds
        if (state.status === 'complete') {
            setTimeout(() => {
                if (this.currentState.status === 'complete') {
                    this.setState({ status: 'idle' });
                }
            }, 5000);
        }
    }
    updateDisplay() {
        switch (this.currentState.status) {
            case 'idle':
                this.statusBarItem.text = '$(robot) Copilot: Ready';
                this.statusBarItem.backgroundColor = undefined;
                this.statusBarItem.tooltip = 'Click to open Autonomous Copilot dashboard';
                break;
            case 'analyzing':
                this.statusBarItem.text = `$(sync~spin) Copilot: ${this.currentState.message || 'Analyzing'}...`;
                this.statusBarItem.backgroundColor = undefined;
                this.statusBarItem.tooltip = `Progress: ${this.currentState.progress}%`;
                break;
            case 'complete':
                const issueText = this.currentState.issuesFound === 1 ? 'issue' : 'issues';
                this.statusBarItem.text = `$(check) Copilot: Found ${this.currentState.issuesFound} ${issueText}`;
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
                this.statusBarItem.tooltip = 'Analysis complete! Click to view results';
                break;
            case 'error':
                this.statusBarItem.text = '$(warning) Copilot: Error';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                this.statusBarItem.tooltip = `Error: ${this.currentState.error}`;
                break;
        }
    }
    dispose() {
        this.statusBarItem.dispose();
    }
}
exports.StatusBarManager = StatusBarManager;


/***/ }),
/* 59 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

/**
 * Sidebar Dashboard Webview Provider
 *
 * Manages the main dashboard webview in the sidebar.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SidebarWebviewProvider = void 0;
const path = __importStar(__webpack_require__(4));
const fs = __importStar(__webpack_require__(3));
class SidebarWebviewProvider {
    extensionUri;
    onMessage;
    _view;
    constructor(extensionUri, onMessage) {
        this.extensionUri = extensionUri;
        this.onMessage = onMessage;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };
        webviewView.webview.html = this.getHtmlContent(webviewView.webview);
        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage((message) => {
            this.onMessage(message);
        });
    }
    /**
     * Post a message to the webview
     */
    postMessage(message) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }
    /**
     * Update context in the webview
     */
    updateContext(context) {
        this.postMessage({
            type: 'contextUpdate',
            payload: context,
        });
    }
    /**
     * Update analysis results in the webview
     */
    updateAnalysis(analysis) {
        this.postMessage({
            type: 'analysisComplete',
            payload: analysis,
        });
    }
    /**
     * Update extension state
     */
    updateState(state) {
        this.postMessage({
            type: 'stateChanged',
            state,
        });
    }
    /**
     * Show error in webview
     */
    showError(message) {
        this.postMessage({
            type: 'error',
            message,
        });
    }
    /**
     * Reveal the webview
     */
    reveal() {
        if (this._view) {
            this._view.show(true);
        }
    }
    getHtmlContent(webview) {
        // Load HTML from file
        const htmlPath = path.join(this.extensionUri.fsPath, 'src', 'ui', 'webview', 'dashboard.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        // Could inject nonce for security, add resource URIs, etc.
        // For now, return as-is since we're using inline scripts/styles
        return html;
    }
}
exports.SidebarWebviewProvider = SidebarWebviewProvider;


/***/ }),
/* 60 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

/**
 * Issues Tree View Provider
 *
 * Displays issues in a hierarchical tree structure:
 * - Root: Files with issues
 * - Children: Individual issues in each file
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.IssuesTreeProvider = void 0;
const vscode = __importStar(__webpack_require__(1));
class IssuesTreeProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    issues = [];
    groupedIssues = new Map();
    constructor() { }
    /**
     * Update the tree with new analysis results
     */
    updateAnalysis(analysis) {
        this.issues = analysis.issues;
        this.groupByFile();
        this.refresh();
    }
    /**
     * Clear all issues
     */
    clear() {
        this.issues = [];
        this.groupedIssues.clear();
        this.refresh();
    }
    /**
     * Refresh the tree view
     */
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            // Root level: return file groups
            return Promise.resolve(this.getFileGroupItems());
        }
        else {
            // Child level: return issues for this file
            return Promise.resolve(this.getIssueItems(element.resourceUri.fsPath));
        }
    }
    groupByFile() {
        this.groupedIssues.clear();
        for (const issue of this.issues) {
            if (!this.groupedIssues.has(issue.file)) {
                this.groupedIssues.set(issue.file, []);
            }
            this.groupedIssues.get(issue.file).push(issue);
        }
    }
    getFileGroupItems() {
        const items = [];
        for (const [file, issues] of this.groupedIssues.entries()) {
            const errorCount = issues.filter(i => i.severity === 'error').length;
            const warningCount = issues.filter(i => i.severity === 'warning').length;
            const infoCount = issues.filter(i => i.severity === 'info').length;
            const fileName = file.split('/').pop() || file;
            const label = `${fileName} (${issues.length})`;
            let description = [];
            if (errorCount > 0) {
                description.push(`${errorCount} errors`);
            }
            if (warningCount > 0) {
                description.push(`${warningCount} warnings`);
            }
            if (infoCount > 0) {
                description.push(`${infoCount} info`);
            }
            const item = new IssueTreeItem(label, vscode.TreeItemCollapsibleState.Expanded, 'file');
            item.description = description.join(', ');
            item.resourceUri = vscode.Uri.file(file);
            item.iconPath = new vscode.ThemeIcon('file');
            item.contextValue = 'fileGroup';
            items.push(item);
        }
        return items;
    }
    getIssueItems(file) {
        const issues = this.groupedIssues.get(file) || [];
        return issues.map(issue => {
            const item = new IssueTreeItem(issue.message, vscode.TreeItemCollapsibleState.None, 'issue');
            item.description = `Line ${issue.line}`;
            item.tooltip = this.createTooltip(issue);
            item.iconPath = this.getIconForSeverity(issue.severity);
            item.contextValue = 'issue';
            // Click to navigate to issue
            item.command = {
                command: 'copilot.navigateToIssue',
                title: 'Go to Issue',
                arguments: [issue.file, issue.line, issue.column],
            };
            // Store issue data for context menu actions
            item.issueData = issue;
            return item;
        });
    }
    createTooltip(issue) {
        const tooltip = new vscode.MarkdownString();
        tooltip.supportHtml = true;
        tooltip.isTrusted = true;
        tooltip.appendMarkdown(`**${issue.severity.toUpperCase()}**: ${issue.message}\n\n`);
        tooltip.appendMarkdown(`**Location**: ${issue.file}:${issue.line}:${issue.column}\n\n`);
        if (issue.codeSnippet) {
            tooltip.appendMarkdown(`**Code**:\n\`\`\`\n${issue.codeSnippet}\n\`\`\`\n\n`);
        }
        if (issue.suggestedFix) {
            tooltip.appendMarkdown(`**Suggested Fix**: ${issue.suggestedFix}`);
        }
        return tooltip;
    }
    getIconForSeverity(severity) {
        switch (severity) {
            case 'error':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('editorError.foreground'));
            case 'warning':
                return new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
            case 'info':
                return new vscode.ThemeIcon('info', new vscode.ThemeColor('editorInfo.foreground'));
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }
}
exports.IssuesTreeProvider = IssuesTreeProvider;
/**
 * Tree item for issues tree view
 */
class IssueTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    type;
    issueData;
    constructor(label, collapsibleState, type) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.type = type;
    }
}


/***/ }),
/* 61 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

/**
 * Notification Manager
 *
 * Handles VSCode notifications and progress indicators.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.NotificationManager = void 0;
const vscode = __importStar(__webpack_require__(1));
class NotificationManager {
    /**
     * Show a progress notification for long-running tasks
     */
    static async withProgress(title, task) {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title,
            cancellable: false,
        }, task);
    }
    /**
     * Show a success notification
     */
    static showSuccess(message, ...actions) {
        return vscode.window.showInformationMessage(message, ...actions);
    }
    /**
     * Show a warning notification
     */
    static showWarning(message, ...actions) {
        return vscode.window.showWarningMessage(message, ...actions);
    }
    /**
     * Show an error notification
     */
    static showError(message, ...actions) {
        return vscode.window.showErrorMessage(message, ...actions);
    }
    /**
     * Show analysis complete notification with actions
     */
    static async showAnalysisComplete(issueCount) {
        const issueText = issueCount === 1 ? 'issue' : 'issues';
        const message = issueCount > 0
            ? `🔍 Analysis complete! Found ${issueCount} ${issueText}.`
            : '✅ Analysis complete! No issues found.';
        const action = await this.showSuccess(message, 'View Results', 'Dismiss');
        if (action === 'View Results') {
            vscode.commands.executeCommand('copilot.showPanel');
        }
    }
    /**
     * Show autonomous mode notification
     */
    static async showAutonomousStarted() {
        await this.showSuccess('🤖 Autonomous mode enabled. Copilot will analyze your code when idle.', 'Got it');
    }
    /**
     * Show autonomous analysis notification
     */
    static async showAutonomousAnalysis(issueCount) {
        const issueText = issueCount === 1 ? 'issue' : 'issues';
        const action = await this.showSuccess(`🤖 Autonomous analysis complete! Found ${issueCount} ${issueText} while you were away.`, 'View Results', 'Dismiss');
        if (action === 'View Results') {
            vscode.commands.executeCommand('copilot.showPanel');
        }
    }
    /**
     * Show error with retry option
     */
    static async showErrorWithRetry(message, retryCallback) {
        const action = await this.showError(message, 'Retry', 'Dismiss');
        if (action === 'Retry') {
            await retryCallback();
        }
    }
    /**
     * Show progress with steps
     */
    static async showProgressWithSteps(title, steps) {
        await this.withProgress(title, async (progress) => {
            const increment = 100 / steps.length;
            for (const step of steps) {
                progress.report({ message: step.message });
                await step.task();
                progress.report({ increment });
            }
        });
    }
}
exports.NotificationManager = NotificationManager;


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map