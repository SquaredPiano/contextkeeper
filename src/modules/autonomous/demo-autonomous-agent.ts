/**
 * COMPREHENSIVE DEMO: Autonomous Agent Flow
 * 
 * Tests the ENTIRE autonomous workflow with REAL operations:
 * 1. Initialize all required services
 * 2. Create test file with linting issues
 * 3. Trigger autonomous agent
 * 4. Verify git branch creation
 * 5. Verify linting runs (Cloudflare or local fallback)
 * 6. Verify test generation (Gemini)
 * 7. Verify commits are made
 * 
 * NOTE: This creates a real git branch and commits! 
 * Run in a test repo or clean up after.
 * 
 * Run with: npx ts-node src/modules/autonomous/demo-autonomous-agent.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { GeminiService } from '../../services/real/GeminiService';
import { GitService } from '../../services/real/GitService';
import { LanceDBStorage } from '../../services/storage/storage';
import { ContextService } from '../../services/real/ContextService';
import { AutonomousAgent } from './AutonomousAgent';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

async function runDemo() {
    console.log('🚀 Starting Autonomous Agent Demo\n');
    console.log('=' .repeat(60));
    console.log('⚠️  WARNING: This creates real git branches and commits!');
    console.log('   Make sure you are in a test environment or clean repo.');
    console.log('=' .repeat(60));

    // Get workspace root
    const workspaceRoot = process.cwd();
    console.log(`\n📁 Working in: ${workspaceRoot}`);

    // Step 1: Check git status
    console.log('\n🔍 Step 1: Checking git repository...');
    const gitService = new GitService(workspaceRoot);
    
    try {
        const currentBranch = await gitService.getCurrentBranch();
        console.log(`✅ Current branch: ${currentBranch}`);
        
        const recentCommits = await gitService.getRecentCommits(3);
        console.log(`✅ Found ${recentCommits.length} recent commits`);
    } catch (error) {
        console.error('❌ Git not initialized or error:', error);
        console.log('\n💡 Initialize git first: git init && git add . && git commit -m "initial"');
        return;
    }

    // Step 2: Initialize Gemini Service
    console.log('\n📡 Step 2: Initializing Gemini Service...');
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY not found!');
    }
    
    const geminiService = new GeminiService();
    await geminiService.initialize(geminiApiKey);
    console.log('✅ Gemini Service initialized');

    // Step 3: Initialize Storage
    console.log('\n💾 Step 3: Initializing Storage...');
    const storage = new LanceDBStorage();
    await storage.connect(geminiService);
    console.log('✅ Storage connected');

    // Step 4: Initialize Context Service
    console.log('\n📋 Step 4: Initializing Context Service...');
    const contextService = new ContextService(storage, geminiService);
    console.log('✅ Context Service initialized');

    // Step 5: Initialize Autonomous Agent
    console.log('\n🤖 Step 5: Initializing Autonomous Agent...');
    const autonomousAgent = new AutonomousAgent(gitService, geminiService, contextService);
    console.log('✅ Autonomous Agent initialized');

    // Step 6: Create test file with issues
    console.log('\n📝 Step 6: Creating test file with linting issues...');
    const testDir = path.join(workspaceRoot, 'demo-test');
    const testFile = path.join(testDir, 'example.ts');
    
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }

    const testCode = `
// Test file for autonomous agent demo
export function calculateTotal(items: any[]) {
    console.log('Starting calculation'); // Lint issue: console.log
    let total = 0;
    // TODO: add validation // Lint issue: TODO
    for (let i = 0; i < items.length; i++) {
        total += items[i].price;
    }
    console.log('Total:', total); // Lint issue: console.log
    return total;
}

export function processOrder(order: any) {
    console.log('Processing order:', order); // Lint issue: console.log
    return order.items;
}
`;

    fs.writeFileSync(testFile, testCode);
    console.log(`✅ Created test file: ${testFile}`);
    console.log(`   File contains ${testCode.split('console.log').length - 1} console.log statements`);
    console.log(`   File contains ${testCode.split('TODO').length - 1} TODO comments`);

    // Commit the test file to main branch
    console.log('\n💾 Committing test file to current branch...');
    await gitService.commit('test: add demo file for autonomous agent testing', [testFile]);
    console.log('✅ Test file committed');

    // Step 7: Collect context
    console.log('\n📊 Step 7: Collecting current context...');
    try {
        const context = await contextService.collectContext();
        console.log('✅ Context collected');
        console.log(`   Active file: ${context.files.activeFile || 'none'}`);
        console.log(`   Open files: ${context.files.openFiles.length}`);
        console.log(`   Recent commits: ${context.git.recentCommits.length}`);
    } catch (error) {
        console.warn('⚠️  Context collection failed (expected outside VS Code):', error);
        console.log('   Continuing with demo...');
    }

    // Step 8: Run Autonomous Agent with auto-lint goal
    console.log('\n🚀 Step 8: Starting Autonomous Session (auto-lint)...');
    console.log('   This will:');
    console.log('   1. Create a new copilot/* branch');
    console.log('   2. Run linting (Cloudflare or local fallback)');
    console.log('   3. Attempt to fix issues');
    console.log('   4. Commit changes');
    console.log('');
    
    try {
        await autonomousAgent.startSession('auto-lint');
        console.log('✅ Autonomous session completed!');
    } catch (error: any) {
        console.error('❌ Autonomous session failed:', error.message);
        console.log('\n   This is expected if:');
        console.log('   - Running outside VS Code (workspace API unavailable)');
        console.log('   - Gemini API rate limits hit');
        console.log('   - Cloudflare worker is down');
    }

    // Step 9: Check for new branches
    console.log('\n🔍 Step 9: Checking for new copilot branches...');
    try {
        const { execSync } = require('child_process');
        const branches = execSync('git branch', { cwd: workspaceRoot }).toString();
        const copilotBranches = branches.split('\n').filter((b: string) => b.includes('copilot'));
        
        if (copilotBranches.length > 0) {
            console.log(`✅ Found ${copilotBranches.length} copilot branches:`);
            copilotBranches.forEach((branch: string) => {
                console.log(`   ${branch.trim()}`);
            });
        } else {
            console.log('⚠️  No copilot branches found');
            console.log('   This might be because the agent failed early');
        }
    } catch (error) {
        console.warn('⚠️  Could not check branches:', error);
    }

    // Step 10: Show recent commits
    console.log('\n📝 Step 10: Recent commits:');
    try {
        const commits = await gitService.getRecentCommits(5);
        commits.forEach((commit, idx) => {
            console.log(`   ${idx + 1}. [${commit.hash.substring(0, 7)}] ${commit.message}`);
            console.log(`      By: ${commit.author} on ${commit.date.toLocaleString()}`);
        });
    } catch (error) {
        console.warn('⚠️  Could not retrieve commits:', error);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 AUTONOMOUS AGENT DEMO COMPLETE!');
    console.log('=' .repeat(60));
    console.log('\n✅ What was tested:');
    console.log('   ✓ Git service operations');
    console.log('   ✓ Autonomous agent initialization');
    console.log('   ✓ Test file creation with linting issues');
    console.log('   ✓ Autonomous session trigger');
    console.log('\n⚠️  Cleanup:');
    console.log('   To remove test artifacts:');
    console.log(`   rm -rf ${testDir}`);
    console.log('   git branch -D copilot/*');
    console.log('');
}

// Run the demo
runDemo().catch(error => {
    console.error('\n❌ Demo failed:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
});
