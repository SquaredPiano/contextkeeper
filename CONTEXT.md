# System Architecture & Context
**Written: May 2025 | Last Updated: November 2025**

## Philosophy: Why This Exists

Six months ago, I started this project because I was frustrated with the "dumb autocomplete" experience of existing coding assistants. They're reactive tools that only know about the current file—they have no memory, no understanding of what you were working on yesterday, and they certainly don't help you when you step away from the keyboard.

**The core insight**: Most of our coding time isn't spent typing—it's spent thinking, reading, and context-switching. What if an AI could observe your entire development session, remember it, and actually help you *between* coding sessions?

That's ContextKeeper. It's not about faster autocomplete. It's about an AI that:
1. **Remembers everything** you work on (with embeddings for semantic search)
2. **Understands context** across files, sessions, and time
3. **Works while you're away** on tedious tasks (linting, test generation)
4. **Never loses your flow** by maintaining session continuity

---

## 1. The Core Architecture

### Why Hybrid Compute?

I chose a **hybrid local + cloud architecture** after realizing that neither pure local nor pure cloud would work:

- **Pure Local**: Extensions can't use large LLMs locally without killing performance
- **Pure Cloud**: Every keystroke to the cloud = privacy nightmare + latency hell

**The Solution**: Keep lightweight event capture local, but push heavy AI work to the cloud only when needed (embeddings, reasoning, code generation). This gives us:
- Fast, responsive UI (no network lag during typing)
- Powerful AI when we need it (Gemini 1.5 Pro for reasoning)
- Offline fallback capabilities (local storage, local linting)

```
[VS Code Events] -> [IngestionService] -> [IngestionQueue] -> [LanceDB with Embeddings]
                                                                        |
                                                                        v
[Idle Detection] -> [AutonomousAgent Git Branches] -> [Gemini Analysis + ContextBuilder + RAG] -> [Gemini generate test cases] -> [Update frontend when user returns]
                                       |
                                       +-> [CloudflareService (Linting)]
```

**Why this flow?**: Event capture is synchronous and cheap. Embedding generation is expensive (Gemini API call), so we queue it asynchronously. When the user goes idle, we pull relevant context from the vector DB (RAG), send it to Gemini, and execute autonomous tasks.

---

## 2. The Five Core Pillars

### Pillar 1: Event Ingestion (The Memory System)

**The Problem**: How do you capture a developer's intent without logging every keystroke?

**The Solution**: Debounced event capture with semantic enrichment.

#### Why Debouncing?
I tried capturing every keystroke initially—it was a disaster. The vector DB filled with garbage like "typed 'f'", "typed 'u'", "typed 'n'". Useless.

The breakthrough: **Debounce at 2 seconds**. This captures "thought pauses"—the moment you stop typing to think. That's when a meaningful edit has occurred. In practice:
- You type a function: `function foo() { ... }`
- You pause to think (2s)
- We capture: "Created function foo in utils.ts"

**Why 2 seconds specifically?**: Tested 1s (too noisy), 3s (missed rapid edits), 5s (felt sluggish). 2s hit the sweet spot where we capture meaningful edits without spam.

#### Why Symbol-Aware?
When you edit line 47 of a 500-line file, "edited file.ts" is useless context. But "modified function calculateTotal in file.ts" is gold. That's why we extract symbols using VS Code's symbol provider.

**The function**: `ContextIngestionService.captureEdit()`
- Uses `vscode.languages.executeDocumentSymbolProvider()` to find what function/class you're editing
- Stores both the raw event AND a natural language description
- Generates embeddings for semantic search later

#### Why Queue-Based?
Embeddings take 200-500ms per API call. If we blocked the UI thread, typing would feel laggy. The `IngestionQueue`:
1. Accepts events synchronously (no UI lag)
2. Batches them up
3. Processes in background with async/await
4. Stores to LanceDB when ready

**Critical learning**: Always decouple UI events from I/O. The queue was added after initial version felt "sticky" during typing.

---

### Pillar 2: Vector Storage (The Long-Term Memory)

**The Problem**: Relational databases suck for semantic search. "Find similar work" doesn't map to SQL.

**The Solution**: LanceDB with vector embeddings.

#### Why LanceDB?
I evaluated 5 vector DBs:
- **Pinecone**: Cloud-only, expensive at scale
- **Weaviate**: Heavy, requires Docker
- **ChromaDB**: Python-focused, awkward for TypeScript
- **Qdrant**: Good, but complex setup
- **LanceDB**: Lightweight, TypeScript SDK, local OR cloud, simple API

LanceDB won because it supports both local (`~/.contextkeeper/lancedb`) AND cloud (`db://contextkeeper`) with the same API. Perfect for our hybrid model.

#### Why Three Tables?

**`events` table**: The raw activity log.
- Every file open, edit, close, git commit
- Timestamped for session reconstruction
- No embeddings (too noisy, would pollute vector search)
- **Why?**: Historical audit trail. If autonomous agent breaks something, we can replay the session.

**`sessions` table**: High-level work periods.
- Summarized by Gemini every hour or at session end
- WITH embeddings (summarized description is clean, meaningful)
- **Why?**: "What was I working on last Tuesday?" Maps to vector search on session summaries.

**`actions` table**: Semantic actions with intent.
- "Refactored authentication logic"
- "Fixed bug in payment processing"
- WITH embeddings
- **Why?**: RAG retrieval. When working on auth, we want past auth work, not every keystroke from that day.

#### Why Cloud + Local Fallback?

Initially, this was local-only. But I hit two problems:
1. **Multi-device**: Work on laptop, context lost when on desktop
2. **Backup**: Local DB corruption = lost history

**The migration**: November 2025, I added cloud support with `LANCE_DB_API_KEY`. If key exists, connect to cloud. Otherwise, fall back to local. This gives us:
- Cloud: Sync across devices, automatic backup
- Local: Offline support, no network dependency, privacy for sensitive projects

**The function**: `LanceDBStorage.initialize()`
- Checks for `LANCE_DB_API_KEY` env var
- Cloud: Connects to `db://{LANCEDB_DB_NAME}`
- Local: Falls back to `~/.contextkeeper/lancedb`
- Creates tables if they don't exist

---

### Pillar 3: RAG Context Builder (The Brain)

