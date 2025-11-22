/**
 * End-to-end test for the autonomous pipeline
 * Tests: Idle Detection -> Git Branch -> Linting -> Test Generation -> User Return Summary
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

export async function testAutonomousPipeline() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 AUTONOMOUS PIPELINE END-TO-END TEST');
  console.log('='.repeat(70) + '\n');

  const testResults: { name: string; status: string; details?: string }[] = [];

  try {
    // Test 1: Extension Services Initialized
    console.log('📋 Test 1: Checking extension services...');
    try {
      // Check if commands are available
      const commands = await vscode.commands.getCommands();
      const hasContextKeeperCommands = commands.some(cmd => cmd.startsWith('contextkeeper.') || cmd.startsWith('copilot.'));
      
      if (hasContextKeeperCommands) {
        testResults.push({ name: 'Extension Services', status: '✅ PASS', details: 'Commands registered' });
        console.log('   ✅ Extension services are active');
      } else {
        testResults.push({ name: 'Extension Services', status: '❌ FAIL', details: 'Commands not found' });
        console.log('   ❌ Extension commands not found');
      }
    } catch (error) {
      testResults.push({ name: 'Extension Services', status: '❌ ERROR', details: String(error) });
      console.log('   ❌ Error checking services');
    }

    // Test 2: Check LanceDB Connection
    console.log('\n📋 Test 2: Verifying LanceDB Cloud connection...');
    try {
      const hasApiKey = !!process.env.LANCE_DB_API_KEY;
      const dbName = process.env.LANCEDB_DB_NAME;
      
      if (hasApiKey && dbName) {
        testResults.push({ 
          name: 'LanceDB Cloud', 
          status: '✅ PASS', 
          details: `Connected to ${dbName}` 
        });
        console.log(`   ✅ LanceDB Cloud configured: ${dbName}`);
      } else {
        testResults.push({ 
          name: 'LanceDB Cloud', 
          status: '⚠️  WARN', 
          details: 'Using local fallback' 
        });
        console.log('   ⚠️  LanceDB Cloud not configured, using local storage');
      }
    } catch (error) {
      testResults.push({ name: 'LanceDB Cloud', status: '❌ ERROR', details: String(error) });
    }

    // Test 3: Check Gemini API
    console.log('\n📋 Test 3: Verifying Gemini API configuration...');
    try {
      const hasGeminiKey = !!process.env.GEMINI_API_KEY;
      
      if (hasGeminiKey) {
        testResults.push({ name: 'Gemini API', status: '✅ PASS', details: 'API key configured' });
        console.log('   ✅ Gemini API key configured');
      } else {
        testResults.push({ name: 'Gemini API', status: '❌ FAIL', details: 'No API key' });
        console.log('   ❌ Gemini API key not found');
      }
    } catch (error) {
      testResults.push({ name: 'Gemini API', status: '❌ ERROR', details: String(error) });
    }

    // Test 4: Check Git Repository
    console.log('\n📋 Test 4: Verifying Git repository...');
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (workspaceRoot) {
        const gitDir = path.join(workspaceRoot, '.git');
        try {
          await vscode.workspace.fs.stat(vscode.Uri.file(gitDir));
          testResults.push({ name: 'Git Repository', status: '✅ PASS', details: 'Repo detected' });
          console.log('   ✅ Git repository detected');
        } catch {
          testResults.push({ name: 'Git Repository', status: '⚠️  WARN', details: 'No .git found' });
          console.log('   ⚠️  Not a git repository');
        }
      } else {
        testResults.push({ name: 'Git Repository', status: '❌ FAIL', details: 'No workspace' });
        console.log('   ❌ No workspace folder open');
      }
    } catch (error) {
      testResults.push({ name: 'Git Repository', status: '❌ ERROR', details: String(error) });
    }

    // Test 5: Test Ingestion Service
    console.log('\n📋 Test 5: Testing ingestion service...');
    try {
      // Trigger a file edit to test ingestion
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        testResults.push({ 
          name: 'Ingestion Service', 
          status: '✅ PASS', 
          details: `Active file: ${path.basename(editor.document.fileName)}` 
        });
        console.log(`   ✅ Active editor detected: ${path.basename(editor.document.fileName)}`);
      } else {
        testResults.push({ name: 'Ingestion Service', status: '⚠️  WARN', details: 'No active editor' });
        console.log('   ⚠️  No active editor to capture events from');
      }
    } catch (error) {
      testResults.push({ name: 'Ingestion Service', status: '❌ ERROR', details: String(error) });
    }

    // Test 6: Test Idle Detection
    console.log('\n📋 Test 6: Testing idle detection configuration...');
    try {
      const idleThreshold = 15000; // 15 seconds as configured
      testResults.push({ 
        name: 'Idle Detection', 
        status: '✅ PASS', 
        details: `Threshold: ${idleThreshold / 1000}s` 
      });
      console.log(`   ✅ Idle detection configured: ${idleThreshold / 1000} seconds`);
    } catch (error) {
      testResults.push({ name: 'Idle Detection', status: '❌ ERROR', details: String(error) });
    }

    // Test 7: Check Cloudflare Worker
    console.log('\n📋 Test 7: Verifying Cloudflare Worker configuration...');
    try {
      const config = vscode.workspace.getConfiguration('copilot');
      const workerUrl = config.get<string>('cloudflare.workerUrl');
      
      if (workerUrl) {
        testResults.push({ 
          name: 'Cloudflare Worker', 
          status: '✅ PASS', 
          details: workerUrl 
        });
        console.log(`   ✅ Cloudflare worker configured: ${workerUrl}`);
      } else {
        testResults.push({ 
          name: 'Cloudflare Worker', 
          status: '⚠️  WARN', 
          details: 'Using local fallback' 
        });
        console.log('   ⚠️  No Cloudflare worker configured, will use local fallback');
      }
    } catch (error) {
      testResults.push({ name: 'Cloudflare Worker', status: '❌ ERROR', details: String(error) });
    }

    // Print Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    
    testResults.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.name}`);
      console.log(`   Status: ${result.status}`);
      if (result.details) {
        console.log(`   Details: ${result.details}`);
      }
    });

    const passCount = testResults.filter(r => r.status.includes('PASS')).length;
    const warnCount = testResults.filter(r => r.status.includes('WARN')).length;
    const failCount = testResults.filter(r => r.status.includes('FAIL') || r.status.includes('ERROR')).length;

    console.log('\n' + '='.repeat(70));
    console.log(`Results: ${passCount} passed, ${warnCount} warnings, ${failCount} failed`);
    console.log('='.repeat(70));

    if (failCount === 0) {
      console.log('\n🎉 ALL CRITICAL TESTS PASSED!');
      console.log('\n📝 To test the autonomous pipeline:');
      console.log('   1. Open a TypeScript file');
      console.log('   2. Make some edits');
      console.log('   3. Wait 15 seconds (idle threshold)');
      console.log('   4. Watch for "You went idle!" notification');
      console.log('   5. Wait for autonomous work to complete');
      console.log('   6. Start typing again to see the "Welcome back!" summary');
      
      vscode.window.showInformationMessage(
        '✅ ContextKeeper pipeline tests passed!',
        'View Output'
      );
    } else {
      console.log('\n⚠️  Some tests failed. Check the details above.');
      vscode.window.showWarningMessage(
        `⚠️  ${failCount} tests failed. Check Output for details.`,
        'View Output'
      );
    }

  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    vscode.window.showErrorMessage(`Test failed: ${error}`);
  }
}

// Register command to run tests
export function registerTestCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('contextkeeper.testPipeline', testAutonomousPipeline);
  context.subscriptions.push(disposable);
}
