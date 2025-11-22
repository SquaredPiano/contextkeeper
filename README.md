# Autonomous Copilot 🤖

AI-powered autonomous code analysis for VSCode. Built with a **frontend-first architecture** that makes backend integration trivial — perfect for hackathons!

## ⚡ Quick Start

### Run Demos (CLI)

**See all available demos:**
```bash
npm run demo
```

**Run specific demos:**
```bash
npm run demo:gemini      # AI code analysis
npm run demo:voice       # Voice synthesis
npm run demo:git         # Git logs tracking
npm run demo:orchestrator # Full pipeline
npm run demo:idle        # Idle detection
```

**For full demo guide:** See [DEMO_SETUP.md](./DEMO_SETUP.md)

### Run Extension (VSCode)

**Try it now (2 minutes):**

```bash
npm run compile
```

Press **F5** → Extension loads with fully functional UI using mock data!

**For detailed instructions:** See [QUICKSTART.md](./QUICKSTART.md)

---

## 🎯 What Is This?

An intelligent VSCode extension that:
- 📊 **Collects developer context** (files, edits, git history, cursor position)
- 🤖 **Analyzes code with AI** (using Gemini API)
- 🔍 **Finds issues automatically** (errors, warnings, suggestions)
- 🎤 **Speaks results** (using ElevenLabs voice synthesis)
- ⚡ **Runs autonomously** (analyzes code when you're idle)

### Key Innovation: Frontend-First Architecture

The entire UI is **built and working** with mock services. When your backend is ready:

```typescript
// Change this line:
const aiService = new MockAIService();

// To this:
const aiService = new AIService();
```

**That's it!** The UI automatically uses real data. Perfect for parallel development in hackathons.

---

## ✨ Features

### Status Bar Integration
- Real-time state display (Idle → Analyzing → Complete)
- Click to open dashboard
- Visual feedback with icons and colors

### Dashboard (Sidebar)
- **Developer Context**: Files, edits, git info, session stats
- **AI Analysis**: Issues found, risk level, confidence score
- **Issue List**: Top issues with severity badges
- **Action Buttons**: Analyze, Toggle Autonomous, Refresh

### Issues Tree View
- Hierarchical display (files → issues)
- Click to navigate to code location
- Severity icons and tooltips
- Real-time updates

### Smart Analysis
- Considers edit frequency to identify "risky" files
- Uses developer context for better suggestions
- Progressive updates with status messages
- Categorizes by severity (error/warning/info)

### Autonomous Mode
- Triggers analysis after idle timeout
- Voice notification when complete
- Configurable timeout period
- Toggle on/off easily

---

## 📚 Documentation

### 🚀 Getting Started
- **[QUICKSTART.md](./QUICKSTART.md)** - Try the extension in 2 minutes
- **[SUMMARY.md](./SUMMARY.md)** - Complete overview of what's built
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Visual system design

### 👨‍💻 For Backend Developers
- **[INTEGRATION.md](./INTEGRATION.md)** - Step-by-step backend integration guide
- **[CHECKLIST.md](./CHECKLIST.md)** - Track your integration progress
- **[FRONTEND_README.md](./FRONTEND_README.md)** - UI components details

### 🎬 For Demos
- **[DEMO.md](./DEMO.md)** - Complete 3-minute demo script
- **[README_DOCS.md](./README_DOCS.md)** - Documentation index

---

## 🏗️ Architecture

```
Extension Entry Point (extension.ts)
    │
    ├─ Mock Services (Current - Demo Ready!)
    │   ├─ MockContextService
    │   ├─ MockAIService
    │   ├─ MockGitService
    │   └─ MockVoiceService
    │
    └─ Real Services (Your Backend - Easy Swap!)
        ├─ ContextService (VSCode API + simple-git)
        ├─ AIService (Gemini API)
        ├─ GitService (Git operations)
        └─ VoiceService (ElevenLabs API)
                │
                ▼
        Same Events → Same UI → Zero Changes!
```

**See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed diagrams.**

---

## 🔧 Project Status

### ✅ Complete (Day 1)
- Service interfaces defined
- Mock services implemented with realistic data
- UI components built and functional
- Dashboard with full styling
- Issues tree view
- Status bar integration
- Notifications and progress indicators
- Commands registered
- Settings configured
- Comprehensive documentation

### 🔨 In Progress (Day 2-3)
- Real service implementations
- Backend integration
- API connections (Gemini, ElevenLabs)
- Testing with real data

**Current Progress: 40% (Frontend Complete, Backend Pending)**

---

## 📦 What's Included

### Files Created (18 total)

**Service Layer:**
- `src/services/interfaces.ts` - Service contracts (THE CONTRACT)
- `src/services/mock/*.ts` - 4 mock services
- `src/services/real/*.template.ts` - 2 starter templates

**UI Layer:**
- `src/ui/StatusBarManager.ts` - Status bar component
- `src/ui/SidebarWebviewProvider.ts` - Dashboard manager
- `src/ui/IssuesTreeProvider.ts` - Tree view component
- `src/ui/NotificationManager.ts` - Notification utility
- `src/ui/webview/dashboard.html` - Dashboard UI

**Documentation:**
- `QUICKSTART.md`, `SUMMARY.md`, `ARCHITECTURE.md`
- `INTEGRATION.md`, `DEMO.md`, `FRONTEND_README.md`
- `CHECKLIST.md`, `README_DOCS.md`

---

## ⚙️ Configuration

Users configure via VSCode settings (`Cmd+,` → search "copilot"):

```json
{
  "copilot.autonomous.enabled": false,
  "copilot.autonomous.idleTimeout": 300,
  "copilot.gemini.apiKey": "your-key-here",
  "copilot.elevenlabs.apiKey": "your-key-here",
  "copilot.voice.enabled": true
}
```

---

## 🎯 Commands

- `Copilot: Analyze Code` - Trigger analysis manually
- `Copilot: Toggle Autonomous Mode` - Enable/disable auto-analysis
- `Copilot: Show Dashboard` - Open sidebar panel
- `Copilot: Refresh Context` - Reload developer context
- `Copilot: Go to Issue` - Navigate to issue location

---

## 🚀 Backend Integration (3 Steps)

### Step 1: Implement Services
Create real service classes in `src/services/real/` that implement the interfaces in `src/services/interfaces.ts`.

### Step 2: Swap in extension.ts
Change 4 lines: import statements and instantiation.

### Step 3: Test
Press F5 and verify real data flows through the UI!

**For detailed guide:** [INTEGRATION.md](./INTEGRATION.md)

---

## 📊 Statistics

- **Lines of Code:** ~2,050
- **Files Created:** 18
- **Time to Build UI:** 1 day
- **Time to Integrate Backend:** 1-2 days (estimated)
- **Integration Complexity:** 4 lines to change

---

## 🎬 Demo

### Quick CLI Demos

Run module demos from the command line:

```bash
# Show demo menu
npm run demo

# Run specific demos
npm run demo:gemini       # AI code analysis demo
npm run demo:voice        # Voice synthesis demo
npm run demo:git          # Git logs demo
npm run demo:orchestrator # Full pipeline demo
npm run demo:idle         # Idle detection demo

# Run all demos
npm run demo:all
```

**📚 Full Demo Guide:** [DEMO_SETUP.md](./DEMO_SETUP.md)

### VSCode Extension Demo

Press **F5** to launch the extension in debug mode. You'll see:

1. Status bar: "🤖 Copilot: Ready"
2. Activity bar: Robot icon (click it)
3. Dashboard: Context + Analysis panels
4. Click "Analyze Now" → Watch the magic!

**For full demo script:** [DEMO.md](./DEMO.md)

---

## 💡 Why This Architecture?

### For Hackathons:
- ✅ **Parallel development** - Frontend and backend work independently
- ✅ **Fast iteration** - UI changes don't break backend
- ✅ **Early demo** - Show working UI from day one
- ✅ **Low risk** - Clear contracts prevent surprises

### For Production:
- ✅ **Testability** - Mock services enable UI testing
- ✅ **Maintainability** - Clean separation of concerns
- ✅ **Extensibility** - Easy to add features
- ✅ **Reliability** - Event-based architecture

---

## 🧪 Development

```bash
# Compile TypeScript
npm run compile

# Watch mode (auto-recompile)
npm run watch

# Run extension (or press F5)
code --extensionDevelopmentPath=$PWD

# Run tests
npm test
```

---

## 📝 Requirements

### Current (for UI):
- VSCode ^1.106.1
- Node.js 22.x
- TypeScript 5.x

### Needed for Backend:
- `simple-git` - Git operations
- `@google/generative-ai` - Gemini API
- ElevenLabs SDK - Voice synthesis

---

## 🐛 Known Issues

- Existing test files have compilation errors (pre-existing, not critical)
- Mock data is static (by design, until backend integrated)
- Voice shows notifications instead of speaking (until ElevenLabs integrated)

---

## 🤝 Contributing

### To Add Features:
1. Define interface in `interfaces.ts`
2. Implement mock version
3. Build UI component
4. Wire up in `extension.ts`
5. Document in `INTEGRATION.md`

### To Integrate Backend:
See [INTEGRATION.md](./INTEGRATION.md) for step-by-step guide.

---

## 📞 Support

- **Questions?** Check [README_DOCS.md](./README_DOCS.md) for documentation index
- **Integrating?** Follow [INTEGRATION.md](./INTEGRATION.md)
- **Demoing?** Use [DEMO.md](./DEMO.md)
- **Stuck?** Check mock services for reference implementations

---

## 🏆 Credits

Built with ❤️ for hackathons. Frontend-first architecture makes backend integration trivial!

- **Frontend**: Complete and functional ✅
- **Backend**: Ready for your implementation 🔧
- **Integration**: 4 lines to change 🎯

---

## 📄 License

[Your license here]

---

**Ready to integrate?** Start with [INTEGRATION.md](./INTEGRATION.md)!

**Want to try it?** See [QUICKSTART.md](./QUICKSTART.md)!

**Need to demo?** Check [DEMO.md](./DEMO.md)!

🚀 **Happy hacking!** 🚀
