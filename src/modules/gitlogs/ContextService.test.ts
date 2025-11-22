import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextService } from './ContextService';
import { IGitService, IStorageService } from '../../services/interfaces';
import * as vscode from 'vscode';

// Mock vscode
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
    onDidChangeTextDocument: vi.fn(),
    onDidOpenTextDocument: vi.fn(),
    onDidCloseTextDocument: vi.fn(),
    textDocuments: []
  },
  window: {
    activeTextEditor: {
      document: { fileName: '/mock/file.ts', getText: () => '' },
      selection: { active: { line: 0, character: 0 } }
    }
  },
  commands: {
    executeCommand: vi.fn()
  },
  SymbolKind: {
    Function: 11,
    Method: 5
  }
}));

describe('ContextService', () => {
  let contextService: ContextService;
  let mockGitService: IGitService;
  let mockStorageService: IStorageService;

  beforeEach(() => {
    vi.resetAllMocks();

    mockGitService = {
      getRecentCommits: vi.fn().mockResolvedValue([]),
      getCurrentBranch: vi.fn().mockResolvedValue('main'),
      createBranch: vi.fn(),
      commit: vi.fn(),
      applyDiff: vi.fn()
    };

    mockStorageService = {
      getSimilarSessions: vi.fn().mockResolvedValue([]),
      logEvent: vi.fn().mockResolvedValue(undefined)
    };

    contextService = new ContextService(mockGitService, mockStorageService);
  });

  it('should collect context with git info', async () => {
    const commits = [{ hash: '123', message: 'test', author: 'me', date: new Date() }];
    (mockGitService.getRecentCommits as any).mockResolvedValue(commits);
    
    // Re-create service to pick up new mock
    contextService = new ContextService(mockGitService, mockStorageService);
    
    // Wait a bit for the constructor's refreshGitContext to complete (it's async)
    // Or we can manually trigger a refresh if we expose it, but we can't.
    // However, collectContext calls refreshGitContext if cache is null.
    // But constructor calls it too. Race condition.
    
    // Better approach: Wait for the promise in constructor? We can't.
    // Let's just wait a tick.
    await new Promise(resolve => setTimeout(resolve, 10));

    const context = await contextService.collectContext();

    expect(context.git.recentCommits).toEqual(commits);
    expect(context.git.currentBranch).toBe('main');
    expect(mockGitService.getRecentCommits).toHaveBeenCalled();
  });

  it('should emit contextCollected event', async () => {
    const spy = vi.fn();
    contextService.on('contextCollected', spy);

    await contextService.collectContext();

    expect(spy).toHaveBeenCalled();
  });
});