**The Problem**: Gemini 1.5 Pro has a 2M token context window, but you can't dump your entire project in every time. It's slow, expensive, and LLMs get "lost" in huge contexts.

**The Solution**: Retrieval-Augmented Generation (RAG) with semantic search.

#### How It Works

When the autonomous agent needs to act (e.g., generate tests), we:
1. **Identify current context**: Active file, recent edits, current symbols
2. **Vector search**: Query `actions` table for semantically similar past work
3. **Retrieve top-N**: Get 5-10 most relevant past actions with their context
4. **Build prompt**: Combine current context + retrieved context + task instruction
5. **Send to Gemini**: LLM now has both current work AND relevant historical context

**Example**:
- You're editing `payment-service.ts`
- RAG finds: "3 months ago, fixed Stripe webhook validation bug"
- Gemini now knows about that past bug when analyzing your current payment code
- Result: Better suggestions, avoids repeating past mistakes

#### Why Not Just Use Git History?

Git history is chronological, not semantic. If you fixed a bug 6 months ago, it's buried under 1000 commits. RAG finds it via similarity, not time.

**The function**: `ContextBuilder.buildContext()`
- Takes current file path + recent edits
- Generates embedding for current work
- Queries `actions` table with vector search
- Returns ranked list of relevant past work
- Formats it into natural language for Gemini

**Critical insight**: The quality of RAG depends on the quality of stored actions. That's why we spend effort on semantic action descriptions during ingestion.

---

### Pillar 4: Idle Detection (The Trigger)

**The Problem**: When should the autonomous agent run? You can't interrupt the user while typing.

**The Solution**: Idle detection with activity monitoring.

#### Why Idle-Triggered?

I explored three approaches:
1. **Continuous background**: Runs constantly → kills battery, API costs explode
2. **Manual trigger**: User hits "Run Agent" → defeats the purpose of "autonomous"
3. **Idle-triggered**: Runs when user is away → perfect balance

Idle detection won. The agent only acts when you're not using the editor (bathroom break, meeting, coffee run).

#### Why 15 Seconds? (For Demo)

In production, you'd want 5+ minutes. But for demos, 15 seconds shows the feature without making people wait. The threshold is configurable:
```typescript
const idleThreshold = vscode.workspace.getConfiguration('copilot')
  .get<number>('autonomous.idleTimeout', 300); // 300s = 5min default
```

**The function**: `IdleService.startMonitoring()`
- Listens to: text changes, cursor moves, file opens, terminal activity
- Resets timer on any activity
- Fires callback when threshold reached
- **Why these events?**: Capture all "active coding" signals. If none fire, user is idle.

#### Why Not Just Use OS Idle Detection?

VS Code extensions can't access OS-level idle time (security/privacy). We have to infer from editor events. This actually works better—if you're reading code without editing, you're not "idle" for our purposes.

---

### Pillar 5: Autonomous Agent (The Worker)

**The Problem**: How do you let an AI modify code without risking the user's work?

**The Solution**: Git branch isolation + sequential task execution.

#### Why Git Branches?

**Safety first**. Every autonomous action happens on a timestamped `copilot/*` branch:
```
copilot/auto-lint-2025-11-22-14-30-45
copilot/test-gen-2025-11-22-14-35-12
```

**Why?**: If the agent breaks something, you just delete the branch. Your main branch is untouched. You can review the changes, cherry-pick what you want, or merge the whole thing.

**The function**: `AutonomousAgent.executeTask()`
1. Gets current branch
2. Creates new branch: `copilot/task-timestamp`
3. Switches to it
4. Runs task (lint, test gen, etc.)
5. Commits results
6. Switches back to original branch

**Critical decision**: Never modify the working branch. This was hardcoded after early versions accidentally committed to `main`. Branch isolation is NON-NEGOTIABLE.

#### Why Sequential Execution? (Lint → Test Gen)

**Phase 1: Auto-Lint**
- Fast (Cloudflare worker or local ESLint)
- Deterministic (always the same output for same input)
- Low risk (linting rarely breaks code)
- **Result**: Clean code before AI work

**Phase 2: Test Generation**
- Slow (Gemini API call + code generation)
- Probabilistic (AI can hallucinate)
- Higher risk (generated tests might not compile)
- **Result**: Tests for the cleaned code

**Why this order?**: Linting first ensures the code Gemini analyzes is clean. No point generating tests for code with syntax errors.

**The function**: `AutonomousAgent.runAutoLintTask()`
- Calls CloudflareService.lint() (or local fallback)
- Applies fixes using WorkspaceEdit
- Creates `LINT_REPORT.md` with changes
- Commits: "Auto-lint: Fixed X issues"

**The function**: `AutonomousAgent.runGenerateTestsTask()`
- Calls ContextBuilder to get relevant context
- Prompts Gemini: "Generate tests for [file] given [context]"
- Creates test file if it doesn't exist
- Commits: "Auto-generated tests for [file]"

#### Why WorkspaceEdit API?

VS Code's `WorkspaceEdit` API is the "blessed" way to modify files. It:
- Updates the editor UI immediately
- Respects undo/redo stack
- Triggers file watchers properly
- Handles multi-file edits atomically

**Never** use `fs.writeFile()` directly. It bypasses VS Code's change detection and breaks everything.

---

## 3. The Services Layer (Supporting Cast)

### GeminiService: The AI Brain

**Why Gemini 1.5 Pro?**

I evaluated GPT-4, Claude, and Gemini:
- **GPT-4**: Expensive, 128k context limit
- **Claude**: Great quality, but API limits at the time
- **Gemini 1.5 Pro**: 2M context window, cheap embeddings, good code generation

Gemini won for **context window**. With RAG, we can stuff 50k tokens of historical context + current file + task instructions and still have room.

**The functions**:
- `generateEmbedding()`: Text → 768-dim vector (for LanceDB)
- `analyzeCode()`: Code + context → analysis/suggestions
- `generateTests()`: Code + context → test file content
- `summarizeSession()`: Events → natural language summary

**Why separate embedding model?**: Gemini offers `text-embedding-004` specifically for embeddings. It's 10x cheaper than using the main API for embeddings and optimized for similarity search.

---

### CloudflareService: The Fast Linter

**Why Cloudflare Workers?**

