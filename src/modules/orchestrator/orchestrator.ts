import * as vscode from "vscode";
import { GitService } from "../gitlogs/GitService";
import { FileData } from "../gitlogs/fileReader";
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
  git: { 
    commits: Array<{ hash: string; message: string; author: string; date: Date; files?: string[] }>; 
    currentBranch?: string; 
    uncommittedChanges?: string[];
  };
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
  private totalEdits: number = 0; // User edits from events
  private aiEditsCount: number = 0; // AI-generated edits (tests + lint fixes)

  constructor(config: OrchestratorConfig) {
    super();
    this.config = config;
    this.cloudflareClient = new CloudflareClient(config.cloudflareWorkerUrl);
    this.geminiClient = new GeminiClient();
    this.storage = new LanceDBStorage();
  }

  /**
   * Track AI-generated edits (tests created + lint fixes applied)
   */
  incrementAIEdits(count: number = 1): void {
    this.aiEditsCount += count;
    console.log(`[Orchestrator] AI edits count: ${this.aiEditsCount}`);
  }

  getAIEditsCount(): number {
    return this.aiEditsCount;
  }

  /**
   * Initialize pipeline. If no Gemini key, use mock mode for testing.
   */
  async initialize(): Promise<void> {
    if (this.config.geminiApiKey) {
      // Explicitly use Gemini 2.0 Flash model
      await this.geminiClient.initialize(this.config.geminiApiKey, "gemini-2.0-flash");
    } else {
      this.geminiClient.enableMockMode();
    }

    try {
      await this.storage.connect();
    } catch (e) {
      console.warn("Failed to connect to LanceDB:", e);
    }

    this.emit("initialized");
  }

  /**
   * Collect MINIMAL, CURRENT-SESSION-ONLY context.
   * NO historical data, NO all-files scan, ONLY what's relevant right now.
   */
  async collectContext(): Promise<CollectedContext> {
    this.emit("contextCollectionStarted");

    const context: CollectedContext = {
      git: { commits: [], currentBranch: undefined, uncommittedChanges: [] },
      files: { allFiles: [], openFiles: [], recentlyEdited: [] },
      workspace: {},
      session: { startTime: this.sessionStartTime, totalEdits: this.totalEdits },
    };

    // Get workspace root path first
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      context.workspace.rootPath = workspaceRoot;

      // Collect git context - ONLY last 3 commits and uncommitted changes
      try {
        const gitService = new GitService(workspaceRoot);
        
        // Get ONLY last 3 commits (not 10)
        try {
          const commits = await gitService.getRecentCommits(3);
          context.git.commits = commits || [];
          console.log(`[Orchestrator] Loaded ${commits.length} recent commits (limited to current session)`);
        } catch (error) {
          console.warn('[Orchestrator] Failed to load commits:', error);
        }

        // Get current branch
        try {
          const branch = await gitService.getCurrentBranch();
          context.git.currentBranch = branch !== "unknown" ? branch : undefined;
        } catch (error) {
          console.warn('[Orchestrator] Failed to get branch:', error);
        }

        // Get uncommitted changes - this is the MOST relevant context
        try {
          const uncommitted = await gitService.getUncommittedChanges();
          context.git.uncommittedChanges = uncommitted || [];
          console.log(`[Orchestrator] Found ${uncommitted.length} uncommitted changes (current session)`);
        } catch (error) {
          console.warn('[Orchestrator] Failed to get uncommitted changes:', error);
        }
      } catch (error) {
        console.warn(`[Orchestrator] Git context collection failed:`, error);
      }
    }

    // DO NOT scan all files - only track what user is actively working on
    // Files are added to context.files.allFiles as user opens them

    // Capture ONLY active editor (the file user is currently on)
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      context.files.activeFile = activeEditor.document.fileName;
      context.files.activeFileContent = activeEditor.document.getText();
      context.workspace.cursor = {
        file: activeEditor.document.fileName,
        line: activeEditor.selection.active.line,
        column: activeEditor.selection.active.character,
      };
      
      // Add only the active file to allFiles
      context.files.allFiles = [{
        filePath: activeEditor.document.fileName,
        content: activeEditor.document.getText()
      }];
      
      console.log(`[Orchestrator] Active file: ${activeEditor.document.fileName}`);
    } else {
      console.warn('[Orchestrator] No active file');
    }

    // Track ONLY currently open tabs (not recently edited history)
    vscode.workspace.textDocuments.forEach((doc) => {
      if (!doc.isUntitled && doc.fileName !== context.files.activeFile) {
        context.files.openFiles.push(doc.fileName);
      }
    });

    // REMOVED: recentlyEdited history - causes irrelevant context pollution
    // REMOVED: readAllFilesHandler - causes massive irrelevant context

    console.log('[Orchestrator] Context collection complete (current session only)');
    return context;
  }

  /**
   * Validates that context was collected properly and logs warnings for missing data
   */
  private validateContext(context: CollectedContext): void {
    const warnings: string[] = [];

    if (context.git.commits.length === 0) {
      warnings.push("No git commits found");
    }
    if (!context.git.currentBranch) {
      warnings.push("Current git branch not available");
    }
    if (context.files.allFiles.length === 0) {
      warnings.push("No workspace files found");
    }
    if (!context.workspace.rootPath) {
      warnings.push("No workspace root path");
    }

    if (warnings.length > 0) {
      console.warn(`[Orchestrator] Context collection warnings: ${warnings.join(", ")}`);
      this.emit("contextCollectionWarning", { warnings });
    } else {
      console.log("[Orchestrator] Context collection completed successfully");
    }
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
      gitLogs: context.git.commits.slice(0, 10).map((commit) => {
        if (typeof commit === "string") {
          return commit;
        }
        return `${commit.hash || ""} - ${commit.message || ""}`;
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
    for (const [_filePath, lintResult] of lintResults.entries()) {
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
      gitLogs: context.git.commits.slice(0, 10).map((commit) => {
        if (typeof commit === "string") {
          return commit;
        }
        return `${commit.hash || ""} - ${commit.message || ""}`;
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
    if (!rootPath) {
      return undefined;
    }

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
    if (!rootPath) {
      return undefined;
    }

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
    if (this.config.analyzeAllFiles) {
      return context.files.allFiles.slice(0, this.config.maxFilesToAnalyze || 50);
    }

    const active = context.files.activeFile;
    if (!active) {
      return [];
    }
    const file = context.files.allFiles.find((f) => f.filePath === active || f.filePath.endsWith(active));
    if (file) {
      return [file];
    }
    if (context.files.activeFileContent) {
      return [{ filePath: active, content: context.files.activeFileContent }];
    }
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

      if (hasIssues) {
        filesWithIssues++;
      }
      totalIssues += lintIssues + aiIssues;

      const lintSeverity = (f.lintResult?.severity || "none") as "none" | "low" | "medium" | "high";
      const geminiRisk = (f.geminiAnalysis?.risk_level || "none") as "none" | "low" | "medium" | "high";
      const levels: Array<"none" | "low" | "medium" | "high"> = [lintSeverity, geminiRisk];

      // Pick the worst severity score
      const max = levels.reduce((a, b) => (score[b] > score[a] ? b : a), "none" as "none" | "low" | "medium" | "high");
      if (score[max] > score[overall]) {
        overall = max;
      }
    }

    return { totalFiles: files.length, filesWithIssues, totalIssues, overallRiskLevel: overall };
  }

  /**
   * Idle improvements workflow:
   * 1. Retrieve current context from VSCode (acts as "Cloudflare" current state)
   * 2. Query LanceDB for similar sessions and actions
   * 3. Merge both contexts
   * 4. Send unified context to Gemini for tests + summary + recommendations (NO patches)
   * 5. Return structured output
   */
  async analyzeForIdleImprovements(): Promise<import("../idle-detector/idle-service").IdleImprovementsResult | null> {
    this.emit("idleAnalysisStarted");

    try {
      // Step 1: Collect current context (current codebase state)
      const currentContext = await this.collectContext();
      console.log("[Orchestrator] Collected current context for idle improvements");

      // Step 2: Query LanceDB for RELEVANT historical context using AST-PARSED symbols
      // NOT generic queries - use actual function/class names from DocumentSymbol API
      let historicalSessions: Array<{ sessionId: string; summary: string; timestamp: string; projectName?: string; sessionData?: unknown }> = [];
      let historicalActions: Array<{ actionId: string; description: string; timestamp: string; metadata?: unknown }> = [];

      if (currentContext.files.activeFile && currentContext.files.activeFileContent) {
        try {
          // Extract specific identifiers using AST parsing (VS Code DocumentSymbol API)
          const fileName = currentContext.files.activeFile.split('/').pop() || '';
          const activeEditor = vscode.window.activeTextEditor;
          
          let identifiers: string[] = [];
          
          if (activeEditor && activeEditor.document.fileName === currentContext.files.activeFile) {
            // Use VS Code's DocumentSymbol API to get proper AST symbols
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
              'vscode.executeDocumentSymbolProvider',
              activeEditor.document.uri
            );
            
            if (symbols && symbols.length > 0) {
              // Extract function and class names from symbols
              const extractSymbolNames = (syms: vscode.DocumentSymbol[]): string[] => {
                const names: string[] = [];
                for (const sym of syms) {
                  // Only include functions, classes, methods, and interfaces
                  if (
                    sym.kind === vscode.SymbolKind.Function ||
                    sym.kind === vscode.SymbolKind.Class ||
                    sym.kind === vscode.SymbolKind.Method ||
                    sym.kind === vscode.SymbolKind.Interface
                  ) {
                    names.push(sym.name);
                  }
                  // Recursively extract from children
                  if (sym.children && sym.children.length > 0) {
                    names.push(...extractSymbolNames(sym.children));
                  }
                }
                return names;
              };
              
              identifiers = extractSymbolNames(symbols).slice(0, 5); // Top 5 symbols
              console.log(`[Orchestrator] Extracted ${identifiers.length} symbols from AST:`, identifiers);
            }
          }
          
          // Fallback: if no symbols found, skip historical search (better than generic queries)
          if (identifiers.length === 0) {
            console.log('[Orchestrator] No AST symbols found - skipping historical search to avoid irrelevant results');
            return null;
          }
          
          // Build SPECIFIC query from AST-parsed identifiers
          const specificQuery = `${fileName} ${identifiers.join(' ')}`;
          
          console.log(`[Orchestrator] 🔍 Vector search query: "${specificQuery}"`);

          // Query with the SPECIFIC context
          historicalSessions = await (this.storage as unknown as { getSimilarSessions: (query: string, limit: number) => Promise<Array<{ sessionId: string; summary: string; timestamp: string; projectName?: string; sessionData?: unknown }>> }).getSimilarSessions(specificQuery, 3);
          historicalActions = await (this.storage as unknown as { getSimilarActions: (query: string, limit: number) => Promise<Array<{ actionId: string; description: string; timestamp: string; metadata?: unknown }>> }).getSimilarActions(specificQuery, 3);

          console.log(`[Orchestrator] 📊 Vector search results: ${historicalSessions.length} sessions, ${historicalActions.length} actions (before filtering)`);

          // Filter results by semantic similarity threshold (0.7+) and time window (1 hour)
          const ONE_HOUR_MS = 60 * 60 * 1000;
          const now = Date.now();
          
          historicalSessions = historicalSessions.filter((s) => {
            const timestamp = typeof s.timestamp === 'string' ? Date.parse(s.timestamp) : s.timestamp;
            const isRecent = timestamp && (now - timestamp) < ONE_HOUR_MS;
            const hasScore = (s as { _distance?: number })._distance !== undefined;
            const isRelevant = !hasScore || ((s as unknown as { _distance: number })._distance >= 0.7); // Higher score = more similar
            
            if (!isRecent) {
              console.log(`[Orchestrator] ❌ Filtered out old session (timestamp: ${s.timestamp})`);
            } else if (hasScore && !isRelevant) {
              console.log(`[Orchestrator] ❌ Filtered out low-relevance session (score: ${(s as { _distance?: number })._distance})`);
            }
            
            return isRecent && isRelevant;
          });
          
          historicalActions = historicalActions.filter((a) => {
            const timestamp = typeof a.timestamp === 'string' ? Date.parse(a.timestamp) : a.timestamp;
            const isRecent = timestamp && (now - timestamp) < ONE_HOUR_MS;
            const hasScore = (a as { _distance?: number })._distance !== undefined;
            const isRelevant = !hasScore || ((a as unknown as { _distance: number })._distance >= 0.7);
            
            if (!isRecent) {
              console.log(`[Orchestrator] ❌ Filtered out old action (timestamp: ${a.timestamp})`);
            } else if (hasScore && !isRelevant) {
              console.log(`[Orchestrator] ❌ Filtered out low-relevance action (score: ${(a as { _distance?: number })._distance})`);
            }
            
            return isRecent && isRelevant;
          });

          console.log(`[Orchestrator] ✅ After filtering: ${historicalSessions.length} relevant sessions, ${historicalActions.length} relevant actions`);
          
          if (historicalSessions.length === 0 && historicalActions.length === 0) {
            console.log(`[Orchestrator] ⚠️  No relevant historical context found - proceeding with current context only`);
          }
        } catch (error) {
          console.warn("[Orchestrator] Failed to query historical context:", error);
          // Continue without historical context
        }
      } else {
        console.log('[Orchestrator] No active file - skipping historical context search');
      }

      // Step 3: Merge contexts - build unified context for Gemini
      // Historical context now includes ONLY relevant past work on same files/functions
      const unifiedContext = await this.buildUnifiedIdleContext(currentContext, historicalSessions, historicalActions);

      // Step 4: Send to Gemini with idle-specific prompt (tests + summary + recommendations only, NO patches)
      if (!this.geminiClient.isReady()) {
        console.warn("[Orchestrator] Gemini client not ready, skipping idle improvements");
        return null;
      }

      const result = await this.geminiClient.generateIdleImprovements(unifiedContext);

      // Step 5: Return structured output
      this.emit("idleAnalysisComplete", result);
      return result;

    } catch (error) {
      console.error("[Orchestrator] Idle improvements analysis failed:", error);
      this.emit("idleAnalysisError", error);
      return null;
    }
  }

  /**
   * Build unified context from current VSCode state + LanceDB historical data
   */
  private async buildUnifiedIdleContext(
    currentContext: CollectedContext,
    historicalSessions: Array<{ sessionId: string; summary: string; timestamp: string; projectName?: string; sessionData?: unknown }>,
    _historicalActions: Array<{ actionId: string; description: string; timestamp: string; metadata?: unknown }>
  ): Promise<GeminiContext> {
    // Format historical sessions - ONLY if they exist and are relevant
    const pastSessions = historicalSessions.length > 0 ? historicalSessions.map(s => ({
      summary: s.summary || "",
      timestamp: typeof s.timestamp === 'string' ? Date.parse(s.timestamp) : (s.timestamp || Date.now())
    })) : undefined;

    // Build git diff summary with ACTUAL DIFF CONTENT, not just file counts
    let gitDiffSummary = "";
    
    if (currentContext.files.activeFile && currentContext.workspace.rootPath) {
      try {
        // Get actual git diff for active file
        const { stdout } = await execAsync(`git diff HEAD -- "${currentContext.files.activeFile}"`, {
          cwd: currentContext.workspace.rootPath,
          timeout: 2000,
        });
        
        if (stdout && stdout.trim()) {
          // Include actual diff lines (limited to first 50 lines to avoid prompt bloat)
          const diffLines = stdout.trim().split('\n').slice(0, 50).join('\n');
          gitDiffSummary = `Active file diff:\n${diffLines}`;
        } else if (currentContext.git.uncommittedChanges && currentContext.git.uncommittedChanges.length > 0) {
          gitDiffSummary = `Uncommitted files: ${currentContext.git.uncommittedChanges.slice(0, 5).join(", ")}`;
        } else if (currentContext.git.commits.length > 0) {
          const recentCommit = currentContext.git.commits[0];
          const commitMsg = typeof recentCommit === 'string' ? recentCommit : (recentCommit.message || '');
          gitDiffSummary = `Last commit: ${commitMsg}`;
        }
      } catch (error) {
        console.warn('[Orchestrator] Failed to get git diff:', error);
        // Fallback to simple file list
        if (currentContext.git.uncommittedChanges && currentContext.git.uncommittedChanges.length > 0) {
          gitDiffSummary = `Uncommitted files: ${currentContext.git.uncommittedChanges.slice(0, 5).join(", ")}`;
        }
      }
    }
    
    if (!gitDiffSummary) {
      gitDiffSummary = "No recent git activity";
    }
    
    // REMOVED: recentlyEdited files - they're not being populated anymore and caused irrelevant context

    return {
      activeFile: currentContext.files.activeFile || null,
      recentCommits: currentContext.git.commits.slice(0, 3).map((c) => 
        typeof c === 'string' ? c : (c.message || '')
      ),
      recentErrors: [],
      gitDiffSummary,
      editCount: currentContext.session.totalEdits || 0,
      relatedFiles: currentContext.files.openFiles.filter(f => f !== currentContext.files.activeFile).slice(0, 5),
      relevantPastSessions: pastSessions, // Now includes relevant historical context
      projectStructure: undefined,
      dependencies: undefined,
      userIntent: `Analyzing current work in ${currentContext.files.activeFile || 'workspace'}`
    };
  }
}
