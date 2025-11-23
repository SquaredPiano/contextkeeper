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
    // Don't auto-start timer when threshold changes
    // Timer only starts on first user activity
  }

  public start(): void {
    if (this.isMonitoring) { 
      return; 
    }
    
    this.isMonitoring = true;
    
    try {
      this.disposables.push(
        vscode.workspace.onDidChangeTextDocument((e) => {
          if (e.document.uri.scheme === 'file' || e.document.uri.scheme === 'untitled') {
            this.handleActivity('typing');
          }
        }),
        
        vscode.window.onDidChangeTextEditorSelection((e) => {
          this.handleActivity('selection');
        }),
        
        vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
          this.handleActivity('scroll');
        }),
        
        vscode.window.onDidChangeActiveTextEditor((e) => {
          if (e) {
            this.handleActivity('tabSwitch');
          }
        }),
        
        vscode.window.onDidChangeWindowState((e) => {
          if (e.focused) {
            this.handleActivity('windowFocus');
          }
        }),
        
        vscode.window.onDidChangeActiveTerminal(() => {
          this.handleActivity('terminal');
        }),
        
        vscode.window.onDidChangeVisibleTextEditors(() => {
          this.handleActivity('editorLayout');
        })
      );
      
      // Start the idle timer now that listeners are registered
      this.resetTimer();
      console.log('[IdleDetector] ✅ Started monitoring with timer');
    } catch (error) {
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
  }

  public reset(): void {
    this.handleActivity('manualReset');
  }

  public getState(): { isIdle: boolean; isMonitoring: boolean; thresholdMs: number; hasTimer: boolean } {
    return {
      isIdle: this._isIdle,
      isMonitoring: this.isMonitoring,
      thresholdMs: this.thresholdMs,
      hasTimer: this.timer !== null
    };
  }

  public dispose(): void {
    this.stop();
    this.removeAllListeners();
  }

  private handleActivity(source: string): void {
    if (!this.isMonitoring) {
      return;
    }
    this.resetTimer();
  }

  private resetTimer(): void {
    if (!this.isMonitoring) { 
      return; 
    }

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    if (this._isIdle) {
      this._isIdle = false;
      console.log('[IdleDetector] 🟢 User became ACTIVE');
      this.emit('active');
    }

    this.timer = setTimeout(() => {
      if (this.isMonitoring && !this._isIdle) {
        this._isIdle = true;
        console.log('[IdleDetector] 🌙 User became IDLE - emitting idle event');
        this.emit('idle');
      }
    }, this.thresholdMs);
  }
}
