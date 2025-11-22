import { GeminiModule } from './index';
import { PromptTemplates } from './prompts';
import { GeminiContext, Analysis, CodeFix } from './types';

export class GeminiClient implements GeminiModule {
  private apiKey: string = "";
  private model: string = "gemini-2.0-flash";
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

  async analyzeCode(code: string, context: GeminiContext): Promise<Analysis> {
    if (!this.ready) {
      throw new Error("GeminiClient not initialized");
    }

    if (this.model === "mock") {
      return {
        issues: [
          { line: 1, severity: "warning", message: "Mock issue: Variable might be undefined" }
        ],
        suggestions: ["Add a null check"],
        risk_level: "low",
        summary: "Mock analysis result"
      };
    }

    const prompt = PromptTemplates.codeAnalysis(code, context);

    try {
      const response = await this.fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      return this.parseAnalysis(data);
    } catch (error) {
      console.error("Gemini analysis failed:", error);
      throw error;
    }
  }

  private async fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {return response;}
        
        console.warn(`Gemini API attempt ${i + 1} failed: ${response.status} ${response.statusText}`);
        
        // If 429 (Too Many Requests) or 5xx, retry
        if (response.status === 429 || response.status >= 500) {
          const delay = Math.pow(2, i) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        return response;
      } catch (error) {
        console.warn(`Gemini API network error attempt ${i + 1}:`, error);
        if (i === retries - 1) {throw error;}
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error("Max retries exceeded");
  }

  private parseAnalysis(data: any): Analysis {
    try {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Robust JSON extraction: find the first '{' and the last '}'
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      
      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error("No JSON object found in response");
      }
      
      const jsonStr = text.substring(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(jsonStr);
      
      return {
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        risk_level: parsed.risk_level || 'low',
        summary: parsed.summary
      };
    } catch (e) {
      console.warn("Failed to parse Gemini response:", e);
      console.warn("Raw response text:", data.candidates?.[0]?.content?.parts?.[0]?.text);
      
      // Fallback
      return {
        issues: [],
        suggestions: ["Failed to parse AI response. Please try again."],
        risk_level: 'low',
        summary: "Error parsing AI response."
      };
    }
  }

  async generateTests(functionCode: string): Promise<string> {
    if (!this.ready) {throw new Error("GeminiClient not initialized");}

    if (this.model === "mock") {
      return `
describe('generatedTest', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});`;
    }

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

    const data = await response.json() as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text;
  }

  async fixError(code: string, error: string): Promise<CodeFix> {
    if (!this.ready) {throw new Error("GeminiClient not initialized");}

    if (this.model === "mock") {
      return {
        fixedCode: code + "\n// Fixed by mock",
        confidence: 0.9
      };
    }

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

    const data = await response.json() as any;
    const fixedCode = data.candidates?.[0]?.content?.parts?.[0]?.text || code;
    
    return { 
      fixedCode, 
      confidence: 0.85 
    };
  }
}
