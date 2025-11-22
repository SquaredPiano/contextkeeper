/**
 * Mock AI Service
 * 
 * Provides fake AI analysis results for UI development.
 * INTEGRATION: Replace with real AIService that calls Gemini API.
 */

import { EventEmitter } from 'events';
import {
	IAIService,
	AIAnalysis,
	Issue,
	Suggestion,
	CodeFix,
	DeveloperContext,
} from '../interfaces';

export class MockAIService extends EventEmitter implements IAIService {
	private currentAnalysis: AIAnalysis | null = null;

	async analyze(code: string, context: DeveloperContext): Promise<AIAnalysis> {
		this.emit('analysisStarted');

		// Simulate progressive analysis with progress updates
		await this.simulateProgressiveAnalysis();

		const analysis: AIAnalysis = {
			issues: this.generateMockIssues(context),
			suggestions: this.generateMockSuggestions(),
			riskLevel: this.calculateRiskLevel(context),
			confidence: 0.87,
			timestamp: new Date(),
		};

		this.currentAnalysis = analysis;
		this.emit('analysisComplete', analysis);
		return analysis;
	}

	async generateTests(code: string): Promise<string> {
		await this.delay(1500);

		return `import { describe, it, expect } from 'vitest';
import { analyzeCode } from './analyzer';

describe('analyzeCode', () => {
  it('should identify unused variables', () => {
    const code = 'const unused = 42;';
    const result = analyzeCode(code);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('unused');
  });

  it('should detect potential null references', () => {
    const code = 'user.name.toUpperCase();';
    const result = analyzeCode(code);
    expect(result.issues).toContain('null reference');
  });

  it('should suggest performance optimizations', () => {
    const code = 'for (let i = 0; i < arr.length; i++)';
    const result = analyzeCode(code);
    expect(result.suggestions).toContain('cache length');
  });
});
`;
	}

	async fixError(code: string, error: string): Promise<CodeFix> {
		await this.delay(1000);

		return {
			fixedCode: code.replace('user.name', 'user?.name'),
			explanation: 'Added optional chaining to prevent null reference error. This ensures the code safely handles cases where user or user.name might be null/undefined.',
			diff: `- user.name.toUpperCase()
+ user?.name?.toUpperCase()`,
		};
	}

	async explainCode(code: string): Promise<string> {
		await this.delay(800);

		return `This code implements a context collection service that gathers developer activity data from the VSCode workspace. 

Key responsibilities:
1. Monitors file edits and tracks edit frequency
2. Collects git information (commits, branch, changes)
3. Tracks cursor position and active files
4. Identifies "risky" files with high edit counts

The service uses an EventEmitter pattern to notify subscribers when new context is collected, making it easy to integrate with UI components that need real-time updates.`;
	}

	getIssuesByFile(): any[] {
		if (!this.currentAnalysis) {
			return [];
		}

		// Group issues by file for tree view
		const fileMap = new Map<string, Issue[]>();
		for (const issue of this.currentAnalysis.issues) {
			if (!fileMap.has(issue.file)) {
				fileMap.set(issue.file, []);
			}
			fileMap.get(issue.file)!.push(issue);
		}

		return Array.from(fileMap.entries()).map(([file, issues]) => ({
			file,
			issueCount: issues.length,
			issues,
		}));
	}

	private generateMockIssues(context: DeveloperContext): Issue[] {
		const issues: Issue[] = [
			{
				id: 'issue-1',
				file: 'src/extension.ts',
				line: 42,
				column: 10,
				severity: 'warning',
				message: 'Unused variable "tempData" detected',
				suggestedFix: 'Remove the unused variable declaration',
				codeSnippet: '  const tempData = await fetchData();',
			},
			{
				id: 'issue-2',
				file: 'src/extension.ts',
				line: 67,
				column: 5,
				severity: 'error',
				message: 'Potential null reference: "user" may be null or undefined',
				suggestedFix: 'Add null check: if (user) { ... } or use optional chaining: user?.name',
				codeSnippet: '  return user.name.toUpperCase();',
			},
			{
				id: 'issue-3',
				file: 'src/extension.ts',
				line: 89,
				column: 1,
				severity: 'info',
				message: 'Function "handleAnalysis" is becoming too complex (cognitive complexity: 15)',
				suggestedFix: 'Consider extracting into smaller functions',
				codeSnippet: 'async function handleAnalysis() {',
			},
			{
				id: 'issue-4',
				file: 'src/services/mock/MockAIService.ts',
				line: 23,
				column: 8,
				severity: 'info',
				message: 'Consider using async/await instead of Promise.then()',
				suggestedFix: 'Refactor to: const result = await fetchData();',
				codeSnippet: '  fetchData().then(result => {',
			},
			{
				id: 'issue-5',
				file: 'src/ui/StatusBarManager.ts',
				line: 15,
				column: 3,
				severity: 'warning',
				message: 'Magic number: Consider extracting "5000" to a named constant',
				suggestedFix: 'const NOTIFICATION_DURATION_MS = 5000;',
				codeSnippet: '  setTimeout(() => reset(), 5000);',
			},
		];

		// Add extra issues for risky files
		context.session.riskyFiles.forEach((file, index) => {
			if (index > 0) { // Skip first one since we already have issues for it
				issues.push({
					id: `issue-risky-${index}`,
					file,
					line: 1,
					column: 1,
					severity: 'warning',
					message: `High edit frequency detected (${context.files.editFrequency.get(file)} edits). Review for potential bugs.`,
					suggestedFix: 'Carefully review recent changes',
				});
			}
		});

		return issues;
	}

	private generateMockSuggestions(): Suggestion[] {
		return [
			{
				type: 'refactor',
				message: 'Extract authentication logic into a separate AuthService class',
				file: 'src/extension.ts',
				line: 120,
			},
			{
				type: 'performance',
				message: 'Cache API responses to reduce redundant network calls',
				file: 'src/services/mock/MockAIService.ts',
				line: 45,
			},
			{
				type: 'security',
				message: 'API keys should be stored in environment variables, not hardcoded',
			},
			{
				type: 'style',
				message: 'Consider adding JSDoc comments to public methods for better documentation',
			},
		];
	}

	private calculateRiskLevel(context: DeveloperContext): 'low' | 'medium' | 'high' {
		const riskyFileCount = context.session.riskyFiles.length;
		const totalEdits = context.session.totalEdits;

		if (riskyFileCount >= 3 || totalEdits > 50) {
			return 'high';
		} else if (riskyFileCount >= 1 || totalEdits > 20) {
			return 'medium';
		}
		return 'low';
	}

	private async simulateProgressiveAnalysis(): Promise<void> {
		const steps = [
			{ progress: 10, message: 'Collecting context...' },
			{ progress: 30, message: 'Analyzing code patterns...' },
			{ progress: 50, message: 'Checking for common issues...' },
			{ progress: 70, message: 'Generating suggestions...' },
			{ progress: 90, message: 'Finalizing analysis...' },
		];

		for (const step of steps) {
			await this.delay(400);
			this.emit('analysisProgress', step.progress, step.message);
		}
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
