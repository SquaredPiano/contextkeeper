import * as vscode from 'vscode';
import { IdleDetector } from './idle-detector';
import { IIdleService, IdleConfig } from './types';
import { storage } from '../../services/storage';
import { EventRecord } from '../../services/storage/schema';

export class IdleService implements IIdleService {
    private detector: IdleDetector;
    private lastSessionTime: number = Date.now();
    private isEnabled: boolean = true;

    constructor(config: IdleConfig = { thresholdMs: 5 * 60 * 1000 }) { // Default 5 minutes
        this.detector = new IdleDetector(config);
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
        // Simple heuristic summary for now
        // In a real implementation, this would call Gemini/LLM to summarize the events
        
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
