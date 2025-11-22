import * as vscode from "vscode";
import { getLogsWithGitlog } from "../gitlogs/gitlog";
import { readAllFilesHandler, FileData } from "../gitlogs/fileReader";
import { CloudflareClient, CloudflareLintResult } from "../cloudflare/client";
import { GeminiClient } from "../gemini/gemini-client";
import { ContextBuilder } from "../gemini/context-builder";
import { GeminiContext, Analysis, BatchAnalysisResult } from "../gemini/types";
import { LanceDBStorage } from "../../services/storage/storage";
import { EventEmitter } from "events";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * CollectedContext
 * Represents everything we capture from the user's coding session.
 * THIS is what we selectively send to our pipeline.
 * DO NOT add raw/bulk code here without sanitizing.
 */
export interface CollectedContext {
  git: { commits: any[]; currentBranch?: string; uncommittedChanges?: any[] };
  files: {
    allFiles: FileData[];
    activeFile?: string; // File user is currently editing
    activeFileContent?: string; // Snapshot of content (should be sanitized before sending)
    openFiles: string[]; // Visible, open tabs
    recentlyEdited: Array<{ file: string; timestamp: Date }>; // Timeline of file edits
  };
  workspace: {
    rootPath?: string; // Root project path
    cursor?: { file: string; line: number; column: number }; // User's cursor info for intent
  };
  session: { startTime: Date; totalEdits: number }; // Tracks how long they’ve been working + edit count
}

/**
 * Result for analyzing ONE file. Contains:
 *  - Cloudflare lint result
 *  - Gemini analysis result
 *  - Errors/warnings + auto-fix logic
 */
export interface FileAnalysisResult {
  filePath: string;
  lintResult: CloudflareLintResult | null;
  geminiAnalysis: Analysis | null;
  errors: string[];
  fixAction?: {
    type: "auto" | "prompt" | "none"; // Should we auto-fix + apply patch?
    fixedCode: string; // Suggested code
    originalCode: string;
    reason: string; // Explain why we auto/prompt/no-fix
  };
}

/**
 * Final output for pipeline run:
 *  - Context we captured
 *  - File analysis (for each file)
 *  - Summary analytics for UX
 */
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
  cloudflareWorkerUrl: string; // Where we send sanitized code for linting
  geminiApiKey: string; // Key for Gemini reasoning
  analyzeAllFiles?: boolean; // Analyze whole workspace vs only active file
  maxFilesToAnalyze?: number; // Prevent slow pipeline on large repos
}

/**
 * Orchestrator is the “conductor” of our pipeline.
 * It:
 *  1. Collects context from VSCode
 *  2. Sends code to Cloudflare lint
 *  3. Sends code to Gemini
 *  4. Emits events to UI or logs
 */
export class Orchestrator extends EventEmitter {
  private cloudflareClient: CloudflareClient;
  private geminiClient: GeminiClient;
  private storage: LanceDBStorage;
  private config: OrchestratorConfig;

  // Tracks user editing history for context reconstruction
  private editHistory: Array<{ file: string; timestamp: Date }> = [];
  private sessionStartTime: Date = new Date();
  private totalEdits: number = 0;

  constructor(config: OrchestratorConfig) {
    super();
    this.config = config;
    this.cloudflareClient = new CloudflareClient(config.cloudflareWorkerUrl);
    this.geminiClient = new GeminiClient();
    this.storage = new LanceDBStorage();
  }

  /**
   * Initialize pipeline. If no Gemini key, use mock mode for testing.
   */
  async initialize(): Promise<void> {
    if (this.config.geminiApiKey) await this.geminiClient.initialize(this.config.geminiApiKey);
    else this.geminiClient.enableMockMode();

    try {
      await this.storage.connect();
    } catch (e) {
      console.warn("Failed to connect to LanceDB:", e);
    }

    this.emit("initialized");
  }

