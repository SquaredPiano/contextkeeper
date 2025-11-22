/**
 * Mock Git Service
 * 
 * Simulates git operations for UI development.
 * INTEGRATION: Replace with real GitService that uses simple-git.
 */

import { IGitService, GitCommit } from '../interfaces';

export class MockGitService implements IGitService {
	private currentBranch = 'feature/autonomous-copilot';
	private commits: GitCommit[] = [];

	async createBranch(name: string): Promise<void> {
		console.log(`[Mock Git] Creating branch: ${name}`);
		await this.delay(300);
		this.currentBranch = name;
	}

	async commit(message: string, files?: string[]): Promise<void> {
		console.log(`[Mock Git] Committing: ${message}`);
		console.log(`[Mock Git] Files: ${files?.join(', ') || 'all changes'}`);
		
		await this.delay(500);
		
		const commit: GitCommit = {
			hash: this.generateHash(),
			message,
			author: 'You',
			date: new Date(),
		};
		
		this.commits.unshift(commit);
	}

	async applyDiff(diff: string): Promise<void> {
		console.log(`[Mock Git] Applying diff:\n${diff}`);
		await this.delay(400);
	}

	async getCurrentBranch(): Promise<string> {
		await this.delay(100);
		return this.currentBranch;
	}

	async getRecentCommits(count: number): Promise<GitCommit[]> {
		await this.delay(200);
		
		// Return mock commits if none exist
		if (this.commits.length === 0) {
			return this.generateMockCommits(count);
		}
		
		return this.commits.slice(0, count);
	}

	private generateMockCommits(count: number): GitCommit[] {
		const messages = [
			'feat: Add autonomous analysis mode',
			'fix: Handle edge case in context collection',
			'refactor: Simplify issue detection logic',
			'docs: Update README with usage examples',
			'test: Add unit tests for AIService',
			'style: Format code with prettier',
			'chore: Update dependencies',
		];

		const commits: GitCommit[] = [];
		const now = Date.now();

		for (let i = 0; i < Math.min(count, messages.length); i++) {
			commits.push({
				hash: this.generateHash(),
				message: messages[i],
				author: i % 3 === 0 ? 'Teammate' : 'You',
				date: new Date(now - i * 3600000), // 1 hour apart
			});
		}

		return commits;
	}

	private generateHash(): string {
		return Math.random().toString(36).substring(2, 9);
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
