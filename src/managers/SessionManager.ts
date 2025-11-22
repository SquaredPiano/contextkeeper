import { IStorageService, SessionRecord } from '../services/interfaces';
import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

export class SessionManager {
    private currentSessionId: string = 'current'; // Default fallback
    private storage: IStorageService;
    private initialized: boolean = false;

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
            console.log(`[SessionManager] Initialized session: ${this.currentSessionId}`);
        } catch (error) {
            console.error('[SessionManager] Failed to initialize session:', error);
            // Fallback to UUID if storage fails, so we don't crash ingestion
            this.currentSessionId = uuidv4();
        }
    }

    getSessionId(): string {
        return this.currentSessionId;
    }
}
