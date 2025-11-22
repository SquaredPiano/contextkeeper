import { describe, it, expect, vi } from 'vitest';
import { ContextBuilder } from './context-builder';
import { RawLogInput } from './types';
import { IStorageService } from '../../services/interfaces';

describe('ContextBuilder', () => {
  const mockStorage = {
    getSimilarSessions: vi.fn().mockResolvedValue([
      { summary: 'Previous session', timestamp: 1234567890 }
    ])
  } as unknown as IStorageService;

  const rawInput: RawLogInput = {
    gitLogs: ['commit 1', 'commit 2'],
    gitDiff: 'diff content',
    openFiles: ['file1.ts', 'file2.ts'],
    activeFile: 'file1.ts',
    errors: ['error 1'],
    editHistory: [{ file: 'file1.ts', timestamp: 123 }],
    fileContents: new Map([['file1.ts', 'content 1']])
  };

  it('should build context correctly', async () => {
    const context = await ContextBuilder.build(rawInput, mockStorage);

    expect(context.activeFile).toBe('file1.ts');
    expect(context.recentCommits).toEqual(['commit 1', 'commit 2']);
    expect(context.gitDiffSummary).toBe('diff content');
    expect(context.relatedFiles).toContain('file2.ts');
    expect(context.openFileContents?.get('file1.ts')).toBe('content 1');
    expect(context.relevantPastSessions).toHaveLength(1);
    expect(context.relevantPastSessions![0].summary).toBe('Previous session');
  });

  it('should truncate long git diffs', async () => {
    const longDiff = 'a'.repeat(9000);
    const input = { ...rawInput, gitDiff: longDiff };
    const context = await ContextBuilder.build(input, mockStorage);

    expect(context.gitDiffSummary).toContain('... [truncated]');
    expect(context.gitDiffSummary.length).toBeLessThan(9000);
  });

  it('should handle missing storage', async () => {
    const context = await ContextBuilder.build(rawInput);
    expect(context.relevantPastSessions).toEqual([]);
  });
});
