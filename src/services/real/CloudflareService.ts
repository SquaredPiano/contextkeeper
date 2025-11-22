import fetch from 'node-fetch';
import * as vscode from 'vscode';
import { AIAnalysis, Issue } from '../interfaces';

export class CloudflareService {
    private workerUrl: string;

    constructor(workerUrl?: string) {
        // Try to get from settings, otherwise use default or provided
        const config = vscode.workspace.getConfiguration('copilot');
        this.workerUrl = workerUrl || 
                        config.get<string>('cloudflare.workerUrl') || 
                        'https://contextkeeper-lint-worker.vishnu.workers.dev';
        
        console.log(`[CloudflareService] Using worker URL: ${this.workerUrl}`);
    }

    async lintCode(code: string, language: string): Promise<Issue[]> {
        console.log(`[CloudflareService] Linting ${language} code via ${this.workerUrl}...`);

        try {
            // Try to call the real worker
            const response = await fetch(this.workerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language }),
                // Add timeout
                signal: AbortSignal.timeout(10000) // 10 second timeout
            });

            if (!response.ok) {
                throw new Error(`Worker returned ${response.status}: ${response.statusText}`);
            }

            const data: any = await response.json();
            const rawIssues = data.issues || data || [];
            
            return rawIssues.map((i: any) => ({
                id: `lint-${Date.now()}-${Math.random()}`,
                file: 'unknown', // Caller should set this
                line: i.line || 1,
                column: i.column || 0,
                severity: i.severity || 'warning',
                message: i.message || 'Linting issue detected'
            }));
        } catch (error) {
            console.warn('[CloudflareService] Linting failed, falling back to local regex linting:', error);
            return this.localLint(code, language);
        }
    }

    private localLint(code: string, language: string): Issue[] {
        const issues: Issue[] = [];
        const lines = code.split('\n');

        // 1. Check for console.log
        const consoleLogRegex = /console\.log\(/g;
        let match;
        while ((match = consoleLogRegex.exec(code)) !== null) {
            const lineIndex = code.substring(0, match.index).split('\n').length;
            issues.push({
                id: `local-lint-${Date.now()}-${Math.random()}`,
                file: 'unknown',
                line: lineIndex,
                column: 0,
                severity: 'warning',
                message: 'Avoid using console.log in production code (Local Check).'
            });
        }

        // 2. Check for TODOs
        const todoRegex = /\/\/ TODO:/g;
        while ((match = todoRegex.exec(code)) !== null) {
            const lineIndex = code.substring(0, match.index).split('\n').length;
            issues.push({
                id: `local-lint-${Date.now()}-${Math.random()}`,
                file: 'unknown',
                line: lineIndex,
                column: 0,
                severity: 'info',
                message: 'Found a TODO comment (Local Check).'
            });
        }

        return issues;
    }
}
