import * as vscode from "vscode";
import { getLogsWithGitlog } from "../gitlogs/gitlog";
import { readAllFilesHandler, FileData } from "../gitlogs/fileReader";
import { CloudflareClient, CloudflareLintResult } from "../cloudflare/client";
import { GeminiClient } from "../gemini/gemini-client";
import { ContextBuilder } from "../gemini/context-builder";
import { GeminiContext, Analysis } from "../gemini/types";
import { EventEmitter } from "events";

export interface CollectedContext {
  git: { commits: any[]; currentBranch?: string; uncommittedChanges?: any[] };
  files: {
    allFiles: FileData[];
    activeFile?: string;
    activeFileContent?: string;
    openFiles: string[];
    recentlyEdited: Array<{ file: string; timestamp: Date }>;
  };
  workspace: {
    rootPath?: string;
    cursor?: { file: string; line: number; column: number };
  };
  session: { startTime: Date; totalEdits: number };
}

export interface FileAnalysisResult {
  filePath: string;
  lintResult: CloudflareLintResult | null;
  geminiAnalysis: Analysis | null;
  errors: string[];
  fixAction?: {
    type: "auto" | "prompt" | "none";
    fixedCode: string;
    originalCode: string;
    reason: string;
  };
}

export interface PipelineResult {
  context: CollectedContext;
  fileAnalyses: FileAnalysisResult[];
  summary: {
    totalFiles: number;
    filesWithIssues: number;
    totalIssues: number;
    overallRiskLevel: "none" | "low" | "medium" | "high";
  };
}

export interface OrchestratorConfig {
  cloudflareWorkerUrl: string;
  geminiApiKey: string;
  analyzeAllFiles?: boolean;
  maxFilesToAnalyze?: number;
}

export class Orchestrator extends EventEmitter {
  private cloudflareClient: CloudflareClient;
  private geminiClient: GeminiClient;
  private config: OrchestratorConfig;
  private editHistory: Array<{ file: string; timestamp: Date }> = [];
  private sessionStartTime: Date = new Date();
  private totalEdits: number = 0;

  constructor(config: OrchestratorConfig) {
    super();
    this.config = config;
    this.cloudflareClient = new CloudflareClient(config.cloudflareWorkerUrl);
    this.geminiClient = new GeminiClient();
  }

  async initialize(): Promise<void> {
    if (this.config.geminiApiKey) await this.geminiClient.initialize(this.config.geminiApiKey);
    else this.geminiClient.enableMockMode();
    this.emit("initialized");
  }

  async collectContext(): Promise<CollectedContext> {
    this.emit("contextCollectionStarted");

    const context: CollectedContext = {
      git: { commits: [] },
      files: { allFiles: [], openFiles: [], recentlyEdited: [] },
      workspace: {},
      session: { startTime: this.sessionStartTime, totalEdits: this.totalEdits },
    };

    try {
      const commits = await getLogsWithGitlog();
      context.git.commits = commits || [];
    } catch {}

    try {
      const files = await readAllFilesHandler();
      context.files.allFiles = files || [];
    } catch {}

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      context.files.activeFile = activeEditor.document.fileName;
      context.files.activeFileContent = activeEditor.document.getText();
      context.workspace.cursor = {
        file: activeEditor.document.fileName,
        line: activeEditor.selection.active.line,
        column: activeEditor.selection.active.character,
      };
    }

    vscode.workspace.textDocuments.forEach((doc) => {
      if (!doc.isUntitled) context.files.openFiles.push(doc.fileName);
    });

    if (vscode.workspace.workspaceFolders?.[0]) {
      context.workspace.rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    context.files.recentlyEdited = this.editHistory.slice(-20);

    return context;
  }

  async runPipeline(): Promise<PipelineResult> {
    this.emit("pipelineStarted");
    try {
      const context = await this.collectContext();
      const filesToAnalyze = this.getFilesToAnalyze(context);

      const fileAnalyses: FileAnalysisResult[] = [];
      for (const file of filesToAnalyze) {
        const result = await this.analyzeFile(file, context);
        fileAnalyses.push(result);
      }

      const result: PipelineResult = {
        context,
        fileAnalyses,
        summary: this.generateSummary(fileAnalyses),
      };

      this.emit("pipelineComplete", result);
      return result;
    } catch (error) {
      this.emit("pipelineError", error);
      throw error;
    }
  }

