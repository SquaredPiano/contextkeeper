import { IStorageService, SessionRecord } from '../services/interfaces';
import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Context switch detection thresholds
 */
const CONTEXT_SWITCH_THRESHOLDS = {
    /** Idle time threshold for auto-finalizing session (30 minutes) */
    MAX_IDLE_TIME_MS: 30 * 60 * 1000,
    /** Minimum time between context switches to avoid excessive sessions (5 minutes) */
    MIN_SESSION_DURATION_MS: 5 * 60 * 1000,
    /** File extensions to ignore for context switches */
    IGNORED_EXTENSIONS: new Set(['.log', '.txt', '.md', '.json', '.yaml', '.yml'])
};

/**
 * Represents a context switch event
 */
interface ContextSwitchEvent {
    reason: 'branch_change' | 'file_pattern_change' | 'long_idle' | 'manual_end';
    details: string;
    timestamp: number;
}

/**
 * Manages session lifecycle with automatic boundary detection.
 * 
 * Sessions automatically finalize when:
 * - User switches git branches
 * - User switches to very different files (e.g., frontend -> backend)
 * - User is idle for 30+ minutes
 * - VS Code window closes
 */
export class SessionManager {
    private currentSessionId: string = 'current'; // Default fallback
    private storage: IStorageService;
    private initialized: boolean = false;
    
    // Context tracking
    private lastActivityTime: number = Date.now();
    private currentBranch: string | null = null;
    private recentFiles: Set<string> = new Set();
    private sessionStartTime: number = Date.now();
    
    // Auto-finalization timer
    private idleCheckInterval: NodeJS.Timeout | null = null;

    constructor(storage: IStorageService) {
        this.storage = storage;
    }

    async initialize(): Promise<void> {
        if (this.initialized) { return; }

        try {
            const workspaceName = vscode.workspace.name || 'Unknown Workspace';
            const session = await this.storage.createSession(
                `Session started at ${new Date().toLocaleString()}`,
                workspaceName
            );

            this.currentSessionId = session.id;
            this.initialized = true;
            this.sessionStartTime = Date.now();
            
            // Track current git branch
            await this.updateCurrentBranch();
            
            // Start idle detection for auto-finalization
            this.startIdleDetection();
            
            console.log(`[SessionManager] Initialized session: ${this.currentSessionId} on branch ${this.currentBranch || 'unknown'}`);
        } catch (error) {
            console.error('[SessionManager] Failed to initialize session:', error);
            // Fallback to UUID if storage fails, so we don't crash ingestion
            this.currentSessionId = uuidv4();
        }
    }

    getSessionId(): string {
        return this.currentSessionId;
    }
    
    /**
     * Record activity and check if context has switched
     */
    async recordActivity(filePath?: string): Promise<void> {
        this.lastActivityTime = Date.now();
        
        if (filePath) {
            this.recentFiles.add(filePath);
            // Keep only last 10 files
            if (this.recentFiles.size > 10) {
                const firstFile = this.recentFiles.values().next().value as string | undefined;
                if (firstFile) {
                    this.recentFiles.delete(firstFile);
                }
            }
        }
        
        // Check for context switch
        const contextSwitch = await this.detectContextSwitch(filePath);
        if (contextSwitch) {
            await this.finalizeAndStartNewSession(contextSwitch);
        }
    }
    
