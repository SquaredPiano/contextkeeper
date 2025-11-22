# System Architecture & Context

## 1. High-Level Overview
**ContextKeeper** is an autonomous coding assistant designed to operate within the VS Code environment. Unlike traditional "autocomplete" copilots, ContextKeeper functions as an active collaborator that maintains a persistent understanding of the development session.

The system is architected around a **Hybrid Compute Model**, balancing local responsiveness (VS Code Extension Host) with remote capability (Cloudflare Workers, Gemini 1.5 Pro).

### Core Data Flow
```mermaid
[VS Code Events] -> [Ingestion Service] -> [Vector Store (LanceDB)]
                                      |
                                      v
[User/Timer] -> [Orchestrator] -> [Context Builder] -> [Hybrid Analysis] -> [Action Execution]
```

---

## 2. Architectural Principles

### 2.1. The "Thin Path" & End-to-End Latency
The architecture prioritizes the speed of the "Context-to-Action" loop. We avoid heavy local processing.
*   **Ingestion**: Asynchronous and non-blocking.
*   **Analysis**: Offloaded to Cloudflare (Linting) and Gemini (Reasoning).
*   **Execution**: Local `WorkspaceEdit` operations for atomicity and undo support.

### 2.2. Safety & Verification
Autonomous agents must be trustworthy. We implement a **"Trust but Verify"** strategy:
1.  **Deterministic Guardrails**: Static analysis (Cloudflare/ESLint) runs *before* and *alongside* probabilistic AI models.
2.  **Sandboxed Execution**: Autonomous changes are applied to dedicated `copilot/*` git branches, never directly to `main`.
3.  **Human-in-the-Loop**: High-risk changes (detected by heuristic analysis) require explicit user approval via the `prompt` action type.

### 2.3. State Persistence
Context is temporal. The `SessionManager` maintains a session ID that links ephemeral IDE events (scrolls, edits) with persistent vector embeddings. This allows the system to recover context after a window reload.

---

## 3. Component Deep Dive

### 3.1. Composition Root (`extension.ts`)
*   **Role**: Handles the VS Code Extension Lifecycle and Dependency Injection.
*   **Design**: Acts as the "Switchboard". It instantiates services based on configuration (Real vs. Mock) and wires event listeners.
*   **Constraint**: Currently monolithic to simplify shared state management. Future refactoring should introduce a proper DI container if service complexity grows.

### 3.2. The Ingestion Layer (`ContextIngestionService.ts`)
*   **Role**: Filters and normalizes the "Firehose" of IDE events.
*   **Key Logic**:
    *   **Debouncing**: `onDidChangeTextDocument` events are debounced (2s) to capture "thought pauses" rather than keystrokes.
    *   **Vectorization**: Significant events are queued for embedding into LanceDB via `IngestionQueue`, ensuring the UI thread remains unblocked.
    *   **Git Awareness**: Listens to local git operations to understand external context changes.

### 3.3. The Orchestrator (`Orchestrator.ts`)
*   **Role**: The central decision engine for analysis and action.
*   **Key Logic**:
    *   **Context Selection**: Dynamically assembles the prompt context (`CollectedContext`) based on the active task. It does *not* dump the entire repo into the context window.
    *   **Batch Processing**: Aggregates file analysis requests to minimize network round-trips to the AI provider.
    *   **Smart Override**: Implements the logic to upgrade `prompt` actions to `auto-fix` if the AI's confidence and risk assessment meet strict criteria (Low Risk + High Confidence).

### 3.4. The Autonomous Agent (`AutonomousAgent.ts`)
*   **Role**: A state machine that executes multi-step tasks.
*   **Workflow**:
    1.  **Plan**: Queries Gemini for a high-level plan based on the current `DeveloperContext`.
    2.  **Isolate**: Creates a temporary git branch.
    3.  **Execute**: Runs the `Orchestrator` pipeline or specific tasks (`auto-lint`, `generate-tests`).
    4.  **Commit**: Commits changes with semantic messages.

### 3.5. External Services
*   **Cloudflare Service**: specialized for low-latency, deterministic code analysis (Linting, AST parsing).
*   **Gemini Service**: specialized for high-latency, probabilistic reasoning and code generation. Enforces JSON output schemas for reliability.

---

## 4. Technical Debt & Known Constraints

### 4.1. Context Window Management
*   **Current State**: We rely on heuristic selection (Active File + Open Tabs + Recent Git Diff).
*   **Limitation**: This may miss relevant context in "spooky action at a distance" scenarios (e.g., changing an interface affecting a distant consumer).
*   **Future Mitigation**: Implement RAG (Retrieval-Augmented Generation) using the LanceDB vector store to pull semantically relevant files.

### 4.2. Extension Host Performance
*   **Current State**: Heavy reliance on `setInterval` for the autonomous heartbeat.
*   **Limitation**: Can potentially impact battery life or performance if the interval is too aggressive.
*   **Future Mitigation**: Move the heartbeat to a dedicated worker thread or rely strictly on event-driven triggers.

### 4.3. Error Handling Strategy
*   **Current State**: "Fail Open". If the AI fails, we fall back to standard linting.
*   **Requirement**: Ensure UI feedback clearly distinguishes between "AI is thinking", "AI failed", and "No issues found".

---

## 5. Developer Guidelines
*   **Do not block the UI thread.** All I/O and heavy computation must be async or offloaded.
*   **Prefer `WorkspaceEdit`.** Never use `fs` module for code modification. VS Code's edit API ensures atomicity and undo stack integration.
*   **Keep `CONTEXT.md` updated.** This file is the source of truth for architectural intent. If you change the data flow, update the diagram.
