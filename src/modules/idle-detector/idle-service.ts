import * as vscode from 'vscode';
import { IdleDetector } from './idle-detector';
import { IIdleService, IdleConfig } from './types';
import { storage } from '../../services/storage';
import { EventRecord } from '../../services/storage/schema';
import { IAIService } from '../../services/interfaces';

// Hardcoded idle threshold: 15 seconds exactly
const DEFAULT_IDLE_THRESHOLD_MS = 15000;

export class IdleService implements IIdleService {
    private detector: IdleDetector;
    private lastSessionTime: number = Date.now();
    private isEnabled: boolean = true;
    private aiService: IAIService | null = null;

    constructor(config: IdleConfig = { thresholdMs: DEFAULT_IDLE_THRESHOLD_MS }, aiService?: IAIService) {
        this.detector = new IdleDetector(config);
        this.aiService = aiService || null;
    }

    public async initialize(): Promise<void> {
        console.log('[IdleService] Initializing...');
        
        this.detector.on('idle', () => this.handleIdle());
        this.detector.on('active', () => this.handleActive());
        
        this.detector.start();
        
        // Ensure storage is connected (lazy)
        try {
            await storage.connect();
        } catch (error) {
            console.error('[IdleService] Failed to connect to storage:', error);
        }
    }

    public dispose(): void {
        this.detector.dispose();
    }

    private async handleIdle(): Promise<void> {
        if (!this.isEnabled) { return; }
        console.log('[IdleService] Handling idle state...');

        try {
            // 1. Fetch events since last session
            // We don't have a direct "since timestamp" query in storage yet, so we fetch recent and filter
            // TODO: Optimize storage query to support "since"
            const recentEvents = await storage.getRecentEvents(100);
            const newEvents = recentEvents.filter(e => e.timestamp > this.lastSessionTime);

            if (newEvents.length === 0) {
                console.log('[IdleService] No new events to summarize.');
                return;
            }

            // 2. Generate Session Summary
            const summary = await this.generateSessionSummary(newEvents);
            const project = vscode.workspace.name || 'Unknown Project';

            // 3. Create Session in DB
            const session = await storage.createSession(summary, project);
            console.log(`[IdleService] Created session: ${session.id} - ${session.summary}`);

            // 4. Update last session time
            this.lastSessionTime = Date.now();

        } catch (error) {
            console.error('[IdleService] Error handling idle state:', error);
        }
    }

    private handleActive(): void {
        console.log('[IdleService] User active.');
        // Potentially log a "Resume" event or just reset internal tracking
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
