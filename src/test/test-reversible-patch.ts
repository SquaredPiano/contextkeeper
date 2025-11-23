/**
 * Integration test script for ReversiblePatchManager
 * 
 * This script tests the reversible patch system in a real VS Code environment.
 * Run this from the VS Code extension host (F5) or via the test command.
 * 
 * Usage:
 * 1. Open a test file with lint errors
 * 2. Run this test script
 * 3. Verify that fixes are applied and can be undone
 */

import * as vscode from 'vscode';
import { ReversiblePatchManager } from '../utils/ReversiblePatch';

/**
 * Create a test file with intentional lint errors
 */
async function createTestFile(): Promise<vscode.Uri> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        throw new Error('No workspace folder found');
    }

    const testFilePath = vscode.Uri.joinPath(workspaceFolder.uri, 'test-reversible-patch.ts');
    const testContent = `// Test file for reversible patch system
export function testFunction() {
    const unused = "test"; // Unused variable
    console.log("This should be removed"); // Console.log
    const x = 5 // Missing semicolon
    return x;
}
`;

    const edit = new vscode.WorkspaceEdit();
    edit.createFile(testFilePath, { ignoreIfExists: true });
    edit.insert(testFilePath, new vscode.Position(0, 0), testContent);

    const applied = await vscode.workspace.applyEdit(edit);
    if (!applied) {
        throw new Error('Failed to create test file');
    }

    await vscode.workspace.openTextDocument(testFilePath);
    return testFilePath;
}

/**
 * Test 1: Apply fix with active editor
 */
async function testApplyFixWithEditor() {
    console.log('[Test] Test 1: Apply fix with active editor');
    
    const testFile = await createTestFile();
    const document = await vscode.workspace.openTextDocument(testFile);
    await vscode.window.showTextDocument(document);

    const manager = ReversiblePatchManager.getInstance();
    
    // Get diagnostics
    const diagnostics = vscode.languages.getDiagnostics(testFile);
    if (diagnostics.length === 0) {
        console.log('[Test] No diagnostics found - waiting for TypeScript to analyze...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Try again
        const newDiagnostics = vscode.languages.getDiagnostics(testFile);
        if (newDiagnostics.length === 0) {
            console.log('[Test] ⚠️  No diagnostics found. This is expected if TypeScript server is not running.');
            return;
        }
    }

    // Apply a fix to the first diagnostic
    const diagnostic = diagnostics[0];
    const originalText = document.getText(diagnostic.range);
    const newText = originalText.replace(/console\.log/g, '// Removed console.log');

    console.log(`[Test] Applying fix: "${originalText}" -> "${newText}"`);
    
    // This will show the Undo/Keep prompt
    await manager.applyFix(testFile, diagnostic.range, newText);
    
    console.log('[Test] ✓ Fix applied. Check the Undo/Keep prompt.');
}

/**
 * Test 2: Apply fix without active editor
 */
async function testApplyFixWithoutEditor() {
    console.log('[Test] Test 2: Apply fix without active editor');
    
    const testFile = await createTestFile();
    const document = await vscode.workspace.openTextDocument(testFile);
    
    // Close the editor
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

    const manager = ReversiblePatchManager.getInstance();
    
    // Get diagnostics
    const diagnostics = vscode.languages.getDiagnostics(testFile);
    if (diagnostics.length === 0) {
        console.log('[Test] No diagnostics found');
        return;
    }

    const diagnostic = diagnostics[0];
    const originalText = document.getText(diagnostic.range);
    const newText = originalText.replace(/console\.log/g, '// Removed console.log');

    console.log(`[Test] Applying fix without editor: "${originalText}" -> "${newText}"`);
    
    await manager.applyFix(testFile, diagnostic.range, newText);
    
    console.log('[Test] ✓ Fix applied via WorkspaceEdit. Check the Undo/Keep prompt.');
}

/**
 * Test 3: Undo functionality
 */
async function testUndo() {
    console.log('[Test] Test 3: Undo functionality');
    
    const testFile = await createTestFile();
    const document = await vscode.workspace.openTextDocument(testFile);

    const manager = ReversiblePatchManager.getInstance();
    
    const diagnostics = vscode.languages.getDiagnostics(testFile);
    if (diagnostics.length === 0) {
        console.log('[Test] No diagnostics found');
        return;
    }

    const diagnostic = diagnostics[0];
    const originalText = document.getText(diagnostic.range);
    const newText = originalText.replace(/console\.log/g, '// Removed console.log');

    // Apply fix
    console.log('[Test] Applying fix...');
    await manager.applyFix(testFile, diagnostic.range, newText);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test undo
    console.log('[Test] Testing undo...');
    const canUndo = manager.hasUndoableFix();
    console.log(`[Test] Has undoable fix: ${canUndo}`);
    
    if (canUndo) {
        const result = await manager.undo();
        console.log(`[Test] Undo result: ${result}`);
    }
}

/**
 * Test 4: Multiple fixes
 */
async function testMultipleFixes() {
    console.log('[Test] Test 4: Multiple fixes');
    
    const testFile = await createTestFile();
    const document = await vscode.workspace.openTextDocument(testFile);

    const manager = ReversiblePatchManager.getInstance();
    
    const diagnostics = vscode.languages.getDiagnostics(testFile);
    if (diagnostics.length < 2) {
        console.log('[Test] Need at least 2 diagnostics for this test');
        return;
    }

    // Apply first fix
    const diagnostic1 = diagnostics[0];
    const originalText1 = document.getText(diagnostic1.range);
    const newText1 = originalText1.replace(/console\.log/g, '// Removed console.log');
    
    console.log('[Test] Applying first fix...');
    await manager.applyFix(testFile, diagnostic1.range, newText1);
    
    // Wait for user to choose Keep/Undo
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Apply second fix
    const diagnostic2 = diagnostics[1];
    const document2 = await vscode.workspace.openTextDocument(testFile);
    const originalText2 = document2.getText(diagnostic2.range);
    const newText2 = originalText2 + ';'; // Add semicolon
    
    console.log('[Test] Applying second fix...');
    await manager.applyFix(testFile, diagnostic2.range, newText2);
    
    console.log('[Test] ✓ Multiple fixes applied. Each should have its own Undo/Keep prompt.');
}

/**
 * Main test runner
 */
export async function runReversiblePatchTests() {
    console.log('=== Reversible Patch System Integration Tests ===\n');

    try {
        // Test 1: With editor
        await testApplyFixWithEditor();
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Test 2: Without editor
        await testApplyFixWithoutEditor();
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Test 3: Undo
        await testUndo();
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Test 4: Multiple fixes
        await testMultipleFixes();

        console.log('\n=== All tests completed ===');
        console.log('Check the VS Code window for Undo/Keep prompts and verify behavior.');
        
        vscode.window.showInformationMessage(
            'Reversible patch tests completed! Check the output panel for details.',
            'View Output'
        );

    } catch (error) {
        console.error('[Test] Error:', error);
        vscode.window.showErrorMessage(
            `Test failed: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

// Export command for VS Code
export function registerTestCommand(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand(
        'copilot.testReversiblePatch',
        runReversiblePatchTests
    );
    context.subscriptions.push(disposable);
}

