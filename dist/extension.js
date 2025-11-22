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
const gitlog_1 = __webpack_require__(2);
const fileWatcher_1 = __webpack_require__(18);
const LintingService_1 = __webpack_require__(32);
// Import mock services (INTEGRATION POINT: Replace with real services here)
const MockContextService_1 = __webpack_require__(19);
const GeminiService_1 = __webpack_require__(21); // Real AI Service
const MockGitService_1 = __webpack_require__(25);
const MockVoiceService_1 = __webpack_require__(26);
// Import UI components
const StatusBarManager_1 = __webpack_require__(27);
const SidebarWebviewProvider_1 = __webpack_require__(28);
const IssuesTreeProvider_1 = __webpack_require__(30);
const NotificationManager_1 = __webpack_require__(31);
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
// State
let currentContext = null;
let currentAnalysis = null;
let isAutonomousMode = false;
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    console.log('Autonomous Copilot extension is now active!');
    let fileWatcher = null;
    // Initialize services
    contextService = new MockContextService_1.MockContextService();
    // Initialize Linting Service
    lintingService = new LintingService_1.LintingService();
    lintingService.initialize(contextService);
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
    context.subscriptions.push(disposable);
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
}


/***/ }),
/* 1 */
/***/ ((module) => {

"use strict";
module.exports = require("vscode");

/***/ }),
/* 2 */
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
const gitlog = __importStar(__webpack_require__(3));
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
/* 3 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var node_child_process__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4);
/* harmony import */ var node_util__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(5);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6);
/* harmony import */ var debug__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(7);
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
/* 4 */
/***/ ((module) => {

"use strict";
module.exports = require("node:child_process");

/***/ }),
/* 5 */
/***/ ((module) => {

"use strict";
module.exports = require("node:util");

/***/ }),
/* 6 */
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),
/* 7 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/**
 * Detect Electron renderer / nwjs process, which is node, but we should
 * treat as a browser.
 */

if (typeof process === 'undefined' || process.type === 'renderer' || process.browser === true || process.__nwjs) {
	module.exports = __webpack_require__(8);
} else {
	module.exports = __webpack_require__(11);
}


/***/ }),
/* 8 */
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

module.exports = __webpack_require__(9)(exports);

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
/* 9 */
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
	createDebug.humanize = __webpack_require__(10);
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
/* 10 */
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
/* 11 */
/***/ ((module, exports, __webpack_require__) => {

/**
 * Module dependencies.
 */

const tty = __webpack_require__(12);
const util = __webpack_require__(13);

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
	const supportsColor = __webpack_require__(14);

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

module.exports = __webpack_require__(9)(exports);

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
/* 12 */
/***/ ((module) => {

"use strict";
module.exports = require("tty");

/***/ }),
/* 13 */
/***/ ((module) => {

"use strict";
module.exports = require("util");

/***/ }),
/* 14 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createSupportsColor: () => (/* binding */ createSupportsColor),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var node_process__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(15);
/* harmony import */ var node_os__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(16);
/* harmony import */ var node_tty__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(17);




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
/* 15 */
/***/ ((module) => {

"use strict";
module.exports = require("node:process");

/***/ }),
/* 16 */
/***/ ((module) => {

"use strict";
module.exports = require("node:os");

/***/ }),
/* 17 */
/***/ ((module) => {

"use strict";
module.exports = require("node:tty");

/***/ }),
/* 18 */
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
    constructor(lintingEndpoint = "https://your-worker.workers.dev/lint") {
        this.lintingEndpoint = lintingEndpoint;
    }
    /**
     * Start watching files in the workspace
     */
    start() {
        console.log("[FileWatcher] Starting file monitoring...");
        // Method 1: Watch specific file patterns (glob patterns)
        // This creates a watcher for TypeScript and JavaScript files
        this.watcher = vscode.workspace.createFileSystemWatcher("**/*.{ts,js,tsx,jsx}", // Watch these file types
        false, // Don't ignore creates
        false, // Don't ignore changes
        false // Don't ignore deletes
        );
        // React to file creation
        this.watcher.onDidCreate((uri) => {
            console.log(`[FileWatcher] File created: ${uri.fsPath}`);
            vscode.window.showInformationMessage(`📄 New file: ${uri.fsPath}`);
        });
        // React to file changes
        this.watcher.onDidChange((uri) => {
            console.log(`[FileWatcher] File changed: ${uri.fsPath}`);
        });
        // React to file deletion
        this.watcher.onDidDelete((uri) => {
            console.log(`[FileWatcher] File deleted: ${uri.fsPath}`);
        });
        // Method 2: Watch for document saves (best for auto-linting)
        const saveWatcher = vscode.workspace.onDidSaveTextDocument(async (document) => {
            await this.onFileSaved(document);
        });
        // Method 3: Watch for any text document changes (real-time)
        const changeWatcher = vscode.workspace.onDidChangeTextDocument((event) => {
            // Only process if there are actual content changes
            if (event.contentChanges.length > 0) {
                console.log(`[FileWatcher] Document modified: ${event.document.fileName}`);
            }
        });
        this.disposables.push(saveWatcher, changeWatcher);
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
        console.log(`[FileWatcher] Auto-linting: ${document.fileName}`);
        try {
            const code = document.getText();
            // Call your Cloudflare worker to lint the code
            const response = await fetch(this.lintingEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
            });
            if (!response.ok) {
                throw new Error(`Linting failed: ${response.statusText}`);
            }
            const result = await response.json();
            // Show results to user
            if (result.warnings && result.warnings.length > 0) {
                const message = `⚠️ ${result.warnings.length} issue(s) found in ${document.fileName}`;
                vscode.window.showWarningMessage(message);
                // Optionally show detailed warnings in output channel
                const outputChannel = vscode.window.createOutputChannel("Auto-Linter");
                outputChannel.clear();
                outputChannel.appendLine(`=== Linting Results for ${document.fileName} ===\n`);
                result.warnings.forEach((warning) => {
                    outputChannel.appendLine(`[${warning.severity}] ${warning.message}`);
                });
                outputChannel.show();
            }
            else {
                vscode.window.showInformationMessage(`✅ No issues found in ${document.fileName}`);
            }
            // If linting produced a fixed version, optionally apply it
            if (result.linted && result.fixed !== code) {
                const applyFix = await vscode.window.showInformationMessage("Apply auto-fix?", "Yes", "No");
                if (applyFix === "Yes") {
                    await this.applyFix(document, result.fixed);
                }
            }
        }
        catch (error) {
            console.error("[FileWatcher] Linting error:", error);
            vscode.window.showErrorMessage(`Linting failed: ${error}`);
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
        console.log("[FileWatcher] Stopped file monitoring");
    }
}
exports.FileWatcher = FileWatcher;


