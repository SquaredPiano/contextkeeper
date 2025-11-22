
import * as vscode from 'vscode';
import { ContextIngestionService } from './ContextIngestionService';
import { IStorageService, EventRecord, ActionRecord, SessionRecord } from '../interfaces';

export class IngestionVerifier {
    private outputChannel: vscode.OutputChannel;

    constructor(private ingestionService: ContextIngestionService, private storage: IStorageService) {
        this.outputChannel = vscode.window.createOutputChannel("ContextKeeper Verification");
    }

    private log(message: string) {
        console.log(message);
        this.outputChannel.appendLine(message);
    }

    async runVerification() {
        this.outputChannel.show(true);
        this.log('🧪 Starting Ingestion Pipeline Verification...');
        
        // 1. Verify File Open Tracking
        // We can't easily "simulate" a file open event from here without triggering the real listener.
        // But we can check if the storage has recent events.
        
        const recentEvents = await this.storage.getRecentEvents(20); // Increased to 20
        this.log(`Found ${recentEvents.length} recent events.`);
        
        const openEvents = recentEvents.filter(e => e.event_type === 'file_open');
        if (openEvents.length > 0) {
            this.log('✅ File Open tracking verified.');
        } else {
            this.log('⚠️ No recent file_open events found. Try opening a file.');
        }

        // 2. Verify Function Tracking
        const editEvents = recentEvents.filter(e => e.event_type === 'file_edit');
        const functionEdits = editEvents.filter(e => {
            try {
                const meta = JSON.parse(e.metadata);
                return meta.function !== undefined;
            } catch (e) { return false; }
        });

        if (functionEdits.length > 0) {
            this.log(`✅ Semantic Function Tracking verified. Found edits in: ${functionEdits.map(e => JSON.parse(e.metadata).function).join(', ')}`);
        } else {
            this.log('⚠️ No function-specific edits found. Try editing inside a function.');
        }

        // 3. Verify Git Commits
        const commitEvents = recentEvents.filter(e => e.event_type === 'git_commit');
        if (commitEvents.length > 0) {
            this.log('✅ Git Commit tracking verified.');
        } else {
            this.log('⚠️ No git_commit events found.');
        }
        
        this.log('---------------------------------------------------');
    }
}
