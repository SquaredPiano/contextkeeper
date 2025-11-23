/**
 * Service Interfaces & Data Contracts
 * 
 * These interfaces define the contract between frontend UI and backend services.
 * Mock services and real services must both implement these interfaces.
 * 
 * INTEGRATION STRATEGY:
 * 1. Frontend built against these interfaces
 * 2. Mock services implement them with fake data
 * 3. Backend team implements real services matching these interfaces
 * 4. Swap: new MockContextService() → new ContextService() (ONE LINE!)
 */

import { EventEmitter } from 'events';
import { ActionRecord, EventRecord } from './storage/schema';
export { ActionRecord, EventRecord };

// ============================================================================
// DATA STRUCTURES
// ============================================================================

export interface GitCommit {
	hash: string;
	message: string;
	author: string;
	date: Date;
}

export interface FileDiff {
	file: string;
	linesAdded: number;
	linesRemoved: number;
}

export interface FileEdit {
	file: string;
	timestamp: Date;
	changes: number;
}

export interface EditEvent {
	file: string;
	line: number;
	timestamp: Date;
	chars: number;
}

export interface FileEvent {
	file: string;
	timestamp: Date;
}

/**
 * Complete developer context collected from the workspace
 * This is what the AI uses to make informed suggestions
 */
export interface DeveloperContext {
	git: {
		recentCommits: GitCommit[];
		currentBranch: string;
		uncommittedChanges: FileDiff[];
	};
	files: {
		openFiles: string[];
		activeFile: string;
		recentlyEdited: FileEdit[];
		editFrequency: Map<string, number>;
	};
	cursor: {
		file: string;
		line: number;
		column: number;
		currentFunction: string;
		selectedText: string;
	};
	timeline: {
		edits: EditEvent[];
		opens: FileEvent[];
		closes: FileEvent[];
	};
	session: {
		startTime: Date;
		totalEdits: number;
		riskyFiles: string[]; // Files edited >10 times
	};
}

/**
 * AI analysis results
 */
export interface AIAnalysis {
	issues: Issue[];
	suggestions: Suggestion[];
	riskLevel: 'low' | 'medium' | 'high';
	confidence: number;
	timestamp: Date;
}

export interface Issue {
	id: string;
	file: string;
	line: number;
	column: number;
	severity: 'error' | 'warning' | 'info';
	message: string;
	suggestedFix?: string;
	codeSnippet?: string;
}

export interface Suggestion {
	type: 'refactor' | 'performance' | 'security' | 'style';
	message: string;
	file?: string;
	line?: number;
}

export interface CodeFix {
	fixedCode: string;
	explanation: string;
	diff?: string;
}

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

/**
 * Context Service - Collects developer activity data
 * 
 * MOCK: Returns hardcoded DeveloperContext
 * REAL: Uses vscode API, simple-git, file watchers
 */
export interface IContextService extends EventEmitter {
	collectContext(): Promise<DeveloperContext>;
	getCurrentFile(): string;
	getRiskyFiles(): string[];
	getLatestContextSummary(): Promise<string>;
}

/**
 * AI Service - Analyzes code and provides suggestions
 * 
 * MOCK: Returns hardcoded AIAnalysis after fake delay
 * REAL: Calls Gemini API with actual code + context
 */
export interface IAIService extends EventEmitter {
	analyze(code: string, context: DeveloperContext): Promise<AIAnalysis>;
	generateTests(code: string, language?: string, framework?: string): Promise<string>;
	fixError(code: string, error: string): Promise<CodeFix>;
	explainCode(code: string): Promise<string>;
	summarize(text: string): Promise<string>;
	plan(goal: string, context: DeveloperContext): Promise<string>;
}

/**
 * Git Service - Manages version control operations
 * 
 * MOCK: Logs actions, returns success
 * REAL: Uses simple-git to execute git commands
 */
export interface IGitService {
	createBranch(name: string): Promise<void>;
	commit(message: string, files?: string[]): Promise<void>;
	applyDiff(diff: string): Promise<void>;
	getCurrentBranch(): Promise<string>;
	getRecentCommits(count: number): Promise<GitCommit[]>;
	getBranches(): Promise<string[]>;
	checkoutBranch(branchName: string): Promise<void>;
	deleteBranch(branchName: string, force?: boolean): Promise<void>;
	mergeBranch(branchName: string): Promise<void>;
}

/**
 * Voice Service - Provides audio notifications
 * 
 * MOCK: Shows VSCode notification instead
 * REAL: Calls ElevenLabs API to generate speech
 */
