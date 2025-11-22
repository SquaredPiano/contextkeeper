import * as vscode from 'vscode';

export interface IdleConfig {
    thresholdMs: number;
    debounceMs?: number;
}

export interface IIdleDetector {
    start(): void;
    stop(): void;
    reset(): void;
    dispose(): void;
    on(event: 'idle', listener: () => void): this;
    on(event: 'active', listener: () => void): this;
}

export interface IIdleService {
    initialize(): Promise<void>;
    dispose(): void;
}
