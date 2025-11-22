import { GeminiModule } from './index';
import { Analysis, CodeFix } from './types';

export class MockGemini implements GeminiModule {
  async initialize(apiKey: string, modelName?: string): Promise<void> {
    // Mock initialization
  }

  isReady(): boolean {
    return true;
  }

  enableMockMode(): void {
    // Already in mock mode
  }

  async getEmbedding(text: string): Promise<number[]> {
    // Return a mock embedding (vector of 768 zeros)
    return new Array(768).fill(0);
  }

  async analyzeCode(code: string, context?: any): Promise<Analysis> {
    return {
      issues: [
        { line: 10, severity: 'error', message: 'Undefined variable "user"' },
        { line: 15, severity: 'warning', message: 'Missing null check' }
      ],
      suggestions: ['Add input validation', 'Use async/await'],
      risk_level: 'medium'
    };
  }
  
  async generateTests(functionCode: string): Promise<string> {
    return `
describe('calculateTotal', () => {
  it('should calculate sum correctly', () => {
    expect(calculateTotal([1, 2, 3])).toBe(6);
  });
  
  it('should handle empty array', () => {
    expect(calculateTotal([])).toBe(0);
  });
});
    `.trim();
  }

  async fixError(code: string, error: string): Promise<CodeFix> {
    return {
      fixedCode: code,
      confidence: 0.8
    };
  }
}

