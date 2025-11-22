# System Architecture & Context

## 1. High-Level Overview
**ContextKeeper** is an autonomous coding assistant designed to operate within the VS Code environment. Unlike traditional "autocomplete" copilots, ContextKeeper functions as an active collaborator that maintains a persistent understanding of the development session.

The system is architected around a **Hybrid Compute Model**, balancing local responsiveness (VS Code Extension Host) with remote capability (Cloudflare Workers for linting, Gemini 1.5 Pro for AI reasoning).

### Core Data Flow
```
[VS Code Events] -> [IngestionService] -> [IngestionQueue] -> [LanceDB with Embeddings]
                                                                        |
                                                                        v
[Idle Detection] -> [AutonomousAgent] -> [ContextBuilder + RAG] -> [Gemini Analysis] -> [Action Execution]
                                       |
                                       +-> [CloudflareService (Linting)]
```

---

## 2. Architectural Principles

### 2.1. Real-Time Event Ingestion with Embeddings
- **Debounced Capture**: File edits are debounced (2s) to capture "thought pauses" rather than keystrokes
- **Async Vectorization**: Events are queued via `IngestionQueue` and processed with Gemini embeddings asynchronously
- **Non-Blocking**: UI thread remains responsive; all I/O is async

### 2.2. RAG-Based Context Retrieval
- **Vector Search**: Uses LanceDB vector similarity search to find relevant past sessions and actions
- **ContextBuilder**: Enhances current context with semantically similar historical work
- **Smart Context Assembly**: Dynamically builds prompt context based on the active task

### 2.3. Idle-Triggered Autonomy
- **Idle Detection**: Monitors user activity (15s threshold for demo, configurable)
- **Branch Isolation**: Creates temporary `copilot/*` branches for autonomous work
- **Dual-Phase Execution**:
  1. **Phase 1**: Cloudflare linting (deterministic, fast)
  2. **Phase 2**: Gemini test generation (probabilistic, creative)

### 2.4. Safety & Verification
- **Sandboxed Execution**: All autonomous changes happen on isolated git branches
- **Fallback Mechanisms**: Local linting fallback if Cloudflare worker unavailable
- **Error Handling**: Services fail gracefully with informative error messages

---

## 3. Component Deep Dive

### 3.1. Extension Activation (`extension.ts`)
- **Async Initialization**: Proper async/await for service initialization sequence
- **Service Initialization Order**:
  1. GeminiService (for embeddings and AI)
  2. LanceDBStorage (connected with GeminiService)
  3. ContextService, SessionManager
  4. IngestionService (starts capturing events)
  5. IdleService (monitors user activity)
  6. AutonomousAgent (ready to execute tasks)

### 3.2. The Ingestion Layer (`ContextIngestionService.ts`)
- **Event Filtering**: Ignores system files, node_modules, build directories
- **Dual Recording**:
  - Raw events (file_open, file_edit, file_close, git_commit)
  - Searchable actions (natural language descriptions with embeddings)
- **Symbol-Aware**: Extracts function context for edits using VS Code's symbol provider
- **Git Integration**: Watches git commits via `GitWatcher`

### 3.3. Storage Layer (`LanceDBStorage`)
- **Two Modes**:
  - **Cloud Mode**: Connects to LanceDB Cloud when `LANCE_DB_API_KEY` is present
  - **Local Mode**: Falls back to `~/.contextkeeper/lancedb` for offline development
- **Three Tables**:
  - `events`: Raw event log (timestamp, type, file, metadata)
  - `sessions`: Work session summaries with embeddings
  - `actions`: High-level actions with embeddings for RAG
- **Embedding Generation**: Uses Gemini's `text-embedding-004` model (768-dim vectors)
- **Vector Search**: LanceDB's native `vectorSearch()` for similarity queries
- **Migration Tool**: `migrate-to-cloud.ts` syncs local data to cloud

### 3.4. Context Builder (`context-builder.ts`)
- **RAG Integration**: Queries vector DB for relevant past sessions
- **Context Enhancement**: Adds historical context to current work context
- **Smart Summarization**: Uses Gemini to generate natural language summaries

### 3.5. Idle Detection (`IdleService`)
- **Activity Monitoring**: Tracks text changes, cursor moves, file opens
- **Configurable Threshold**: Default 15s for demo (production could be 5+ minutes)
- **Callback Pattern**: Registers callback to trigger autonomous agent

### 3.6. Autonomous Agent (`AutonomousAgent.ts`)
- **Task Registry**: Pluggable task system (auto-lint, auto-fix, generate-tests)
- **Git Branch Isolation**: Creates timestamped `copilot/*` branches
- **Sequential Execution**:
  1. **Phase 1**: Cloudflare linting with lint report generation and commit
  2. **Phase 2**: Gemini test generation with automatic file creation and commit
- **Error Handling**: Shows user-friendly error messages and tracks work progress
- **Work Tracking**: Maintains list of completed tasks to show user on return

