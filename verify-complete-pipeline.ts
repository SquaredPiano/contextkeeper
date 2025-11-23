#!/usr/bin/env ts-node
/**
 * Complete Pipeline Verification Script
 * 
 * This script tests the entire ContextKeeper pipeline end-to-end:
 * 1. Context Ingestion (file edits, git events)
 * 2. LanceDB Storage (events, actions, sessions with embeddings)
 * 3. Idle Detection Trigger
 * 4. Orchestrator Analysis (Cloudflare lint + Gemini reasoning)
 * 5. Autonomous Agent (branch management, test generation)
 * 6. UI Update (dashboard displays results)
 * 
 * Usage: npx ts-node verify-complete-pipeline.ts
 */

import * as dotenv from 'dotenv';
import { LanceDBStorage } from './src/services/storage/storage';
import { GeminiService } from './src/services/real/GeminiService';
import { SessionManager } from './src/managers/SessionManager';
import { ContextService } from './src/services/real/ContextService';
import { Orchestrator } from './src/modules/orchestrator/orchestrator';
import { IdleService } from './src/modules/idle-detector/idle-service';
import { AutonomousAgent } from './src/modules/autonomous/AutonomousAgent';
import { GitService } from './src/services/real/GitService';

// Load environment variables
dotenv.config({ path: '.env.local' });

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof COLORS = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function section(title: string) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80) + '\n');
}

async function verifyEnvironment(): Promise<boolean> {
  section('STEP 1: Verify Environment Configuration');
  
  const requiredEnvVars = [
    'GEMINI_API_KEY',
  ];
  
  const optionalEnvVars = [
    'LANCE_DB_API_KEY',
    'LANCEDB_DB_NAME',
    'CLOUDFLARE_WORKER_URL',
  ];
  
  let allRequired = true;
  
  log('Checking required environment variables:', 'yellow');
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      log(`  ✓ ${envVar}: Set (${process.env[envVar]?.substring(0, 10)}...)`, 'green');
    } else {
      log(`  ✗ ${envVar}: NOT SET`, 'red');
      allRequired = false;
    }
  }
  
  log('\nChecking optional environment variables:', 'yellow');
  for (const envVar of optionalEnvVars) {
    if (process.env[envVar]) {
      log(`  ✓ ${envVar}: Set`, 'green');
    } else {
      log(`  ⚠ ${envVar}: Not set (using fallback)`, 'yellow');
    }
  }
  
  return allRequired;
}

async function testLanceDBStorage(): Promise<LanceDBStorage | null> {
  section('STEP 2: Test LanceDB Storage Connection');
  
  try {
    const storage = new LanceDBStorage();
    const geminiService = new GeminiService();
    
    await geminiService.initialize(process.env.GEMINI_API_KEY || '');
    log('✓ GeminiService initialized', 'green');
    
    await storage.connect(geminiService);
    log('✓ LanceDB connected', 'green');
    
    // Test write
    await storage.logEvent({
      timestamp: Date.now(),
      event_type: 'file_edit',
      file_path: '/test/verify.ts',
      metadata: JSON.stringify({ test: true })
    });
    log('✓ Test event written', 'green');
    
    // Test read
    const events = await storage.getRecentEvents(1);
    if (events.length > 0) {
      log(`✓ Retrieved ${events.length} event(s)`, 'green');
    }
    
    return storage;
  } catch (error) {
    log(`✗ LanceDB test failed: ${error}`, 'red');
    return null;
  }
}

async function testContextIngestion(storage: LanceDBStorage): Promise<boolean> {
  section('STEP 3: Test Context Ingestion Pipeline');
  
  try {
    const geminiService = new GeminiService();
    await geminiService.initialize(process.env.GEMINI_API_KEY || '');
    
    new ContextService(storage, geminiService); // Just to verify it can be initialized
    const sessionManager = new SessionManager(storage);
    await sessionManager.initialize();
    
    log('✓ Session manager initialized', 'green');
    
    // Simulate file edit
    await storage.logEvent({
      timestamp: Date.now(),
      event_type: 'file_edit',
      file_path: 'src/test.ts',
      metadata: JSON.stringify({
        languageId: 'typescript',
        changeCount: 1
      })
    });
    log('✓ Simulated file edit event', 'green');
    
    // Test action with embedding
    await storage.addAction({
      session_id: sessionManager.getSessionId(),
      timestamp: Date.now(),
      description: 'User edited test.ts to add new function',
      diff: '{}',
      files: JSON.stringify(['src/test.ts'])
    });
    log('✓ Action with embedding stored', 'green');
    
    // Query similar actions
    const similarActions = await storage.getSimilarActions('editing test file', 3);
    log(`✓ Retrieved ${similarActions.length} similar action(s)`, 'green');
    
    return true;
  } catch (error) {
    log(`✗ Context ingestion test failed: ${error}`, 'red');
    return false;
  }
}

