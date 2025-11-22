import { IAIService, DeveloperContext, AIAnalysis, CodeFix } from '../interfaces';
import { GeminiClient } from '../../modules/gemini/gemini-client';
import { ContextBuilder } from '../../modules/gemini/context-builder';
import { EventEmitter } from 'events';
import * as vscode from 'vscode';

export class GeminiService extends EventEmitter implements IAIService {
  private client: GeminiClient;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.client = new GeminiClient();
  }

  async initialize(apiKey: string): Promise<void> {
    await this.client.initialize(apiKey);
    this.isInitialized = true;
  }

  async analyze(code: string, context: DeveloperContext): Promise<AIAnalysis> {
    if (!this.isInitialized) {
      const error = new Error("GeminiService not initialized. Please check your API key settings.");
      this.emit('error', error);
      throw error;
    }

    this.emit('analysisStarted');

    try {
      // Convert DeveloperContext to GeminiContext
      // We map the rich DeveloperContext from the extension to the Gemini module's expected input
      const geminiContext = ContextBuilder.build({
        gitLogs: context.git.recentCommits.map(c => `${c.hash.substring(0,7)} - ${c.message}`),
        gitDiff: "", // TODO: Get actual diff if available in context
        openFiles: context.files.openFiles,
        activeFile: context.files.activeFile,
        errors: [], // TODO: Pass errors if available
        editHistory: context.files.recentlyEdited.map(e => ({ 
          file: e.file, 
          timestamp: e.timestamp.getTime() 
        }))
      });

      this.emit('analysisProgress', 20, 'Sending context to Gemini...');
      
      const result = await this.client.analyzeCode(code, geminiContext);
      
      this.emit('analysisProgress', 80, 'Processing results...');

      const analysis: AIAnalysis = {
        issues: result.issues.map((i, idx) => ({
          id: `issue-${idx}`,
          file: context.files.activeFile,
          line: i.line,
          column: 0,
          severity: (i.severity as 'error' | 'warning' | 'info') || 'warning',
          message: i.message
        })),
        suggestions: result.suggestions.map(s => ({
          type: 'refactor',
          message: s
        })),
        riskLevel: (result.risk_level as 'low' | 'medium' | 'high') || 'low',
        confidence: 0.9, // Placeholder
        timestamp: new Date()
      };

      this.emit('analysisComplete', analysis);
      return analysis;

    } catch (error: any) {
      console.error("GeminiService Analysis Error:", error);
      this.emit('error', error);
      throw error;
    }
  }

  async generateTests(code: string): Promise<string> {
    if (!this.isInitialized) {throw new Error("GeminiService not initialized");}
    return this.client.generateTests(code);
  }

  async fixError(code: string, error: string): Promise<CodeFix> {
    if (!this.isInitialized) {throw new Error("GeminiService not initialized");}
    
    const fix = await this.client.fixError(code, error);
    return {
      fixedCode: fix.fixedCode,
      explanation: "Fixed by Gemini AI",
      diff: "" // Optional
    };
  }

  async explainCode(code: string): Promise<string> {
    // TODO: Implement explain code in client
    return "Explanation not implemented yet";
  }
}
