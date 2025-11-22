import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { IIdleDetector, IdleConfig } from './types';

export class IdleDetector extends EventEmitter implements IIdleDetector {
  private timer: NodeJS.Timeout | null = null;
  private thresholdMs: number;
  private disposables: vscode.Disposable[] = [];
  private _isIdle: boolean = false;
  private isMonitoring: boolean = false;

  constructor(config: IdleConfig = { thresholdMs: 60000 }) {
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
      this.disposables.push(
        vscode.window.onDidChangeWindowState(() => this.handleActivity('windowState')),
        vscode.window.onDidChangeTextEditorSelection(() => this.handleActivity('selection')),
        vscode.workspace.onDidChangeTextDocument(() => this.handleActivity('documentChange')),
        vscode.window.onDidChangeActiveTextEditor(() => this.handleActivity('activeEditor'))
      );
      console.log('[IdleDetector] Started monitoring');
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
    // console.debug(`[IdleDetector] Activity detected from: ${source}`);
    this.resetTimer();
  }

  private resetTimer(): void {
    if (!this.isMonitoring) { return; }

    if (this.timer) {
      clearTimeout(this.timer);
    }
    
    if (this._isIdle) {
      this._isIdle = false;
      console.log('[IdleDetector] User is active again');
      this.emit('active');
    }

    this.timer = setTimeout(() => {
      if (!this._isIdle && this.isMonitoring) {
        this._isIdle = true;
        console.log('[IdleDetector] User is idle');
        this.emit('idle');
      }
    }, this.thresholdMs);
  }
}
