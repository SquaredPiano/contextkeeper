import * as vscode from 'vscode';
import { EventEmitter } from 'events';

export class IdleDetector extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private thresholdMs: number;
  private disposables: vscode.Disposable[] = [];
  private _isIdle: boolean = false;

  constructor(thresholdMs: number = 60000) { // Default 1 minute
    super();
    this.thresholdMs = thresholdMs;
  }

  public get isIdle(): boolean {
    return this._isIdle;
  }

  public setThreshold(ms: number): void {
    this.thresholdMs = ms;
    if (!this._isIdle) {
      this.resetTimer();
    }
  }

  public start(): void {
    this.resetTimer();
    this.disposables.push(
      vscode.window.onDidChangeWindowState(() => this.resetTimer()),
      vscode.window.onDidChangeTextEditorSelection(() => this.resetTimer()),
      vscode.workspace.onDidChangeTextDocument(() => this.resetTimer())
    );
    console.log('[IdleDetector] Started monitoring');
  }

  public stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this._isIdle = false;
    console.log('[IdleDetector] Stopped monitoring');
  }

  private resetTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    
    if (this._isIdle) {
      this._isIdle = false;
      console.log('[IdleDetector] User is active again');
      this.emit('active');
    }

    this.timer = setTimeout(() => {
      if (!this._isIdle) {
        this._isIdle = true;
        console.log('[IdleDetector] User is idle');
        this.emit('idle');
      }
    }, this.thresholdMs);
  }
}
