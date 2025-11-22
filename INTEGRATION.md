# Backend Integration Guide

## 🎯 Quick Start for Backend Team

This extension is built with a **frontend-first architecture** using mock services. When you're ready to integrate your real backend implementations, you only need to:

1. Implement services matching the interfaces in `src/services/interfaces.ts`
2. Swap mock services for real ones in `src/extension.ts`
3. Test!

**That's it!** The UI is already built and working with mock data.

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────┐
│         EXTENSION ENTRY POINT                    │
│         (src/extension.ts)                       │
│                                                  │
│   // INTEGRATION POINT - ONE LINE SWAP:         │
│   const contextService = new MockContextService(); // ← CHANGE THIS
│   const contextService = new ContextService();     // ← TO THIS
│                                                  │
└──────────────────────┬──────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────┐          ┌─────────▼────────┐
│   UI LAYER     │          │  SERVICE LAYER   │
│  (Complete!)   │◄────────►│  (Your Work)     │
│                │  Events  │                  │
│ ✅ Status Bar  │          │ 🔧 ContextService│
│ ✅ Dashboard   │          │ 🔧 AIService     │
│ ✅ Tree View   │          │ 🔧 GitService    │
│ ✅ Notifications│         │ 🔧 VoiceService  │
└────────────────┘          └──────────────────┘
```

---

## 🔌 Service Interfaces (The Contract)

All services **must** implement these interfaces defined in `src/services/interfaces.ts`:

### 1. IContextService

Collects developer activity data from the workspace.

```typescript
interface IContextService extends EventEmitter {
  collectContext(): Promise<DeveloperContext>;
  getCurrentFile(): string;
  getRiskyFiles(): string[];
}
```

**Events to emit:**
- `contextCollected` - When context is successfully collected
- `error` - On errors

**What to implement:**
- Use `vscode.workspace` API to track files, edits
- Use `simple-git` to get git information
- Monitor cursor position, active editor
- Track edit frequency to identify "risky" files

### 2. IAIService

Analyzes code using AI (Gemini API).

```typescript
interface IAIService extends EventEmitter {
  analyze(code: string, context: DeveloperContext): Promise<AIAnalysis>;
  generateTests(code: string): Promise<string>;
  fixError(code: string, error: string): Promise<CodeFix>;
  explainCode(code: string): Promise<string>;
}
```

**Events to emit:**
- `analysisStarted` - When analysis begins
- `analysisProgress` - Progress updates (number, message)
- `analysisComplete` - When done with results
- `error` - On errors

**What to implement:**
- Call Gemini API with code + context
- Parse response into `AIAnalysis` format
- Emit progress events for UI updates

### 3. IGitService

Manages git operations.

```typescript
interface IGitService {
  createBranch(name: string): Promise<void>;
  commit(message: string, files?: string[]): Promise<void>;
  applyDiff(diff: string): Promise<void>;
  getCurrentBranch(): Promise<string>;
  getRecentCommits(count: number): Promise<GitCommit[]>;
}
```

**What to implement:**
- Use `simple-git` library
- Execute git commands in workspace root
- Handle errors gracefully

### 4. IVoiceService

Provides audio notifications via ElevenLabs.

```typescript
interface IVoiceService {
  speak(text: string, voice?: 'casual' | 'professional' | 'encouraging'): Promise<void>;
  isEnabled(): boolean;
}
```

**What to implement:**
- Call ElevenLabs API to generate speech
- Stream/play audio in VSCode
- Check `copilot.voice.enabled` setting

---

## 🚀 Integration Steps

### Step 1: Create Real Service Classes

Create new files in `src/services/real/`:

```bash
src/services/real/
├── ContextService.ts
├── AIService.ts
├── GitService.ts
└── VoiceService.ts
```

**Example: ContextService.ts**

```typescript
import { EventEmitter } from 'events';
import * as vscode from 'vscode';
import simpleGit from 'simple-git';
import { IContextService, DeveloperContext } from '../interfaces';

export class ContextService extends EventEmitter implements IContextService {
  private git = simpleGit(vscode.workspace.rootPath);

