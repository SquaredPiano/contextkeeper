#!/usr/bin/env node
"use strict";
/**
 * ContextKeeper / Autonomous Copilot - Unified Demo Runner
 *
 * This script runs various demos for the project.
 * Usage: npm run demo [demo-name]
 *
 * Available demos:
 *   - gemini      : Gemini AI code analysis demo
 *   - elevenlabs  : ElevenLabs voice synthesis demo
 *   - gitlogs     : Git log tracking demo
 *   - orchestrator: Full pipeline orchestration demo
 *   - idle        : Idle detection demo
 *   - all         : Run all demos sequentially
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
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const dotenv = __importStar(require("dotenv"));
// Load environment variables
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('✅ Loaded .env file');
}
else {
    console.log('⚠️  No .env file found. Some demos may use mock mode.');
}
// Color output helpers
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};
function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}
function logHeader(message) {
    console.log('\n' + '='.repeat(60));
    log(message, 'cyan');
    log('='.repeat(60) + '\n', 'dim');
}
// Demo runners
async function runGeminiDemo() {
    logHeader('🧠 GEMINI AI MODULE DEMO');
    try {
        // Import and run the demo
        const demoPath = path.join(__dirname, 'src/modules/gemini/demo.ts');
        if (!fs.existsSync(demoPath)) {
            log('❌ Demo file not found: ' + demoPath, 'red');
            return;
        }
        // Note: This will be executed via tsx/ts-node, so we just show instructions
        log('📝 To run this demo, execute:', 'yellow');
        log('   npx tsx src/modules/gemini/demo.ts', 'bright');
        log('\nOr use: npm run demo:gemini\n', 'dim');
    }
    catch (error) {
        log(`❌ Error: ${error.message}`, 'red');
    }
}
async function runElevenLabsDemo() {
    logHeader('🎤 ELEVENLABS VOICE MODULE DEMO');
    try {
        log('📝 To run this demo, execute:', 'yellow');
        log('   npx tsx src/modules/elevenlabs/demo.ts', 'bright');
        log('\nOr use: npm run demo:voice\n', 'dim');
        log('⚠️  Note: This demo requires ELEVEN_LABS_API_KEY in .env', 'yellow');
    }
    catch (error) {
        log(`❌ Error: ${error.message}`, 'red');
    }
}
async function runGitLogsDemo() {
    logHeader('📜 GIT LOGS MODULE DEMO');
    try {
        log('📝 To run this demo, execute:', 'yellow');
        log('   npx tsx src/modules/gitlogs/demo.ts', 'bright');
        log('\nOr use: npm run demo:git\n', 'dim');
    }
    catch (error) {
        log(`❌ Error: ${error.message}`, 'red');
    }
}
async function runOrchestratorDemo() {
    logHeader('🎼 ORCHESTRATOR PIPELINE DEMO');
    try {
        log('📝 To run this demo, execute:', 'yellow');
        log('   npx tsx src/modules/orchestrator/demo.ts', 'bright');
        log('\nOr use: npm run demo:orchestrator\n', 'dim');
        log('⚠️  Note: This demo requires CLOUDFLARE_WORKER_URL and GEMINI_API_KEY', 'yellow');
    }
    catch (error) {
        log(`❌ Error: ${error.message}`, 'red');
    }
}
async function runIdleDetectorDemo() {
    logHeader('⏱️  IDLE DETECTOR MODULE DEMO');
    try {
        log('📝 To run this demo, execute:', 'yellow');
        log('   npx tsx src/modules/idle-detector/demo.ts', 'bright');
        log('\nOr use: npm run demo:idle\n', 'dim');
    }
    catch (error) {
        log(`❌ Error: ${error.message}`, 'red');
    }
}
function showExtensionDemo() {
    logHeader('🚀 VSCODE EXTENSION DEMO');
    log('To demo the full VSCode extension:', 'bright');
    log('\n1. Compile the extension:', 'yellow');
    log('   npm run compile', 'dim');
    log('\n2. Press F5 in VSCode to launch Extension Development Host', 'yellow');
    log('\n3. In the new window:', 'yellow');
    log('   - Click the robot icon in the activity bar', 'dim');
    log('   - Open the Dashboard panel', 'dim');
    log('   - Click "Analyze Now" to see code analysis', 'dim');
    log('   - Explore the Issues tree view', 'dim');
    log('\n✨ The extension is already configured with real services!', 'green');
}
function showMenu() {
    logHeader('🎬 CONTEXTKEEPER DEMO MENU');
    log('Available demos:', 'bright');
    log('\n  Module Demos (CLI):', 'yellow');
    log('   1. gemini      - AI code analysis with Gemini', 'dim');
    log('   2. elevenlabs  - Voice synthesis with ElevenLabs', 'dim');
    log('   3. gitlogs     - Git history tracking', 'dim');
    log('   4. orchestrator - Full pipeline orchestration', 'dim');
    log('   5. idle        - Idle detection', 'dim');
    log('\n  Extension Demo (VSCode):', 'yellow');
    log('   6. extension   - Full VSCode extension demo', 'dim');
    log('\n  Quick Commands:', 'bright');
    log('   npm run demo              - Show this menu', 'dim');
    log('   npm run demo:gemini       - Run Gemini demo', 'dim');
    log('   npm run demo:voice        - Run ElevenLabs demo', 'dim');
    log('   npm run demo:git          - Run Git logs demo', 'dim');
    log('   npm run demo:orchestrator - Run Orchestrator demo', 'dim');
    log('   npm run demo:idle         - Run Idle detector demo', 'dim');
    log('   npm run demo:extension    - Instructions for VSCode demo', 'dim');
    log('   npm run demo:all          - Run all module demos', 'dim');
}
// Main function
async function main() {
    const args = process.argv.slice(2);
    const demoName = args[0] || 'menu';
    switch (demoName.toLowerCase()) {
        case 'gemini':
            await runGeminiDemo();
            break;
        case 'elevenlabs':
        case 'voice':
            await runElevenLabsDemo();
            break;
        case 'git':
        case 'gitlogs':
            await runGitLogsDemo();
            break;
        case 'orchestrator':
            await runOrchestratorDemo();
            break;
        case 'idle':
            await runIdleDetectorDemo();
            break;
        case 'extension':
            showExtensionDemo();
            break;
        case 'all':
            logHeader('🎬 RUNNING ALL DEMOS');
            await runGeminiDemo();
            await runElevenLabsDemo();
            await runGitLogsDemo();
            await runOrchestratorDemo();
            await runIdleDetectorDemo();
            showExtensionDemo();
            break;
        case 'menu':
        default:
            showMenu();
            break;
    }
}
// Check environment setup
function checkEnvironment() {
    log('\n📋 Environment Check:', 'bright');
    const checks = {
        'GEMINI_API_KEY': process.env.GEMINI_API_KEY,
        'ELEVEN_LABS_API_KEY': process.env.ELEVEN_LABS_API_KEY || process.env.ELEVENLABS_API_KEY,
        'CLOUDFLARE_WORKER_URL': process.env.CLOUDFLARE_WORKER_URL,
        'LANCEDB_API_KEY': process.env.LANCEDB_API_KEY,
    };
    for (const [key, value] of Object.entries(checks)) {
        if (value) {
            log(`  ✅ ${key}`, 'green');
        }
        else {
            log(`  ⚠️  ${key} (optional - will use mock mode)`, 'yellow');
        }
    }
    if (Object.values(checks).every(v => !v)) {
        log('\n💡 Tip: Create a .env file with your API keys to use real services', 'cyan');
        log('   See env_template for reference\n', 'dim');
    }
}
// Run main
if (require.main === module) {
    checkEnvironment();
    main().catch((error) => {
        log(`\n❌ Fatal error: ${error.message}`, 'red');
        process.exit(1);
    });
}
//# sourceMappingURL=demo.js.map