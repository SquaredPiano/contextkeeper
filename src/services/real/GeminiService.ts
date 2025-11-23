import { IAIService, DeveloperContext, AIAnalysis, CodeFix } from '../interfaces';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { EventEmitter } from 'events';

export class GeminiService extends EventEmitter implements IAIService {
  private genAI: GoogleGenerativeAI | undefined;
  private model: GenerativeModel | undefined;
  private embeddingModel: GenerativeModel | undefined;
  private isInitialized: boolean = false;

  constructor() {
    super();
  }

  async initialize(apiKey: string): Promise<void> {
    if (!apiKey) {
      console.warn("GeminiService: No API key provided.");
      return;
    }
    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      const modelName = "gemini-2.0-flash";
      console.log(`[GeminiService] Initializing with model: ${modelName}`);
      this.model = this.genAI.getGenerativeModel({ model: modelName });
      this.embeddingModel = this.genAI.getGenerativeModel({ model: "text-embedding-004" });
      this.isInitialized = true;
      console.log(`[GeminiService] Initialized successfully with model: ${modelName}`);
    } catch (error) {
      console.error("Failed to initialize GeminiService:", error);
    }
  }

  async analyze(code: string, context: DeveloperContext): Promise<AIAnalysis> {
    if (!this.isInitialized || !this.model) {
      throw new Error("GeminiService not initialized");
    }

    this.emit('analysisStarted');

    try {
      const prompt = `
        Analyze the following code snippet and provided developer context.
        Identify potential issues, bugs, or improvements.
        
        Context:
        - Active File: ${context.files.activeFile}
        - Recent Commits: ${context.git.recentCommits.map(c => c.message).join(', ')}
        
        Code:
        \`\`\`
        ${code}
        \`\`\`
        
        Return the response as a JSON object with the following structure:
        {
          "issues": [{ "line": number, "message": "string", "severity": "error" | "warning" }],
          "suggestions": ["string"],
          "riskLevel": "low" | "medium" | "high",
          "confidence": number
        }
      `;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Clean up markdown code blocks if present
      const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const analysisData = JSON.parse(jsonString);

      const analysis: AIAnalysis = {
        issues: analysisData.issues.map((i: any, idx: number) => ({
          id: `issue-${Date.now()}-${idx}`,
          file: context.files.activeFile,
          line: i.line,
          column: 0,
          severity: i.severity,
          message: i.message
        })),
        suggestions: analysisData.suggestions.map((s: string) => ({
          type: 'refactor',
          message: s
        })),
        riskLevel: analysisData.riskLevel,
        confidence: analysisData.confidence,
        timestamp: new Date()
      };

      this.emit('analysisComplete', analysis);
      return analysis;

    } catch (error: any) {
      console.error("Gemini Analysis Error:", error);
      this.emit('error', error);
      throw error;
    }
  }

  async generateTests(code: string, language?: string, framework?: string): Promise<string> {
    if (!this.isInitialized || !this.model) { throw new Error("GeminiService not initialized"); }

    // Determine appropriate test framework based on language
    let testFramework = framework;
    if (!testFramework) {
      // Default frameworks by language
      const defaultFrameworks: Record<string, string> = {
        'typescript': 'Jest',
        'javascript': 'Jest',
        'python': 'pytest',
        'java': 'JUnit',
        'go': 'Go testing',
        'rust': 'Rust testing',
        'cpp': 'Catch2',
        'c': 'Unity or assert.h',
        'csharp': 'NUnit'
      };
      testFramework = defaultFrameworks[language || 'typescript'] || 'Jest';
    }

    const prompt = `Generate comprehensive unit tests for the following ${language || 'code'} using ${testFramework}.

Code:
\`\`\`${language || ''}
${code}
\`\`\`

Requirements:
- Include tests for normal cases
- Include tests for edge cases
- Include tests for error conditions
- Use descriptive test names
- Generate complete, runnable test code
- For C code, use Unity testing framework or standard assert.h if Unity is not available

Generate only the test code, no explanations:`;
    
    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }

  async fixError(code: string, error: string): Promise<CodeFix> {
    if (!this.isInitialized || !this.model) { throw new Error("GeminiService not initialized"); }

    const prompt = `Analyze the following error in the code and provide guidance on how to fix it. DO NOT generate or provide fixed code - only explain what's wrong and how to fix it.\n\nError: ${error}\n\nCode:\n${code}\n\nProvide a detailed explanation without any code examples.`;
    const result = await this.model.generateContent(prompt);
    const explanation = result.response.text().trim();

    // Always return original code unchanged - only provide suggestions
    return {
      fixedCode: code, // Return original code - no implementation
      explanation: explanation || "Error analysis completed. Please review and apply fixes manually.",
      diff: ""
    };
  }

  async explainCode(code: string): Promise<string> {
    if (!this.isInitialized || !this.model) { throw new Error("GeminiService not initialized"); }

    const prompt = `Explain what this code does concisely:\n\n${code}`;
    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }

  async summarize(text: string): Promise<string> {
    if (!this.isInitialized || !this.model) { throw new Error("GeminiService not initialized"); }

    const prompt = `Summarize the following developer activity log into a concise, natural language update (2-3 sentences) for the developer who is returning to work. Focus on what they were doing last and where they left off. Address the developer directly as "You".\n\nActivity Log:\n${text}`;
    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }

  async plan(goal: string, context: DeveloperContext): Promise<string> {
    if (!this.isInitialized || !this.model) { throw new Error("GeminiService not initialized"); }

    const prompt = `
      You are an autonomous coding agent.
      Goal: ${goal}
      
      Context:
      - Active File: ${context.files.activeFile}
      - Recent Commits: ${context.git.recentCommits.map(c => c.message).join(', ')}
      - Recent Edits: ${context.files.recentlyEdited.map(f => f.file).join(', ')}
      
      Based on this context, propose a high-level plan (one short sentence) to achieve the goal.
      Examples:
      - "Run auto-lint to fix style issues."
      - "Generate unit tests for the new auth module."
      - "Fix the type error in the user controller."
      
      Plan:
    `;
    
    const result = await this.model.generateContent(prompt);
    return result.response.text().trim();
  }

  async getEmbedding(text: string): Promise<number[]> {
    if (!this.isInitialized || !this.embeddingModel) {
      console.warn("GeminiService not initialized for embeddings, returning mock.");
      return new Array(768).fill(0); // Mock 768-dim vector
    }

    try {
      const result = await this.embeddingModel.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error("Embedding generation failed:", error);
      return new Array(768).fill(0);
    }
  }
}
