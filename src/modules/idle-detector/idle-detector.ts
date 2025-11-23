import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { IIdleDetector, IdleConfig } from './types';

// Hardcoded idle threshold: 15 seconds exactly
const DEFAULT_IDLE_THRESHOLD_MS = 15000;

export class IdleDetector extends EventEmitter implements IIdleDetector {
  private timer: NodeJS.Timeout | null = null;
  private thresholdMs: number;
  private disposables: vscode.Disposable[] = [];
  private _isIdle: boolean = false;
  private isMonitoring: boolean = false;

  constructor(config: IdleConfig = { thresholdMs: DEFAULT_IDLE_THRESHOLD_MS }) {
    super();
    this.thresholdMs = config.thresholdMs;
  }

  public get isIdle(): boolean {
    return this._isIdle;
  }

  public setThreshold(ms: number): void {
    this.thresholdMs = ms;
    if (this.isMonitoring && !this._isIdle) {
      this.resetTimer();
    }
  }

  public start(): void {
    if (this.isMonitoring) { return; }
    
    this.isMonitoring = true;
    this.resetTimer();
    
    try {
      // Track ALL user activity that indicates they're present:
      // - Keyboard: typing (onDidChangeTextDocument)
      // - Mouse clicks/movements: selection changes (onDidChangeTextEditorSelection)
      // - Mouse movements: active editor changes (onDidChangeActiveTextEditor) 
      // - Window focus: window state changes (onDidChangeWindowState)
      this.disposables.push(
        vscode.window.onDidChangeWindowState(() => this.handleActivity('windowFocus')),
        vscode.window.onDidChangeTextEditorSelection(() => this.handleActivity('click/selection')),
        vscode.workspace.onDidChangeTextDocument(() => this.handleActivity('typing')),
        vscode.window.onDidChangeActiveTextEditor(() => this.handleActivity('mouseMovement/editorSwitch'))
      );
      console.log('[IdleDetector] Monitoring typing, clicks, mouse movements, and window focus');
    } catch (error) {
      console.error('[IdleDetector] Error starting monitoring:', error);
      this.stop();
    }
  }

  public stop(): void {
    this.isMonitoring = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this._isIdle = false;
    console.log('[IdleDetector] Stopped monitoring');
  }

  public reset(): void {
    this.handleActivity('manualReset');
  }

  public dispose(): void {
    this.stop();
    this.removeAllListeners();
  }

  private handleActivity(source: string): void {
    console.log(`[IdleDetector] Activity detected: ${source}`);
    this.resetTimer();
  }

  private resetTimer(): void {
    if (!this.isMonitoring) { return; }

    if (this.timer) {
      clearTimeout(this.timer);
    }
    
    if (this._isIdle) {
      this._isIdle = false;
      console.log('[IdleDetector] ✅ State transition: IDLE → ACTIVE (user returned)');
      this.emit('active');
    }

    this.timer = setTimeout(() => {
      if (!this._isIdle && this.isMonitoring) {
        this._isIdle = true;
        console.log(`[IdleDetector] ⏸️  State transition: ACTIVE → IDLE (threshold: ${this.thresholdMs}ms reached)`);
        this.emit('idle');
        // Don't set another timer - wait for user activity to resume
      }
    }, this.thresholdMs);
  }
}
