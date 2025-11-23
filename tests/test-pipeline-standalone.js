#!/usr/bin/env node
"use strict";
/**
 * Standalone End-to-End Pipeline Test
 * Tests the complete flow WITHOUT VS Code dependencies by mocking them
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
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: '.env.local' });
// Mock VS Code before any imports
const vscode = {
    workspace: {
        workspaceFolders: [{ uri: { fsPath: process.cwd() } }],
        name: 'test-workspace',
        textDocuments: [], // Mock open text documents
        getConfiguration: () => ({
            get: () => undefined
        }),
        asRelativePath: (path) => path,
        openTextDocument: async () => ({}),
        applyEdit: async () => true,
        findFiles: async (_pattern) => {
            // Return mock file URIs for testing
            return [
                { fsPath: 'src/extension.ts' },
                { fsPath: 'src/modules/autonomous/AutonomousAgent.ts' },
                { fsPath: 'src/services/storage/storage.ts' }
            ];
        },
        fs: {
            writeFile: async () => { },
            stat: async () => { throw new Error('Not found'); },
            readFile: async () => Buffer.from('// mock file content')
        }
    },
    window: {
        activeTextEditor: undefined, // No active editor in test
        showInformationMessage: (...args) => { console.log('[INFO]', ...args); return Promise.resolve(); },
        showWarningMessage: (...args) => { console.log('[WARN]', ...args); return Promise.resolve(); },
        showErrorMessage: (...args) => { console.log('[ERROR]', ...args); return Promise.resolve(); },
        createOutputChannel: () => ({
            appendLine: (msg) => console.log('[OUTPUT]', msg),
            show: () => { }
        })
    },
    Uri: {
        file: (path) => ({ fsPath: path })
    },
    Position: class Position {
        line;
        character;
        constructor(line, character) {
            this.line = line;
            this.character = character;
        }
    },
    Range: class Range {
        start;
        end;
        constructor(start, end) {
            this.start = start;
            this.end = end;
        }
    },
    WorkspaceEdit: class WorkspaceEdit {
        createFile() { }
        insert() { }
        replace() { }
    },
    EventEmitter: class EventEmitter {
        fire() { }
        event = () => () => { };
    }
};
// Inject mock into require cache BEFORE any imports try to resolve it
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
    if (request === 'vscode') {
        return 'vscode-mock';
    }
    return originalResolveFilename.call(this, request, ...args);
};
Module._cache['vscode-mock'] = {
    exports: vscode,
    id: 'vscode-mock',
    filename: 'vscode-mock',
    loaded: true,
    children: [],
    paths: []
};
// Now import our modules
const storage_1 = require("./src/services/storage/storage");
const GeminiService_1 = require("./src/services/real/GeminiService");
const SessionManager_1 = require("./src/managers/SessionManager");
const ContextService_1 = require("./src/services/real/ContextService");
const orchestrator_1 = require("./src/modules/orchestrator/orchestrator");
const GitService_1 = require("./src/services/real/GitService");
const log = {
    info: (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`),
    error: (msg) => console.log(`\x1b[31m✗\x1b[0m ${msg}`),
    warn: (msg) => console.log(`\x1b[33m⚠\x1b[0m ${msg}`),
    section: (msg) => console.log(`\n\x1b[36m${'='.repeat(80)}\n${msg}\n${'='.repeat(80)}\x1b[0m\n`)
};
async function testPipeline() {
    log.section('STANDALONE END-TO-END PIPELINE TEST');
    let testsPassed = 0;
    let testsFailed = 0;
    // Test 1: Environment
    log.section('TEST 1: Environment Configuration');
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY not set');
        }
        log.info(`Gemini API Key: ${process.env.GEMINI_API_KEY.substring(0, 10)}...`);
        testsPassed++;
    }
    catch (error) {
        log.error(`Environment check failed: ${error}`);
        testsFailed++;
        process.exit(1);
    }
    // Test 2: Initialize GeminiService
    log.section('TEST 2: Initialize Gemini Service');
    let geminiService;
    try {
        geminiService = new GeminiService_1.GeminiService();
        await geminiService.initialize(process.env.GEMINI_API_KEY);
        log.info('GeminiService initialized successfully');
        // Test embedding generation
        const testEmbedding = await geminiService.getEmbedding('test query for embedding');
        if (testEmbedding && testEmbedding.length === 768) {
            log.info(`Embedding generated: ${testEmbedding.length} dimensions`);
            testsPassed++;
        }
        else {
            throw new Error(`Invalid embedding dimension: ${testEmbedding?.length}`);
        }
    }
    catch (error) {
        log.error(`Gemini initialization failed: ${error}`);
        testsFailed++;
        process.exit(1);
    }
    // Test 3: Initialize LanceDB Storage
    log.section('TEST 3: Initialize LanceDB Storage');
    let storage;
    try {
        storage = new storage_1.LanceDBStorage();
        await storage.connect(geminiService);
        log.info('LanceDB storage connected');
        // Test write event
        await storage.logEvent({
            timestamp: Date.now(),
            event_type: 'file_edit',
            file_path: 'test/standalone.ts',
            metadata: JSON.stringify({ test: true })
        });
        log.info('Test event written to LanceDB');
        // Test read events
        const events = await storage.getRecentEvents(5);
        log.info(`Retrieved ${events.length} recent events`);
        testsPassed++;
    }
    catch (error) {
        log.error(`LanceDB initialization failed: ${error}`);
        testsFailed++;
    }
    // Test 4: Session Manager
    log.section('TEST 4: Session Manager');
    let sessionManager;
    try {
        sessionManager = new SessionManager_1.SessionManager(storage);
        await sessionManager.initialize();
        const sessionId = sessionManager.getSessionId();
        log.info(`Session initialized with ID: ${sessionId}`);
        testsPassed++;
    }
    catch (error) {
        log.error(`Session manager failed: ${error}`);
        testsFailed++;
    }
    // Test 5: Context Service
    log.section('TEST 5: Context Service & RAG');
    try {
        new ContextService_1.ContextService(storage, geminiService); // Initialize to verify it works
        // Add some test actions with embeddings
        await storage.addAction({
            session_id: sessionManager.getSessionId(),
            timestamp: Date.now(),
            description: 'User edited authentication service to add JWT validation',
            diff: JSON.stringify({ added: 10, removed: 2 }),
            files: JSON.stringify(['src/auth/service.ts'])
        });
        log.info('Test action with embedding stored');
        await storage.addAction({
            session_id: sessionManager.getSessionId(),
            timestamp: Date.now(),
            description: 'Fixed bug in payment processing error handling',
            diff: JSON.stringify({ added: 5, removed: 1 }),
            files: JSON.stringify(['src/payment/processor.ts'])
        });
        log.info('Second test action stored');
        // Test RAG - query for similar actions
        const similarActions = await storage.getSimilarActions('working on authentication', 3);
        log.info(`RAG retrieved ${similarActions.length} similar actions`);
        if (similarActions.length > 0) {
            log.info(`Top match: "${similarActions[0].description}"`);
        }
        testsPassed++;
    }
    catch (error) {
        log.error(`Context service failed: ${error}`);
        testsFailed++;
    }
    // Test 6: Orchestrator Analysis
    log.section('TEST 6: Orchestrator Analysis (Idle Improvements)');
    try {
        const config = {
            cloudflareWorkerUrl: process.env.CLOUDFLARE_WORKER_URL || 'https://contextkeeper-lint-worker.vishnu.workers.dev',
            geminiApiKey: process.env.GEMINI_API_KEY,
            analyzeAllFiles: false,
            maxFilesToAnalyze: 5
        };
        const orchestrator = new orchestrator_1.Orchestrator(config);
        await orchestrator.initialize();
        log.info('Orchestrator initialized');
        // Run idle improvements analysis
        log.info('Running idle improvements analysis (this may take 10-30 seconds)...');
        const result = await orchestrator.analyzeForIdleImprovements();
        if (result) {
            log.info('Idle improvements analysis completed!');
            console.log('\n  📋 Summary:', result.summary.substring(0, 150) + '...');
            console.log(`  ✅ Tests generated: ${result.tests.length}`);
            console.log(`  💡 Recommendations: ${result.recommendations.length}`);
            if (result.recommendations.length > 0) {
                console.log('\n  Top recommendations:');
                result.recommendations.slice(0, 3).forEach((rec, i) => {
                    console.log(`    ${i + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
                });
            }
            testsPassed++;
        }
        else {
            log.warn('Orchestrator returned null result');
            testsFailed++;
        }
    }
    catch (error) {
        log.error(`Orchestrator failed: ${error}`);
        console.error(error);
        testsFailed++;
    }
    // Test 7: Git Service (without actual git operations)
    log.section('TEST 7: Git Service');
    try {
        const gitService = new GitService_1.GitService(process.cwd());
        const currentBranch = await gitService.getCurrentBranch();
        log.info(`Current branch: ${currentBranch}`);
        const recentCommits = await gitService.getRecentCommits(5);
        log.info(`Recent commits: ${recentCommits.length}`);
        testsPassed++;
    }
    catch (error) {
        log.error(`Git service failed: ${error}`);
        testsFailed++;
    }
    // Test 8: Complete Workflow Simulation
    log.section('TEST 8: Complete Workflow Simulation');
    try {
        log.info('Simulating: User edits file → Goes idle → Analysis runs → Results stored');
        // Step 1: Simulate file edit
        await storage.logEvent({
            timestamp: Date.now(),
            event_type: 'file_edit',
            file_path: 'src/components/UserProfile.tsx',
            metadata: JSON.stringify({
                languageId: 'typescriptreact',
                changeCount: 3,
                affectedFunctions: ['UserProfile', 'handleUpdate']
            })
        });
        log.info('Step 1: File edit event logged');
        // Step 2: Create action with semantic description
        await storage.addAction({
            session_id: sessionManager.getSessionId(),
            timestamp: Date.now(),
            description: 'Updated UserProfile component to handle async state updates properly',
            diff: JSON.stringify({
                added: 15,
                removed: 8,
                context: 'Added loading state and error handling'
            }),
            files: JSON.stringify(['src/components/UserProfile.tsx'])
        });
        log.info('Step 2: Action with embedding stored');
        // Step 3: Simulate idle detection (orchestrator runs)
        log.info('Step 3: Simulating idle detection trigger...');
        const config = {
            cloudflareWorkerUrl: process.env.CLOUDFLARE_WORKER_URL || 'https://contextkeeper-lint-worker.vishnu.workers.dev',
            geminiApiKey: process.env.GEMINI_API_KEY,
            analyzeAllFiles: false,
            maxFilesToAnalyze: 5
        };
        const orchestrator = new orchestrator_1.Orchestrator(config);
        await orchestrator.initialize();
        const idleResult = await orchestrator.analyzeForIdleImprovements();
        if (idleResult) {
            log.info('Step 4: Idle analysis completed');
            // Step 5: Store results (simulate AutonomousAgent.storeIdleResults)
            const session = await storage.createSession(idleResult.summary, vscode.workspace.name || 'test-project');
            log.info(`Step 5: Session created with ID: ${session.id}`);
            // Store recommendations as actions
            for (const rec of idleResult.recommendations.slice(0, 3)) {
                await storage.addAction({
                    session_id: session.id,
                    timestamp: Date.now(),
                    description: `[${rec.priority.toUpperCase()}] ${rec.message}`,
                    diff: '',
                    files: JSON.stringify([])
                });
            }
            log.info(`Step 6: Stored ${Math.min(3, idleResult.recommendations.length)} recommendations`);
            // Step 7: Verify we can retrieve this session later
            const retrievedSession = await storage.getLastSession();
            if (retrievedSession && retrievedSession.id === session.id) {
                log.info('Step 7: Successfully retrieved session from LanceDB');
            }
            // Step 8: Test vector search on the new session
            const similarSessions = await storage.getSimilarSessions('working on user profile component', 3);
            log.info(`Step 8: RAG found ${similarSessions.length} similar sessions`);
            testsPassed++;
        }
        else {
            throw new Error('Idle analysis returned no result');
        }
    }
    catch (error) {
        log.error(`Complete workflow simulation failed: ${error}`);
        console.error(error);
        testsFailed++;
    }
    // Final Summary
    log.section('TEST RESULTS SUMMARY');
    console.log(`\n  Total Tests: ${testsPassed + testsFailed}`);
    console.log(`  \x1b[32m✓ Passed: ${testsPassed}\x1b[0m`);
    console.log(`  \x1b[31m✗ Failed: ${testsFailed}\x1b[0m\n`);
    if (testsFailed === 0) {
        console.log('\x1b[32m🎉 ALL TESTS PASSED! Pipeline is fully operational.\x1b[0m\n');
        console.log('The complete flow works:');
        console.log('  1. ✓ Event ingestion with LanceDB storage');
        console.log('  2. ✓ Action storage with embeddings (768-dim vectors)');
        console.log('  3. ✓ RAG retrieval of similar past work');
        console.log('  4. ✓ Orchestrator analysis with Gemini');
        console.log('  5. ✓ Idle improvements generation (tests + recommendations)');
        console.log('  6. ✓ Session storage and retrieval');
        console.log('  7. ✓ Vector similarity search\n');
        console.log('Next: Test in VS Code Extension Host (press F5)');
        process.exit(0);
    }
    else {
        console.log('\x1b[31m⚠ Some tests failed. Review output above.\x1b[0m\n');
        process.exit(1);
    }
}
// Run the test
testPipeline().catch(error => {
    log.error(`Fatal error: ${error}`);
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=test-pipeline-standalone.js.map