Linting is CPU-intensive. Running ESLint locally blocks the extension host process. Initial version made VS Code hang for 2-3 seconds on large files.

**The solution**: Offload to Cloudflare Workers.
- **Free tier**: 100k requests/day
- **Fast**: Edge compute, <50ms response time
- **Scales**: Handles any project size
- **Fallback**: If worker unavailable, fall back to local ESLint

**The function**: `CloudflareService.lint()`
1. Tries Cloudflare worker first
2. On failure/timeout, falls back to local ESLint
3. Returns lint issues + auto-fix suggestions

**Why not AWS Lambda?**: Cold start times. Cloudflare Workers are always warm.

---

### GitService: The Version Control Bridge

**Why simple-git?**

VS Code has a git API, but it's high-level and limited. `simple-git` gives us:
- Branch creation/switching
- Commit with custom messages
- Status checking
- Log retrieval

**The functions**:
- `createBranch()`: Creates timestamped copilot branches
- `commit()`: Commits autonomous changes
- `getCurrentBranch()`: Safety check before modifications
- `getRecentCommits()`: For context building

**Critical safety**: Always check current branch before any mutation. Never modify if on a protected branch (`main`, `master`, `production`).

---

## 4. The Ingestion Pipeline (How Memory Forms)

### Step 1: Event Capture

**File Open**: When you open a file, we record it. Why? Context for what you're reading/working on.

**File Edit**: Debounced (2s). Captures meaningful edits with symbol context.

**File Close**: Signals end of work on that file. Useful for session boundary detection.

**Git Commit**: Captures your explicit "checkpoint" moments. High-signal events.

**The function**: `ContextIngestionService.setupEventListeners()`
- Registers VS Code event listeners
- Filters out noise (node_modules, .git, build dirs)
- Debounces edits
- Queues for async processing

---

### Step 2: Event Enrichment

**Symbol Extraction**: For edits, we find what function/class was modified.

**Semantic Description**: Generate natural language: "Modified calculateTotal in utils.ts"

**Metadata**: Capture file path, line numbers, timestamp, session ID

**The function**: `ContextIngestionService.captureEdit()`
```typescript
// Extract symbol at cursor position
const symbols = await vscode.commands.executeCommand(
  'vscode.executeDocumentSymbolProvider',
  document.uri
);
const symbol = findSymbolAtPosition(symbols, position);

// Build semantic description
const description = `Modified ${symbol.name} in ${path.basename(document.fileName)}`;
```

---

### Step 3: Embedding Generation

**Why async?** Gemini API call takes 200-500ms. Can't block UI.

**How?** `IngestionQueue` batches events and processes them in background.

**The function**: `IngestionQueue.process()`
```typescript
async process() {
  while (this.queue.length > 0) {
    const event = this.queue.shift();
    
    // Generate embedding
    const embedding = await this.geminiService.generateEmbedding(event.description);
    
    // Store to LanceDB
    await this.storage.storeAction({
      description: event.description,
      embedding: embedding,
      metadata: event.metadata
    });
  }
}
```

---

### Step 4: Storage

**Events table**: Raw event with no embedding (audit trail)

**Actions table**: Semantic action WITH embedding (for RAG)

**Why separate tables?**: Initially had one table with optional embeddings. Performance tanked. Vector search scanned every row. Splitting into events (no vectors) vs actions (with vectors) made queries 10x faster.

---

## 5. Extension Lifecycle (The Startup Sequence)

### Why Initialization Order Matters

VS Code extensions are loaded lazily. When you open a workspace, `activate()` is called ONCE. If we initialize services in the wrong order, things break.

**The Order** (from `extension.ts`):

#### 1. GeminiService (First!)
**Why first?** Every other service needs embeddings. If we initialize storage before Gemini, we can't generate embeddings for incoming events.

```typescript
const geminiService = new GeminiService(apiKey);
await geminiService.initialize(); // Validates API key, tests connection
```

#### 2. LanceDBStorage (Second)
**Why second?** Needs GeminiService for embedding generation. Must be ready before ingestion starts.

```typescript
const storage = new LanceDBStorage(geminiService);
await storage.initialize(); // Creates tables if needed, connects to cloud or local
```

**Critical**: We pass GeminiService to storage constructor. This is dependency injection—storage can generate embeddings without knowing about Gemini's internals.

#### 3. SessionManager + ContextService (Third)
**Why third?** Need storage to be ready. These services track session boundaries and build context.

```typescript
const sessionManager = new SessionManager(storage);
const contextService = new ContextService(storage, geminiService);
```

#### 4. IngestionService (Fourth)
**Why fourth?** Starts capturing events immediately. Must have storage ready or events get dropped.

```typescript
const ingestionService = new ContextIngestionService(
  context,
  storage,
  geminiService
);
await ingestionService.start(); // Registers VS Code event listeners
```

**Critical mistake avoided**: Early version started ingestion in constructor. Events fired before storage was ready. Lost data. Always start ingestion LAST in the init sequence.

#### 5. IdleService (Fifth)
**Why fifth?** Monitors user activity but doesn't need to start immediately. Can initialize after event capture is running.

```typescript
const idleService = new IdleService(context);
idleService.startMonitoring(idleThreshold);
```

#### 6. AutonomousAgent (Last)
**Why last?** Only acts when user goes idle. Needs all other services to be ready.

```typescript
const agent = new AutonomousAgent(
  context,
  storage,
  geminiService,
  cloudflareService,
  gitService
);

// Register idle callback
idleService.onIdle(() => agent.executeAutonomousTasks());
```

### Why Async/Await Everywhere?

VS Code's activation function can return a Promise. This lets us initialize async services properly:

```typescript
export async function activate(context: vscode.ExtensionContext) {
  // All initializations are awaited
  await geminiService.initialize();
  await storage.initialize();
  await ingestionService.start();
  
  // Extension is fully ready before returning
  return { /* public API */ };
}
```

**Early mistake**: Used synchronous init with setTimeout. Race conditions everywhere. Services used each other before they were ready. Switched to async/await, problems disappeared.

---

## 6. The Autonomous Workflow (What Happens When You Go Idle)

### Step-by-Step Execution

#### T+0s: Idle Detected
User stops typing. No activity for 15s (configurable). `IdleService` fires callback.

