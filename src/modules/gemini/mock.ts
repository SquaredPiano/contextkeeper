import { GeminiModule } from './index';

interface Analysis {
  issues: Array<{ line: number; severity: string; message: string }>;
  suggestions: string[];
  risk_level: string;
}

export class MockGemini implements GeminiModule {
  async initialize(apiKey: string): Promise<void> {
    // Mock initialization
  }

  isReady(): boolean {
    return true;
  }

  enableMockMode(): void {
    // Already in mock mode
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

  async fixError(code: string, error: string): Promise<{ fixedCode: string; confidence: number }> {
    return {
      fixedCode: code,
      confidence: 0.8
    };
  }
}

