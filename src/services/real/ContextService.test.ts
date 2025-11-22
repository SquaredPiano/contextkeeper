import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextService } from './ContextService';
import { storage } from '../storage';
import * as vscode from 'vscode';

// Mock vscode
vi.mock('vscode', () => {
  return {
    window: {
      activeTextEditor: {
        document: {
          fileName: '/path/to/active.ts',
          getText: () => 'const x = 1;',
        },
        selection: {
          active: { line: 10, character: 5 },
        },
      },
    },
    workspace: {
      textDocuments: [
        { uri: { scheme: 'file' }, fileName: '/path/to/file1.ts' },
        { uri: { scheme: 'file' }, fileName: '/path/to/active.ts' },
      ],
      asRelativePath: (path: string) => path,
    },
    commands: {
      executeCommand: vi.fn(),
    },
    SymbolKind: {
      Function: 11,
      Method: 5,
    },
  };
});

// Mock storage
vi.mock('../storage', () => ({
  storage: {
    connect: vi.fn(),
    getRecentEvents: vi.fn(),
  },
}));

describe('ContextService', () => {
  let contextService: ContextService;

  beforeEach(() => {
    // Mock storage
    const mockStorage = {
      connect: vi.fn(),
      logEvent: vi.fn(),
      createSession: vi.fn(),
      addAction: vi.fn(),
      getLastSession: vi.fn(),
      getSimilarSessions: vi.fn(),
      getSimilarActions: vi.fn(),
      getRecentEvents: vi.fn(),
      getLastActiveFile: vi.fn(),
      clearAllTables: vi.fn()
    };
    contextService = new ContextService(mockStorage as any);
    vi.clearAllMocks();
  });

  it('should collect context from storage and vscode', async () => {
    // Mock storage response
    const mockEvents = [
      {
        event_type: 'file_edit',
        file_path: 'src/utils.ts',
        timestamp: Date.now() - 1000,
        metadata: JSON.stringify({ changeCount: 5 }),
      },
      {
        event_type: 'git_commit',
        file_path: 'root',
        timestamp: Date.now() - 5000,
        metadata: JSON.stringify({
          hash: 'abc1234',
          message: 'fix: bug',
          author: 'Dev',
        }),
      },
    ];

    // We need to mock the injected storage, not the global one, but for this test structure 
    // we might need to adjust how we mock. 
    // However, since we passed a mockStorage to the constructor, we should mock THAT instance.
    // But here we are mocking the global storage import? 
    // The previous code was mocking `storage.getRecentEvents`. 
    // Since we injected a mock, we should use that mock.
    // But `mockStorage` is local to beforeEach.
    // Let's redefine mockStorage at describe level or use the one on the instance if public?
    // Or just cast contextService['storage'] to any.

    const mockStorage = (contextService as any).storage;
    mockStorage.getRecentEvents.mockResolvedValue(mockEvents);

    const context = await contextService.collectContext();

    // Verify Git Context
    expect(context.git.recentCommits).toHaveLength(1);
    expect(context.git.recentCommits[0].message).toBe('fix: bug');

    // Verify File Context
    expect(context.files.openFiles).toContain('/path/to/file1.ts');
    expect(context.files.activeFile).toBe('/path/to/active.ts');
    expect(context.files.recentlyEdited).toHaveLength(1);
    expect(context.files.recentlyEdited[0].file).toBe('src/utils.ts');

    // Verify Timeline
    expect(context.timeline.edits).toHaveLength(1);
    expect(context.timeline.edits[0].file).toBe('src/utils.ts');

    // Verify Session
    expect(context.session.totalEdits).toBe(1);
  });

  it('should handle empty storage gracefully', async () => {
    const mockStorage = (contextService as any).storage;
    mockStorage.getRecentEvents.mockResolvedValue([]);

    const context = await contextService.collectContext();

    expect(context.git.recentCommits).toHaveLength(0);
    expect(context.files.recentlyEdited).toHaveLength(0);
    expect(context.session.totalEdits).toBe(0);
  });

  it('should calculate risky files based on edit frequency', async () => {
    // Create 6 edit events for the same file
    const mockEvents = Array(6).fill(null).map((_, i) => ({
      event_type: 'file_edit',
      file_path: 'risky.ts',
      timestamp: Date.now() - i * 1000,
      metadata: JSON.stringify({ changeCount: 1 }),
    }));

    const mockStorage = (contextService as any).storage;
    mockStorage.getRecentEvents.mockResolvedValue(mockEvents);

    const context = await contextService.collectContext();

    expect(context.session.riskyFiles).toContain('risky.ts');
  });
});