export interface IVoiceService {
	speak(text: string, voice?: 'casual' | 'professional' | 'encouraging'): Promise<void>;
	isEnabled(): boolean;
}

/**
 * Embedding Service - Generates vector embeddings for text
 * 
 * MOCK: Returns random vectors
 * REAL: Calls Gemini API (text-embedding-004)
 */
export interface IEmbeddingService {
	getEmbedding(text: string): Promise<number[]>;
}

export interface SessionRecord {
	id: string;
	timestamp: number;
	summary: string;
	embedding: number[];
	project: string;
	event_count: number;
}

export interface StorageEvent {
	timestamp: number;
	event_type: string;
	file_path: string;
	metadata: string;
}

export interface IStorageService {
	connect(embeddingService?: IEmbeddingService): Promise<void>;
	logEvent(event: Omit<EventRecord, 'id'>): Promise<void>;
	createSession(summary: string, project: string): Promise<SessionRecord>;
	updateSessionSummary(sessionId: string, summary: string, embedding: number[]): Promise<void>;
	addAction(action: Omit<ActionRecord, 'id' | 'embedding'>): Promise<void>;
	getLastSession(): Promise<SessionRecord | null>;
	getSimilarSessions(query: string, topK?: number): Promise<SessionRecord[]>;
	getSimilarActions(query: string, topK?: number): Promise<ActionRecord[]>;
	getRecentEvents(limit?: number): Promise<EventRecord[]>;
	getRecentActions(limit?: number): Promise<ActionRecord[]>;
	getLastActiveFile(): Promise<string | null>;
}

// ============================================================================
// SERVICE EVENTS
// ============================================================================

export type ContextServiceEvents = {
	contextCollected: (context: DeveloperContext) => void;
	fileChanged: (file: string) => void;
	error: (error: Error) => void;
};

export type AIServiceEvents = {
	analysisStarted: () => void;
	analysisProgress: (progress: number, message: string) => void;
	analysisComplete: (analysis: AIAnalysis) => void;
	error: (error: Error) => void;
};

// ============================================================================
// UI MESSAGE CONTRACTS
// ============================================================================

/**
 * Extension change record for tracking autonomous work
 */
export interface ExtensionChange {
	time: number;
	description: string;
	action?: string;
	actor?: string;
}

/**
 * Copilot branch information
 */
export interface CopilotBranch {
	name: string;
	lastCommit: string;
	lastCommitDate: Date;
	commitCount: number;
	isCurrent: boolean;
}

/**
 * Messages sent FROM webview TO extension
 */
export type UIToExtensionMessage =
	| { type: 'requestContext' }
	| { type: 'triggerAnalysis' }
	| { type: 'toggleAutonomous'; enabled: boolean }
	| { type: 'applyFix'; issueId: string }
	| { type: 'navigateToIssue'; file: string; line: number }
	| { type: 'dismissIssue'; issueId: string }
	| { type: 'setAutonomyDelay'; seconds: number }
	| { type: 'setElevenVoice'; enabled: boolean }
	| { type: 'setNotifications'; enabled: boolean }
	| { type: 'ensureSoundOn' }
	| { type: 'clearIdleSummary' }
	| { type: 'requestCopilotBranches' }
	| { type: 'checkoutCopilotBranch'; branchName: string }
	| { type: 'mergeCopilotBranch'; branchName: string }
	| { type: 'deleteCopilotBranch'; branchName: string };

/**
 * Messages sent FROM extension TO webview
 */
export type ExtensionToUIMessage =
	| { type: 'contextUpdate'; payload: DeveloperContext }
	| { type: 'analysisComplete'; payload: AIAnalysis }
	| { type: 'stateChanged'; state: ExtensionState }
	| { type: 'progress'; progress: number; message: string }
	| { type: 'error'; message: string }
	| { type: 'idleImprovementsComplete'; payload: { 
			summary: string; 
			testsGenerated: number; 
			recommendations: Array<{ priority: 'high' | 'medium' | 'low'; message: string }>; 
			timestamp: number;
		}
	}
	| { type: 'extensionChanges'; payload: ExtensionChange[] }
	| { type: 'elevenVoiceState'; enabled: boolean }
	| { type: 'notificationsState'; enabled: boolean }
	| { type: 'copilotBranches'; payload: CopilotBranch[] };

export type ExtensionState =
	| { status: 'idle' }
	| { status: 'analyzing'; progress: number; message: string }
	| { status: 'complete'; issuesFound: number }
	| { status: 'error'; error: string };
