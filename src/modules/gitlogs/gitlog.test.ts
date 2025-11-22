import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLogsWithGitlog } from './gitlog';
import * as vscode from 'vscode';

// Mock gitlog
// Since gitlog is ESM-only and we are in CJS/TS environment, we need to mock it carefully.
// The actual code uses `import { gitlogPromise } from 'gitlog'`, so we mock that named export.
const gitlogPromiseMock = vi.fn();
vi.mock('gitlog', () => ({
  default: {
    gitlogPromise: (...args: any[]) => gitlogPromiseMock(...args),
  },
  gitlogPromise: (...args: any[]) => gitlogPromiseMock(...args),
}));

// Mock vscode
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [],
  },
  Uri: {
    file: (path: string) => ({ fsPath: path }),
  },
}));

describe('GitLogs Module', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    gitlogPromiseMock.mockReset();
  });

  it('should throw error if no workspace folder is open', async () => {
    // Mock empty workspace folders
    (vscode.workspace as any).workspaceFolders = undefined;

    await expect(getLogsWithGitlog()).rejects.toThrow('No workspace folder found');
  });

  it('should retrieve git logs when workspace exists', async () => {
    // Mock workspace folder
    (vscode.workspace as any).workspaceFolders = [{
      uri: { fsPath: '/mock/workspace' }
    }];

    // Mock gitlog response
    const mockCommits = [
      { hash: '123', authorName: 'Dev', subject: 'Init' },
      { hash: '456', authorName: 'Dev', subject: 'Feat' }
    ];
    gitlogPromiseMock.mockResolvedValue(mockCommits as any);

    const logs = await getLogsWithGitlog();

    expect(logs).toHaveLength(2);
    expect(logs[0].subject).toBe('Init');
    expect(gitlogPromiseMock).toHaveBeenCalledWith(expect.objectContaining({
      repo: '/mock/workspace',
      number: 10
    }));
  });
});