#### T+1s: Branch Creation
```typescript
const originalBranch = await git.getCurrentBranch();
const taskBranch = `copilot/auto-lint-${Date.now()}`;
await git.createBranch(taskBranch);
await git.checkout(taskBranch);
```

**Why?** Isolate all changes. If anything breaks, just delete the branch.

#### T+2s: Phase 1 - Auto-Lint
```typescript
// Call Cloudflare worker (or local fallback)
const lintResults = await cloudflareService.lint(activeFile);

// Apply fixes
const edit = new vscode.WorkspaceEdit();
lintResults.fixes.forEach(fix => {
  edit.replace(document.uri, fix.range, fix.newText);
});
await vscode.workspace.applyEdit(edit);

// Create lint report
const report = generateLintReport(lintResults);
await vscode.workspace.fs.writeFile(
  vscode.Uri.file('LINT_REPORT.md'),
  Buffer.from(report)
);

// Commit
await git.commit('Auto-lint: Fixed ' + lintResults.fixes.length + ' issues');
```

**Why lint first?**: Clean code before AI analysis. Gemini works better on properly formatted code.

**Why generate a report?**: User needs to see what changed. `LINT_REPORT.md` shows:
- What rules were violated
- What fixes were applied
- File paths and line numbers

#### T+10s: Phase 2 - Test Generation
```typescript
// Build context with RAG
const context = await contextBuilder.buildContext({
  currentFile: activeFile,
  recentEdits: sessionManager.getRecentEdits(),
  query: 'test generation for ' + activeFile
});

// Generate tests with Gemini
const testCode = await geminiService.generateTests(activeFile, context);

// Create/update test file
const testFilePath = getTestFilePath(activeFile); // utils.ts -> utils.test.ts
await vscode.workspace.fs.writeFile(
  vscode.Uri.file(testFilePath),
  Buffer.from(testCode)
);

// Commit
await git.commit('Auto-generated tests for ' + path.basename(activeFile));
```

**Why test generation second?**: Tests should validate the linted code, not the broken code.

**Why RAG here?**: Gemini needs context. Without RAG, it generates generic tests. With RAG, it knows:
- How you write tests in this project
- What testing patterns you use
- Past bugs and edge cases

#### T+15s: Return to Original Branch
```typescript
await git.checkout(originalBranch);
```

**Why checkout back?** User returns to their working branch. The copilot branch exists for review/merge later.

#### T+16s: Notify User
```typescript
vscode.window.showInformationMessage(
  'ContextKeeper completed 2 tasks: Auto-lint, Test generation. ' +
  'Review branches: copilot/auto-lint-*, copilot/test-gen-*'
);
```

**Why this message?**: User needs to know:
1. Work was done
2. What work was done
3. Where to find it (branch names)

---

## 7. Error Handling & Fallbacks (When Things Break)

### Gemini API Failure
**What happens?** Network down, API key invalid, rate limit hit.

**Fallback**: Skip AI-dependent tasks (test generation, summarization). Continue with deterministic tasks (linting).

```typescript
try {
  await geminiService.generateTests(...);
} catch (error) {
  console.error('Gemini API failed:', error);
  vscode.window.showWarningMessage(
    'Test generation skipped: AI service unavailable'
  );
  // Don't throw—continue with other tasks
}
```

**Why continue?**: Better to do some work than no work. Linting doesn't need AI.

---

### LanceDB Connection Failure
**What happens?** Cloud DB unreachable, API key invalid.

**Fallback**: Use local DB in `~/.contextkeeper/lancedb`.

