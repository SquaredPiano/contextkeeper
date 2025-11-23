# Quick Test Guide - Reversible Patch System

## 🚀 Quick Start

### Test in VS Code (Recommended)

1. **Press F5** to launch extension in debug mode
2. **Open Command Palette** (Cmd+Shift+P / Ctrl+Shift+P)
3. **Run**: `Copilot: Test Reversible Patch`
4. **Follow the prompts** and verify:
   - ✅ Fixes are applied
   - ✅ "Undo" / "Keep" buttons appear
   - ✅ Undo works correctly

### Manual Test

1. **Open** `test-lint-errors.ts` in VS Code
2. **Wait** for TypeScript/ESLint diagnostics to appear
3. **Wait 15 seconds** (idle) OR manually trigger autonomous agent
4. **Verify** fixes are applied with Undo/Keep prompts

## 📋 Test Checklist

- [ ] Fix applied with active editor (uses TextEditor.edit)
- [ ] Fix applied without active editor (uses WorkspaceEdit)
- [ ] "Undo" button works
- [ ] "Keep" button works
- [ ] Undo works after file modification
- [ ] Multiple fixes work independently
- [ ] VS Code's built-in undo (Cmd+Z) still works

## 🧪 Test Files

- **Unit Tests**: `src/utils/ReversiblePatch.test.ts`
- **Integration Tests**: `src/test/test-reversible-patch.ts`
- **Manual Test File**: `test-lint-errors.ts`

## 🔍 What to Look For

### ✅ Success Indicators:
- Popup appears: "Fix applied" with "Undo" / "Keep" buttons
- Fix is actually applied to the file
- Undo reverses the change correctly
- Keep clears the stored fix

### ❌ Failure Indicators:
- No popup appears
- Fix not applied
- "No fix to undo" when trying to undo
- Undo doesn't reverse the change

## 🐛 Debugging

If tests fail, check:
1. **Console Output** (View → Output → Select "Log")
2. **Extension Host Logs** (Help → Toggle Developer Tools)
3. **Verify** TypeScript server is running (should show diagnostics)

## 📝 Expected Behavior

- **With Active Editor**: Uses `TextEditor.edit()` → automatic undo support
- **Without Active Editor**: Uses `WorkspaceEdit` → manual tracking
- **Undo Strategies**: Tries 4 different methods to find and reverse changes
- **File Modifications**: Handles files that changed elsewhere

## 🎯 Integration Points

The system is automatically used by:
- `AutonomousAgent.createLintFixSuggestions()` - during idle improvements
- `IdleService.handleIdleImprovements()` - triggers lint fixes

No additional setup needed - it's already integrated!

