import { IAIService, DeveloperContext, AIAnalysis, CodeFix } from '../interfaces';
import { GeminiClient } from '../../modules/gemini/gemini-client';
import { ContextBuilder } from '../../modules/gemini/context-builder';
import { BatchAnalysisResult } from '../../modules/gemini/types';
import { EventEmitter } from 'events';
import * as vscode from 'vscode';

export class GeminiService extends EventEmitter implements IAIService {
  private client: GeminiClient;
  private isInitialized: boolean = false;
  private batchCache: Map<string, BatchAnalysisResult> = new Map();

  constructor() {
    super();
    this.client = new GeminiClient();
  }

  async initialize(apiKey: string): Promise<void> {
    await this.client.initialize(apiKey);
    this.isInitialized = true;
  }

  /**
   * Runs a batch analysis on the active file and potentially related files.
   * This leverages the large context window to get analysis, tests, and fixes in one go.
   */
  async analyze(code: string, context: DeveloperContext): Promise<AIAnalysis> {
    if (!this.isInitialized) {
      const error = new Error("GeminiService not initialized. Please check your API key settings.");
      this.emit('error', error);
      throw error;
    }

    this.emit('analysisStarted');

    try {
      const geminiContext = ContextBuilder.build({
        gitLogs: context.git.recentCommits.map(c => `${c.hash.substring(0,7)} - ${c.message}`),
        gitDiff: "", 
        openFiles: context.files.openFiles,
        activeFile: context.files.activeFile,
        errors: [],
        editHistory: context.files.recentlyEdited.map(e => ({ 
          file: e.file, 
          timestamp: e.timestamp.getTime() 
        }))
      });

      // Prepare batch payload
      const filesToAnalyze = new Map<string, string>();
      filesToAnalyze.set(context.files.activeFile, code);
      
      // In a real scenario, we would read related files here and add them to the map
      // For now, we focus on the active file but use the batch endpoint structure

      this.emit('analysisProgress', 20, 'Sending batch context to Gemini...');
      
      // Use runBatch instead of analyzeCode
      const batchResult = await this.client.runBatch(filesToAnalyze, geminiContext);
      
      // Cache the result for future use (e.g. generateTests calls)
      this.batchCache.set(context.files.activeFile, batchResult);

      this.emit('analysisProgress', 80, 'Processing batch results...');

      // Extract analysis for the active file
      const fileResult = batchResult.files.find(f => f.file === context.files.activeFile) || batchResult.files[0];
      
      if (!fileResult) {
        throw new Error("No analysis result found for active file");
      }

      const analysis: AIAnalysis = {
        issues: fileResult.analysis.issues.map((i, idx) => ({
          id: `issue-${idx}`,
          file: context.files.activeFile,
          line: i.line,
          column: 0,
          severity: (i.severity as 'error' | 'warning' | 'info') || 'warning',
          message: i.message
        })),
        suggestions: fileResult.analysis.suggestions.map(s => ({
          type: 'refactor',
          message: s
        })),
        riskLevel: (fileResult.analysis.risk_level as 'low' | 'medium' | 'high') || 'low',
        confidence: 0.9,
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
    
    // Check cache first
    // Note: In a real app, we'd need a better cache key than just the file content or path
    // For now, we assume the last analysis run populated the cache for the active file
    for (const [key, batch] of this.batchCache.entries()) {
      const fileResult = batch.files.find(f => f.generatedTests);
      if (fileResult && fileResult.generatedTests) {
        console.log("Returning cached tests from batch analysis");
        return fileResult.generatedTests;
      }
    }

    // Fallback to single call if not cached
    return this.client.generateTests(code);
  }

  async fixError(code: string, error: string): Promise<CodeFix> {
    if (!this.isInitialized) {throw new Error("GeminiService not initialized");}
    
    // Check cache for pre-calculated fixes
    // This is a simplification; matching specific errors to cached fixes is complex
    // For now, we'll fall back to the direct call for specific error fixes
    
    const fix = await this.client.fixError(code, error);
    return {
      fixedCode: fix.fixedCode,
      explanation: "Fixed by Gemini AI",
      diff: "" 
    };
  }

  async explainCode(code: string): Promise<string> {
    return "Explanation not implemented yet";
  }
}
