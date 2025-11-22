import * as vscode from 'vscode';
import { EventEmitter } from 'events';

export class IdleDetector extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private thresholdMs: number;
  private disposables: vscode.Disposable[] = [];

  constructor(thresholdMs: number = 60000) { // Default 1 minute
    super();
    this.thresholdMs = thresholdMs;
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
    console.log('[IdleDetector] Stopped monitoring');
  }

  private resetTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    
    // Emit activity event if needed, but mainly we care about idle
    this.emit('activity');

    this.timer = setTimeout(() => {
      console.log('[IdleDetector] User is idle');
      this.emit('idle');
    }, this.thresholdMs);
  }
}