  /**
   * Collects everything we know about the workspace right now.
   * This should be LIGHT and SANITIZED before sending anywhere.
   */
  async collectContext(): Promise<CollectedContext> {
    this.emit("contextCollectionStarted");

    const context: CollectedContext = {
      git: { commits: [] },
      files: { allFiles: [], openFiles: [], recentlyEdited: [] },
      workspace: {},
      session: { startTime: this.sessionStartTime, totalEdits: this.totalEdits },
    };

    // Try git logs
    try {
      const commits = await getLogsWithGitlog();
      context.git.commits = commits || [];
    } catch {}

    // Try reading workspace files (no raw full sends)
    try {
      const files = await readAllFilesHandler();
      context.files.allFiles = files || [];
    } catch {}

    // Capture active editor info (file + cursor)
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      context.files.activeFile = activeEditor.document.fileName;
      context.files.activeFileContent = activeEditor.document.getText(); // Should be sanitized!
      context.workspace.cursor = {
        file: activeEditor.document.fileName,
        line: activeEditor.selection.active.line,
        column: activeEditor.selection.active.character,
      };
    }

    // Track open files (tabs)
    vscode.workspace.textDocuments.forEach((doc) => {
      if (!doc.isUntitled) context.files.openFiles.push(doc.fileName);
    });

    // Root project folder
    if (vscode.workspace.workspaceFolders?.[0]) {
      context.workspace.rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    // Push recent edit history
    context.files.recentlyEdited = this.editHistory.slice(-20);

    return context;
  }

  /**
   * FULL PIPELINE RUN:
   *  - collect context
   *  - decide which files to analyze
   *  - send each file to lint + AI analysis
   *  - Uses batch processing when analyzing multiple files for efficiency
   */
  async runPipeline(): Promise<PipelineResult> {
    this.emit("pipelineStarted");
    try {
      const context = await this.collectContext();
      const filesToAnalyze = this.getFilesToAnalyze(context);

      if (filesToAnalyze.length === 0) {
        const result: PipelineResult = {
          context,
          fileAnalyses: [],
          summary: { totalFiles: 0, filesWithIssues: 0, totalIssues: 0, overallRiskLevel: "none" },
        };
        this.emit("pipelineComplete", result);
        return result;
      }

      // Use batch processing for multiple files, single file for one
      const fileAnalyses: FileAnalysisResult[] =
        filesToAnalyze.length > 1 && this.geminiClient.isReady()
          ? await this.analyzeFilesBatch(filesToAnalyze, context)
          : await this.analyzeFilesSequential(filesToAnalyze, context);

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

  /**
   * Analyze multiple files using batch processing (more efficient).
   * Falls back to sequential if batch fails.
   */
  private async analyzeFilesBatch(
    files: FileData[],
    context: CollectedContext
  ): Promise<FileAnalysisResult[]> {
    this.emit("pipelineProgress", `Using batch processing for ${files.length} files...`);

    // First, run Cloudflare linting for all files
    const lintResults = new Map<string, CloudflareLintResult | null>();
    for (const file of files) {
      try {
        const lintResult = await this.cloudflareClient.lint(file.content);
        lintResults.set(file.filePath, lintResult);
      } catch {
        lintResults.set(file.filePath, null);
      }
    }

    // Build context for batch processing
    const gemContext = await this.buildGeminiContextForFiles(files, context, lintResults);

    // Prepare file contents map for batch
    const fileContents = new Map<string, string>();
    for (const file of files) {
      // Use fixed code if auto-fix was applied
      const lintResult = lintResults.get(file.filePath);
      const content =
        lintResult?.fixed && lintResult.linted && lintResult.severity !== "high"
          ? lintResult.fixed
          : file.content;
      fileContents.set(file.filePath, content);
    }

    // Run batch analysis
    let batchResult: BatchAnalysisResult | null = null;
    try {
      if (this.geminiClient.isReady()) {
        batchResult = await this.geminiClient.runBatch(fileContents, gemContext);
      }
    } catch (error) {
      console.warn("[Orchestrator] Batch analysis failed, falling back to sequential:", error);
      return this.analyzeFilesSequential(files, context);
    }

    // Combine lint results with batch analysis results
    const fileAnalyses: FileAnalysisResult[] = files.map((file) => {
      const lintResult = lintResults.get(file.filePath) || null;
      const batchFileResult = batchResult?.files.find((f) => f.file === file.filePath);

      const analysis: FileAnalysisResult = {
        filePath: file.filePath,
        lintResult,
        geminiAnalysis: batchFileResult?.analysis || null,
        errors: [],
      };

      // Apply fix action logic
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
        } else {
          type = "prompt";
          reason = "Potential code-behavior change";
        }

        analysis.fixAction = { type, fixedCode: fixed, originalCode: original, reason };

        // Smart override with batch analysis
        if (type === "prompt" && batchFileResult?.analysis) {
          const geminiAnalysis = batchFileResult.analysis;
          const isLowRisk = geminiAnalysis.risk_level === "low";
          const hasFewIssues = (geminiAnalysis.issues?.length || 0) <= 2;
          const hasOnlyWarnings =
            geminiAnalysis.issues?.every(
              (issue) => issue.severity === "warning" || issue.severity === "info"
            ) ?? false;

          if (isLowRisk && hasFewIssues && hasOnlyWarnings) {
            analysis.fixAction.type = "auto";
            analysis.fixAction.reason = "Confirmed by Gemini deep analysis (low risk, minor issues)";
          }
        }
      }

      return analysis;
    });

    return fileAnalyses;
  }

