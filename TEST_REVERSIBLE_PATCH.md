# Reversible Patch System - Testing Guide

This guide explains how to test the reversible patch system that provides Undo/Keep functionality for lint fixes, similar to Cursor AI or Copilot.

## Overview

The reversible patch system allows users to:
- Apply lint fixes automatically
- Choose to **Keep** or **Undo** each fix via a popup
- Undo fixes even if the file was modified elsewhere

## Test Files

1. **Unit Tests**: `src/utils/ReversiblePatch.test.ts`
   - Tests the ReversiblePatchManager class with mocked VS Code APIs
   - Run with: `npm test` (if vitest is configured)

2. **Integration Tests**: `test-reversible-patch.ts`
   - Tests the system in a real VS Code environment
   - Run via VS Code command: `copilot.testReversiblePatch`

3. **Manual Test File**: `test-lint-errors.ts`
   - A file with intentional lint errors for manual testing

## Running Tests

### Option 1: Unit Tests (Vitest)

```bash
npm test -- ReversiblePatch.test.ts
```

### Option 2: Integration Tests (VS Code)

1. Press **F5** to launch the extension in debug mode
2. Open the Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
3. Run: `Copilot: Test Reversible Patch`
4. Follow the prompts and verify:
   - Fixes are applied correctly
   - "Undo" / "Keep" prompts appear
   - Undo works correctly
   - Multiple fixes work independently

### Option 3: Manual Testing

1. Open `test-lint-errors.ts` in VS Code
2. Wait for TypeScript/ESLint to show diagnostics
3. Trigger idle improvements (wait 15 seconds idle) OR
4. Run the autonomous agent manually
5. Verify fixes are applied with Undo/Keep prompts

## Test Scenarios

### Scenario 1: Fix with Active Editor
- **Setup**: Open a file with lint errors
- **Action**: Apply a fix
- **Expected**: 
  - Uses `TextEditor.edit()` (automatic undo support)
  - Shows "Fix applied" with "Undo" / "Keep" buttons
  - VS Code's built-in undo (Cmd+Z) also works

### Scenario 2: Fix without Active Editor
- **Setup**: Close the editor for a file with lint errors
- **Action**: Apply a fix via autonomous agent
- **Expected**:
  - Uses `WorkspaceEdit` with manual tracking
  - Shows "Fix applied" with "Undo" / "Keep" buttons
  - Undo works even without editor open

### Scenario 3: Undo After File Modification
- **Setup**: Apply a fix, then manually edit the file elsewhere
- **Action**: Click "Undo"
- **Expected**:
  - System finds the changed text and reverses it
  - Works even if file was modified

### Scenario 4: Multiple Fixes
- **Setup**: File with multiple lint errors
- **Action**: Apply fixes one by one
- **Expected**:
  - Each fix has its own Undo/Keep prompt
  - Only the last fix can be undone via the manager
  - VS Code's undo stack handles all edits

### Scenario 5: Keep Fix
- **Setup**: Apply a fix
- **Action**: Click "Keep"
- **Expected**:
  - Fix is kept
  - Manager clears the stored fix
  - No undo available via manager (but VS Code undo still works)

## Integration Points

The reversible patch system is integrated at:

1. **AutonomousAgent.createLintFixSuggestions()**
   - Called during idle improvements
   - Uses `ReversiblePatchManager.applyFixWithEdit()`

2. **IdleService.handleIdleImprovements()**
   - Triggers lint fix creation after analysis
   - Already integrated - no changes needed

## Debugging

### Check if fixes are being applied:
```typescript
const manager = ReversiblePatchManager.getInstance();
console.log('Has undoable fix:', manager.hasUndoableFix());
```

### View stored fix:
```typescript
// In ReversiblePatchManager, add logging:
console.log('Last fix:', this.lastFix);
```

### Common Issues

1. **"No fix to undo"**
   - Fix was already cleared (user chose "Keep")
   - Or no fix was applied yet

2. **Undo doesn't work**
   - File may have been modified in a way that breaks range matching
   - Check console for error messages
   - Try VS Code's built-in undo (Cmd+Z) as fallback

3. **Prompts don't appear**
   - Check that `showInformationMessage` is being called
   - Verify the fix was actually applied (check file content)

## Expected Behavior

✅ **Works:**
- Applying fixes with active editor
- Applying fixes without active editor
- Undoing recent fixes
- Keeping fixes
- Multiple sequential fixes

⚠️ **Limitations:**
- Only the last fix can be undone via the manager
- Undo may fail if file was heavily modified
- VS Code's built-in undo (Cmd+Z) is more reliable for complex scenarios

## Success Criteria

A successful test should demonstrate:
1. ✅ Fixes are applied correctly
2. ✅ "Undo" / "Keep" prompts appear
3. ✅ "Undo" reverses the change
4. ✅ "Keep" clears the stored fix
5. ✅ Works with both active and inactive editors
6. ✅ Handles file modifications gracefully

