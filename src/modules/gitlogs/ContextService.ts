import { EventEmitter } from "events";
import * as vscode from "vscode";
import { GitService } from "./GitService";
import {
  IContextService,
  DeveloperContext,
  GitCommit,
  FileEdit,
  EditEvent,
  FileEvent,
  IGitService,
  IStorageService
} from "../../services/interfaces";
import { LanceDBStorage } from "../../services/storage/storage";

export class ContextService extends EventEmitter implements IContextService {
  // State tracking
  private editFrequency: Map<string, number> = new Map();
  private editTimeline: EditEvent[] = [];
  private fileOpens: FileEvent[] = [];
  private fileCloses: FileEvent[] = [];
  private gitContextCache: { commits: GitCommit[]; branch: string } | null = null;
  
  private gitService: IGitService;
  private storageService: IStorageService;

  constructor(gitService?: IGitService, storageService?: IStorageService) {
    super();
    
    // Initialize services with defaults if not provided
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
    this.gitService = gitService || new GitService(workspaceRoot);
    this.storageService = storageService || new LanceDBStorage();

    this.setupFileWatchers();
    
    // Refresh git context periodically (every 5 mins)
    setInterval(() => this.refreshGitContext(), 5 * 60 * 1000);
    this.refreshGitContext(); // Initial fetch
  }

  // --- 1. GIT LOGS & CONTEXT ---
  private async refreshGitContext() {
    try {
      const commits = await this.gitService.getRecentCommits(10);
      const branch = await this.gitService.getCurrentBranch();

      this.gitContextCache = { commits, branch };
      
      // Emit event for linting service to trigger linting on git refresh
      this.emit("gitContextRefreshed", { commits, branch });
      
      // Log to storage
      // We might want to log the latest commit if it's new, but GitWatcher handles that better.
      // Here we just update cache.
    } catch (e) {
      console.warn("Failed to fetch git logs:", e);
    }
  }

  // --- MAIN COLLECTION METHOD ---
  async collectContext(): Promise<DeveloperContext> {
    const editor = vscode.window.activeTextEditor;

    // Ensure we have fresh git context
    if (!this.gitContextCache) {
      await this.refreshGitContext();
    }

    const context: DeveloperContext = {
      git: {
        recentCommits: this.gitContextCache?.commits || [],
        currentBranch: this.gitContextCache?.branch || "unknown",
        uncommittedChanges: [], // TODO: Implement uncommitted changes in GitService
      },
      files: {
        openFiles: vscode.workspace.textDocuments.map((d) => d.fileName),
        activeFile: editor?.document.fileName || "",
        recentlyEdited: this.getRecentlyEditedFiles(),
        editFrequency: this.editFrequency,
      },
      cursor: await this.collectCursorContext(),
      timeline: {
        edits: this.editTimeline.slice(-20),
        opens: this.fileOpens.slice(-10),
        closes: this.fileCloses.slice(-10),
      },
      session: {
        startTime: new Date(), // You might want to store actual start time in constructor
        totalEdits: this.editTimeline.length,
        riskyFiles: this.getRiskyFiles(),
      },
    };
    
    // Emit event for linting service and other listeners
    this.emit("contextCollected", context);
    
    // Persist session context to Vector DB
    this.persistContext(context);

    return context;
  }

  private async persistContext(context: DeveloperContext) {
    try {
      // Log a snapshot of the context
      await this.storageService.logEvent({
        timestamp: Date.now(),
        event_type: 'context_collected',
        file_path: 'workspace',
        metadata: JSON.stringify({
          commitCount: context.git.recentCommits.length,
          openFiles: context.files.openFiles.length,
          activeFile: context.files.activeFile,
          riskyFilesCount: context.session.riskyFiles.length
        })
      });
    } catch (error) {
      console.error("Failed to persist context:", error);
    }
  }

  // --- 5. FUNCTION/COMPONENT CLOSED DETECTION ---
  private async collectCursorContext() {
    const editor = vscode.window.activeTextEditor;
    if (!editor)
      return {
        file: "",
        line: 0,
        column: 0,
        currentFunction: "",
        selectedText: "",
      };

    const pos = editor.selection.active;

    // Detect if we are inside a function using VS Code Symbols
    // This helps the AI know WHICH component you are editing
    let currentFunctionName = "";
    try {
      const symbols = await vscode.commands.executeCommand<
        vscode.DocumentSymbol[]
      >("vscode.executeDocumentSymbolProvider", editor.document.uri);
      currentFunctionName = this.findFunctionAtPosition(symbols, pos) || "";
    } catch (e) {
      /* Ignore symbol errors */
    }

    return {
      file: editor.document.fileName,
      line: pos.line + 1,
      column: pos.character + 1,
      currentFunction: currentFunctionName,
      selectedText: editor.document.getText(editor.selection),
    };
  }

  private findFunctionAtPosition(
    symbols: vscode.DocumentSymbol[] | undefined,
    pos: vscode.Position
  ): string | undefined {
    if (!symbols) return undefined;
    for (const symbol of symbols) {
      if (symbol.range.contains(pos)) {
        if (
          symbol.kind === vscode.SymbolKind.Function ||
          symbol.kind === vscode.SymbolKind.Method
        ) {
          return symbol.name;
        }
        const child = this.findFunctionAtPosition(symbol.children, pos);
        if (child) return child;
      }
    }
    return undefined;
  }

  // --- 2, 3, 4. FILE WATCHERS (Edits, Open, Close) ---
  private setupFileWatchers() {
    // 2. File Edits & 5. "Function Closed" Heuristic
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.contentChanges.length === 0) return;

      const file = e.document.fileName;
      const change = e.contentChanges[0];

      // Track Edits
      this.editTimeline.push({
        file,
        timestamp: new Date(),
        line: change.range.start.line,
        chars: change.text.length,
      });
      this.editFrequency.set(file, (this.editFrequency.get(file) || 0) + 1);

      // Smart Trigger: Did they just type '}'?
      // This often signifies closing a function or block
      if (change.text.includes("}")) {
        // Emit a special event that the Extension can listen to
        // This allows "Linting on Function Close"
        this.emit("functionClosed", file);
      }
    });

    // 3. Files Opened
    vscode.workspace.onDidOpenTextDocument((doc) => {
      this.fileOpens.push({ file: doc.fileName, timestamp: new Date() });
    });

    // 4. Files Closed
    vscode.workspace.onDidCloseTextDocument((doc) => {
      this.fileCloses.push({ file: doc.fileName, timestamp: new Date() });
    });
  }

  getCurrentFile(): string {
    return vscode.window.activeTextEditor?.document.fileName || "";
  }

  getRiskyFiles(): string[] {
    // Simple logic: files edited > 10 times are "Risky" (Hotspots)
    return Array.from(this.editFrequency.entries())
      .filter(([_, count]) => count > 10)
      .map(([file]) => file);
  }

  private getRecentlyEditedFiles(): FileEdit[] {
    // Convert timeline to unique file list
    const map = new Map<string, FileEdit>();
    this.editTimeline.forEach((edit) => {
      map.set(edit.file, {
        file: edit.file,
        timestamp: edit.timestamp,
        changes: (map.get(edit.file)?.changes || 0) + 1,
      });
    });
    return Array.from(map.values());
  }
}
