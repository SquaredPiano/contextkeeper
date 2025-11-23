# Idle Detection Service - Quick Reference

## How It Works

The idle detection service automatically analyzes your code and generates improvements when you step away from your keyboard.

### The 15-Second Rule
- **ACTIVE:** You're typing, moving cursor, or clicking → Timer resets
- **IDLE:** 15 seconds pass with no activity → Workflow starts

---

## What Happens When You Go Idle

### 1. **Git Branch Creation** 🌿
- Creates a new branch: `copilot/idle-YYYY-MM-DDTHH-MM-SS`
- All AI-generated changes are isolated on this branch
- You can review and merge later

### 2. **Context Analysis** 🔍
- Parses your current file using AST (not regex)
- Finds function/class names
- Searches vector DB for:
  - Recent edits (last 1 hour)
  - Semantically similar code (similarity ≥ 0.7)
- Generates intelligent summary

### 3. **Test Generation** ✅
- Creates test files in `src/tests/`
- Executes tests immediately
- Reports pass/fail status

### 4. **Lint Fixes** 💡
- Analyzes VS Code errors/warnings
- Generates AI-powered fixes
- Shows lightbulb (💡) icon in editor
- Click to preview diff and apply

---

## What Happens When You Return

### 1. **Voice Summary** 🔊
Hears: *"Welcome back! While you were away: {summary of work}"*

### 2. **Work Notification** 📋
Shows popup:
```
👋 Welcome back! I completed some work while you were away.
   [Show Details]
```

### 3. **Abort Pending Work** 🛑
- Any in-progress workflow stops immediately
- No wasted resources
- No race conditions

---

## Commands

### Check Status
```
Cmd+Shift+P → ContextKeeper: Check Idle Status
```
Shows:
- Running: Yes/No
- Current State: IDLE/ACTIVE
- Threshold: 15000ms (15s)
- Timer Active: Yes/No
- Currently Processing: Yes/No

### Test Flow (Diagnostic)
```
Cmd+Shift+P → ContextKeeper: Test Idle Flow
```
Runs comprehensive diagnostic test

---

## Using Lint Fixes

When lint fixes are available:

1. **Look for lightbulb (💡)** on lines with errors/warnings
2. **Click lightbulb** or press `Cmd+.` (Mac) / `Ctrl+.` (Windows/Linux)
3. **Select AI suggestion:**
   ```
   AI Suggestion: Fix undefined variable
   ```
4. **Preview diff** showing old vs. new code
5. **Apply or Cancel**
6. **Undo with Cmd+Z** if needed

---

## Configuration

Edit `.vscode/settings.json`:

```json
{
  "contextkeeper.autonomous.enabled": true,  // Enable idle workflow
  "contextkeeper.gemini.apiKey": "YOUR_KEY", // Required for AI
  "contextkeeper.cloudflare.workerUrl": "https://...", // Required for vector DB
  "contextkeeper.elevenlabs.apiKey": "YOUR_KEY" // Optional for TTS
}
```

---

## Troubleshooting

### Workflow doesn't start
1. Check status: `ContextKeeper: Check Idle Status`
2. Verify `autonomous.enabled: true` in settings
3. Check console: `Developer: Toggle Developer Tools`
4. Look for errors in Output panel

### No TTS voice
- ElevenLabs API key required
- Check `elevenlabs.apiKey` in settings
- Workflow still runs without TTS

### Tests don't run
- Check test runner is installed (`npm install`)
- Verify workspace has `package.json`
- Check console for test runner errors

### Lint fixes not showing
- Ensure file has actual errors/warnings
- Check lightbulb appears on error lines
- Try `Cmd+.` to manually trigger quick fix

---

## Best Practices

### 1. Review Before Merging
```bash
# View changes on idle branch
git diff main copilot/idle-2025-11-23T10-30-00

# Merge if satisfied
git checkout main
git merge copilot/idle-2025-11-23T10-30-00
```

### 2. Cleanup Old Branches
```bash
# List idle branches
git branch | grep copilot/idle

# Delete old branches
git branch -D copilot/idle-2025-11-20*
```

### 3. Optimize for Context
- Keep related code in same file (better AST parsing)
- Use descriptive function/class names (better vector search)
- Work on one feature at a time (clearer context)

---

## Advanced Usage

### Custom Test Patterns
Tests are generated based on file patterns:
- `src/foo.ts` → `src/tests/foo.test.ts`
- `lib/bar.js` → `lib/tests/bar.test.js`

### Vector DB Queries
Context retrieval uses:
- **Semantic similarity:** Embeddings-based search
- **Time window:** Last 1 hour only
- **Relevance threshold:** ≥ 0.7 similarity score

### Abort Mechanism
Uses `AbortController` API:
- Checks at each workflow step
- Throws `AbortError` if canceled
- Graceful cleanup (no error dialogs)

---

## FAQ

**Q: Can I change the 15-second threshold?**  
A: Currently hardcoded at 15s. Could be made configurable in future update.

**Q: Will this interfere with my work?**  
A: No! All changes are on a separate branch. Your main branch is untouched.

**Q: What if I don't want AI suggestions?**  
A: Set `autonomous.enabled: false` in settings.

**Q: Does it work offline?**  
A: No. Requires API access to Gemini (AI) and Cloudflare (vector DB).

**Q: Can I disable TTS?**  
A: Yes. Simply don't set `elevenlabs.apiKey`. Workflow continues without voice.

---

## Support

For issues or questions:
1. Check logs: `Developer: Toggle Developer Tools` → Console tab
2. Check Output panel: `View → Output` → "ContextKeeper"
3. File issue: https://github.com/SquaredPiano/contextkeeper/issues
