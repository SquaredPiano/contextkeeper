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
    expect(detector.isIdle).toBe(false);
    
    // Fast forward time
    vi.advanceTimersByTime(1001);
    
    expect(idleSpy).toHaveBeenCalled();
    expect(detector.isIdle).toBe(true);
  });

  it('should reset timer on activity and emit active if was idle', () => {
    const idleSpy = vi.fn();
    const activeSpy = vi.fn();
    detector.on('idle', idleSpy);
    detector.on('active', activeSpy);
    
    detector.start();
    
    // Go idle
    vi.advanceTimersByTime(1001);
    expect(idleSpy).toHaveBeenCalled();
    expect(detector.isIdle).toBe(true);
    
    // Simulate activity
    (detector as any).resetTimer();
    
    expect(activeSpy).toHaveBeenCalled();
    expect(detector.isIdle).toBe(false);
    
    // Wait again but not enough
    vi.advanceTimersByTime(500);
    expect(idleSpy).toHaveBeenCalledTimes(1); // Still 1
  });

  it('should update threshold dynamically', () => {
    const idleSpy = vi.fn();
    detector.on('idle', idleSpy);
    
    detector.start();
    detector.setThreshold(2000);
    
    vi.advanceTimersByTime(1500);
    expect(idleSpy).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(501);
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