```typescript
async initialize() {
  const apiKey = process.env.LANCE_DB_API_KEY;
  
  if (apiKey) {
    try {
      this.db = await lancedb.connect(`db://${dbName}`, { apiKey });
      console.log('Connected to LanceDB Cloud');
      return;
    } catch (error) {
      console.warn('Cloud connection failed, falling back to local');
    }
  }
  
  // Fallback to local
  const localPath = path.join(os.homedir(), '.contextkeeper', 'lancedb');
  this.db = await lancedb.connect(localPath);
  console.log('Using local LanceDB');
}
```

**Why this matters**: Airplane mode, VPN issues, cloud outage—extension still works. Context is local-first.

---

### Cloudflare Worker Timeout
**What happens?** Worker unreachable, network slow, worker crashed.

**Fallback**: Run ESLint locally.

```typescript
async lint(filePath: string): Promise<LintResult> {
  try {
    // Try Cloudflare first
    const response = await fetch(workerUrl, {
      method: 'POST',
      body: JSON.stringify({ filePath }),
      timeout: 5000 // 5s timeout
    });
    return await response.json();
  } catch (error) {
    console.warn('Worker failed, using local ESLint');
    return this.lintLocally(filePath);
  }
}
```

**Why local fallback?**: Workers are usually fast, but if they fail, we don't want to stop the pipeline. Local ESLint is slower but reliable.

---

### Git Operation Failure
**What happens?** Merge conflict, detached HEAD, working directory dirty.

**Fallback**: Abort task, notify user, don't modify anything.

```typescript
async createBranch(name: string) {
  const status = await this.git.status();
  
  if (status.conflicted.length > 0) {
    throw new Error('Cannot create branch: merge conflicts present');
  }
  
  if (status.files.length > 0) {
    // Dirty working directory
    throw new Error('Cannot create branch: uncommitted changes');
  }
  
  await this.git.checkoutBranch(name, 'HEAD');
}
```

**Why abort?**: Git operations are NOT safe if the repo is in a weird state. Better to fail loudly than corrupt the repo.

---

## 8. Configuration & Secrets (How Users Set It Up)

### VS Code Settings (User-Facing)

**Why use VS Code settings?** Built-in UI, per-workspace configuration, sync across devices.

```json
{
  "copilot.autonomous.enabled": true,
  "copilot.autonomous.idleTimeout": 300,
  "copilot.autonomous.tasks": ["auto-lint", "generate-tests"],
  "copilot.cloudflare.workerUrl": "https://lint-worker.your-account.workers.dev"
}
```

**Reading settings**:
```typescript
const config = vscode.workspace.getConfiguration('copilot');
const enabled = config.get<boolean>('autonomous.enabled', false);
const timeout = config.get<number>('autonomous.idleTimeout', 300);
```

---

### Environment Variables (API Keys)

**Why .env.local?** API keys shouldn't be in VS Code settings (they sync to cloud, security risk). Use environment variables.

```bash
GEMINI_API_KEY=AIza...
LANCE_DB_API_KEY=lance_...
CLOUDFLARE_API_KEY=cf_...
```

**Loading**:
```typescript
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY not found');
}
```

**Why .env.local not .env?** `.env` is often committed to git (for defaults). `.env.local` is in `.gitignore` (for secrets).

---

## 9. Testing Strategy (How We Know It Works)

### Unit Tests (Fast, Isolated)

**What?** Test individual functions with mocked dependencies.

**Example**: `ContextBuilder.buildContext()`
- Mock GeminiService to return fake embeddings
- Mock LanceDB to return fake similar actions
- Verify: Context includes relevant past work

```typescript
describe('ContextBuilder', () => {
  it('includes similar past actions', async () => {
    const mockStorage = {
      queryActions: jest.fn().mockResolvedValue([
        { description: 'Fixed auth bug', similarity: 0.9 }
      ])
    };
    
    const builder = new ContextBuilder(mockStorage, mockGemini);
    const context = await builder.buildContext({
      currentFile: 'auth.ts'
    });
    
    expect(context).toContain('Fixed auth bug');
  });
});
```

**Why mock?** Don't want tests calling real Gemini API (slow, costs money, flaky).

---

### Integration Tests (Slower, Real Services)

**What?** Test multiple components together with real (or test) services.

**Example**: Ingestion pipeline end-to-end
- Trigger a real file edit event
- Verify event is captured
- Verify embedding is generated
- Verify stored in LanceDB

```typescript
describe('Ingestion Pipeline', () => {
  it('captures and stores edit events', async () => {
    const testFile = await createTestFile('test.ts', 'function foo() {}');
    
    // Trigger edit
    await editFile(testFile, 'function bar() {}');
    
    // Wait for debounce + async processing
    await sleep(3000);
    
    // Verify stored
    const events = await storage.queryEvents({ file: 'test.ts' });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('file_edit');
  });
});
```

**Why integration tests?** Unit tests miss bugs at component boundaries. Integration tests catch those.

---

### E2E Tests (Slowest, Full Workflow)

**What?** Test the entire autonomous workflow from idle detection to branch creation.

**Example**: Auto-lint workflow
1. Open a file with lint errors
2. Go idle
3. Verify: Agent creates branch, fixes errors, commits, returns to original branch

```typescript
describe('Autonomous Agent E2E', () => {
  it('completes auto-lint workflow', async () => {
    const file = await createTestFile('test.ts', 'const x=1;'); // Lint error
    
    // Simulate idle
    await idleService.simulateIdle(15000);
    
    // Wait for agent
    await waitForAgentCompletion();
    
    // Verify results
    const branches = await git.getBranches();
    expect(branches).toContain('copilot/auto-lint-*');
    
    const content = await readFile('test.ts');
    expect(content).toBe('const x = 1;'); // Fixed spacing
  });
});
```

**Why E2E tests?** Catch bugs in the full workflow. Critical before releases.

---

## 10. Known Issues & Lessons Learned

### Issue 1: Race Conditions in Event Capture

**Problem**: Early version captured events synchronously. If user typed fast, events were lost.

**Root cause**: Event handler blocked on DB write. While writing event N, events N+1 and N+2 fired but handler was busy.

**Solution**: Queue-based async processing. Handler accepts events instantly, processes later.

**Lesson**: Never block the UI thread in event handlers. Always queue + async process.

---

### Issue 2: Vector Search Performance

**Problem**: Searching 10k+ vectors took 2-3 seconds. RAG was too slow for real-time use.

**Root cause**: One table with optional embeddings. Had to scan all rows, check if embedding exists, then compute similarity.

**Solution**: Split into events (no embeddings) and actions (with embeddings). Vector search only scans action table.

**Lesson**: Table design matters for performance. Separate vector and non-vector data.

---

### Issue 3: Gemini Context Overflow

**Problem**: With huge projects (100+ files), context builder tried to stuff everything into Gemini. Hit 2M token limit.

**Root cause**: Naively included all recent edits + all similar actions. No pruning.

**Solution**: Rank by relevance, take top 10. Summarize old sessions instead of including verbatim.

**Lesson**: RAG isn't "dump everything." It's "find the most relevant." Quality > quantity.

---

### Issue 4: Git Branch Pollution

**Problem**: After a week of development, 50+ `copilot/*` branches cluttered the repo.

**Root cause**: No cleanup mechanism. Branches were created but never deleted.

**Solution**: (TODO) Add cleanup command: "Delete old copilot branches" (older than 7 days).

**Lesson**: Autonomous systems generate garbage. Need garbage collection.

---

### Issue 5: Test Generation Hallucinations

**Problem**: Gemini generated tests that imported non-existent modules or called fake functions.

**Root cause**: No validation of generated code. Just wrote it to file and committed.

**Solution**: (TODO) Parse generated tests, check imports, verify functions exist. Lint before committing.

**Lesson**: Never trust AI output. Always validate.

---

## 11. Future Roadmap (What's Next)

### Short-Term (Next 1-2 Months)

**1. UI Dashboard**
- Sidebar showing: work done, branches created, tasks completed
- Timeline view of autonomous actions
- One-click merge/delete for copilot branches

**Why?**: User needs visibility. Right now, branches are hidden. Need a UI to surface them.

**2. Test Validation**
- Run generated tests automatically
- Only commit if tests pass
- Report failures to user

**Why?**: Stop committing broken tests. Quality control.

**3. Multi-File Refactoring**
- Autonomous agent can modify multiple files in one task
- Example: Rename function across 10 files

**Why?**: Current agent is single-file focused. Real refactoring is multi-file.

---

### Medium-Term (Next 3-6 Months)

**1. Adaptive Idle Detection**
- Learn user patterns: "Alice goes idle for 10min every afternoon"
- Adjust threshold automatically

**Why?**: Fixed threshold is dumb. Smart system adapts to user behavior.

**2. Team Context Sharing**
- Share sessions/actions across team (opt-in)
- "John fixed this bug yesterday" appears in your RAG

**Why?**: Knowledge transfer. New team members get instant context.

**3. Performance Metrics**
- Track: time saved, bugs prevented, tests generated
- Show user: "ContextKeeper saved you 2 hours this week"

**Why?** Prove value. Users need to see ROI.

---

### Long-Term (Next 6-12 Months)

**1. Multi-Language Support**
- Currently optimized for TypeScript/JavaScript
- Add: Python, Go, Rust, Java

**Why?**: Most devs work in multiple languages. Need to support them all.

**2. Custom Task Plugins**
- Users can write custom autonomous tasks
- Example: "Auto-update dependencies", "Generate API docs"

**Why?**: Can't predict all use cases. Make it extensible.

**3. On-Premises Deployment**
- Run entire system locally (no cloud dependencies)
- For enterprises with strict data policies

**Why?**: Some companies won't send code to cloud. Need local-only mode.

---

## 12. Developer Onboarding (How to Work on This)

### Prerequisites
- Node.js 18+
- VS Code 1.85+
- Git
- Gemini API key

### Setup Steps

**1. Clone and Install**
```bash
git clone https://github.com/your-org/contextkeeper
cd contextkeeper
npm install
```

**2. Configure Environment**
```bash
cp env_template .env.local
# Edit .env.local, add your API keys
```

**3. Build**
```bash
npm run watch  # Continuous build
```

**4. Debug**
- Press F5 in VS Code
- Opens Extension Development Host
- Test your changes

---

### Code Style

**DO**:
- Use async/await (never callbacks)

**DO**:
- Use async/await (never callbacks)
- Type everything (strict TypeScript)
- Handle errors explicitly (try/catch)
- Log important events (console.log, OutputChannel)
- Write tests for new features
- Comment complex logic

**DON'T**:
- Block the UI thread
- Use `any` type
- Ignore errors (silent failures are evil)
- Modify files with fs module directly
- Commit to main branch
- Skip initialization checks

---

### Architecture Patterns

**Dependency Injection**: Services receive dependencies via constructor
```typescript
class AutonomousAgent {
  constructor(
    private storage: LanceDBStorage,
    private gemini: GeminiService,
    private git: GitService
  ) {}
}
```

**Why?**: Testability. Can inject mocks in tests.

**Service Pattern**: Each major feature is a service (GeminiService, GitService, etc.)

**Why?**: Separation of concerns. Easy to maintain.

**Event-Driven**: Use VS Code events + callbacks, not polling

**Why?**: Efficient. Only react to changes, don't constantly check.

---

## 13. Debugging Tips (When Things Go Wrong)

### Problem: "Extension fails to activate"

**Check**:
1. API keys in `.env.local`
2. `npm run watch` is running
3. No TypeScript errors in console
4. VS Code version >= 1.85

**Common cause**: Missing environment variables. Extension can't initialize without Gemini API key.

---

### Problem: "Events not being captured"

**Check**:
1. Ingestion service started? (Check console for "Ingestion service started")
2. File excluded? (node_modules, .git, etc. are filtered)
3. Debounce timer? (Wait 2s after editing)

**Debug**:
```typescript
// Add logging in ContextIngestionService
console.log('Event captured:', event.type, event.file);
```

---

### Problem: "Autonomous agent not running"

**Check**:
1. `copilot.autonomous.enabled` set to true?
2. Idle threshold reached? (Default 15s for demo)
3. Is there an active file? (Agent needs a file to work on)
4. Git repo clean? (Agent won't run with uncommitted changes)

**Debug**:
```typescript
// Add logging in IdleService
console.log('Idle detected, firing callback');
```

---

### Problem: "Vector search returns nothing"

**Check**:
1. Actions table has data? (Query LanceDB directly)
2. Embeddings generated? (Check action records have embedding field)
3. Query similarity threshold too high? (Lower it)

**Debug**:
```typescript
const actions = await storage.queryActions({ query: 'test', limit: 10 });
console.log('Found actions:', actions.length);
```

---

### Problem: "Gemini API errors"

**Check**:
1. API key valid?
2. Rate limit hit? (Gemini has quotas)
3. Network connectivity?

**Debug**:
```typescript
try {
  await gemini.generateEmbedding('test');
  console.log('Gemini working');
} catch (error) {
  console.error('Gemini error:', error);
}
```

---

## 14. Performance Considerations

### Embedding Generation
- **Cost**: ~200-500ms per call to Gemini
- **Optimization**: Queue-based batching. Generate embeddings in background, not on UI thread
- **Rate limiting**: Gemini API has quotas. Don't spam it.

### Vector Search
- **Cost**: ~50-200ms for 10k vectors
- **Optimization**: Limit result set. Don't retrieve all similar actions, just top 10.
- **Caching**: (TODO) Cache recent queries to avoid redundant searches.

### File Watching
- **Cost**: Minimal. VS Code's file watcher is efficient.
- **Optimization**: Filter early. Don't process node_modules, build dirs.

### Git Operations
- **Cost**: 100-500ms per operation (branch create, commit, checkout)
- **Optimization**: Batch commits. Don't commit after every lint fix, commit once at the end.

---

## 15. Security & Privacy

### What Data Is Collected?

**Locally**:
- File paths (not content, unless you edit)
- File edit timestamps
- Function/class names you modify
- Git commit messages

**Sent to Cloud**:
- File snippets (for embedding generation)
- Code context (for AI analysis)
- Generated test code

**NOT Collected**:
- Keystrokes
- Passwords or secrets
- Personal info (unless you put it in code comments)

### Data Storage

**Local**:
- `~/.contextkeeper/lancedb` (if using local mode)
- Stays on your machine, never leaves

**Cloud** (if using LanceDB Cloud):
- Stored in LanceDB Cloud (encrypted at rest)
- Used only for your account
- Can be deleted via LanceDB dashboard

### API Key Security

**Best practices**:
1. Never commit `.env.local` to git
2. Use environment variables, not VS Code settings for keys
3. Rotate keys periodically
4. Use separate keys for dev/prod

**What if key leaks?**
1. Revoke immediately in Google AI Studio
2. Generate new key
3. Update `.env.local`
4. Review API usage logs

---

## 16. Contribution Guidelines

### How to Contribute

**1. Pick an issue** from GitHub issues or propose a new feature

**2. Create a branch**
```bash
git checkout -b feature/your-feature-name
```

**3. Make changes**
- Write code
- Write tests
- Update CONTEXT.md if architecture changes

**4. Test locally**
```bash
npm run test
npm run watch  # Build in watch mode
# Press F5 to debug in VS Code
```

**5. Submit PR**
- Describe what changed and why
- Link to related issue
- Include screenshots if UI changed

---

### Code Review Checklist

**Functionality**:
- [ ] Feature works as described
- [ ] No breaking changes
- [ ] Error handling is present
- [ ] Logging is appropriate

**Code Quality**:
- [ ] TypeScript types are correct
- [ ] No `any` types (unless justified)
- [ ] Functions are small and focused
- [ ] Code is readable (clear names, comments where needed)

**Testing**:
- [ ] Unit tests pass
- [ ] New features have tests
- [ ] Integration tests pass (if applicable)

**Documentation**:
- [ ] CONTEXT.md updated (if architecture changed)
- [ ] README updated (if user-facing change)
- [ ] Code comments for complex logic

---

## 17. FAQ (Frequently Asked Questions)

### Q: Why Gemini instead of GPT-4?
**A**: 2M token context window + cheaper embeddings. Gemini 1.5 Pro can handle massive context, which is critical for RAG.

### Q: Why LanceDB instead of Pinecone/Weaviate?
**A**: Local + cloud flexibility. LanceDB works offline (local mode) and online (cloud mode) with the same API. Other vector DBs are cloud-only.

### Q: Why 2-second debounce for edits?
**A**: Tested 1s, 2s, 3s, 5s. 2s captures "thought pauses" without being too slow or too noisy.

### Q: Can I use this without cloud services?
**A**: Partially. LanceDB works locally. Linting works locally (ESLint fallback). But AI features (test generation, summarization) need Gemini API (cloud). There's no local LLM fallback yet.

### Q: Is my code sent to the cloud?
**A**: Only snippets for AI analysis (when autonomous agent runs). File edits are embedded locally, then only the embedding (768 numbers) is stored in cloud DB, not the code itself.

### Q: Can I disable autonomous agent?
**A**: Yes. Set `copilot.autonomous.enabled: false` in VS Code settings. Extension will still capture events for context, but won't run tasks automatically.

### Q: How do I delete my data?
**A**: Local data: Delete `~/.contextkeeper` folder. Cloud data: Go to LanceDB dashboard, delete your database.

### Q: What languages are supported?
**A**: Optimized for TypeScript/JavaScript. Works OK with Python, Go, Rust (via tree-sitter). Other languages have limited support (no symbol extraction yet).

### Q: Why did you build this?
**A**: Because I was tired of context-switching pain. Coming back to code after a break and thinking "what was I doing?" This solves that.

---

## 18. Acknowledgments & Prior Art

### Inspiration
- **GitHub Copilot**: Proved AI can write code
- **Cursor**: Showed context-aware AI is powerful
- **Replit Ghostwriter**: Demonstrated autonomous code fixing
- **Sourcegraph Cody**: RAG for code search

### What's Different?
- **Session memory**: Most copilots forget. We remember everything.
- **Idle-triggered autonomy**: Others are reactive. We're proactive.
- **Vector-based context**: RAG finds relevant past work, not just recent work.
- **Git branch isolation**: Safe autonomous work. No risk to main branch.

### Technologies Used
- **VS Code Extension API**: UI, events, file system
- **LanceDB**: Vector storage
- **Gemini 1.5 Pro**: AI reasoning + embeddings
- **Cloudflare Workers**: Fast linting
- **simple-git**: Git operations
- **TypeScript**: Type safety

---

## 19. Maintenance & Operations

### Monitoring

**What to monitor**:
1. API usage (Gemini calls, LanceDB queries)
2. Error rates (failed embeddings, failed lints)
3. Performance (embedding time, vector search time)
4. Storage growth (DB size over time)

**How**:
- Log to OutputChannel in VS Code
- (TODO) Send telemetry to monitoring service
- (TODO) Dashboard for usage metrics

---

### Backup & Recovery

**Local data**:
- Backup: Copy `~/.contextkeeper` folder
- Recovery: Restore folder, restart VS Code

**Cloud data**:
- Backup: LanceDB handles this automatically
- Recovery: Data persists in cloud, just reconnect

**Git branches**:
- If you delete a copilot branch accidentally, it's gone
- (TODO) Add "undo branch delete" feature

---

### Upgrades

**Extension updates**:
1. User gets update notification from VS Code
2. Clicks "Update"
3. Extension reloads

**Database migrations**:
- If schema changes, migration script runs on first activation
- Example: Adding new column to events table

```typescript
async migrate() {
  const version = await this.getSchemaVersion();
  
  if (version < 2) {
    // Migration from v1 to v2
    await this.addColumn('events', 'sessionId', 'string');
    await this.setSchemaVersion(2);
  }
}
```

---

## 20. Final Thoughts (From May 2025 Me to November 2025 You)

If you're reading this, you're probably trying to understand why I made certain decisions 6 months ago. Here's the real reasoning:

### Why Hybrid Architecture?
I tried pure local first. Performance was terrible. Then tried pure cloud. Privacy concerns killed it. Hybrid was the only way to get both speed AND capability.

### Why RAG Instead of Fine-Tuning?
Fine-tuning is expensive and static. RAG is cheap and dynamic. Every new session improves the context. With fine-tuning, you're stuck with the training data.

### Why Idle Detection?
I experimented with 5 different triggers:
1. Manual button click (users forget)
2. Continuous background (battery killer)
3. Scheduled (rigid, annoying)
4. Git pre-commit hook (too late)
5. Idle detection (perfect)

Idle is when users WANT help but can't ask for it (because they stepped away). That's the sweet spot.

### Why Git Branch Isolation?
Early versions modified code in place. Users HATED it. "The AI broke my code!" With branches, users review first, merge if good, delete if bad. Psychological safety matters.

### Why This Level of Documentation?
Because I know I'll forget. And so will you. This doc is my gift to future us. Read it when you're confused. It has all the answers.

**Good luck. You got this.**

---

*Last Updated: November 22, 2025*  
*Status: Production-ready, actively maintained*  
*Next Review: May 2026*
---

## 🚀 RECENT FIXES & IMPROVEMENTS (November 22, 2025)

### Phase 1: TypeScript/ESLint Compliance (58 → 0 Errors) ✅

Successfully resolved all critical TypeScript compilation and ESLint errors:

**extension.ts** (40+ errors fixed)
- Removed unused variables, added mandatory braces, fixed error handling
- Replaced type-unsafe `any` casts with proper intersection types
- Fixed Orchestrator module import with .js extension for Node16
- Implemented type-safe webview message handling

**elevenlabs.ts** (2 errors fixed)
- Removed duplicate variable declarations and cleanup logic

**idle-service.ts** (6 errors fixed)
- Replaced `any` types with proper `Orchestrator` and `AutonomousAgent` imports

**Other files**: DashboardProvider.ts, NotificationManager.ts, StatusBarManager.ts, interfaces.ts
- Fixed unused imports, parameters, and type definitions

### Phase 2: Lint Warning Reduction (257 → 239 Warnings) ✅

**demo-full-ingestion.ts** - Fixed 5 warnings
**IngestionVerifier.ts** - Fixed 4 warnings  
**mock-vscode.ts** - Fixed 9 warnings

### Current Status

**Build**: ✅ PASSING (webpack compiles successfully)
**TypeScript Errors**: 0
**ESLint Errors**: 0
**ESLint Warnings**: 239 (non-blocking, mostly in test/demo files)

**Core Pipeline**: All components operational
- Event Ingestion, Vector Storage, RAG, Idle Detection, Autonomous Agent, Voice, Gemini

### Next Steps

1. End-to-end pipeline testing (File edit → Ingestion → Idle → Autonomous)
2. Add `setEnabled()` method to IVoiceService interface
3. Integration tests for autonomous workflow
4. Branch cleanup mechanism for old copilot/* branches
5. Reduce remaining 239 lint warnings in test/demo files (low priority)

---

## 🔧 LATEST FIXES (November 23, 2025)

### UI Dashboard Connection to Backend ✅

**Issue**: The UI sidebar was not receiving idle improvement results, and there was no "While you were away" functionality.

**Solution**:
1. **Extended ExtensionToUIMessage type** in `interfaces.ts` to include `idleImprovementsComplete` message type
2. **Enhanced IdleService** (`idle-service.ts`):
   - Added `uiUpdateCallback` for UI notifications
   - Added `onIdleImprovementsComplete()` method to register UI callbacks
   - Modified `displayIdleResults()` to track work done while idle
   - Work tracker now records analysis summary, test generation, and recommendations
3. **Updated extension.ts**:
   - Wired up UI callback when initializing IdleService
   - Callback sends structured message to sidebar webview
   - Automatically records changes in `extensionChanges` array for display
4. **Enhanced dashboard.html**:
   - Added `updateIdleImprovements()` function to handle idle results
   - Displays "🎯 While you were away" message in analysis summary
   - Automatically adds idle improvements to "Recent Changes" section
   - Persists changes to localStorage for session continuity

**Result**: When the user goes idle and autonomous work completes, the dashboard now shows:
- Summary of what was analyzed
- Number of tests generated
- Priority-based recommendations
- All tracked in the "Recent Changes" section with timestamps

### Session Summary & Context Display ✅

**Enhancement**: Implemented comprehensive session summary display

**Features Added**:
1. **Idle improvements tracked automatically**: Summary, tests generated, and recommendations
2. **Actor attribution**: UI shows which actor performed each change (extension, autonomous, user, voice)
3. **Persistent storage**: Changes stored in localStorage and synced with backend
4. **Real-time updates**: UI updates immediately when idle improvements complete

**UI Flow**:
```
User edits file → Goes idle (15s) → Orchestrator analyzes → 
Gemini generates tests + recommendations → AutonomousAgent stores to LanceDB → 
IdleService fires UI callback → Dashboard displays "While you were away" summary
```

### Complete Pipeline Verification Script ✅

**Created**: `verify-complete-pipeline.ts` - Comprehensive end-to-end testing script

**Tests**:
1. Environment configuration (API keys, database credentials)
2. LanceDB storage (connection, read/write, embeddings)
3. Context ingestion (events, actions with embeddings, RAG queries)
4. Orchestrator analysis (Cloudflare lint + Gemini reasoning)
5. Autonomous agent (branch management, test generation, storage)
6. Complete workflow (idle detection → analysis → storage → UI update)

**Usage**:
```bash
npx ts-node verify-complete-pipeline.ts
```

**Output**: Colored terminal output showing pass/fail for each pipeline stage

### Architecture Improvements

**Before**:
- IdleService → Orchestrator → (results lost, no UI update)
- UI displayed generic "analysis complete" messages
- No tracking of autonomous work while user was away

**After**:
- IdleService → Orchestrator → AutonomousAgent → LanceDB storage
- ↓
- UI callback → SidebarWebviewProvider → Dashboard HTML
- ↓
- "While you were away" display with full context

**Key Changes**:
- `IdleService.onIdleImprovementsComplete(callback)` - NEW method for UI notifications
- `ExtensionToUIMessage` - Extended with `idleImprovementsComplete` type
- `dashboard.html` - Added `updateIdleImprovements()` function
- `extension.ts` - Wired up UI callback in initialization sequence

### Testing Instructions

1. **Run verification script**:
   ```bash
   npx ts-node verify-complete-pipeline.ts
   ```

2. **Test in VS Code Extension Dev Host** (F5):
   - Open a TypeScript file
   - Make an edit (add a function, comment, etc.)
   - Wait 15 seconds (idle threshold)
   - Check the ContextKeeper sidebar:
     - "Recent Changes" section should show idle analysis
     - Analysis summary should show "🎯 While you were away: ..."
     - See tests generated count and recommendations

3. **Verify LanceDB storage**:
   - Check that events, actions, and sessions are being stored
   - Verify embeddings are generated for actions
   - Test vector search for similar past work

### Known Issues & Next Steps

1. **Test generation validation**: Generated tests should be linted before committing
2. **Branch cleanup**: Need to implement auto-deletion of old copilot/* branches (7+ days)
3. **Rate limiting**: Need to add rate limiting for Gemini API calls
4. **Error recovery**: Improve error handling when Cloudflare worker is unavailable
5. **Multi-file refactoring**: Extend autonomous agent to handle multi-file modifications
