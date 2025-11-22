# CONTEXT.md

## Preface
Okay, future me. You're reading this six months from now, probably wondering why the hell I built things this way. It wasn't just caffeine and panic (though there was plenty of both). Here's the *real* reasoning behind the architecture of the Autonomous Copilot.

---

## 1. The Core Philosophy: "Thin Path" First
I didn't want to build a perfect system that does nothing. I wanted a messy system that does *everything*—end-to-end. That's why you'll see some "ugly" code in `extension.ts` or hardcoded fallbacks. The goal was to prove the loop: **Context -> AI -> Action -> Context**. If that loop works, we can refine the components later. If it doesn't, no amount of clean code matters.

## 2. `extension.ts`: The messy switchboard
**Why it's a mess:** This file is the integration point. It's where VS Code's event loop meets our services.
- **`activate()`**: It's massive because dependency injection in VS Code extensions is a pain. I manually wire everything here (`SessionManager`, `ContextService`, `AutonomousAgent`) so I can swap mocks for real services easily.
- **`setupServiceListeners()`**: Instead of services calling UI directly (coupling), they emit events. The extension listens and updates the UI. This keeps the logic decoupled from the view.
- **The Scheduler**: I used a simple `setInterval` for the autonomous loop. Why? because `cron` libraries are heavy and I just needed a "heartbeat" to wake the agent up.

## 3. `SessionManager.ts`: The Anchor
**Reasoning:** Initially, I hardcoded the session ID. Bad idea. The AI needs to know *when* a session starts and stops to group context meaningfully.
- **`initialize()`**: It checks if a session exists or creates a new one. It persists this to LanceDB so if you reload the window, the AI remembers "Oh, we were working on the Auth feature".
- **`getSessionId()`**: The single source of truth. If this returns null, nothing else should work.

## 4. `ContextIngestionService.ts`: The Firehose
**Reasoning:** Developers generate a ton of noise. We need to filter it.
- **`handleFileEdit`**: I don't save every keystroke. I debounce it. Why? Because sending 1000 "I typed 'a'" events to the DB is expensive and useless. I only care when you pause or save.
- **`collectContext`**: This aggregates Git, File, and Cursor context into a single `DeveloperContext` object. This object is the "prompt" for the AI. If it's not in here, the AI doesn't know about it.

## 5. `AutonomousAgent.ts`: The "Intern"
**Reasoning:** This is the cool part. It's an agent that runs *alongside* you.
- **`startSession`**: It creates a new "job".
- **`proposeAction`**: This is the brain. It looks at the context and asks Gemini "What should I do?". It decides between `auto-lint` (boring maintenance) or `fix-issues` (active help).
- **`runAutoFix`**: This is the "hand". It takes the AI's suggestion and applies it to the editor. I used `WorkspaceEdit` because it's undoable by the user. Never touch the file system directly if you can avoid it.

## 6. `GeminiService.ts`: The Brain
**Reasoning:** I wrapped the Google Generative AI API.
- **`fixError`**: It constructs a very specific prompt: "Return ONLY the fixed code". LLMs love to chat. I don't want chat. I want code.
- **`analyze`**: It asks for a JSON response. Parsing text is fragile. JSON is robust (mostly).

## 7. `LanceDBStorage.ts`: The Memory
**Reasoning:** Vector DBs are overkill for simple logs, but essential for *retrieval*.
- **`createSession`**: It stores metadata.
- **`addEmbedding`**: This is for the future. When we want to ask "How did I fix this bug last time?", we'll search these vectors.

## 8. `CloudflareService.ts`: The Offloader
**Reasoning:** Running heavy linting or analysis in the VS Code process slows down the editor.
- **`lintCode`**: I send the code to a Cloudflare Worker. It processes it and returns issues. This keeps the extension lightweight. If the network fails, it falls back to a local mock (because offline support matters).

---

## Final Note
If you're refactoring this, keep the **Event-Driven** nature. Don't let services talk to each other directly if you can avoid it. Let them emit events and let `extension.ts` or a Mediator handle the flow. And please, for the love of code, keep the `CONTEXT.md` updated.

Good luck,
Past You (Vishnu)
