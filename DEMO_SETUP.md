# 🎬 Demo Setup Guide

This guide will help you quickly set up and run demos for ContextKeeper / Autonomous Copilot.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install all required dependencies including `tsx` for running TypeScript demos.

### 2. Set Up Environment (Optional)

Create a `.env` file in the root directory:

```bash
cp env_template .env
```

Edit `.env` and add your API keys:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
ELEVEN_LABS_API_KEY=your_elevenlabs_key_here
CLOUDFLARE_WORKER_URL=your_worker_url_here
LANCEDB_API_KEY=your_lancedb_key_here
```

**Note:** Demos will work without API keys using mock mode, but real functionality requires keys.

### 3. Run Demos

#### Show Demo Menu
```bash
npm run demo
```

This shows all available demos and quick commands.

#### Run Specific Demo

```bash
# Gemini AI Module Demo
npm run demo:gemini

# ElevenLabs Voice Demo
npm run demo:voice

# Git Logs Demo
npm run demo:git

# Full Ingestion & GenAI Demo
npm run demo:ingestion

# Orchestrator Pipeline Demo
npm run demo:orchestrator

# Idle Detector Demo
npm run demo:idle
```

#### Run All Module Demos
```bash
npm run demo:all
```

---

## 🎯 Demo: VSCode Extension

### Quick Demo (2 minutes)

1. **Compile the extension:**
   ```bash
   npm run compile
   ```

2. **Launch in VSCode:**
   - Press **F5** in VSCode (or Run → Start Debugging)
   - This opens a new "Extension Development Host" window

3. **Explore the Extension:**
   - Click the **robot icon** 🤖 in the activity bar (left side)
   - Open the **Dashboard** panel
   - Click **"Analyze Now"** to see code analysis
   - Check the **"Issues Found"** tree view
   - Try the commands from the Command Palette (`Cmd+Shift+P`)

### Available Commands

Access via Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

- `Copilot: Analyze Code` - Manually trigger analysis
- `Copilot: Toggle Autonomous Mode` - Enable/disable auto-analysis
- `Copilot: Show Dashboard` - Open the dashboard
- `Copilot: Refresh Context` - Reload developer context
- `Copilot: Go to Issue` - Navigate to an issue location

---

## 📋 Module Demos

### 1. Gemini AI Module (`npm run demo:gemini`)

**What it does:**
- Analyzes buggy code
- Generates test cases
- Fixes common errors

**Requirements:**
- `GEMINI_API_KEY` in `.env` (optional - uses mock mode if missing)

**Example Output:**
```
🧠 Gemini AI Module Demo

1. Analyzing buggy code...
Issues: 3
Risk: medium
Suggestions: ["Add null checks", "Handle async operations"]

2. Generating tests...
✓ Generated test suite

3. Fixing error...
Fixed Code: const user = data?.user; user?.email?.toLowerCase();
```

### 2. ElevenLabs Voice Module (`npm run demo:voice`)

**What it does:**
- Tests voice synthesis
- Plays different voice styles (casual, professional, encouraging)

**Requirements:**
- `ELEVEN_LABS_API_KEY` in `.env` (optional - uses notifications if missing)

**Example Output:**
```
🎤 ElevenLabs Module Demo

Testing voices...
[Plays audio] "I've fixed 5 linting errors while you were away"
[Plays audio] "Critical error detected on line 42"
[Plays audio] "Great job! All tests passing"
```

### 3. Git Logs Module (`npm run demo:git`)

**What it does:**
- Reads git commit history
- Displays recent commits with metadata

**Requirements:**
- Git repository (should be run from within a git repo)

**Example Output:**
```
📜 GitLogs Module Demo

Reading git logs from: /path/to/repo

Found 15 commits:

[abc1234] 2024-01-15 - fix: update user model (John Doe)
[def5678] 2024-01-14 - feat: add authentication (Jane Smith)
```

### 4. Orchestrator Pipeline (`npm run demo:orchestrator`)

**What it does:**
- Runs the full analysis pipeline
- Collects context → Analyzes files → Returns results
- Shows integration of multiple services

**Requirements:**
- `CLOUDFLARE_WORKER_URL` in `.env` (optional)
- `GEMINI_API_KEY` in `.env` (optional - uses mock mode)

**Example Output:**
```
🎼 Orchestrator Demo

[INFO] Orchestrator initialized
[INFO] Collecting context...
[INFO] Running Analysis Pipeline...

[SUCCESS] Pipeline Complete!
  Analyzed: 5 file(s)
  Issues Found: 12
  Overall Risk: medium

[FILE] src/utils/helper.ts
  Cloudflare warnings: 2
  Gemini risk level: low
  Fix Action: auto-lint (Minor style issues)
```

### 5. Idle Detector Module (`npm run demo:idle`)

**What it does:**
- Tests idle detection logic
- Simulates user activity and idle periods

**Requirements:**
- None (works standalone)

---

## 🔧 Troubleshooting

### Demo Won't Run

**Error: "tsx: command not found"**
```bash
npm install --save-dev tsx
```

**Error: "Cannot find module 'vscode'"**
- Some demos require VSCode environment
- Use `npm run demo:extension` to run the full extension demo instead

**Error: "No .env file found"**
- This is fine! Demos will use mock mode
- Create `.env` with API keys for real functionality

### Extension Won't Launch

**Error: "Extension host terminated unexpectedly"**
1. Check that compilation succeeded: `npm run compile`
2. Check VSCode console for errors (Help → Toggle Developer Tools)
3. Verify all dependencies are installed: `npm install`

**Extension loads but doesn't show UI:**
1. Click the robot icon in the activity bar
2. Use Command Palette: `Copilot: Show Dashboard`
3. Check the Output panel for errors

---

## 📊 What Each Demo Shows

| Demo | Purpose | Key Features |
|------|---------|--------------|
| **Extension** | Full VSCode integration | UI, dashboard, real-time analysis |
| **Gemini** | AI code analysis | Bug detection, test generation, error fixing |
| **ElevenLabs** | Voice notifications | Text-to-speech with multiple styles |
| **Git Logs** | History tracking | Commit reading, metadata extraction |
| **Orchestrator** | Full pipeline | End-to-end analysis workflow |
| **Idle Detector** | Activity monitoring | Idle detection, session management |

---

## 🎯 Recommended Demo Flow

### For Quick Demo (5 minutes):
1. `npm run demo` - Show menu
2. `npm run demo:gemini` - Show AI capabilities
3. `npm run demo:extension` - Show instructions
4. Open VSCode and press F5 - Show full UI

### For Full Demo (15 minutes):
1. Run all module demos: `npm run demo:all`
2. Launch extension in VSCode
3. Walk through all features:
   - Context collection
   - Code analysis
   - Issue detection
   - Autonomous mode
   - Voice notifications

---

## 💡 Tips

- **Mock Mode**: All demos work without API keys using mock data
- **Real Mode**: Add API keys to `.env` for real functionality
- **Extension Demo**: Best way to show the full user experience
- **Module Demos**: Great for showing individual capabilities

---

## 🚀 Next Steps

After running demos:

1. **Explore the Code:**
   - Check `src/modules/` for module implementations
   - See `src/services/` for service layer
   - Review `src/ui/` for UI components

2. **Read Documentation:**
   - `README.md` - Project overview
   - `CONTEXT.md` - Architecture reasoning
   - `PLAN.md` - Storage implementation guide

3. **Start Development:**
   - Modify demos to test your changes
   - Add new modules following existing patterns
   - Integrate real services

---

**Happy Demo-ing! 🎉**

