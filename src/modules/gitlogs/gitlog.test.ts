import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitService } from './GitService';
import * as vscode from 'vscode';

// Mock gitlog
const gitlogPromiseMock = vi.fn();
vi.mock('gitlog', () => ({
  default: {
    gitlogPromise: (...args: any[]) => gitlogPromiseMock(...args),
  },
  gitlogPromise: (...args: any[]) => gitlogPromiseMock(...args),
}));

// Mock child_process and util
const execMock = vi.fn();

vi.mock('child_process', () => ({
  exec: (cmd: string, opts: any, cb: any) => execMock(cmd, opts, cb)
}));

vi.mock('util', () => ({
  promisify: (fn: any) => {
    // We can't access execMock here directly if it's not hoisted, 
    // but we can return a mock function that calls our execMock logic
    return async (cmd: string, opts: any) => {
      if (cmd.includes('git branch')) {
        return { stdout: 'feature-branch\n' };
      }
      return { stdout: '' };
    };
  }
}));

describe('GitService', () => {
  let gitService: GitService;
  const repoPath = '/mock/workspace';

  beforeEach(() => {
    vi.resetAllMocks();
    gitlogPromiseMock.mockReset();
    gitService = new GitService(repoPath);
  });

  it('should retrieve git logs', async () => {
    // Mock gitlog response
    const mockCommits = [
      { hash: '123', authorName: 'Dev', subject: 'Init', authorDate: '2023-01-01', files: ['README.md'] },
      { hash: '456', authorName: 'Dev', subject: 'Feat', authorDate: '2023-01-02', files: ['src/index.ts'] }
    ];
    gitlogPromiseMock.mockResolvedValue(mockCommits as any);

    const logs = await gitService.getRecentCommits();

    expect(logs).toHaveLength(2);
    expect(logs[0].message).toBe('Init');
    expect(logs[0].files).toContain('README.md');
    expect(gitlogPromiseMock).toHaveBeenCalledWith(expect.objectContaining({
      repo: repoPath,
      number: 10
    }));
  });

  it('should retrieve current branch', async () => {
    const branch = await gitService.getCurrentBranch();
    expect(branch).toBe('feature-branch');
  });

  it('should handle errors gracefully', async () => {
    gitlogPromiseMock.mockRejectedValue(new Error('Git error'));
    const logs = await gitService.getRecentCommits();
    expect(logs).toEqual([]);
  });
});