  async collectContext(): Promise<DeveloperContext> {
    try {
      // REAL implementation using vscode API
      const editor = vscode.window.activeTextEditor;
      const gitLog = await this.git.log({ maxCount: 10 });
      const status = await this.git.status();
      
      const context: DeveloperContext = {
        git: {
          recentCommits: gitLog.all.map(c => ({
            hash: c.hash,
            message: c.message,
            author: c.author_name,
            date: new Date(c.date),
          })),
          currentBranch: status.current || 'main',
          uncommittedChanges: status.files.map(f => ({
            file: f.path,
            linesAdded: 0, // Parse from git diff
            linesRemoved: 0,
          })),
        },
        files: {
          openFiles: vscode.workspace.textDocuments.map(d => d.fileName),
          activeFile: editor?.document.fileName || '',
          recentlyEdited: [], // Track with file watcher
          editFrequency: new Map(),
        },
        // ... implement other fields
      };

      this.emit('contextCollected', context);
      return context;
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  getCurrentFile(): string {
    return vscode.window.activeTextEditor?.document.fileName || '';
  }

  getRiskyFiles(): string[] {
    // Return files with high edit frequency
    return [];
  }
}
```

### Step 2: Update extension.ts (ONE LINE CHANGE PER SERVICE!)

Open `src/extension.ts` and find these lines:

```typescript
// OLD (mock services)
let contextService: MockContextService;
let aiService: MockAIService;
let gitService: MockGitService;
let voiceService: MockVoiceService;

// ...

contextService = new MockContextService();
aiService = new MockAIService();
gitService = new MockGitService();
voiceService = new MockVoiceService();
```

**Replace with:**

```typescript
// NEW (real services)
import { ContextService } from "./services/real/ContextService";
import { AIService } from "./services/real/AIService";
import { GitService } from "./services/real/GitService";
import { VoiceService } from "./services/real/VoiceService";

let contextService: ContextService;
let aiService: AIService;
let gitService: GitService;
let voiceService: VoiceService;

// ...

contextService = new ContextService();
aiService = new AIService();
gitService = new GitService();
voiceService = new VoiceService();
```

### Step 3: Test!

Press `F5` in VSCode to run the extension. The UI will now use your real services!

---

## 📋 Testing Checklist

- [ ] **Context Collection**: Open dashboard, click "Refresh Context" - verify real data appears
- [ ] **Analysis**: Click "Analyze Now" - verify Gemini API is called and real issues appear
- [ ] **Tree View**: Check that issues populate correctly in sidebar tree
- [ ] **Status Bar**: Verify states transition: Ready → Analyzing → Complete
- [ ] **Notifications**: Check that VSCode notifications appear appropriately
- [ ] **Voice**: Enable voice in settings, trigger analysis, verify audio plays
- [ ] **Navigation**: Click an issue in tree view, verify it jumps to correct line
- [ ] **Git Operations**: Test branch creation, commits (if implemented)

---

## 🔧 API Keys & Configuration

Users configure API keys in VSCode settings:

```json
{
  "copilot.gemini.apiKey": "your-gemini-key",
  "copilot.elevenlabs.apiKey": "your-elevenlabs-key",
  "copilot.cloudflare.workerUrl": "https://your-worker.workers.dev",
  "copilot.voice.enabled": true
}
```

**Access in code:**

```typescript
const config = vscode.workspace.getConfiguration('copilot');
const geminiKey = config.get<string>('gemini.apiKey');
const voiceEnabled = config.get<boolean>('voice.enabled');
```

---

## 🎨 UI Components (Already Built!)

### Status Bar
- **Location**: Bottom left
- **States**: Idle, Analyzing (with spinner), Complete, Error
- **Click**: Opens dashboard

### Dashboard (Sidebar Webview)
- **Shows**: Context summary, analysis results, action buttons
- **Updates**: Automatically when services emit events
- **Messages**: Two-way communication with extension

### Issues Tree View
- **Shows**: Hierarchical list of issues by file
- **Click**: Navigates to issue location in code
- **Updates**: Automatically on new analysis

### Notifications
- Progress indicators for long tasks
- Success/warning/error toasts
- Action buttons (View Results, Retry, etc.)

---

## 📦 Dependencies You'll Need

Add these to `package.json` if not already present:

```json
{
  "dependencies": {
    "simple-git": "^3.x",
    "@google/generative-ai": "^0.x", // Gemini SDK
    "elevenlabs-node": "^1.x", // ElevenLabs SDK
  }
}
```

---

## 🐛 Debugging Tips

1. **Service not updating UI?**
   - Make sure you're emitting events (`this.emit(...)`)
   - Check event names match exactly
   - Verify listeners are set up in `setupServiceListeners()`

2. **Type errors?**
   - Ensure your service class `implements` the interface
   - Check return types match exactly
   - Run `npm run compile` to see all errors

3. **UI not showing data?**
   - Open DevTools: `Help > Toggle Developer Tools`
   - Check console for webview errors
   - Verify `postMessage()` calls in SidebarWebviewProvider

4. **API calls failing?**
   - Check API keys in settings
   - Verify network requests in DevTools Network tab
   - Add error handling and emit `error` events

---

## 📝 Code Style & Best Practices

- **Async/await**: Use promises, not callbacks
- **Error handling**: Always catch and emit errors
- **TypeScript**: Use strict types, no `any` if possible
- **Events**: Emit progress events for long operations
- **Logging**: Use `console.log` for debugging, remove before PR

---

## 🎬 Demo Recording Tips

When your services are integrated, record a demo showing:

1. Open VSCode with extension installed
2. Click status bar → Dashboard opens with REAL context
3. Click "Analyze Now" → Progress indicator → Real issues appear
4. Click issue in tree → Jumps to code
5. Enable autonomous mode → Show notification
6. Toggle voice on → Hear notification

---

## 🚨 Important Notes

### DO NOT modify:
- `src/ui/` - UI components are complete
- `src/services/interfaces.ts` - Contracts are locked
- `package.json` contributions - Commands/views already registered

### DO modify:
- `src/services/real/` - Your service implementations
- `src/extension.ts` - Service instantiation (lines 15-18, 46-49)
- Dependencies in `package.json` - Add what you need

### CAN extend:
- Add new methods to service classes (beyond interface)
- Add utility files in `src/utils/`
- Add new commands if needed (register in package.json + extension.ts)

---

## 💡 Quick Reference: Mock vs Real

| Mock (Current) | Real (Your Work) |
|----------------|------------------|
| Hardcoded data | VSCode API calls |
| Fake delays | Actual async operations |
| Console logs | Real git commands |
| Instant responses | API network requests |
| No external deps | simple-git, Gemini SDK, etc. |

---

## 📞 Integration Support

If you get stuck:

1. Check the mock implementations for reference behavior
2. Review interface definitions for exact contracts
3. Test incrementally (one service at a time)
4. Use VSCode debugger (breakpoints in service classes)

---

## ✅ Success Criteria

Your integration is complete when:

- [ ] All UI components display real data (not mock)
- [ ] Analysis calls Gemini API and returns actual issues
- [ ] Context collection reflects actual workspace state
- [ ] Git operations execute real commands
- [ ] Voice speaks using ElevenLabs API
- [ ] No console errors in production
- [ ] Extension loads in <2 seconds
- [ ] All commands respond within reasonable time

---

**Ready to integrate? Start with ContextService (easiest), then AIService (most important), then GitService and VoiceService!**
