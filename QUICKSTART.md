# 🚀 Quick Start Guide

## Try the Extension RIGHT NOW (2 minutes)

### Step 1: Compile
```bash
npm run compile
```

### Step 2: Launch
Press **F5** in VSCode

A new window opens → Extension is running!

### Step 3: Explore
1. **Status Bar** (bottom-left) → Click "Copilot: Ready"
2. **Activity Bar** (left) → Click robot icon  
3. **Dashboard** → Click "Analyze Now"
4. **Tree View** → Click any issue

**That's it!** You're seeing the full UI with mock data.

---

## For Backend Team: Integration in 3 Steps

### Step 1: Implement Your Service
```typescript
// src/services/real/AIService.ts
import { IAIService, AIAnalysis } from '../interfaces';

export class AIService extends EventEmitter implements IAIService {
  async analyze(code: string, context: DeveloperContext): Promise<AIAnalysis> {
    // Your Gemini API call here
    this.emit('analysisComplete', analysis);
    return analysis;
  }
  // ... implement other methods
}
```

### Step 2: Swap in extension.ts
```typescript
// Line 10: Change import
import { AIService } from "./services/real/AIService";

// Line 41: Change instantiation  
aiService = new AIService();
```

### Step 3: Test
Press **F5** → Click "Analyze Now" → Uses your real service!

---

## File Locations

### What You Need to Know:
- **Interfaces**: `src/services/interfaces.ts` ← THE CONTRACT
- **Mock Services**: `src/services/mock/*.ts` ← REFERENCE EXAMPLES
- **Templates**: `src/services/real/*.template.ts` ← STARTER CODE
- **Integration Point**: `src/extension.ts` (lines 10-13, 41-44)

### What You DON'T Touch:
- `src/ui/*` - UI is done
- `package.json` contributions - Already configured

---

## Documentation

1. **`SUMMARY.md`** ← Start here! Overview of everything
2. **`INTEGRATION.md`** ← Detailed backend integration guide
3. **`DEMO.md`** ← How to demo the extension
4. **`FRONTEND_README.md`** ← Architecture and features

---

## Common Commands

```bash
# Compile once
npm run compile

# Watch mode (auto-recompile)
npm run watch

# Run tests
npm test

# Launch extension
# (or just press F5)
```

---

## Testing Your Integration

### After implementing a service:
1. Change import in `extension.ts`
2. Change instantiation in `extension.ts`
3. Press **F5**
4. Click "Analyze Now"
5. Open DevTools: `Help > Toggle Developer Tools`
6. Check console for your logs

### If something breaks:
- Check event names match (`analysisComplete`, etc.)
- Verify return types match interfaces
- Look for TypeScript errors: `npm run compile`

---

## Demo in 30 Seconds

```
1. Press F5
2. Click robot icon (activity bar)
3. Click "Analyze Now"
4. Watch status bar animate
5. See issues appear
6. Click issue in tree
7. Code opens at exact line!
```

**Boom! 💥 That's a demo.**

---

## Questions?

- **How do I...?** → Check `INTEGRATION.md`
- **Why isn't...?** → Check mock services for examples
- **What's the...?** → Check `src/services/interfaces.ts`
- **Can I...?** → Probably yes! Architecture is flexible

---

## Success in 5 Words

**Mock now. Real later. Easy.**

🎉 **Have fun building!** 🎉
