# Idle Detector Critical Bug Fix

## The Problem

The idle detector was **completely broken** due to a fundamental architectural flaw:

### Root Cause
**File:** `src/modules/idle-detector/idle-service.ts` Line 106

```typescript
// BROKEN CODE (before fix):
private async handleIdle(): Promise<void> {
    console.log('[IdleService] User went idle!');
    this.detector.stop();  // ❌ THIS DESTROYS ALL EVENT LISTENERS!
    // ...workflow...
}
```

### Why This Broke Everything

1. **User stops activity** → 15 seconds pass
2. **`idle` event fires** → `handleIdle()` is called
3. **`this.detector.stop()` is executed**:
   - Removes ALL event listeners (`onDidChangeTextDocument`, `onDidChangeTextEditorSelection`, etc.)
   - Sets `isMonitoring = false`
   - Clears the timer
4. **User moves mouse or types** → **NO EVENT IS CAPTURED** (listeners were destroyed!)
5. **Detector stays in IDLE state forever** → never detects user return

### The Flawed Logic

The original developer thought:
> "When user goes idle, pause the detector and restart it when they come back"

**This is WRONG** because:
- You can't detect "when they come back" if you've destroyed all the event listeners!
- It's like closing your eyes and expecting to see when someone enters the room

## The Fix

### Change 1: Never Stop the Detector

**File:** `src/modules/idle-detector/idle-service.ts` Lines 103-106

```typescript
// FIXED CODE:
private async handleIdle(): Promise<void> {
    console.log('[IdleService] User went idle! Starting ONE-TIME idle improvements workflow...');
    
    // DO NOT STOP THE DETECTOR - we need it to detect when user returns!
    // The detector will automatically transition IDLE → ACTIVE when user activity is detected
    
    // Reset work tracker
    this.workDoneWhileIdle = [];
    // ...workflow continues...
}
```

### Change 2: Remove Redundant Restart

**File:** `src/modules/idle-detector/idle-service.ts` Lines 252-258

```typescript
// BEFORE (redundant):
private handleActive(): void {
    this.detector.start(); // ❌ Already running! This does nothing due to guard.
}

// AFTER (clean):
private handleActive(): void {
    console.log('[IdleService] ✅ User is BACK! (IDLE → ACTIVE transition)');
    // Detector is already monitoring - it automatically detected user return
    // No need to restart - it's already listening for the next idle period
}
```

### Enhanced Logging

Added detailed logging to diagnose issues:

**File:** `src/modules/idle-detector/idle-detector.ts`

```typescript
// Every event now logs:
🔔 onDidChangeTextDocument fired - file: dashboard.html
🔔 onDidChangeTextEditorSelection fired - editor: page.tsx
⏰ Setting new 15000ms timer (was ACTIVE)
🔄 Cleared existing timer
⏸️  State transition: ACTIVE → IDLE (threshold: 15000ms reached)
✅ State transition: IDLE → ACTIVE (user returned)
```

## How It Works Now (Correct Flow)

### State Machine Diagram

```
┌─────────────────────────────────────────────────────┐
│                  ACTIVE STATE                       │
│  • All event listeners active                       │
│  • 15s timer running                                │
│  • Any activity → reset timer                       │
└─────────────┬───────────────────────────────────────┘
              │
              │ (15s of no activity)
              ▼
┌─────────────────────────────────────────────────────┐
│                   IDLE STATE                        │
│  • Event listeners STILL ACTIVE ✓                   │
│  • No timer running (one-shot)                      │
│  • Waiting for ANY activity to return to ACTIVE     │
│  • Workflow executing in background                 │
└─────────────┬───────────────────────────────────────┘
              │
              │ (user types/clicks/moves mouse)
              ▼
┌─────────────────────────────────────────────────────┐
│            BACK TO ACTIVE STATE                     │
│  • Automatically detected by existing listeners     │
│  • New 15s timer starts                             │
│  • TTS speaks summary                               │
└─────────────────────────────────────────────────────┘
```

### Event Flow

1. **Extension activates**
   ```
   IdleService.initialize()
     └─> detector.start()
           └─> Register 4 event listeners:
                 • onDidChangeTextDocument (typing)
                 • onDidChangeTextEditorSelection (clicks)
                 • onDidChangeActiveTextEditor (mouse movement)
                 • onDidChangeWindowState (focus)
           └─> Start 15s timer
   ```

2. **User is active**
   ```
   [User types]
     └─> onDidChangeTextDocument fires
           └─> handleActivity('typing')
                 └─> resetTimer()
                       └─> Clear old timer
                       └─> Set new 15s timer
   ```

3. **User goes idle**
   ```
   [15 seconds pass with no events]
     └─> Timer expires
           └─> _isIdle = true
           └─> emit('idle')
                 └─> handleIdle()
                       └─> Run workflow (branch, analyze, test, lint)
                       └─> Listeners REMAIN ACTIVE ✓
   ```