/***/ }),
/* 19 */
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
const events_1 = __webpack_require__(20);
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
/* 20 */
/***/ ((module) => {

"use strict";
module.exports = require("events");

/***/ }),
/* 21 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GeminiService = void 0;
const gemini_client_1 = __webpack_require__(22);
const context_builder_1 = __webpack_require__(24);
const events_1 = __webpack_require__(20);
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
/* 22 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GeminiClient = void 0;
const prompts_1 = __webpack_require__(23);
class GeminiClient {
    apiKey = "";
    model = "gemini-2.5-flash";
    ready = false;
    lastRequestTime = 0;
    minRequestInterval = 2000; // 2 seconds between requests to be safe
    async initialize(apiKey) {
        this.apiKey = apiKey;
        this.model = "gemini-2.5-flash"; // Reset to default model
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
        try {
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace === -1 || lastBrace === -1) {
                throw new Error("No JSON object found in response");
            }
            const jsonStr = text.substring(firstBrace, lastBrace + 1);
            return JSON.parse(jsonStr);
        }
        catch (e) {
            console.warn("Failed to parse Gemini batch response:", e);
            return {
                globalSummary: "Failed to parse AI response",
                files: []
            };
        }
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
        try {
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            // Robust JSON extraction: find the first '{' and the last '}'
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace === -1 || lastBrace === -1) {
                throw new Error("No JSON object found in response");
            }
            const jsonStr = text.substring(firstBrace, lastBrace + 1);
            const parsed = JSON.parse(jsonStr);
            return {
                issues: Array.isArray(parsed.issues) ? parsed.issues : [],
                suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
                risk_level: parsed.risk_level || 'low',
                summary: parsed.summary
            };
        }
        catch (e) {
            console.warn("Failed to parse Gemini response:", e);
            console.warn("Raw response text:", data.candidates?.[0]?.content?.parts?.[0]?.text);
            // Fallback
            return {
                issues: [],
                suggestions: ["Failed to parse AI response. Please try again."],
                risk_level: 'low',
                summary: "Error parsing AI response."
            };
        }
    }
    async generateTests(functionCode) {
        if (!this.ready) {
            throw new Error("GeminiClient not initialized");
        }
        if (this.model === "mock") {
            return `
describe('generatedTest', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});`;
        }
        const prompt = prompts_1.PromptTemplates.testGeneration(functionCode);
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return text;
    }
    async fixError(code, error) {
        if (!this.ready) {
            throw new Error("GeminiClient not initialized");
        }
        if (this.model === "mock") {
            return {
                fixedCode: code + "\n// Fixed by mock",
                confidence: 0.9
            };
        }
        const prompt = prompts_1.PromptTemplates.errorFix(code, error);
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        const data = await response.json();
        const fixedCode = data.candidates?.[0]?.content?.parts?.[0]?.text || code;
        return {
            fixedCode,
            confidence: 0.85
        };
    }
}
exports.GeminiClient = GeminiClient;


/***/ }),
/* 23 */
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
Fix the following error in the code. Return ONLY the fixed code block without markdown formatting if possible, or inside a single code block.

Error:
${error}

Code:
\`\`\`
${code}
\`\`\`
    `.trim();
    }
}
exports.PromptTemplates = PromptTemplates;


/***/ }),
/* 24 */
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ContextBuilder = void 0;
class ContextBuilder {
    static build(raw) {
        const { gitLogs = [], gitDiff = "", openFiles = [], activeFile = null, errors = [], editHistory = [], fileContents = new Map() } = raw;
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
            openFileContents: openFileContents
        };
    }
}
exports.ContextBuilder = ContextBuilder;


/***/ }),
/* 25 */
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
/* 26 */
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
/* 27 */
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
/* 28 */
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
const path = __importStar(__webpack_require__(29));
const fs = __importStar(__webpack_require__(6));
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
/* 29 */
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ }),
/* 30 */
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
/* 31 */
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


/***/ }),
/* 32 */
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
const events_1 = __webpack_require__(20);
const linting_1 = __webpack_require__(33);
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
/* 33 */
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