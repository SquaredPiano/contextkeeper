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
    if (!this.ready) throw new Error("GeminiClient not initialized");

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

  async generateTests(functionCode: string): Promise<string> {
    const prompt = PromptTemplates.testGeneration(functionCode);
    // your fetch here...
    return "TODO";
  }

  async fixError(code: string, error: string): Promise<CodeFix> {
    const prompt = PromptTemplates.errorFix(code, error);
    // your fetch here...
    return { fixedCode: "", confidence: 0 };
  }
}
