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
            // Try to call the real worker - use /lint endpoint
            const lintUrl = `${this.workerUrl}/lint`;
            const response = await fetch(lintUrl, {
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

        // Language-specific linting
        if (language === 'c' || language === 'cpp') {
            // C/C++ specific checks
            // 1. Check for unsafe functions
            const unsafeFunctions = ['gets', 'strcpy', 'strcat', 'sprintf'];
            unsafeFunctions.forEach(func => {
                const regex = new RegExp(`\\b${func}\\s*\\(`, 'g');
                let match;
                while ((match = regex.exec(code)) !== null) {
                    const lineIndex = code.substring(0, match.index).split('\n').length;
                    issues.push({
                        id: `local-lint-${Date.now()}-${Math.random()}`,
                        file: 'unknown',
                        line: lineIndex,
                        column: 0,
                        severity: 'error',
                        message: `Unsafe function '${func}' detected. Use safer alternatives like ${func.replace('str', 'strn')} or ${func.replace('s', 'sn')}.`
                    });
                }
            });

            // 2. Check for missing return statements in non-void functions
            const functionRegex = /^\s*(?:static\s+)?(?:inline\s+)?(int|char|float|double|void\*?)\s+\w+\s*\([^)]*\)\s*\{/gm;
            // This is complex, so we'll skip it for now

            // 3. Check for uninitialized variables (basic check)
            // This would require more sophisticated parsing

            // 4. Check for memory leaks (malloc without free)
            const mallocRegex = /\bmalloc\s*\(/g;
            const freeRegex = /\bfree\s*\(/g;
            const mallocMatches = Array.from(code.matchAll(mallocRegex));
            const freeMatches = Array.from(code.matchAll(freeRegex));
            if (mallocMatches.length > freeMatches.length) {
                issues.push({
                    id: `local-lint-${Date.now()}-${Math.random()}`,
                    file: 'unknown',
                    line: 1,
                    column: 0,
                    severity: 'warning',
                    message: `Potential memory leak: ${mallocMatches.length} malloc() calls but only ${freeMatches.length} free() calls.`
                });
            }

            // 5. Check for printf without format string validation
            const printfRegex = /printf\s*\([^)]*\)/g;
            let match;
            while ((match = printfRegex.exec(code)) !== null) {
                const lineIndex = code.substring(0, match.index).split('\n').length;
                const matchText = match[0];
                // Check if it's a format string vulnerability
                if (matchText.includes('%') && !matchText.includes('"') && !matchText.includes("'")) {
                    issues.push({
                        id: `local-lint-${Date.now()}-${Math.random()}`,
                        file: 'unknown',
                        line: lineIndex,
                        column: 0,
                        severity: 'warning',
                        message: 'Potential format string vulnerability in printf(). Use format specifiers carefully.'
                    });
                }
            }
        } else {
            // JavaScript/TypeScript checks
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
        }

        // 2. Check for TODOs (all languages)
        const todoRegex = /\/\/ TODO:/g;
        let match;
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
