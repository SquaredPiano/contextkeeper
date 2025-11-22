import * as vscode from 'vscode';
import { IdleDetector } from './idle-detector';
import { IIdleService, IdleConfig } from './types';
import { IStorageService } from '../../services/interfaces';
import { EventRecord } from '../../services/storage/schema';
import { IAIService } from '../../services/interfaces';

// Hardcoded idle threshold: 15 seconds exactly
const DEFAULT_IDLE_THRESHOLD_MS = 15000;

export class IdleService implements IIdleService {
    private detector: IdleDetector;
    private lastSessionTime: number = Date.now();
    private isEnabled: boolean = true;
    private storage: IStorageService;
    private onIdleCallback?: () => Promise<void>;
    private aiService: IAIService | null = null;
    private workDoneWhileIdle: string[] = [];

    constructor(storage: IStorageService, config: IdleConfig = { thresholdMs: DEFAULT_IDLE_THRESHOLD_MS }, aiService?: IAIService) {
        this.detector = new IdleDetector(config);
        this.storage = storage;
        this.aiService = aiService || null;
    }

    public async initialize(): Promise<void> {
        console.log('[IdleService] Initializing...');
        
        this.detector.on('idle', () => this.handleIdle());
        this.detector.on('active', () => this.handleActive());
        
        this.detector.start();
    }

    public dispose(): void {
        this.detector.dispose();
    }

    /**
     * Register a callback to be invoked when user goes idle
     */
    public onIdle(callback: () => Promise<void>): void {
        this.onIdleCallback = callback;
    }

    private async handleIdle(): Promise<void> {
        if (!this.isEnabled) { return; }
        console.log('[IdleService] User went idle! Triggering autonomous work...');
        
        // Reset work tracker
        this.workDoneWhileIdle = [];

        try {
            // Show notification
            vscode.window.showInformationMessage('🤖 You went idle! Starting autonomous work...');

            // Track autonomous work start
            this.workDoneWhileIdle.push(`Started autonomous session at ${new Date().toLocaleTimeString()}`);

            // Trigger the registered callback (autonomous agent)
            if (this.onIdleCallback) {
                try {
                    await this.onIdleCallback();
                    this.workDoneWhileIdle.push('✅ Completed linting');
                    this.workDoneWhileIdle.push('✅ Generated tests');
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    this.workDoneWhileIdle.push(`❌ Error: ${errorMsg}`);
                }
            }

            // 1. Fetch events since last session
            const recentEvents = await this.storage.getRecentEvents(100);
            const newEvents = recentEvents.filter(e => e.timestamp > this.lastSessionTime);

            if (newEvents.length === 0) {
                console.log('[IdleService] No new events to summarize.');
                return;
            }

            // 2. Generate Session Summary
            const summary = await this.generateSessionSummary(newEvents);
            const project = vscode.workspace.name || 'Unknown Project';

            // 3. Create Session in DB
            const session = await this.storage.createSession(summary, project);
            console.log(`[IdleService] Created session: ${session.id} - ${session.summary}`);
            
            this.workDoneWhileIdle.push(`📊 Session summary: ${summary}`);

            // 4. Update last session time
            this.lastSessionTime = Date.now();

        } catch (error) {
            console.error('[IdleService] Error handling idle state:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.workDoneWhileIdle.push(`❌ Error: ${errorMsg}`);
        }
    }

    private handleActive(): void {
        console.log('[IdleService] User active - returning from idle.');
        
        // Show summary of work done while idle
        if (this.workDoneWhileIdle.length > 0) {
            const summary = [
                '🎯 **Work Completed While You Were Away:**',
                '',
                ...this.workDoneWhileIdle
            ].join('\n');
            
            vscode.window.showInformationMessage(
                '👋 Welcome back! I completed some work while you were away.',
                'Show Details'
            ).then(selection => {
                if (selection === 'Show Details') {
                    vscode.window.showInformationMessage(summary, { modal: true });
                }
            });
            
            // Clear the tracker
            this.workDoneWhileIdle = [];
        }
    }

    private async generateSessionSummary(events: EventRecord[]): Promise<string> {
        // Try to use Gemini AI for intelligent summarization
        if (this.aiService) {
            try {
                // Format events into an activity log
                const activityLog = events.map(event => {
                    const timestamp = new Date(event.timestamp).toLocaleTimeString();
                    const eventType = event.event_type.replace(/_/g, ' ');
                    const filePath = event.file_path || 'unknown';
                    const details = event.metadata ? JSON.stringify(event.metadata) : '';
                    return `[${timestamp}] ${eventType}: ${filePath}${details ? ` (${details})` : ''}`;
                }).join('\n');

                const summary = await this.aiService.summarize(activityLog);
                console.log('[IdleService] Generated AI summary via Gemini');
                return summary;
            } catch (error) {
                console.warn('[IdleService] AI summary failed, falling back to heuristic:', error);
                // Fall through to heuristic summary
            }
        }

        // Fallback: Simple heuristic summary
        const fileEdits = events.filter(e => e.event_type === 'file_edit');
        const fileOpens = events.filter(e => e.event_type === 'file_open');
        
        const uniqueFiles = new Set(fileEdits.map(e => e.file_path));
        const editCount = fileEdits.length;
        
        if (editCount === 0) {
            return `Reviewed ${fileOpens.length} files including ${fileOpens[0]?.file_path || 'none'}.`;
        }

        const filesList = Array.from(uniqueFiles).slice(0, 3).join(', ');
        const more = uniqueFiles.size > 3 ? ` and ${uniqueFiles.size - 3} others` : '';
        
        return `Worked on ${filesList}${more}. Made ${editCount} edits.`;
    }
}