    /**
     * Detect if user has switched contexts (different branch, different files, etc.)
     */
    private async detectContextSwitch(currentFile?: string): Promise<ContextSwitchEvent | null> {
        // Rule 1: Branch change detection
        const newBranch = await this.getCurrentGitBranch();
        if (this.currentBranch && newBranch && newBranch !== this.currentBranch) {
            return {
                reason: 'branch_change',
                details: `Switched from ${this.currentBranch} to ${newBranch}`,
                timestamp: Date.now()
            };
        }
        
        // Rule 2: Significant file pattern change (e.g., frontend -> backend)
        // Only check if session has been running for at least 5 minutes
        const sessionDuration = Date.now() - this.sessionStartTime;
        if (currentFile && sessionDuration > CONTEXT_SWITCH_THRESHOLDS.MIN_SESSION_DURATION_MS) {
            const fileExt = path.extname(currentFile);
            if (!CONTEXT_SWITCH_THRESHOLDS.IGNORED_EXTENSIONS.has(fileExt)) {
                const currentPattern = this.getFilePattern(currentFile);
                const recentPatterns = Array.from(this.recentFiles)
                    .filter(f => !CONTEXT_SWITCH_THRESHOLDS.IGNORED_EXTENSIONS.has(path.extname(f)))
                    .map(f => this.getFilePattern(f));
                
                // If current pattern is drastically different from recent patterns
                if (recentPatterns.length > 3 && !recentPatterns.includes(currentPattern)) {
                    return {
                        reason: 'file_pattern_change',
                        details: `Switched from ${recentPatterns[0]} to ${currentPattern}`,
                        timestamp: Date.now()
                    };
                }
            }
        }
        
        return null;
    }
    
    /**
     * Extract file pattern (e.g., "src/ui", "src/services", "tests")
     */
    private getFilePattern(filePath: string): string {
        const parts = filePath.split('/');
        // Return first 2 path segments (e.g., "src/ui")
        return parts.slice(0, 2).join('/');
    }
    
    /**
     * Get current git branch for workspace
     */
    private async getCurrentGitBranch(): Promise<string | null> {
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) { return null; }
            
            const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { 
                cwd: workspaceRoot,
                timeout: 1000 
            });
            return stdout.trim();
        } catch {
            return null;
        }
    }
    
    /**
     * Update cached current branch
     */
    private async updateCurrentBranch(): Promise<void> {
        this.currentBranch = await this.getCurrentGitBranch();
    }
    
    /**
     * Start periodic idle detection for auto-finalization
     */
    private startIdleDetection(): void {
        // Check every 5 minutes
        this.idleCheckInterval = setInterval(() => {
            const idleTime = Date.now() - this.lastActivityTime;
            if (idleTime > CONTEXT_SWITCH_THRESHOLDS.MAX_IDLE_TIME_MS) {
                this.finalizeAndStartNewSession({
                    reason: 'long_idle',
                    details: `Idle for ${Math.floor(idleTime / 60000)} minutes`,
                    timestamp: Date.now()
                }).catch(err => console.error('[SessionManager] Failed to auto-finalize session:', err));
            }
        }, 5 * 60 * 1000); // Check every 5 minutes
    }
    
    /**
     * Finalize current session and start a new one
     */
    private async finalizeAndStartNewSession(event: ContextSwitchEvent): Promise<void> {
        console.log(`[SessionManager] 🔄 Context switch detected: ${event.reason} - ${event.details}`);
        
        try {
            // Finalize old session with a meaningful summary
            const summary = `Session ended: ${event.details}`;
            const storageWithEmbedding = this.storage as unknown as { getEmbedding: (text: string) => Promise<number[]> };
            const embedding = await storageWithEmbedding.getEmbedding(summary);
            await this.storage.updateSessionSummary(this.currentSessionId, summary, embedding);
            
            console.log(`[SessionManager] ✅ Finalized session ${this.currentSessionId}`);
            
            // Start new session
            const workspaceName = vscode.workspace.name || 'Unknown Workspace';
            const newSession = await this.storage.createSession(
                `Session started at ${new Date().toLocaleString()} (${event.reason})`,
                workspaceName
            );
            
            this.currentSessionId = newSession.id;
            this.sessionStartTime = Date.now();
            this.recentFiles.clear();
            await this.updateCurrentBranch();
            
            console.log(`[SessionManager] 🆕 Started new session: ${this.currentSessionId} on branch ${this.currentBranch || 'unknown'}`);
        } catch (error) {
            console.error('[SessionManager] Failed to finalize and create new session:', error);
        }
    }
    
    /**
     * Manually end current session (called on window close)
     */
    async finalizeSession(): Promise<void> {
        if (this.idleCheckInterval) {
            clearInterval(this.idleCheckInterval);
            this.idleCheckInterval = null;
        }
        
        await this.finalizeAndStartNewSession({
            reason: 'manual_end',
            details: 'VS Code window closed',
            timestamp: Date.now()
        });
    }
}