  private async analyzeFile(file: FileData, context: CollectedContext): Promise<FileAnalysisResult> {
    const errors: string[] = [];
    let lintResult: CloudflareLintResult | null = null;
    let geminiAnalysis: Analysis | null = null;

    try {
      lintResult = await this.cloudflareClient.lint(file.content);
    } catch {
      errors.push("Cloudflare lint timeout/failure");
    }

    const analysis: FileAnalysisResult = {
      filePath: file.filePath,
      lintResult,
      geminiAnalysis,
      errors,
    };

    // SMART FIX — detect auto vs prompt vs none
    if (lintResult?.fixed && lintResult.linted) {
      const original = file.content;
      const fixed = lintResult.fixed;
      const diff = Math.abs(fixed.length - original.length);

      let type: "auto" | "prompt" | "none" = "none";
      let reason = "";

      if (lintResult.severity === "high") {
        type = "none";
        reason = "High-risk or security-sensitive change";
      } else if (diff < 20 && (lintResult.severity === "low" || lintResult.severity === "medium")) {
        type = "auto";
        reason = "Minor safe formatting or style fix";
        file.content = fixed;
      } else {
        type = "prompt";
        reason = "Potential code-behavior change";
      }

      analysis.fixAction = { type, fixedCode: fixed, originalCode: original, reason };
    }

    // Build proper GeminiContext using ContextBuilder
    const rawLogInput = {
      gitLogs: context.git.commits
        .slice(0, 10)
        .map((commit: any) => {
          if (typeof commit === "string") return commit;
          return `${commit.hash || ""} - ${commit.subject || commit.message || ""}`;
        }),
      gitDiff: "",
      openFiles: context.files.openFiles,
      activeFile: file.filePath,
      errors: lintResult?.warnings?.map((w) => w.message) || [],
      editHistory: context.files.recentlyEdited.map((e) => ({
        file: e.file,
        timestamp: e.timestamp.getTime(),
      })),
      fileContents: new Map<string, string>([[file.filePath, file.content]]),
      workspaceRoot: context.workspace.rootPath,
    };

    const gemContext: GeminiContext = ContextBuilder.build(rawLogInput);

    try {
      const codeForGemini = analysis.fixAction?.type === "auto" ? analysis.fixAction.fixedCode : file.content;
      geminiAnalysis = await this.geminiClient.analyzeCode(codeForGemini, gemContext);
      analysis.geminiAnalysis = geminiAnalysis;

      // SMART OVERRIDE: Gemini confirms prompt-level change → promote to auto
      // If Gemini analysis shows low risk and few issues, it's likely safe
      if (analysis.fixAction?.type === "prompt" && geminiAnalysis) {
        const isLowRisk = geminiAnalysis.risk_level === "low";
        const hasFewIssues = (geminiAnalysis.issues?.length || 0) <= 2;
        const hasOnlyWarnings = geminiAnalysis.issues?.every(
          (issue) => issue.severity === "warning" || issue.severity === "info"
        ) ?? false;

        if (isLowRisk && hasFewIssues && hasOnlyWarnings) {
          analysis.fixAction.type = "auto";
          analysis.fixAction.reason = "Confirmed by Gemini deep analysis (low risk, minor issues)";
        }
      }
    } catch {
      errors.push("Gemini analysis failed");
    }

    return analysis;
  }

  private getFilesToAnalyze(context: CollectedContext): FileData[] {
    if (this.config.analyzeAllFiles) return context.files.allFiles.slice(0, this.config.maxFilesToAnalyze || 50);

    const active = context.files.activeFile;
    if (!active) return [];
    const file = context.files.allFiles.find((f) => f.filePath === active || f.filePath.endsWith(active));
    if (file) return [file];
    if (context.files.activeFileContent) return [{ filePath: active, content: context.files.activeFileContent }];
    return [];
  }

  private generateSummary(files: FileAnalysisResult[]) {
    let totalIssues = 0;
    let filesWithIssues = 0;
    let overall: "none" | "low" | "medium" | "high" = "none";
    const score: Record<"none" | "low" | "medium" | "high", number> = { none: 0, low: 1, medium: 2, high: 3 };

    for (const f of files) {
      const lintIssues = f.lintResult?.warnings.length || 0;
      const aiIssues = f.geminiAnalysis?.issues?.length || 0;
      const hasIssues = lintIssues + aiIssues > 0;

      if (hasIssues) filesWithIssues++;
      totalIssues += lintIssues + aiIssues;

      const lintSeverity = (f.lintResult?.severity || "none") as "none" | "low" | "medium" | "high";
      const geminiRisk = (f.geminiAnalysis?.risk_level || "none") as "none" | "low" | "medium" | "high";
      const levels: Array<"none" | "low" | "medium" | "high"> = [lintSeverity, geminiRisk];
      const max = levels.reduce((a, b) => (score[b] > score[a] ? b : a), "none" as "none" | "low" | "medium" | "high");
      if (score[max] > score[overall]) overall = max;
    }

    return { totalFiles: files.length, filesWithIssues, totalIssues, overallRiskLevel: overall };
  }
}
