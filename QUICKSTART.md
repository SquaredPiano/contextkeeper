# ContextKeeper - Quick Start Guide

## What is ContextKeeper?

ContextKeeper is an autonomous AI coding assistant that:
- **Captures** your coding context in real-time (edits, commits, open files)
- **Understands** your work using vector embeddings and RAG (Retrieval-Augmented Generation)
- **Acts autonomously** when you go idle - running linting, generating tests, all on isolated git branches

## Quick Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Your Gemini API Key

**Option A: Environment Variable**
```bash
# Create .env.local in project root
echo "GEMINI_API_KEY=your_api_key_here" > .env.local
```

**Option B: VS Code Settings**
1. Open Command Palette: `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type: "Preferences: Open Settings (JSON)"
3. Add:
```json
{
  "copilot.gemini.apiKey": "your_gemini_api_key_here"
}
```

### 3. Build and Launch
```bash
npm run compile
```

Then press **F5** in VS Code to launch the Extension Development Host.

## First Test

### See It Capture Context
1. In the Extension Development Host, open any TypeScript file
2. Make some edits
3. Open Output panel → Select "ContextKeeper Ingestion"
4. **Expected**: See real-time logs of your edits being captured

### Verify Storage
1. Run command: `ContextKeeper: Show Stored Events (Debug)`
2. **Expected**: Output channel shows your events stored in LanceDB with timestamps

### Experience Autonomous Work
1. Open a TypeScript file
2. Add a simple function:
```typescript
export function add(a: number, b: number): number {
  return a + b;
}
```
3. **Stop typing for 15 seconds** ⏱️
4. **Expected**:
   - Notification: "You went idle! Starting autonomous work..."
   - Check `git branch` - you should see a new `copilot/*` branch
   - A `.test.ts` file should be generated with tests for your function
   - Two commits: one for linting, one for test generation

## Architecture at a Glance

```
Your Edits → Ingestion Service → LanceDB (with embeddings)
                                        ↓
                               ContextBuilder (RAG)
                                        ↓
You Go Idle → Autonomous Agent → 1. Cloudflare Lint
                                 2. Gemini Tests
                                        ↓
                               Git Branch + Commits
```

## Key Commands

| Command | Description |
|---------|-------------|
| `ContextKeeper: Show Stored Events` | View captured events in LanceDB |
| `Copilot: Refresh Context` | Manually refresh development context |
| `Copilot: Toggle Autonomous Mode` | Enable/disable autonomous work |
| `Copilot: Show Dashboard` | Open the sidebar dashboard |

## Configuration Options

```json
{
  "copilot.gemini.apiKey": "your_key",           // Required for AI features
  "copilot.cloudflare.workerUrl": "https://...", // Optional (has fallback)
  "copilot.autonomous.enabled": true,            // Enable autonomous mode
  "copilot.autonomous.idleTimeout": 15,          // Idle threshold (seconds)
  "copilot.voice.enabled": false                 // Enable TTS (needs ElevenLabs key)
}
```

## Troubleshooting

### Extension won't activate
- Check Debug Console for errors
- Verify Gemini API key is set correctly
- Try: `npm install` again

### Events not being captured
- Check Output panel: "ContextKeeper Ingestion"
- Verify you're editing `.ts` files (not `.md` or other)
- Check that workspace is a git repository

### Idle detection not working
- Make sure you're **completely idle** for 15 seconds
- No mouse moves, keyboard input, or file saves
- Check Debug Console for "User went idle!" message

### Autonomous agent fails
- Verify Gemini API key is valid
- Check you have git initialized: `git status`
- Cloudflare worker might be unavailable (will use local fallback)
- Check Debug Console for detailed error messages

## What to Expect

### First Run
- Extension activates and initializes services
- Creates `~/.contextkeeper/lancedb` directory
- Starts monitoring your activity

### During Development
- Your edits are captured with 2-second debounce
- Context is embedded using Gemini's text-embedding-004
- RAG retrieves relevant past work when needed

### When You Go Idle (15s)
- Autonomous agent creates a new `copilot/*` branch
- Runs Cloudflare linting (or local fallback)
- Generates tests using Gemini
- Commits both with descriptive messages
- Shows notification when complete

## Next Steps

1. **Read CONTEXT.md** - Understand the architecture
2. **Read PLAN2.md** - See implementation status
3. **Customize settings** - Adjust idle timeout, enable TTS
4. **Contribute** - The codebase is well-documented!

## Getting Help

- Check Debug Console (View → Debug Console)
- Check Output panel "ContextKeeper Ingestion"
- Read error messages carefully (they're informative!)
- Review CONTEXT.md for architectural details

---

**Built with**: TypeScript, VS Code Extensions API, LanceDB, Gemini AI, Cloudflare Workers

**Philosophy**: Real infrastructure, not mocks. RAG-based context. Autonomous but safe (git branches).
