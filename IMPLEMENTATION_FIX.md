# Proper Implementation Fix for ContextKeeper

## Problem Statement
The extension is currently destructive:
1. ❌ Overwrites entire files without warning
2. ❌ Creates git branches automatically
3. ❌ No "Keep/Undo" mechanism like VS Code Copilot
4. ❌ Test files not created in proper location (tests/ folder)
5. ❌ Summary shows generic issues, not user's actual work context

## Solution Architecture

### 1. Use VS Code's CodeActionProvider (Like Copilot)
**Files Created:**
- `src/services/AICodeActionProvider.ts` ✅ Created
- `src/services/TestFileManager.ts` ✅ Created

**How It Works:**
- AI suggestions appear as **lightbulb Quick Fixes**
- User can **Accept** or **Reject** each suggestion
- Uses VS Code's native `WorkspaceEdit` with proper undo/redo
- Non-destructive by default

### 2. Test File Creation (Safe)
**Location Logic:**
- If `src/` exists → create in `src/tests/`
- Otherwise → create in `tests/` at workspace root
- Filename auto-generated: `myfile.test.ts` or `test_myfile.py`

**User Flow:**
1. AI generates test code
2. Shows notification: "💡 Create test file: myfile.test.ts?"
3. User chooses: Create / Preview / Cancel
4. If file exists → offer "View Existing" or "Create New Version"

### 3. Lint Suggestions (Safe)
**Implementation Needed:**
```typescript
// When lint issues found:
const edit = new vscode.WorkspaceEdit();
edit.replace(docUri, problemRange, fixedCode);

codeActionProvider.addSuggestion(
    docUri,
    "Fix lint issue: Missing semicolon",
    edit
);
// Shows as lightbulb that user can accept/reject
```

### 4. Context-Aware Summary
**Current Issue:** Summary shows generic code issues instead of user's work

**Fix Needed in Gemini Prompt:**
```typescript
// src/modules/gemini/prompts.ts - idleImprovements()
WHAT THE USER WAS JUST WORKING ON:
- Currently open file: ${context.activeFile} // ✅ Already added
- Files they edited: ${recentlyEditedFiles}  // ✅ Already added
- Their recent commits: ${commitsWithMessages} // ✅ Already added
- What they changed: ${specificFileChanges} // ❌ NEED TO ADD

FOCUS: Tell me what the USER was doing, not what's wrong with the code.
```

**Additional Context Needed:**
- Parse git diff to show actual lines changed
- Track which functions/classes were edited
- Include file-specific context (e.g., "editing React component UserProfile")

## Implementation Steps

### Step 1: Wire Up CodeActionProvider (15 min)
```typescript
// src/extension.ts
import { AICodeActionProvider } from './services/AICodeActionProvider';
import { TestFileManager } from './services/TestFileManager';

export async function activate(context: vscode.ExtensionContext) {
    // Register CodeAction provider
    const codeActionProvider = new AICodeActionProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('*', codeActionProvider, {
            providedCodeActionKinds: [
                vscode.CodeActionKind.RefactorRewrite,
                vscode.CodeActionKind.QuickFix
            ]
        })
    );
    
    // Register test file manager
    const testFileManager = new TestFileManager(codeActionProvider);
    
    // Register dismiss command
    context.subscriptions.push(
        vscode.commands.registerCommand('contextkeeper.dismissAISuggestion', (fileKey: string) => {
            codeActionProvider.dismissSuggestion(fileKey);
        })
    );
    
    // Pass to orchestrator/idle service
    idleService.setCodeActionProvider(codeActionProvider);
    idleService.setTestFileManager(testFileManager);
}
```

### Step 2: Update AutonomousAgent to Use Safe Methods (30 min)
```typescript
// src/modules/autonomous/AutonomousAgent.ts

// REMOVE: Direct file writing
// await vscode.workspace.applyEdit(edit);
// await document.save();

// REPLACE WITH: CodeAction suggestion
async applyLintFix(document: vscode.TextDocument, fixedCode: string) {
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
    );
    edit.replace(document.uri, fullRange, fixedCode);
    
    // Let user accept/reject
    this.codeActionProvider.addSuggestion(
        document.uri,
        "Apply lint fixes",
        edit,
        "Fixed formatting and style issues"
    );
}
```

### Step 3: Update Idle Service to Create Tests Safely (20 min)
```typescript
// src/modules/idle-detector/idle-service.ts

async handleIdleImprovements(orchestrator, autonomousAgent) {
    const result = await orchestrator.analyzeForIdleImprovements();
    
    if (result && result.tests.length > 0) {
        // Use TestFileManager instead of direct file creation
        for (const testCode of result.tests) {
            await this.testFileManager.proposeTestFile(
                result.sourceFile || '',
                testCode
            );
        }
    }
}
```

### Step 4: Improve Context Collection (30 min)
```typescript
// src/modules/orchestrator/orchestrator.ts - buildUnifiedIdleContext()

// ADD: Actual file changes
const fileChanges = await this.getRecentFileChanges(currentContext);

// ADD: Function/class context
const editedSymbols = await this.getEditedSymbols(currentContext);

return {
    activeFile: currentContext.files.activeFile,
    recentCommits: [...],
    fileChanges, // NEW: What actually changed
    editedSymbols, // NEW: Which functions/classes were modified
    gitDiffSummary: `Modified ${fileChanges.length} lines in ${editedSymbols.join(', ')}`,
    // ...rest
};
```

### Step 5: Disable All Automatic Actions (10 min)
```typescript
// Ensure these are all removed/disabled:
// ❌ autonomousAgent.startSession() - creates branches
// ❌ autonomousAgent.ensureIdleBranch() - creates branches
// ❌ Direct vscode.workspace.applyEdit() without user confirmation
// ❌ document.save() without user action
// ❌ gitService.commit() without user action
```

## Testing Checklist
- [ ] Go idle → AI generates suggestions
- [ ] See lightbulb icon appear in file
- [ ] Click lightbulb → see "✨ Apply AI Suggestion"
- [ ] Accept suggestion → file updates with undo history
- [ ] Reject suggestion → nothing happens
- [ ] Test file creation → notification appears
- [ ] Choose "Preview" → see test in untitled document
- [ ] Choose "Create" → file created in tests/ folder
- [ ] Summary says "You were working on [actual context]"
- [ ] No automatic git branches created
- [ ] No files overwritten without permission

## Success Criteria
✅ All file changes go through CodeActionProvider (accept/reject)
✅ Test files created in proper location with user confirmation
✅ Summary focuses on user's actual work, not generic issues
✅ No automatic git operations
✅ Full undo/redo support for all changes
✅ Non-destructive by default
