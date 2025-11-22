# 🎬 Demo System - Quick Reference

## What Was Set Up

✅ **Unified demo runner** (`demo.ts`) - Shows menu and runs demos  
✅ **npm scripts** - Easy commands to run any demo  
✅ **Demo documentation** - Complete guides for all demos  
✅ **tsx installed** - For running TypeScript files directly  

---

## Quick Start

### Show Demo Menu
```bash
npm run demo
```

### Run Specific Demo
```bash
npm run demo:gemini      # AI code analysis
npm run demo:voice       # Voice synthesis  
npm run demo:git         # Git logs
npm run demo:orchestrator # Full pipeline
npm run demo:idle        # Idle detection
npm run demo:extension   # VSCode extension instructions
```

### Run All Demos
```bash
npm run demo:all
```

---

## Demo Locations

| Demo | Script Command | File Location |
|------|----------------|---------------|
| Gemini | `npm run demo:gemini` | `src/modules/gemini/demo.ts` |
| ElevenLabs | `npm run demo:voice` | `src/modules/elevenlabs/demo.ts` |
| Git Logs | `npm run demo:git` | `src/modules/gitlogs/demo.ts` |
| Orchestrator | `npm run demo:orchestrator` | `src/modules/orchestrator/demo.ts` |
| Idle Detector | `npm run demo:idle` | `src/modules/idle-detector/demo.ts` |
| Extension | `npm run demo:extension` | VSCode F5 (after compile) |

---

## Files Created

1. **`demo.ts`** - Main demo runner script
2. **`DEMO_SETUP.md`** - Complete demo setup guide
3. **`QUICK_DEMO.md`** - Quick reference guide
4. **`DEMO_README.md`** - This file

---

## Next Steps

1. **Try a demo:**
   ```bash
   npm run demo
   ```

2. **Run a specific demo:**
   ```bash
   npm run demo:gemini
   ```

3. **For VSCode extension:**
   ```bash
   npm run compile
   # Then press F5 in VSCode
   ```

---

## Documentation

- **Quick Demo:** [QUICK_DEMO.md](./QUICK_DEMO.md)
- **Full Setup:** [DEMO_SETUP.md](./DEMO_SETUP.md)
- **Main README:** [README.md](./README.md)

---

**You're all set! Run `npm run demo` to get started! 🚀**