4. **User returns**
   ```
   [User moves mouse]
     └─> onDidChangeActiveTextEditor fires (BECAUSE LISTENERS ARE STILL ACTIVE!)
           └─> handleActivity('mouseMovement')
                 └─> resetTimer()
                       └─> _isIdle = false
                       └─> emit('active')
                             └─> handleActive()
                                   └─> TTS speaks summary
                                   └─> Show notification
                       └─> Set new 15s timer for next idle
   ```

## Verification Checklist

To verify the fix is working:

### Terminal Output (Console Logs)

When extension starts:
```
[IdleDetector] 🚀 Starting activity monitors...
[IdleDetector] ✅ All event listeners registered successfully
[IdleDetector] ⏰ Setting new 15000ms timer (was ACTIVE)
```

When you type:
```
[IdleDetector] 🔔 onDidChangeTextDocument fired - file: /path/to/file.ts
[IdleDetector] [12:34:56] Activity detected: typing | Current state: ACTIVE
[IdleDetector] 🔄 Cleared existing timer
[IdleDetector] ⏰ Setting new 15000ms timer (was ACTIVE)
```

After 15s of no activity:
```
[IdleDetector] ⏸️  State transition: ACTIVE → IDLE (threshold: 15000ms reached)
[IdleDetector] 🛑 Timer expired - awaiting user activity to resume
[IdleService] User went idle! Starting ONE-TIME idle improvements workflow...
```

When you move mouse (while idle):
```
[IdleDetector] 🔔 onDidChangeActiveTextEditor fired - editor: /path/to/file.ts
[IdleDetector] [12:35:20] Activity detected: mouseMovement/editorSwitch | Current state: IDLE
[IdleDetector] 🔄 Cleared existing timer
[IdleDetector] ✅ State transition: IDLE → ACTIVE (user returned)
[IdleService] ✅ User is BACK! (IDLE → ACTIVE transition)
[IdleService] 🔊 Speaking summary via ElevenLabs...
```

### Manual Testing Steps

1. **Open VS Code with extension active**
2. **Check console for:** `[IdleDetector] ✅ All event listeners registered successfully`
3. **Type a character** → Should see: `🔔 onDidChangeTextDocument fired`
4. **Click somewhere** → Should see: `🔔 onDidChangeTextEditorSelection fired`
5. **Switch to different file** → Should see: `🔔 onDidChangeActiveTextEditor fired`
6. **Stop all activity for 15 seconds** → Should see:
   - `⏸️  State transition: ACTIVE → IDLE`
   - `[IdleService] User went idle!`
7. **Move your mouse or type** → Should see:
   - `🔔 onDidChangeActiveTextEditor fired` (or other event)
   - `✅ State transition: IDLE → ACTIVE (user returned)`
   - `[IdleService] ✅ User is BACK!`

### What Should NOT Happen

❌ **After going idle, moving mouse does nothing** → This was the bug, now fixed  
❌ **Console shows "Already monitoring - ignoring start()"** → Fixed, no longer tries to restart  
❌ **Detector stops listening after going idle** → Fixed, listeners stay active  

## Technical Details

### Why `onDidChangeActiveTextEditor` Works for Mouse Movement

VS Code doesn't have a direct "mouse movement" API, but `onDidChangeActiveTextEditor` fires when:
- User clicks on a different editor tab
- User clicks into a different split view
- User focuses a different editor (even with keyboard)

Combined with `onDidChangeTextEditorSelection`, this catches:
- Mouse clicks that change cursor position
- Mouse clicks on different lines
- Mouse selection/dragging

This is sufficient to detect user presence without being too noisy (unlike the removed `onDidChangeTextEditorVisibleRanges` which fired on every scroll).

### Performance Considerations

- Event listeners are lightweight - no performance impact from keeping them active
- Timer is a single setTimeout - minimal memory footprint
- Logging is console-only (not written to disk) - safe for production

## Files Modified

1. **src/modules/idle-detector/idle-detector.ts**
   - Added detailed logging with timestamps and state info
   - Added `getState()` diagnostic method
   - Enhanced error messages with emojis for visibility

2. **src/modules/idle-detector/idle-service.ts**
   - **CRITICAL FIX:** Removed `this.detector.stop()` call in `handleIdle()`
   - Removed redundant `this.detector.start()` call in `handleActive()`
   - Added explanatory comments

## Conclusion

The idle detector now works as a proper state machine:
- **ONE instance** of listeners, always active
- **ONE timer** that resets on activity
- **TWO states:** ACTIVE (timer running) and IDLE (awaiting activity)
- **NO stopping/restarting** of the detector

This is the correct architectural pattern for idle detection.
