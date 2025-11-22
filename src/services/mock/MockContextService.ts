/**
 * Mock Context Service
 * 
 * Provides fake developer context data for UI development.
 * INTEGRATION: Replace with real ContextService that uses vscode API.
 */

import { EventEmitter } from 'events';
import {
	IContextService,
	DeveloperContext,
	GitCommit,
	FileDiff,
	FileEdit,
} from '../interfaces';

export class MockContextService extends EventEmitter implements IContextService {
	private mockContext: DeveloperContext;

	constructor() {
		super();
		this.mockContext = this.generateMockContext();
	}

	async collectContext(): Promise<DeveloperContext> {
		// Simulate network delay
		await this.delay(500);

		// Update some fields to simulate real-time changes
		this.mockContext.session.totalEdits += Math.floor(Math.random() * 5);
		this.mockContext.files.activeFile = this.mockContext.files.openFiles[
			Math.floor(Math.random() * this.mockContext.files.openFiles.length)
		];

		this.emit('contextCollected', this.mockContext);
		return this.mockContext;
	}

	getCurrentFile(): string {
		return this.mockContext.files.activeFile;
	}

	getRiskyFiles(): string[] {
		return this.mockContext.session.riskyFiles;
	}

	async getLatestContextSummary(): Promise<string> {
		return "Mock context summary: User was working on extension.ts, fixing bugs in the authentication flow.";
	}

	private generateMockContext(): DeveloperContext {
		const now = new Date();
		const oneHourAgo = new Date(now.getTime() - 3600000);

		return {
			git: {
				recentCommits: [
					{
						hash: 'abc1234',
						message: 'feat: Add user authentication flow',
						author: 'You',
						date: new Date(now.getTime() - 7200000), // 2 hours ago
					},
					{
						hash: 'def5678',
						message: 'fix: Handle null reference in login',
						author: 'You',
						date: new Date(now.getTime() - 3600000), // 1 hour ago
					},
					{
						hash: '9ab0cde',
						message: 'refactor: Extract validation logic',
						author: 'Teammate',
						date: new Date(now.getTime() - 1800000), // 30 min ago
					},
				],
				currentBranch: 'feature/autonomous-copilot',
				uncommittedChanges: [
					{ file: 'src/extension.ts', linesAdded: 47, linesRemoved: 12 },
					{ file: 'src/services/mock/MockAIService.ts', linesAdded: 89, linesRemoved: 3 },
					{ file: 'src/ui/StatusBarManager.ts', linesAdded: 25, linesRemoved: 0 },
				],
			},
			files: {
				openFiles: [
					'src/extension.ts',
					'src/services/interfaces.ts',
					'src/services/mock/MockAIService.ts',
					'src/ui/StatusBarManager.ts',
					'README.md',
				],
				activeFile: 'src/extension.ts',
				recentlyEdited: [
					{ file: 'src/extension.ts', timestamp: new Date(now.getTime() - 300000), changes: 15 },
					{ file: 'src/services/mock/MockAIService.ts', timestamp: new Date(now.getTime() - 600000), changes: 23 },
					{ file: 'src/ui/StatusBarManager.ts', timestamp: new Date(now.getTime() - 900000), changes: 8 },
				],
				editFrequency: new Map([
					['src/extension.ts', 27],
					['src/services/interfaces.ts', 8],
					['src/services/mock/MockAIService.ts', 15],
					['src/ui/StatusBarManager.ts', 12],
					['README.md', 3],
				]),
			},
			cursor: {
				file: 'src/extension.ts',
				line: 42,
				column: 15,
				currentFunction: 'activate',
				selectedText: '',
			},
			timeline: {
				edits: [
					{ file: 'src/extension.ts', line: 42, timestamp: new Date(now.getTime() - 120000), chars: 25 },
					{ file: 'src/extension.ts', line: 45, timestamp: new Date(now.getTime() - 180000), chars: 43 },
					{ file: 'src/services/mock/MockAIService.ts', line: 67, timestamp: new Date(now.getTime() - 300000), chars: 18 },
				],
				opens: [
					{ file: 'src/extension.ts', timestamp: oneHourAgo },
					{ file: 'src/services/interfaces.ts', timestamp: new Date(oneHourAgo.getTime() + 600000) },
				],
				closes: [
					{ file: 'package.json', timestamp: new Date(oneHourAgo.getTime() + 300000) },
				],
			},
			session: {
				startTime: oneHourAgo,
				totalEdits: 47,
				riskyFiles: ['src/extension.ts', 'src/services/mock/MockAIService.ts'], // High edit frequency
			},
		};
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
