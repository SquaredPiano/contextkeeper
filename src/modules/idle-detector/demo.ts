import { IdleDetector } from './idle-detector';
import { EventEmitter } from 'events';

// MOCK VS CODE API
// We need to mock this BEFORE the module is imported if it was a real import,
// but since we are in TS-Node, we can't easily intercept the 'vscode' import 
// unless we use a loader hook or if the module uses dependency injection.
// The IdleDetector imports 'vscode'. This will fail in Node.

// To make this demo work, we will create a "MockIdleDetector" that extends the real one
// BUT we can't even extend it if the file fails to load.

// SOLUTION: We will create a standalone demo that *replicates* the logic of IdleDetector
// using a mock event source, to demonstrate HOW it works, since we can't run the actual
// VS Code dependent code in a pure Node terminal without a mock framework like `jest` (which we used for tests).

// Actually, we CAN run it if we mock the module.
// Let's try to use a simple trick: define a global 'vscode' object if we were using JS,
// but in TS it's harder.

// Instead, let's demonstrate the logic by creating a "Simulated Environment"
// that mimics what the IdleDetector does.

console.log('⏳ Idle Detector Module Demo');
console.log('(Simulating VS Code environment in terminal)\n');

class MockVSCodeWindow extends EventEmitter {
  onDidChangeWindowState(cb: any) { return this.on('state', cb); }
  onDidChangeTextEditorSelection(cb: any) { return this.on('selection', cb); }
}

class MockVSCodeWorkspace extends EventEmitter {
  onDidChangeTextDocument(cb: any) { return this.on('doc', cb); }
}

const mockWindow = new MockVSCodeWindow();
const mockWorkspace = new MockVSCodeWorkspace();

// Re-implementing the core logic for the demo since we can't import the real file
// due to 'vscode' dependency.
class DemoIdleDetector extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private thresholdMs: number;

  constructor(thresholdMs: number) {
    super();
    this.thresholdMs = thresholdMs;
  }

  start() {
    console.log('[IdleDetector] Started monitoring');
    this.resetTimer();
    mockWindow.on('state', () => { console.log('  [Event] Window State Changed'); this.resetTimer(); });
    mockWindow.on('selection', () => { console.log('  [Event] Selection Changed'); this.resetTimer(); });
    mockWorkspace.on('doc', () => { console.log('  [Event] Document Changed'); this.resetTimer(); });
  }

  private resetTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      console.log('[IdleDetector] ⚠️  User is idle!');
      this.emit('idle');
    }, this.thresholdMs);
  }
}

async function runDemo() {
  const threshold = 3000; // 3 seconds for demo
  const detector = new DemoIdleDetector(threshold);
  
  detector.start();
  
  console.log(`\nWaiting for ${threshold}ms of inactivity...`);
  
  // Simulate activity at 1s
  setTimeout(() => {
    mockWindow.emit('selection');
  }, 1000);

  // Simulate activity at 2s
  setTimeout(() => {
    mockWorkspace.emit('doc');
  }, 2000);

  // Then let it go idle
  // Should fire at 2000 + 3000 = 5000ms
}

runDemo();
