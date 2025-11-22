import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiClient } from './gemini-client';
import { GeminiContext } from './types';

// Mock GoogleGenerativeAI
const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent
}));

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel = mockGetGenerativeModel;
    }
  };
});

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

    const mockResponseText = JSON.stringify({
      issues: [{ line: 1, severity: 'error', message: 'Test error' }],
      suggestions: ['Fix it'],
      risk_level: 'high',
      summary: 'Test summary'
    });

    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => mockResponseText
      }
    });

    const result = await client.analyzeCode('const x = 1;', mockContext);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toBe('Test error');
    expect(result.risk_level).toBe('high');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('should handle markdown code blocks in response', async () => {
    await client.initialize('test-key');

    const jsonContent = JSON.stringify({
      issues: [],
      suggestions: [],
      risk_level: 'low'
    });

    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => `\`\`\`json\n${jsonContent}\n\`\`\``
      }
    });

    const result = await client.analyzeCode('const x = 1;', mockContext);
    expect(result.risk_level).toBe('low');
  });

  it('should handle API errors', async () => {
    await client.initialize('test-key');

    mockGenerateContent.mockRejectedValue(new Error('API Error'));

    await expect(client.analyzeCode('code', mockContext)).rejects.toThrow('API Error');
  });

  it('should generate tests', async () => {
    await client.initialize('test-key');
    
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'describe("test", () => {});'
      }
    });

    const tests = await client.generateTests('function foo() {}');
    expect(tests).toBe('describe("test", () => {});');
  });

  it('should fix errors and parse JSON response', async () => {
    await client.initialize('test-key');
    
    const fixResponse = {
      fixedCode: 'fixed',
      confidence: 0.95,
      explanation: 'Fixed typo'
    };

    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify(fixResponse)
      }
    });

    const result = await client.fixError('broken', 'error');
    expect(result.fixedCode).toBe('fixed');
    expect(result.confidence).toBe(0.95);
    expect(result.explanation).toBe('Fixed typo');
  });
});
