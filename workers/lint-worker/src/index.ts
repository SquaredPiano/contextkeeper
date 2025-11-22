export interface Env {
    API_KEY?: string;
}

interface LintIssue {
    line: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
}

class Linter {
    static lint(code: string, language: string): LintIssue[] {
        const issues: LintIssue[] = [];
        const lines = code.split('\n');

        // 1. Check for console.log usage
        const consoleLogRegex = /console\.log\(/g;
        let match;
        while ((match = consoleLogRegex.exec(code)) !== null) {
            const lineIndex = code.substring(0, match.index).split('\n').length;
            issues.push({
                line: lineIndex,
                message: 'Avoid using console.log in production code.',
                severity: 'warning'
            });
        }

        // 2. Check for TODOs
        const todoRegex = /\/\/ TODO:/g;
        while ((match = todoRegex.exec(code)) !== null) {
            const lineIndex = code.substring(0, match.index).split('\n').length;
            issues.push({
                line: lineIndex,
                message: 'Found a TODO comment.',
                severity: 'info'
            });
        }

        // 3. Check for 'any' type (TypeScript)
        if (language === 'typescript' || language === 'ts') {
            const anyRegex = /: any/g;
            while ((match = anyRegex.exec(code)) !== null) {
                const lineIndex = code.substring(0, match.index).split('\n').length;
                issues.push({
                    line: lineIndex,
                    message: 'Avoid using "any" type. Be explicit.',
                    severity: 'warning'
                });
            }
        }

        // 4. Check for long lines (> 120 chars)
        lines.forEach((line, index) => {
            if (line.length > 120) {
                issues.push({
                    line: index + 1,
                    message: `Line exceeds 120 characters (${line.length}).`,
                    severity: 'info'
                });
            }
        });

        // 5. Check for empty blocks
        const emptyBlockRegex = /\{\s*\}/g;
        while ((match = emptyBlockRegex.exec(code)) !== null) {
            const lineIndex = code.substring(0, match.index).split('\n').length;
            issues.push({
                line: lineIndex,
                message: 'Empty block found.',
                severity: 'warning'
            });
        }

        return issues;
    }
}

export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext
    ): Promise<Response> {
        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 });
        }

        // Security: API Key Check
        const authHeader = request.headers.get('Authorization');
        if (env.API_KEY && authHeader !== `Bearer ${env.API_KEY}`) {
            return new Response('Unauthorized', { status: 401 });
        }

        try {
            const body: any = await request.json();
            const { code, language } = body;

            if (!code) {
                return new Response('Missing code', { status: 400 });
            }

            const issues = Linter.lint(code, language || 'plaintext');

            return new Response(JSON.stringify({ warnings: issues }), {
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (e: any) {
            return new Response(`Error: ${e.message}`, { status: 500 });
        }
    },
};
