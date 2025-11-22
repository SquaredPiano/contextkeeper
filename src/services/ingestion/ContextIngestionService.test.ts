import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContextIngestionService } from './ContextIngestionService';
import { IStorageService, IContextService } from '../interfaces';
import { SessionManager } from '../../managers/SessionManager';

// Mock VS Code
vi.mock('vscode', () => {
    const mockVscode = {
        workspace: {
            workspaceFolders: [{ uri: { fsPath: '/root' } }],
            asRelativePath: (uri: any) => uri.fsPath.replace('/root/', ''),
            onDidCloseTextDocument: vi.fn(),
            onDidChangeTextDocument: vi.fn(),
            getConfiguration: vi.fn(() => ({ get: vi.fn() })),
        },
        window: {
            createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })),
            onDidChangeActiveTextEditor: vi.fn(),
        },
        Uri: {
            file: (path: string) => ({ fsPath: path, scheme: 'file' }),
            parse: (path: string) => ({ fsPath: path, scheme: 'file' })
        },
        Range: class {
            constructor(public start: any, public end: any) {}
        },
        Position: class {
            constructor(public line: number, public character: number) {}
        },
        commands: {
            executeCommand: vi.fn()
        },
        extensions: {
            getExtension: vi.fn().mockReturnValue({
                exports: {
                    getAPI: vi.fn().mockReturnValue({
                        repositories: [],
                        onDidChangeRepository: vi.fn(),
                        onDidOpenRepository: vi.fn(),
                        onDidCloseRepository: vi.fn()
                    })
                }
            })
        }
    };
    return mockVscode;
});

// Mock symbolUtils
vi.mock('../../utils/symbolUtils', () => ({
    getDocumentSymbols: vi.fn().mockResolvedValue([
        {
            name: 'testFunction',
            kind: 11, // Function
            range: { start: { line: 10, character: 0 }, end: { line: 20, character: 0 } },
            children: []
        }
    ]),
    findFunctionAtPosition: vi.fn().mockReturnValue('testFunction')
}));

describe('ContextIngestionService', () => {
    let service: ContextIngestionService;
    let mockStorage: any;
    let mockContextService: any;
    let mockSessionManager: any;

    beforeEach(() => {
        vi.useFakeTimers();
        
        mockStorage = {
            connect: vi.fn(),
            saveEvent: vi.fn(),
            saveAction: vi.fn()
        };
        
        mockContextService = {};
        
        mockSessionManager = {
            getSessionId: vi.fn().mockReturnValue('test-session-id')
        };

        service = new ContextIngestionService(
            mockStorage as IStorageService,
            mockContextService as IContextService,
            mockSessionManager as SessionManager
        );
        
        // Mock the queue to intercept enqueue calls
        (service as any).queue = {
            start: vi.fn(),
            stop: vi.fn(),
            enqueue: vi.fn()
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it('should track file edits and identify function context', async () => {
        await service.initialize({ subscriptions: [] } as any);

        const mockDocument = {
            uri: { fsPath: '/root/src/test.ts', scheme: 'file' },
            languageId: 'typescript',
            lineCount: 100,
            getText: () => 'content'
        };

        const mockEvent = {
            document: mockDocument,
            contentChanges: [{
                range: { start: { line: 15, character: 0 }, end: { line: 15, character: 1 } },
                text: 'a',
                textLength: 1
            }]
        };

        // Trigger edit
        // Access private method or trigger via listener if we could capture it
        // Since we mocked onDidChangeTextDocument, we can't easily trigger the listener registered inside.
        // So we will call the handler directly (casting to any to access private method)
        (service as any).handleFileEdit(mockEvent);

        // Fast forward debounce
        await vi.advanceTimersByTimeAsync(2500);

        // Wait for async processing
        // await new Promise(resolve => setTimeout(resolve, 10)); // This is problematic with fake timers

        const queue = (service as any).queue;
        expect(queue.enqueue).toHaveBeenCalledTimes(2); // 1 event, 1 action

        // Check Event
        const eventCall = queue.enqueue.mock.calls[0][0];
        expect(eventCall.type).toBe('event');
        expect(eventCall.data.event_type).toBe('file_edit');
        
        const metadata = JSON.parse(eventCall.data.metadata);
        expect(metadata.function).toBe('testFunction');
        
        // Check Action
        const actionCall = queue.enqueue.mock.calls[1][0];
        expect(actionCall.type).toBe('action');
        expect(actionCall.data.description).toContain('Modified function: testFunction');
    });

    it('should track git commits', async () => {
        await service.initialize({ subscriptions: [] } as any);

        const mockCommit = {
            hash: 'abc1234',
            message: 'feat: added new feature',
            author: 'Test User',
            date: '2023-01-01',
            files: ['src/test.ts']
        };

        // Simulate git commit event
        // We need to access the gitWatcher instance or call handleGitCommit directly
        // Since gitWatcher is private, we'll call handleGitCommit directly
        await (service as any).handleGitCommit(mockCommit);

        const queue = (service as any).queue;
        expect(queue.enqueue).toHaveBeenCalledTimes(2); // 1 event, 1 action

        // Check Event
        const eventCall = queue.enqueue.mock.calls[0][0];
        expect(eventCall.type).toBe('event');
        expect(eventCall.data.event_type).toBe('git_commit');
        
        const metadata = JSON.parse(eventCall.data.metadata);
        expect(metadata.hash).toBe('abc1234');
        expect(metadata.message).toBe('feat: added new feature');
        
        // Check Action
        const actionCall = queue.enqueue.mock.calls[1][0];
        expect(actionCall.type).toBe('action');
        expect(actionCall.data.description).toContain('User committed changes: feat: added new feature');
    });
});
