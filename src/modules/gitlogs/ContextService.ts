import { EventEmitter } from "events";
import * as vscode from "vscode";
import { getLogsWithGitlog } from "../../modules/gitlogs/gitlog";
import {
  IContextService,
  DeveloperContext,
  GitCommit,
  FileEdit,
  EditEvent,
  FileEvent,
} from "../interfaces";

export class ContextService extends EventEmitter implements IContextService {
  // State tracking
  private editFrequency: Map<string, number> = new Map();
  private editTimeline: EditEvent[] = [];
  private fileOpens: FileEvent[] = [];
  private fileCloses: FileEvent[] = [];
  private activeFunction: string = "";
  private gitContextCache: { commits: GitCommit[]; branch: string } | null =
    null;

  constructor() {
    super();
    this.setupFileWatchers();
    // Refresh git context periodically (every 5 mins)
    setInterval(() => this.refreshGitContext(), 5 * 60 * 1000);
    this.refreshGitContext(); // Initial fetch
  }

  // --- 1. GIT LOGS & CONTEXT ---
  private async refreshGitContext() {
    try {
      const logs = await getLogsWithGitlog(vscode.workspace.rootPath);
      // Map the gitlog output to our interface
      const commits: GitCommit[] = logs.map((log: any) => ({
        hash: log.hash,
        message: log.subject,
        author: log.authorName,
        date: new Date(log.authorDate),
      }));

      // Simple branch detection
      const branch = "main"; // Ideally use simple-git here for real branch name

      this.gitContextCache = { commits, branch };
      
      // Emit event for linting service to trigger linting on git refresh
      this.emit("gitContextRefreshed", { commits, branch });
    } catch (e) {
      console.warn("Failed to fetch git logs:", e);
    }
  }

  // --- MAIN COLLECTION METHOD ---
  async collectContext(): Promise<DeveloperContext> {
    const editor = vscode.window.activeTextEditor;

    const context: DeveloperContext = {
      git: {
        recentCommits: this.gitContextCache?.commits || [],
        currentBranch: this.gitContextCache?.branch || "unknown",
        uncommittedChanges: [], // Can expand with simple-git status
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
    
    return context;
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