  /**
   * Analyze files sequentially (one by one).
   * Used as fallback or for single file analysis.
   */
  private async analyzeFilesSequential(
    files: FileData[],
    context: CollectedContext
  ): Promise<FileAnalysisResult[]> {
    const fileAnalyses: FileAnalysisResult[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this.emit("pipelineProgress", `Analyzing ${file.filePath} (${i + 1}/${files.length})...`);
      const result = await this.analyzeFile(file, context);
      fileAnalyses.push(result);
    }
    return fileAnalyses;
  }

  /**
   * Analyze a single file.
   * Sends content to:
   *   1. Cloudflare lint service
   *   2. Gemini AI analysis
   * Applies auto-fix logic when safe.
   */
  private async analyzeFile(file: FileData, context: CollectedContext): Promise<FileAnalysisResult> {
    const errors: string[] = [];
    let lintResult: CloudflareLintResult | null = null;
    let geminiAnalysis: Analysis | null = null;

    // Try Cloudflare lint service
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

    /**
     * Decide whether to auto-apply a fix or ask user approval.
     * This logic prevents risky automatic edits. Smart AF.
     */
    if (lintResult?.fixed && lintResult.linted) {
      const original = file.content;
      const fixed = lintResult.fixed;
      const diff = Math.abs(fixed.length - original.length);

      let type: "auto" | "prompt" | "none" = "none";
      let reason = "";

      if (lintResult.severity === "high") {
        type = "none"; // Too risky to auto-change.
        reason = "High-risk or security-sensitive change";
      } else if (diff < 20 && (lintResult.severity === "low" || lintResult.severity === "medium")) {
        type = "auto"; // Tiny safe formatting fix → do it automatically
        reason = "Minor safe formatting or style fix";
        file.content = fixed; // Apply fix immediately
      } else {
        type = "prompt"; // Ask user if they want AI patch
        reason = "Potential code-behavior change";
      }

      analysis.fixAction = { type, fixedCode: fixed, originalCode: original, reason };
    }

    /** PREP CONTEXT FOR GEMINI **/
    const rawLogInput = await this.buildRawLogInput(file, context, lintResult);

    const gemContext: GeminiContext = await ContextBuilder.build(rawLogInput, this.storage);

    // Try Gemini analysis (only if ready)
    try {
      if (!this.geminiClient.isReady()) {
        errors.push("Gemini client not initialized");
      } else {
        // If we auto-fixed, analyze THAT. Otherwise analyze original.
        const codeForGemini = analysis.fixAction?.type === "auto" ? analysis.fixAction.fixedCode : file.content;
        geminiAnalysis = await this.geminiClient.analyzeCode(codeForGemini, gemContext);
        analysis.geminiAnalysis = geminiAnalysis;

      /**
       * Smart override:
       * If we originally asked the user to approve a fix,
       * but Gemini confirms it's low risk → auto-apply instead.
       */
      if (analysis.fixAction?.type === "prompt" && geminiAnalysis) {
        const isLowRisk = geminiAnalysis.risk_level === "low";
        const hasFewIssues = (geminiAnalysis.issues?.length || 0) <= 2;
        const hasOnlyWarnings =
          geminiAnalysis.issues?.every(
            (issue) => issue.severity === "warning" || issue.severity === "info"
          ) ?? false;

        if (isLowRisk && hasFewIssues && hasOnlyWarnings) {
          analysis.fixAction.type = "auto";
          analysis.fixAction.reason = "Confirmed by Gemini deep analysis (low risk, minor issues)";
        }
      }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Gemini analysis failed: ${errorMsg}`);
      console.warn(`[Orchestrator] Gemini analysis error for ${file.filePath}:`, error);
      // Continue without Gemini analysis - we still have lint results
    }

    return analysis;
  }

  /**
   * Build raw log input for ContextBuilder.
   * Includes git diff, project structure, and better context.
   */
  private async buildRawLogInput(
    file: FileData,
    context: CollectedContext,
    lintResult: CloudflareLintResult | null
  ): Promise<import("../gemini/types").RawLogInput> {
    // Get git diff for this file
    let gitDiff = "";
    if (context.workspace.rootPath) {
      try {
        const { stdout } = await execAsync(`git diff HEAD -- "${file.filePath}"`, {
          cwd: context.workspace.rootPath,
          timeout: 2000,
        });
        gitDiff = stdout || "";
      } catch {
        // Git diff failed, try unstaged changes
        try {
          const { stdout } = await execAsync(`git diff -- "${file.filePath}"`, {
            cwd: context.workspace.rootPath,
            timeout: 2000,
          });
          gitDiff = stdout || "";
        } catch {
          // No git diff available, continue without it
        }
      }
    }

    // Get project structure (package.json, tsconfig.json, etc.)
    const projectStructure = await this.getProjectStructure(context.workspace.rootPath);

    // Get dependencies from package.json if available
    const dependencies = await this.getDependencies(context.workspace.rootPath);

    return {
      gitLogs: context.git.commits.slice(0, 10).map((commit: any) => {
        if (typeof commit === "string") return commit;
        return `${commit.hash || ""} - ${commit.subject || commit.message || ""}`;
      }),
      gitDiff,
      openFiles: context.files.openFiles,
      activeFile: file.filePath,
      errors: lintResult?.warnings?.map((w) => w.message) || [],
      editHistory: context.files.recentlyEdited.map((e) => ({
        file: e.file,
        timestamp: e.timestamp.getTime(),
      })),
      fileContents: new Map<string, string>([[file.filePath, file.content]]),
      workspaceRoot: context.workspace.rootPath,
      projectStructure,
      dependencies,
    };
  }

  /**
   * Build Gemini context for batch processing.
   */
  private async buildGeminiContextForFiles(
    files: FileData[],
    context: CollectedContext,
    lintResults: Map<string, CloudflareLintResult | null>
  ): Promise<GeminiContext> {
    // Collect all errors from lint results
    const allErrors: string[] = [];
    for (const [filePath, lintResult] of lintResults.entries()) {
      if (lintResult?.warnings) {
        allErrors.push(...lintResult.warnings.map((w) => w.message));
      }
    }

    // Get git diff for all files (combined)
    let combinedGitDiff = "";
    if (context.workspace.rootPath) {
      try {
        const filePaths = files.map((f) => `"${f.filePath}"`).join(" ");
        const { stdout } = await execAsync(`git diff HEAD -- ${filePaths}`, {
          cwd: context.workspace.rootPath,
          timeout: 3000,
        });
        combinedGitDiff = stdout || "";
      } catch {
        // Try unstaged
        try {
          const filePaths = files.map((f) => `"${f.filePath}"`).join(" ");
          const { stdout } = await execAsync(`git diff -- ${filePaths}`, {
            cwd: context.workspace.rootPath,
            timeout: 3000,
          });
          combinedGitDiff = stdout || "";
        } catch {
          // No diff available
        }
      }
    }

    const projectStructure = await this.getProjectStructure(context.workspace.rootPath);
    const dependencies = await this.getDependencies(context.workspace.rootPath);

    const rawLogInput = {
      gitLogs: context.git.commits.slice(0, 10).map((commit: any) => {
        if (typeof commit === "string") return commit;
        return `${commit.hash || ""} - ${commit.subject || commit.message || ""}`;
      }),
      gitDiff: combinedGitDiff,
      openFiles: context.files.openFiles,
      activeFile: files[0]?.filePath || undefined,
      errors: allErrors.slice(0, 10), // Limit errors
      editHistory: context.files.recentlyEdited.map((e) => ({
        file: e.file,
        timestamp: e.timestamp.getTime(),
      })),
      fileContents: new Map<string, string>(),
      workspaceRoot: context.workspace.rootPath,
      projectStructure,
      dependencies,
    };

    return await ContextBuilder.build(rawLogInput, this.storage);
  }

  /**
   * Get project structure summary (package.json, tsconfig, etc.)
   */
  private async getProjectStructure(rootPath?: string): Promise<string | undefined> {
    if (!rootPath) return undefined;

    try {
      const fs = await import("fs/promises");
      const path = await import("path");

      const structure: string[] = [];

      // Check for package.json
      try {
        const packageJsonPath = path.join(rootPath, "package.json");
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
        structure.push(`Project: ${packageJson.name || "unknown"}`);
        structure.push(`Type: ${packageJson.type || "commonjs"}`);
        if (packageJson.scripts) {
          structure.push(`Scripts: ${Object.keys(packageJson.scripts).join(", ")}`);
        }
      } catch {
        // No package.json
      }

      // Check for TypeScript config
      try {
        const tsconfigPath = path.join(rootPath, "tsconfig.json");
        await fs.access(tsconfigPath);
        structure.push("TypeScript: configured");
      } catch {
        // No tsconfig
      }

      return structure.length > 0 ? structure.join("\n") : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Get dependencies from package.json
   */
  private async getDependencies(rootPath?: string): Promise<string[] | undefined> {
    if (!rootPath) return undefined;

    try {
      const fs = await import("fs/promises");
      const path = await import("path");
      const packageJsonPath = path.join(rootPath, "package.json");
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));

      const deps = [
        ...Object.keys(packageJson.dependencies || {}),
        ...Object.keys(packageJson.devDependencies || {}),
      ];

      return deps.length > 0 ? deps.slice(0, 20) : undefined; // Limit to 20
    } catch {
      return undefined;
    }
  }

  /**
   * Decide which files we should target.
   * If config tells us to analyze the whole workspace, do that.
   * Otherwise: prioritize the active file (fast + relevant).
   */
  private getFilesToAnalyze(context: CollectedContext): FileData[] {
    if (this.config.analyzeAllFiles) return context.files.allFiles.slice(0, this.config.maxFilesToAnalyze || 50);

    const active = context.files.activeFile;
    if (!active) return [];
    const file = context.files.allFiles.find((f) => f.filePath === active || f.filePath.endsWith(active));
    if (file) return [file];
    if (context.files.activeFileContent) return [{ filePath: active, content: context.files.activeFileContent }];
    return [];
  }

  /**
   * Creates a summary dashboard UI can use:
   * # of issues, severity, risk level.
   */
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

      // Pick the worst severity score
      const max = levels.reduce((a, b) => (score[b] > score[a] ? b : a), "none" as "none" | "low" | "medium" | "high");
      if (score[max] > score[overall]) overall = max;
    }

    return { totalFiles: files.length, filesWithIssues, totalIssues, overallRiskLevel: overall };
  }
}