### 3.7. External Services
- **CloudflareService**: Fast deterministic linting with local fallback
- **GeminiService**: AI reasoning, embeddings, test generation, code fixes
- **GitService**: Git operations via simple-git

---

## 4. Implementation Status

### ✅ Completed
- [x] Async extension activation
- [x] **LanceDB Cloud integration with local fallback**
- [x] **Data migration from local to cloud storage**
- [x] Storage initialization with embedding service
- [x] Event ingestion with embeddings
- [x] RAG-based context retrieval via ContextBuilder
- [x] Idle detection service with AI-powered summaries
- [x] Autonomous agent with branch isolation
- [x] **Enhanced auto-lint task with commit tracking**
- [x] **Improved test generation with automatic file creation**
- [x] Cloudflare linting integration with fallback
- [x] **Work summary on return from idle**
- [x] Session management

### 🚧 In Progress
- [ ] UI integration (sidebar showing work done)
- [ ] ElevenLabs TTS integration polish

### 📋 TODO
- [ ] Optimize context window management
- [ ] Add more autonomous tasks (refactoring, documentation)
- [ ] Performance monitoring and optimization
- [ ] Error recovery UI improvements
- [ ] Test suite for autonomous workflows

---

## 5. Developer Guidelines

### DO
- **Always use async/await**: Extension activation and all service initialization
- **Initialize in sequence**: Services have dependencies; respect the order
- **Use WorkspaceEdit API**: For all code modifications (ensures undo/redo works)
- **Handle errors gracefully**: Provide fallbacks and user feedback
- **Log extensively**: Use console.log for debugging; OutputChannel for user-visible logs

### DON'T
- **Block the UI thread**: All I/O and heavy computation must be async
- **Use fs module directly**: Use VS Code's workspace.fs API instead
- **Ignore error cases**: Always catch and handle exceptions
- **Hardcode configuration**: Use VS Code settings API
- **Skip initialization**: Services won't work without proper init

### Configuration Keys
```json
{
  "copilot.gemini.apiKey": "your-gemini-api-key",
  "copilot.elevenlabs.apiKey": "your-elevenlabs-api-key",
  "copilot.cloudflare.workerUrl": "https://your-worker.workers.dev",
  "copilot.autonomous.enabled": false,
  "copilot.autonomous.idleTimeout": 300
}
```

### Environment Variables (`.env.local`)
```bash
GEMINI_API_KEY=your-gemini-key
LANCE_DB_API_KEY=your-lancedb-cloud-key
LANCEDB_DB_NAME=your-database-name
ELEVEN_LABS_API_KEY=your-elevenlabs-key
CLOUDFLARE_API_KEY=your-cloudflare-key
```

---

## 6. Recent Updates (November 22, 2025)

### LanceDB Cloud Integration
- **Migrated from local-only to cloud-first architecture**
- Storage service now checks for `LANCE_DB_API_KEY` environment variable
- Connects to `db://{LANCEDB_DB_NAME}` when API key is present
- Falls back to local `~/.contextkeeper/lancedb` when offline
- Created `migrate-to-cloud.ts` script to sync existing local data to cloud
- **Successfully migrated 74 events, 15 actions, and 19 sessions to cloud**

### Enhanced Autonomous Workflow
- **Auto-Lint Task**: Now creates lint reports and commits them with detailed messages
- **Test Generation**: Improved to handle file creation and commit tracking
- **Work Tracking**: Idle service tracks all work done and presents summary on user return
- **Better Error Handling**: All tasks catch errors and report them to user
- **Sequential Execution**: Linting always runs before test generation

### Verification & Testing
- Created `verify-cloud-connection.ts` to test end-to-end cloud connectivity
- Verified all features: event logging, embeddings, vector search, data retrieval
- All tests passing ✅

---

## 6. Known Limitations & Future Work

### Current Limitations
1. **Context Window**: Still relies on heuristics; RAG helps but could be smarter
2. **Idle Threshold**: Fixed threshold; could adapt based on user patterns
3. **Single-File Focus**: Autonomous agent focuses on active file; could be multi-file aware
4. **Error Recovery**: Basic error messages; could provide more actionable guidance

### Future Enhancements
1. **Adaptive Idle Detection**: Learn user patterns over time
2. **Multi-File Autonomous Tasks**: Refactoring across multiple files
3. **User Preference Learning**: Adapt behavior based on accepted/rejected suggestions
4. **Performance Metrics**: Track and display time saved by autonomous work
5. **Team Collaboration**: Share sessions and context across team members

---

## 7. Testing Strategy

### Manual Testing Checklist
1. Edit a file -> Check LanceDB for events with embeddings
2. Go idle for 15s -> Verify autonomous agent triggers
3. Check git branches -> Verify copilot/* branch created
4. Review commits -> Verify linting and test generation commits
5. Query context -> Verify RAG returns relevant past work

### Automated Testing
- Unit tests for services (mocked dependencies)
- Integration tests for ingestion pipeline
- E2E tests for autonomous agent flow

---

*Last Updated: Current Implementation*
*Status: Core infrastructure complete, testing phase*
