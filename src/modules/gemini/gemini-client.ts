import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { PromptTemplates } from './prompts';
import { GeminiContext, Analysis, CodeFix, BatchAnalysisResult, GeminiModule } from './types';
import { parseJsonFromText } from './utils';

export class GeminiClient implements GeminiModule {
  private apiKey: string = "";
  private modelName: string = "gemini-2.0-flash";
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private ready = false;
  private lastRequestTime = 0;
  private minRequestInterval = 5000; // 5 seconds between requests to be safe

  async initialize(apiKey: string, modelName: string = "gemini-2.0-flash"): Promise<void> {
    console.log(`[GeminiClient] Initializing with model: ${modelName}`);
    this.apiKey = apiKey;
    
    // If already in mock mode, don't create real client
    if (this.modelName === "mock") {
      this.ready = true;
      return;
    }
    
    this.modelName = modelName;
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    console.log(`[GeminiClient] Creating model instance with name: ${this.modelName}`);
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });
    console.log(`[GeminiClient] Model initialized successfully`);
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  enableMockMode(): void {
    this.modelName = "mock";
    this.model = null; // Ensure we don't use the real model
    this.genAI = null; // Don't create real API client
    // Don't set ready here - let initialize() do it, or set it manually if not calling initialize
  }

  private async rateLimit() {
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;
    if (timeSinceLast < this.minRequestInterval) {
      const wait = this.minRequestInterval - timeSinceLast;
      await new Promise(resolve => setTimeout(resolve, wait));
    }
    this.lastRequestTime = Date.now();
  }

  async getEmbedding(text: string): Promise<number[]> {
    if (!this.ready || !this.genAI) {
      throw new Error("GeminiClient not initialized");
    }
    
    await this.rateLimit();

    if (this.modelName === "mock") {
      return new Array(768).fill(0.1);
    }

    try {
      const embeddingModel = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const result = await embeddingModel.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error("Gemini embedding generation failed:", error);
      throw error;
    }
  }

  async runBatch(files: Map<string, string>, context: GeminiContext): Promise<BatchAnalysisResult> {
    if (!this.ready) { throw new Error("GeminiClient not initialized"); }
    
    await this.rateLimit();

    if (this.modelName === "mock") {
      return {
        globalSummary: "Mock batch analysis",
        files: Array.from(files.keys()).map(f => ({
          file: f,
          analysis: { issues: [], suggestions: [], risk_level: 'low' },
          generatedTests: "// Mock tests",
          suggestedFixes: []
        }))
      };
    }

    const prompt = PromptTemplates.batchProcess(files, context);

    try {
      if (!this.model) { throw new Error("Model not initialized"); }
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      return this.parseBatchResponse(text);
    } catch (error) {
      console.error("Gemini batch analysis failed:", error);
      throw error;
    }
  }

  private parseBatchResponse(text: string): BatchAnalysisResult {
    return parseJsonFromText<BatchAnalysisResult>(text, {
      globalSummary: "Failed to parse AI response",
      files: []
    });
  }

  async analyzeCode(code: string, context: GeminiContext): Promise<Analysis> {
    if (!this.ready) {
      throw new Error("GeminiClient not initialized");
    }
    
    await this.rateLimit();

    if (this.modelName === "mock") {
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
      if (!this.model) { throw new Error("Model not initialized"); }
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      return this.parseAnalysis(text);
    } catch (error) {
      console.error("Gemini analysis failed:", error);
      throw error;
    }
  }

  private parseAnalysis(text: string): Analysis {
    const fallback: Analysis = {
      issues: [],
      suggestions: ["Failed to parse AI response. Please try again."],
      risk_level: 'low',
      summary: "Error parsing AI response."
    };

    const parsed = parseJsonFromText<any>(text, fallback);
    
    // Ensure structure even if parsed correctly but missing fields
    return {
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      risk_level: parsed.risk_level || 'low',
      summary: parsed.summary,
      context_analysis: parsed.context_analysis
    };
  }

  async generateTests(functionCode: string): Promise<string> {
    if (!this.ready) {throw new Error("GeminiClient not initialized");}

    await this.rateLimit();

    if (this.modelName === "mock") {
      return `
describe('generatedTest', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});`;
    }

    const prompt = PromptTemplates.testGeneration(functionCode);
    
    try {
      if (!this.model) { throw new Error("Model not initialized"); }
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Gemini test generation failed:", error);
      throw error;
    }
  }

  async fixError(code: string, error: string): Promise<CodeFix> {
    if (!this.ready) {throw new Error("GeminiClient not initialized");}

    await this.rateLimit();

    if (this.modelName === "mock") {
      return {
        fixedCode: code, // Return original code unchanged
        confidence: 0.9,
        explanation: "Mock analysis: Error identified. Please review the code and apply fixes manually."
      };
    }

    const prompt = PromptTemplates.errorFix(code, error);
    
    try {
      if (!this.model) { throw new Error("Model not initialized"); }
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const fallback: CodeFix = {
        fixedCode: code, // Return original code unchanged - no implementation
        confidence: 0,
        explanation: "Failed to parse fix response. Please review the error manually."
      };

      const parsed = parseJsonFromText<CodeFix>(text, fallback);
      
      // Always return original code to prevent any implementation
      // Only provide suggestions in explanation
      return {
        fixedCode: code, // Never return modified code
        confidence: parsed.confidence || 0,
        explanation: parsed.explanation || "Analysis completed. Please review and apply fixes manually."
      };
    } catch (error) {
      console.error("Gemini error fix failed:", error);
      // Return original code unchanged on error
      return {
        fixedCode: code,
        confidence: 0,
        explanation: "Error analysis failed. Please review the error manually."
      };
    }
  }

  /**
   * Generate idle improvements: tests, summary, and recommendations (NO code patches)
   */
  async generateIdleImprovements(context: GeminiContext): Promise<import("../idle-detector/idle-service").IdleImprovementsResult> {
    if (!this.ready) {
      throw new Error("GeminiClient not initialized");
    }

    await this.rateLimit();

    if (this.modelName === "mock") {
      return {
        summary: "Mock idle improvements analysis completed. Found potential areas for improvement.",
        tests: ["// Mock test file 1", "// Mock test file 2"],
        recommendations: [
          { priority: "medium" as const, message: "Mock recommendation: Consider adding error handling" },
          { priority: "low" as const, message: "Mock recommendation: Add more comments for clarity" }
        ]
      };
    }

    const prompt = PromptTemplates.idleImprovements(context);

    try {
      if (!this.model) { throw new Error("Model not initialized"); }
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return this.parseIdleImprovements(text);
    } catch (error) {
      console.error("Gemini idle improvements generation failed:", error);
      throw error;
    }
  }

  private parseIdleImprovements(text: string): import("../idle-detector/idle-service").IdleImprovementsResult {
    const fallback: import("../idle-detector/idle-service").IdleImprovementsResult = {
      summary: "Analysis completed. No specific improvements identified at this time.",
      tests: [],
      recommendations: []
    };

    try {
      const parsed = parseJsonFromText<any>(text, fallback);
      
      return {
        summary: parsed.summary || fallback.summary,
        tests: Array.isArray(parsed.tests) ? parsed.tests : fallback.tests,
        recommendations: Array.isArray(parsed.recommendations) 
          ? parsed.recommendations.filter((r: any) => 
              r && r.priority && ['high', 'medium', 'low'].includes(r.priority) && r.message
            ).map((r: any) => ({
              priority: r.priority as 'high' | 'medium' | 'low',
              message: r.message || ''
            }))
          : fallback.recommendations
      };
    } catch (error) {
      console.error("Failed to parse idle improvements response:", error);
      return fallback;
    }
  }
}