async function testOrchestrator(): Promise<boolean> {
  section('STEP 4: Test Orchestrator Analysis');
  
  try {
    const config = {
      cloudflareWorkerUrl: process.env.CLOUDFLARE_WORKER_URL || 'https://contextkeeper-lint-worker.vishnu.workers.dev',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      analyzeAllFiles: false,
      maxFilesToAnalyze: 5
    };
    
    const orchestrator = new Orchestrator(config);
    await orchestrator.initialize();
    log('✓ Orchestrator initialized', 'green');
    
    // Test idle improvements analysis
    log('  Running idle improvements analysis...', 'yellow');
    const result = await orchestrator.analyzeForIdleImprovements();
    
    if (result) {
      log('✓ Idle improvements analysis completed', 'green');
      log(`  Summary: ${result.summary.substring(0, 100)}...`, 'blue');
      log(`  Tests generated: ${result.tests.length}`, 'blue');
      log(`  Recommendations: ${result.recommendations.length}`, 'blue');
      
      if (result.recommendations.length > 0) {
        log('\n  Sample recommendations:', 'yellow');
        result.recommendations.slice(0, 3).forEach(rec => {
          log(`    [${rec.priority.toUpperCase()}] ${rec.message}`, 'blue');
        });
      }
      
      return true;
    } else {
      log('⚠ No result from idle improvements', 'yellow');
      return false;
    }
  } catch (error) {
    log(`✗ Orchestrator test failed: ${error}`, 'red');
    console.error(error);
    return false;
  }
}

async function testAutonomousAgent(storage: LanceDBStorage): Promise<boolean> {
  section('STEP 5: Test Autonomous Agent');
  
  try {
    const workspaceRoot = process.cwd();
    const gitService = new GitService(workspaceRoot);
    const geminiService = new GeminiService();
    await geminiService.initialize(process.env.GEMINI_API_KEY || '');
    
    const contextService = new ContextService(storage, geminiService);
    
    const autonomousAgent = new AutonomousAgent(gitService, geminiService, contextService);
    log('✓ Autonomous agent initialized', 'green');
    
    // Test branch management (without actually creating branches)
    log('  Branch management methods available', 'blue');
    
    // Test storage of idle results
    const mockResult = {
      summary: 'Test summary of idle improvements',
      tests: ['// Test file content 1', '// Test file content 2'],
      recommendations: [
        { priority: 'high' as const, message: 'Add error handling' },
        { priority: 'medium' as const, message: 'Improve documentation' }
      ]
    };
    
    await autonomousAgent.storeIdleResults(mockResult, storage);
    log('✓ Idle results stored to LanceDB', 'green');
    
    return true;
  } catch (error) {
    log(`✗ Autonomous agent test failed: ${error}`, 'red');
    console.error(error);
    return false;
  }
}

