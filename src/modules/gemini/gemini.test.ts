import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiClient } from './gemini-client';
import { GeminiContext } from './types';

// Mock global fetch
global.fetch = vi.fn();

describe('GeminiClient', () => {
  let client: GeminiClient;
  const mockContext: GeminiContext = {
    activeFile: 'test.ts',
    recentCommits: ['feat: test'],
    recentErrors: [],
    gitDiffSummary: '',
    editCount: 5,
    relatedFiles: []
  };

  beforeEach(() => {
    client = new GeminiClient();
    vi.clearAllMocks();
  });

  it('should initialize correctly', async () => {
    await client.initialize('test-key');
    expect(client.isReady()).toBe(true);
  });

  it('should throw if analyzing before initialization', async () => {
    await expect(client.analyzeCode('code', mockContext)).rejects.toThrow('GeminiClient not initialized');
  });

  it('should analyze code and parse response', async () => {
    await client.initialize('test-key');

    const mockResponse = {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              issues: [{ line: 1, severity: 'error', message: 'Test error' }],
              suggestions: ['Fix it'],
              risk_level: 'high',
              summary: 'Test summary'
            })
          }]
        }
      }]
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const result = await client.analyzeCode('const x = 1;', mockContext);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toBe('Test error');
    expect(result.risk_level).toBe('high');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle markdown code blocks in response', async () => {
    await client.initialize('test-key');

    const jsonContent = JSON.stringify({
      issues: [],
      suggestions: [],
      risk_level: 'low'
    });

    const mockResponse = {
      candidates: [{
        content: {
          parts: [{
            text: `\`\`\`json\n${jsonContent}\n\`\`\``
          }]
        }
      }]
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const result = await client.analyzeCode('const x = 1;', mockContext);
    expect(result.risk_level).toBe('low');
  });

  it('should handle API errors', async () => {
    await client.initialize('test-key');

    (global.fetch as any).mockResolvedValue({
      ok: false,
      statusText: 'Bad Request'
    });

    await expect(client.analyzeCode('code', mockContext)).rejects.toThrow('Gemini API error: Bad Request');
  });

  it('should retry on 500 errors', async () => {
    await client.initialize('test-key');

    const mockResponse = {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              issues: [],
              suggestions: [],
              risk_level: 'low'
            })
          }]
        }
      }]
    };

    let callCount = 0;
    (global.fetch as any).mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        return { ok: false, status: 500, statusText: 'Internal Server Error' };
      }
      return {
        ok: true,
        json: async () => mockResponse
      };
    });

    const result = await client.analyzeCode('code', mockContext);
    expect(callCount).toBe(3);
    expect(result.risk_level).toBe('low');
  });
});
