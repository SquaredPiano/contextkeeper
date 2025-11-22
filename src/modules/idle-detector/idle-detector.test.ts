import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IdleDetector } from './idle-detector';
import * as vscode from 'vscode';

// Mock VS Code API
vi.mock('vscode', () => ({
  window: {
    onDidChangeWindowState: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeTextEditorSelection: vi.fn(() => ({ dispose: vi.fn() })),
  },
  workspace: {
    onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
  },
}));

describe('IdleDetector', () => {
  let detector: IdleDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new IdleDetector(1000); // 1 second threshold
  });

  afterEach(() => {
    detector.stop();
    vi.useRealTimers();
  });

  it('should emit idle event after threshold', () => {
    const idleSpy = vi.fn();
    detector.on('idle', idleSpy);
    
    detector.start();
    
    // Fast forward time
    vi.advanceTimersByTime(1001);
    
    expect(idleSpy).toHaveBeenCalled();
  });

  it('should reset timer on activity', () => {
    const idleSpy = vi.fn();
    detector.on('idle', idleSpy);
    
    detector.start();
    
    // Advance 500ms (halfway)
    vi.advanceTimersByTime(500);
    
    // Simulate activity (resetTimer is private, but triggered by event listeners)
    // We can simulate the effect by calling the private method if we cast to any, 
    // or better, verify that start() registers listeners that call reset.
    // For this unit test, let's access the private method to ensure logic works.
    (detector as any).resetTimer();
    
    // Advance another 600ms (total 1100ms from start, but only 600ms from reset)
    vi.advanceTimersByTime(600);
    
    expect(idleSpy).not.toHaveBeenCalled();
    
    // Advance remaining 401ms
    vi.advanceTimersByTime(401);
    
    expect(idleSpy).toHaveBeenCalled();
  });

  it('should stop monitoring when requested', () => {
    const idleSpy = vi.fn();
    detector.on('idle', idleSpy);
    
    detector.start();
    detector.stop();
    
    vi.advanceTimersByTime(2000);
    
    expect(idleSpy).not.toHaveBeenCalled();
  });
});
