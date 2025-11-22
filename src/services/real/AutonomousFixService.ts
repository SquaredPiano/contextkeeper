import * as vscode from "vscode";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";
import { IContextService, IGitService, DeveloperContext } from "../interfaces";
import { GeminiClient } from "../../modules/gemini/gemini-client";
import { ContextBuilder } from "../../modules/gemini/context-builder";
import { BatchAnalysisResult, BatchFileResult } from "../../modules/gemini/types";

export interface FixResult {
  branchName: string;
  filesFixed: string[];
  testsCreated: string[];
  improvements: string[];
  summary: string;
}

/**
 * AutonomousFixService uses Gemini AI to:
 * 1. Analyze code with full context
 * 2. Create a new branch
 * 3. Fix errors
 * 4. Generate tests
 * 5. Make context-aware improvements
 */
export class AutonomousFixService extends EventEmitter {
  private geminiClient: GeminiClient;
  private contextService: IContextService;
  private gitService: IGitService;
  private workspaceRoot: string;

  constructor(
    geminiClient: GeminiClient,
    contextService: IContextService,
    gitService: IGitService
  ) {
    super();
    this.geminiClient = geminiClient;
    this.contextService = contextService;
    this.gitService = gitService;
    this.workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
  }

  /**
   * Main entry point: Run autonomous fix workflow
   */
  async runAutonomousFix(
    targetFiles?: string[]
  ): Promise<FixResult> {
    this.emit("progress", 0, "Collecting context...");

    try {
      // Step 1: Collect comprehensive context
      const context = await this.contextService.collectContext();
      this.emit("progress", 10, "Context collected");

      // Step 2: Get files to analyze (target files or all open files with errors)
      const filesToAnalyze = await this.getFilesToAnalyze(
        context,
        targetFiles
      );
      this.emit("progress", 20, `Analyzing ${filesToAnalyze.length} files...`);

      // Step 3: Read file contents
      const fileContents = await this.readFileContents(filesToAnalyze);
      this.emit("progress", 30, "File contents loaded");

      // Step 4: Get linting errors/diagnostics
      const errors = await this.collectDiagnostics(filesToAnalyze);
      this.emit("progress", 40, `Found ${errors.length} issues`);

      // Step 5: Build Gemini context
      const geminiContext = ContextBuilder.build({
        gitLogs: context.git.recentCommits.map(
          (c) => `${c.hash.substring(0, 7)} - ${c.message}`
        ),
        gitDiff: "", // Could enhance with actual git diff
        openFiles: context.files.openFiles,
        activeFile: context.files.activeFile,
        errors: errors,
        editHistory: context.files.recentlyEdited.map((e) => ({
          file: e.file,
          timestamp: e.timestamp.getTime(),
        })),
        fileContents: fileContents,
        workspaceRoot: this.workspaceRoot,
      });

      // Step 6: Run Gemini batch analysis
      this.emit("progress", 50, "Running AI analysis...");
      const batchResult = await this.geminiClient.runBatch(
        fileContents,
        geminiContext
      );
      this.emit("progress", 70, "AI analysis complete");

      // Step 7: Create branch
      const branchName = await this.createBranchName(batchResult);
      this.emit("progress", 75, `Creating branch: ${branchName}`);
      await this.gitService.createBranch(branchName);

      // Step 8: Apply fixes and improvements
      this.emit("progress", 80, "Applying fixes...");
      const fixResult = await this.applyFixesAndImprovements(
        batchResult,
        branchName
      );

      this.emit("progress", 100, "Complete!");
      this.emit("complete", fixResult);

      return fixResult;
    } catch (error: any) {
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Determine which files to analyze
   */
  private async getFilesToAnalyze(
    context: DeveloperContext,
    targetFiles?: string[]
  ): Promise<string[]> {
    if (targetFiles && targetFiles.length > 0) {
      return targetFiles;
    }

    // Default: files with errors or recently edited risky files
    const files = new Set<string>();

    // Add files with errors
    const diagnostics = vscode.languages.getDiagnostics();
    for (const [uri, diags] of diagnostics) {
      if (diags.length > 0 && uri.scheme === "file") {
        files.add(uri.fsPath);
      }
    }

    // Add recently edited risky files
    context.session.riskyFiles.forEach((file) => files.add(file));

    // Add active file if it exists
    if (context.files.activeFile) {
      files.add(context.files.activeFile);
    }

    // Fallback to open files
    if (files.size === 0) {
      context.files.openFiles.forEach((file) => files.add(file));
    }

    return Array.from(files).filter((f) => this.isCodeFile(f));
  }

  /**
   * Check if file is a code file we should analyze
   */
  private isCodeFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return [".ts", ".js", ".tsx", ".jsx", ".py"].includes(ext);
  }

  /**
   * Read contents of files
   */
  private async readFileContents(
    filePaths: string[]
  ): Promise<Map<string, string>> {
    const contents = new Map<string, string>();

    for (const filePath of filePaths) {
      try {
        // Try to get from open documents first
        const uri = vscode.Uri.file(filePath);
        const doc = vscode.workspace.textDocuments.find(
          (d) => d.uri.fsPath === filePath
        );

        if (doc) {
          contents.set(filePath, doc.getText());
        } else if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");
          contents.set(filePath, content);
        }
      } catch (error) {
        console.warn(`Failed to read ${filePath}:`, error);
      }
    }

    return contents;
  }