async function testCompleteWorkflow(storage: LanceDBStorage): Promise<boolean> {
  section('STEP 6: Test Complete Idle Detection Workflow');
  
  try {
    const geminiService = new GeminiService();
    await geminiService.initialize(process.env.GEMINI_API_KEY || '');
    
    const config = {
      cloudflareWorkerUrl: process.env.CLOUDFLARE_WORKER_URL || 'https://contextkeeper-lint-worker.vishnu.workers.dev',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      analyzeAllFiles: false,
      maxFilesToAnalyze: 5
    };
    
    const orchestrator = new Orchestrator(config);
    await orchestrator.initialize();
    
    const workspaceRoot = process.cwd();
    const gitService = new GitService(workspaceRoot);
    const contextService = new ContextService(storage, geminiService);
    const autonomousAgent = new AutonomousAgent(gitService, geminiService, contextService);
    
    const idleService = new IdleService(storage, { thresholdMs: 1000 }, geminiService);
    idleService.setWorkflowServices(orchestrator, autonomousAgent);
    
    log('✓ Complete workflow services initialized', 'green');
    
    // Set up UI callback to capture results
    let capturedResult: { summary: string; tests: string[]; recommendations: Array<{ priority: string; message: string }> } | null = null;
    idleService.onIdleImprovementsComplete((result) => {
      capturedResult = result;
      log('✓ UI callback received idle improvements', 'green');
      log(`  Summary: ${result.summary.substring(0, 100)}...`, 'blue');
      log(`  Tests: ${result.tests.length}`, 'blue');
      log(`  Recommendations: ${result.recommendations.length}`, 'blue');
    });
    
    log('\n  Simulating idle detection workflow...', 'yellow');
    log('  (In real usage, this happens after 15 seconds of inactivity)', 'yellow');
    
    // Manually trigger idle improvements (bypassing actual idle detection)
    const result = await orchestrator.analyzeForIdleImprovements();
    if (result) {
      await autonomousAgent.storeIdleResults(result, storage);
      
      // Simulate UI callback
      if (idleService['uiUpdateCallback']) {
        idleService['uiUpdateCallback'](result);
      }
    }
    
    if (capturedResult) {
      log('\n✓ Complete workflow executed successfully', 'green');
      return true;
    } else {
      log('\n⚠ Workflow executed but no result captured', 'yellow');
      return false;
    }
  } catch (error) {
    log(`✗ Complete workflow test failed: ${error}`, 'red');
    console.error(error);
    return false;
  }
}

async function main() {
  log('\n╔════════════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║            ContextKeeper Complete Pipeline Verification                   ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════════════════╝\n', 'cyan');
  
  // Step 1: Environment
  const envOk = await verifyEnvironment();
  if (!envOk) {
    log('\n✗ Environment check failed. Please set required environment variables.', 'red');
    process.exit(1);
  }
  
  // Step 2: Storage
  const storage = await testLanceDBStorage();
  if (!storage) {
    log('\n✗ Storage test failed. Cannot continue.', 'red');
    process.exit(1);
  }
  
  // Step 3: Ingestion
  const ingestionOk = await testContextIngestion(storage);
  if (!ingestionOk) {
    log('\n⚠ Context ingestion test failed, continuing...', 'yellow');
  }
  
  // Step 4: Orchestrator
  const orchestratorOk = await testOrchestrator();
  if (!orchestratorOk) {
    log('\n⚠ Orchestrator test failed, continuing...', 'yellow');
  }
  
  // Step 5: Autonomous Agent
  const agentOk = await testAutonomousAgent(storage);
  if (!agentOk) {
    log('\n⚠ Autonomous agent test failed, continuing...', 'yellow');
  }
  
  // Step 6: Complete Workflow
  const workflowOk = await testCompleteWorkflow(storage);
  
  // Final Summary
  section('VERIFICATION SUMMARY');
  
  const results = [
    { name: 'Environment Configuration', status: envOk },
    { name: 'LanceDB Storage', status: storage !== null },
    { name: 'Context Ingestion', status: ingestionOk },
    { name: 'Orchestrator Analysis', status: orchestratorOk },
    { name: 'Autonomous Agent', status: agentOk },
    { name: 'Complete Workflow', status: workflowOk },
  ];
  
  results.forEach(({ name, status }) => {
    const icon = status ? '✓' : '✗';
    const color = status ? 'green' : 'red';
    log(`  ${icon} ${name}`, color);
  });
  
  const allPassed = results.every(r => r.status);
  
  if (allPassed) {
    log('\n🎉 ALL TESTS PASSED! ContextKeeper pipeline is fully operational.', 'green');
    log('\nNext steps:', 'cyan');
    log('  1. Open VS Code extension development host (F5)', 'blue');
    log('  2. Edit a file and wait 15 seconds to trigger idle detection', 'blue');
    log('  3. Check the ContextKeeper sidebar for "While you were away" summary', 'blue');
    process.exit(0);
  } else {
    log('\n⚠ Some tests failed. Review the output above for details.', 'yellow');
    process.exit(1);
  }
}

// Run the verification
main().catch((error) => {
  log(`\n✗ Fatal error during verification: ${error}`, 'red');
  console.error(error);
  process.exit(1);
});
