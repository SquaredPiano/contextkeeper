export class MockGemini implements GeminiModule {
  async analyzeCode(code: string): Promise<Analysis> {
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
}