  /**
   * Collect diagnostics/errors from VS Code
   */
  private async collectDiagnostics(filePaths: string[]): Promise<string[]> {
    const errors: string[] = [];
    const diagnostics = vscode.languages.getDiagnostics();

    for (const [uri, diags] of diagnostics) {
      if (uri.scheme === "file" && filePaths.includes(uri.fsPath)) {
        for (const diag of diags) {
          if (diag.severity === vscode.DiagnosticSeverity.Error) {
            errors.push(
              `${uri.fsPath}:${diag.range.start.line + 1}: ${diag.message}`
            );
          }
        }
      }
    }

    return errors;
  }

  /**
   * Generate a branch name based on the analysis
   */
  private async createBranchName(
    batchResult: BatchAnalysisResult
  ): Promise<string> {
    const timestamp = new Date().toISOString().split("T")[0];
    const fileCount = batchResult.files.length;
    const issueCount = batchResult.files.reduce(
      (sum, f) => sum + f.analysis.issues.length,
      0
    );

    // Create a descriptive branch name
    const prefix = "ai-fix";
    const suffix = `${fileCount}files-${issueCount}issues`;
    return `${prefix}/${timestamp}-${suffix}`;
  }

  /**
   * Apply fixes, create tests, and make improvements
   */
  private async applyFixesAndImprovements(
    batchResult: BatchAnalysisResult,
    branchName: string
  ): Promise<FixResult> {
    const filesFixed: string[] = [];
    const testsCreated: string[] = [];
    const improvements: string[] = [];

    for (const fileResult of batchResult.files) {
      const filePath = fileResult.file;

      // Apply fixes for errors
      if (fileResult.suggestedFixes && fileResult.suggestedFixes.length > 0) {
        await this.applyFixesToFile(filePath, fileResult);
        filesFixed.push(filePath);
      }

      // Create test files
      if (fileResult.generatedTests) {
        const testPath = await this.createTestFile(filePath, fileResult.generatedTests);
        if (testPath) {
          testsCreated.push(testPath);
        }
      }

      // Track improvements
      if (fileResult.analysis.suggestions.length > 0) {
        improvements.push(
          `${filePath}: ${fileResult.analysis.suggestions.length} suggestions`
        );
      }
    }

    return {
      branchName,
      filesFixed,
      testsCreated,
      improvements,
      summary: batchResult.globalSummary,
    };
  }

  /**
   * Apply fixes to a file
   */
  private async applyFixesToFile(
    filePath: string,
    fileResult: BatchFileResult
  ): Promise<void> {
    if (!fileResult.suggestedFixes || fileResult.suggestedFixes.length === 0) {
      return;
    }

    try {
      // Read current file content
      let currentContent = "";
      const uri = vscode.Uri.file(filePath);
      const doc = vscode.workspace.textDocuments.find(
        (d) => d.uri.fsPath === filePath
      );

      if (doc) {
        currentContent = doc.getText();
      } else if (fs.existsSync(filePath)) {
        currentContent = fs.readFileSync(filePath, "utf-8");
      }

      if (!currentContent) {
        console.warn(`No content found for ${filePath}`);
        return;
      }

      // Find the best fix (highest confidence)
      const bestFix = fileResult.suggestedFixes
        .filter(f => f.fix && f.fix.confidence > 0.7)
        .sort((a, b) => (b.fix?.confidence || 0) - (a.fix?.confidence || 0))[0]?.fix;

      if (bestFix && bestFix.fixedCode) {
        // Clean up the fixed code (remove markdown code blocks if present)
        let fixedContent = bestFix.fixedCode;
        if (fixedContent.includes("```")) {
          const codeBlockMatch = fixedContent.match(/```[\w]*\n([\s\S]*?)```/);
          if (codeBlockMatch) {
            fixedContent = codeBlockMatch[1];
          }
        }

        // Write the fixed code
        fs.writeFileSync(filePath, fixedContent, "utf-8");

        // If file is open, try to reload it
        if (doc) {
          // Close and reopen to reload
          await vscode.workspace.openTextDocument(uri).then(async (newDoc) => {
            await vscode.window.showTextDocument(newDoc);
          });
        }
      }
    } catch (error) {
      console.error(`Failed to apply fixes to ${filePath}:`, error);
      // Don't throw - continue with other files
    }
  }

  /**
   * Create a test file for the given file
   */
  private async createTestFile(
    sourceFilePath: string,
    testContent: string
  ): Promise<string | null> {
    try {
      // Determine test file path
      const testPath = this.getTestFilePath(sourceFilePath);
      const testDir = path.dirname(testPath);

      // Create directory if needed
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      // Clean up test content (remove markdown code blocks if present)
      let cleanTestContent = testContent;
      if (testContent.includes("```")) {
        const codeBlockMatch = testContent.match(/```[\w]*\n([\s\S]*?)```/);
        if (codeBlockMatch) {
          cleanTestContent = codeBlockMatch[1];
        }
      }

      // Write test file
      fs.writeFileSync(testPath, cleanTestContent, "utf-8");
      return testPath;
    } catch (error) {
      console.error(`Failed to create test file for ${sourceFilePath}:`, error);
      return null;
    }
  }

  /**
   * Get test file path for a source file
   */
  private getTestFilePath(sourceFilePath: string): string {
    const ext = path.extname(sourceFilePath);
    const basename = path.basename(sourceFilePath, ext);
    const dir = path.dirname(sourceFilePath);

    // Try common test directory patterns
    const testDir = path.join(dir, "__tests__");
    const testFileName = `${basename}.test${ext}`;

    return path.join(testDir, testFileName);
  }
}

