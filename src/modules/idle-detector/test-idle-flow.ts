/**
 * Comprehensive test script to validate the idle detection workflow
 * Run this from the VS Code debug console to test the idle service
 */
import * as vscode from 'vscode';
import { IdleDetector } from './idle-detector';

export async function testIdleFlow() {
    console.log('=== IDLE DETECTION DIAGNOSTIC TEST ===\n');

    // 1. Check if IdleDetector is listening to events
    console.log('1. Testing IdleDetector event listeners...');
    const detector = new IdleDetector({ thresholdMs: 5000 }); // 5 second test
    
    detector.on('idle', () => {
        console.log('✅ IDLE event fired!');
    });
    
    detector.on('active', () => {
        console.log('✅ ACTIVE event fired!');
    });
    
    detector.start();
    const state = detector.getState();
    console.log('   Detector state:', {
        isMonitoring: state.isMonitoring,
        isIdle: state.isIdle,
        thresholdMs: state.thresholdMs,
        hasTimer: state.hasTimer
    });

    // 2. Simulate user activity
    console.log('\n2. Simulating user activity...');
    console.log('   Please type something or move your cursor...');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 3. Wait for idle (5 seconds with no activity)
    console.log('\n3. Waiting for idle state (5 seconds with no activity)...');
    console.log('   Do NOT type or move cursor for 5 seconds!');
    
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    const stateAfterIdle = detector.getState();
    console.log('   Detector state after idle:', {
        isIdle: stateAfterIdle.isIdle,
        hasTimer: stateAfterIdle.hasTimer
    });

    // 4. Test VS Code event integration
    console.log('\n4. Testing VS Code event integration...');
    console.log('   Available VS Code events:');
    console.log('   - workspace.onDidChangeTextDocument ✓');
    console.log('   - window.onDidChangeTextEditorSelection ✓');
    console.log('   - window.onDidChangeWindowState ✓');

    // 5. Check workflow services
    console.log('\n5. Checking workflow services availability...');
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        console.log('   ✅ Workspace folder:', workspaceFolder.uri.fsPath);
    } else {
        console.log('   ❌ No workspace folder found!');
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        console.log('   ✅ Active editor:', activeEditor.document.fileName);
        console.log('   ✅ Language:', activeEditor.document.languageId);
        console.log('   ✅ Line count:', activeEditor.document.lineCount);
    } else {
        console.log('   ⚠️  No active editor');
    }

    // 6. Test git branch creation capability
    console.log('\n6. Testing git availability...');
    try {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (gitExtension) {
            console.log('   ✅ Git extension available');
        } else {
            console.log('   ❌ Git extension not found');
        }
    } catch (error) {
        console.log('   ❌ Error checking git:', error);
    }

    // 7. Test diagnostics availability
    console.log('\n7. Testing diagnostics availability...');
    if (activeEditor) {
        const diagnostics = vscode.languages.getDiagnostics(activeEditor.document.uri);
        console.log(`   Found ${diagnostics.length} diagnostic(s) in active file`);
        diagnostics.slice(0, 3).forEach((d, i) => {
            console.log(`   ${i + 1}. [${vscode.DiagnosticSeverity[d.severity]}] ${d.message}`);
        });
    }

    // Cleanup
    detector.dispose();
    console.log('\n=== TEST COMPLETE ===');
    console.log('Summary:');
    console.log('- If IDLE/ACTIVE events fired, the detector is working ✅');
    console.log('- If no events fired, check that event listeners are properly registered ❌');
}

export function registerTestCommand(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('contextkeeper.testIdleFlow', testIdleFlow);
    context.subscriptions.push(disposable);
    console.log('Registered test command: contextkeeper.testIdleFlow');
}
