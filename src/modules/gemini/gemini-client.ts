import { GeminiModule } from './index';
import { PromptTemplates } from './prompts';

interface CodeContext {
  recentCommits?: any[];
  fileChanges?: any[];
  activeFile?: string;
}

interface Analysis {
  issues: Array<{ line: number; severity: string; message: string }>;
  suggestions: string[];
  risk_level: string;
}

interface CodeFix {
  fixedCode: string;
  confidence: number;
}

export class GeminiClient implements GeminiModule {
  private apiKey: string = "";
  private model: string = "gemini-2.0-flash-exp";
  private ready = false;

  async initialize(apiKey: string): Promise<void> {
    this.apiKey = apiKey;
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  enableMockMode(): void {
    this.model = "mock";
  }

  async analyzeCode(code: string, context: CodeContext): Promise<Analysis> {
    if (!this.ready) {
      throw new Error("GeminiClient not initialized");
    }

    const prompt = PromptTemplates.codeAnalysis(code, context);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();
    return this.parseAnalysis(data);
  }

  private parseAnalysis(data: any): Analysis {
    // Parse Gemini response and extract structured data
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Simple parsing - in production, use more robust parsing
    return {
      issues: [],
      suggestions: [text.substring(0, 200)],
      risk_level: 'low'
    };
  }

  async generateTests(functionCode: string): Promise<string> {
    if (!this.ready) {throw new Error("GeminiClient not initialized");}

    const prompt = PromptTemplates.testGeneration(functionCode);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text;
  }

  async fixError(code: string, error: string): Promise<CodeFix> {
    if (!this.ready) {throw new Error("GeminiClient not initialized");}

    const prompt = PromptTemplates.errorFix(code, error);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();
    const fixedCode = data.candidates?.[0]?.content?.parts?.[0]?.text || code;
    
    return { 
      fixedCode, 
      confidence: 0.85 
    };
  }
}
