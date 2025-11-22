import { LanceDBStorage } from './src/services/storage/storage';
import { SessionManager } from './src/managers/SessionManager';
import * as vscode from 'vscode';

// Mock VS Code API
const mockVscode = {
    workspace: {
        name: 'Test Workspace',
        workspaceFolders: [{ uri: { fsPath: '/tmp/test-workspace' } }],
        getConfiguration: () => ({ get: () => '' })
    },
    window: {
        createOutputChannel: () => ({ appendLine: console.log })
    }
};
(global as any).vscode = mockVscode;

async function verify() {
    console.log('--- Verifying Session Manager ---');

    const storage = new LanceDBStorage();
    await storage.connect();

    const sessionManager = new SessionManager(storage);
    await sessionManager.initialize();

    const sessionId = sessionManager.getSessionId();
    console.log(`Session ID: ${sessionId}`);

    if (sessionId === 'current') {
        console.error('❌ Failed: Session ID is still default "current"');
        process.exit(1);
    }

    // Verify persistence
    const lastSession = await storage.getLastSession();
    if (lastSession && lastSession.id === sessionId) {
        console.log('✅ Success: Session persisted in LanceDB');
        console.log('Session Details:', lastSession);
    } else {
        console.error('❌ Failed: Session not found in DB or ID mismatch');
        console.log('Last Session in DB:', lastSession);
    }

    console.log('--- Verification Complete ---');
}

verify().catch(console.error);
