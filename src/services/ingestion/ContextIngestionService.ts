import * as vscode from 'vscode';
import * as path from 'path';
import { IStorageService, IContextService } from '../interfaces';
import { GitWatcher, GitCommitEvent } from './GitWatcher';
import { SessionManager } from '../../managers/SessionManager';
import { IngestionQueue } from './IngestionQueue';
import { getDocumentSymbols, findFunctionAtPosition } from '../../utils/symbolUtils';

export class ContextIngestionService {
  private gitWatcher: GitWatcher | null = null;
  private disposables: vscode.Disposable[] = [];
  private pendingEdits: Map<string, NodeJS.Timeout> = new Map();
  private readonly EDIT_DEBOUNCE_MS = 2000;
  private outputChannel: vscode.OutputChannel | null = null;
  private storage: IStorageService;
  private contextService: IContextService;
  private sessionManager: SessionManager;
  private queue: IngestionQueue;

  constructor(storage: IStorageService, contextService: IContextService, sessionManager: SessionManager) {
    this.storage = storage;
    this.contextService = contextService;
    this.sessionManager = sessionManager;
    this.queue = new IngestionQueue(storage, sessionManager);
  }

  public async initialize(context: vscode.ExtensionContext, outputChannel?: vscode.OutputChannel): Promise<void> {
    console.log('Initializing Context Ingestion Service...');
    if (outputChannel) {
      this.outputChannel = outputChannel;
      this.outputChannel.appendLine('ContextIngestionService: Initializing...');
    }

    // Start the ingestion queue
    this.queue.start();

    // 1. Setup Git Watcher
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      this.gitWatcher = new GitWatcher(workspaceRoot);
      this.gitWatcher.on('commit', (commit: GitCommitEvent) => this.handleGitCommit(commit));
      this.gitWatcher.start();
    } else {
      console.warn('No workspace root found, Git ingestion disabled.');
    }

    // 2. Setup VS Code Listeners
    this.setupListeners();

    // 3. Capture initial state
    if (vscode.window.activeTextEditor) {
      this.handleFileOpen(vscode.window.activeTextEditor.document);
    }

    // 4. Ensure Storage is Connected
    try {
      // await this.storage.connect(); // Assuming connection is handled externally
      console.log('Storage connected for ingestion.');
    } catch (error) {
      console.error('Failed to connect storage for ingestion:', error);
    }
  }

  public dispose(): void {
    this.gitWatcher?.stop();
    this.queue.stop();
    this.disposables.forEach(d => d.dispose());
    this.pendingEdits.forEach(timeout => clearTimeout(timeout));
  }

  private setupListeners(): void {
    // File Open (Active Editor Change) -> Treat as Focus
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
          this.handleFileFocus(editor.document);
        }
      })
    );

    // File Open (Actual Open)
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument(doc => this.handleFileOpen(doc))
    );

    // File Close
    this.disposables.push(
      vscode.workspace.onDidCloseTextDocument(doc => this.handleFileClose(doc))
    );

    // File Edit
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(event => this.handleFileEdit(event))
    );
  }

  private async handleFileFocus(document: vscode.TextDocument): Promise<void> {
    if (this.shouldIgnoreFile(document.uri)) { return; }

    try {
      this.queue.enqueue({
        type: 'event',
        data: {
          timestamp: Date.now(),
          event_type: 'file_focus',
          file_path: vscode.workspace.asRelativePath(document.uri),
          metadata: JSON.stringify({
            languageId: document.languageId,
            lineCount: document.lineCount
          })
        }
      });
      this.logToOutput(`[FILE_FOCUS] ${vscode.workspace.asRelativePath(document.uri)}`);
    } catch (error) {
      console.error('Error logging file_focus:', error);
    }
  }

  private async handleFileOpen(document: vscode.TextDocument): Promise<void> {
    if (this.shouldIgnoreFile(document.uri)) { return; }

    try {
      this.queue.enqueue({
        type: 'event',
        data: {
          timestamp: Date.now(),
          event_type: 'file_open',
          file_path: vscode.workspace.asRelativePath(document.uri),
          metadata: JSON.stringify({
            languageId: document.languageId,
            lineCount: document.lineCount
          })
        }
      });
      this.logToOutput(`[FILE_OPEN] ${vscode.workspace.asRelativePath(document.uri)}`);
    } catch (error) {
      console.error('Error logging file_open:', error);
    }
  }

  private async handleFileClose(document: vscode.TextDocument): Promise<void> {
    if (this.shouldIgnoreFile(document.uri)) { return; }

    try {
      this.queue.enqueue({
        type: 'event',
        data: {
          timestamp: Date.now(),
          event_type: 'file_close',
          file_path: vscode.workspace.asRelativePath(document.uri),
          metadata: JSON.stringify({
            languageId: document.languageId
          })
        }
      });
      this.logToOutput(`[FILE_CLOSE] ${vscode.workspace.asRelativePath(document.uri)}`);
    } catch (error) {
      console.error('Error logging file_close:', error);
    }
  }

  private handleFileEdit(event: vscode.TextDocumentChangeEvent): void {
    const document = event.document;
    if (this.shouldIgnoreFile(document.uri)) { return; }
    if (event.contentChanges.length === 0) { return; }

    const filePath = document.uri.fsPath;

    // Debounce edits
    if (this.pendingEdits.has(filePath)) {
      clearTimeout(this.pendingEdits.get(filePath)!);
    }

    const timeout = setTimeout(async () => {
      this.pendingEdits.delete(filePath);
      await this.processFileEdit(document, event.contentChanges);
    }, this.EDIT_DEBOUNCE_MS);

    this.pendingEdits.set(filePath, timeout);
  }

  private async processFileEdit(document: vscode.TextDocument, changes: readonly vscode.TextDocumentContentChangeEvent[]): Promise<void> {
    try {
      const relativePath = vscode.workspace.asRelativePath(document.uri);

      // Identify function context
      const affectedFunctions = new Set<string>();
      try {
        const symbols = await getDocumentSymbols(document.uri);
        console.log(`[ContextIngestion] Found ${symbols.length} symbols in ${relativePath}`);
        for (const change of changes) {
            const func = findFunctionAtPosition(symbols, change.range.start);
            if (func) {
                affectedFunctions.add(func);
                console.log(`[ContextIngestion] Edit at line ${change.range.start.line} affects function: ${func}`);
            }
        }
        if (affectedFunctions.size === 0) {
          console.log(`[ContextIngestion] No function context found for edit at line ${changes[0]?.range.start.line}`);
        }
      } catch (e) {
        console.warn('[ContextIngestion] Symbol detection failed:', e);
      }

      const affectedFunctionsList = Array.from(affectedFunctions);

      // Calculate a rough "diff" or summary of changes with actual code context
      const changeSummary = changes.map(c => {
        const startLine = c.range.start.line;
        const endLine = c.range.end.line;
        const textPreview = c.text.substring(0, 200).replace(/\n/g, '\\n');
        
        // Get surrounding context (3 lines before and after)
        let contextBefore = '';
        let contextAfter = '';
        try {
          const lineCount = document.lineCount;
          if (startLine > 0) {
            const beforeStart = Math.max(0, startLine - 3);
            contextBefore = document.getText(new vscode.Range(beforeStart, 0, startLine, 0));
          }
          if (endLine < lineCount - 1) {
            const afterEnd = Math.min(lineCount - 1, endLine + 3);
            contextAfter = document.getText(new vscode.Range(endLine + 1, 0, afterEnd + 1, 0));
          }
        } catch (e) {
          // Ignore context extraction errors
        }

        return {
          range: { 
            start: { line: startLine + 1, char: c.range.start.character + 1 },  // Convert to 1-based
            end: { line: endLine + 1, char: c.range.end.character + 1 }          // Convert to 1-based
          },
          textLength: c.text.length,
          textPreview,
          contextBefore: contextBefore.substring(0, 200),
          contextAfter: contextAfter.substring(0, 200),
          rangeText: c.rangeLength > 0 ? document.getText(c.range).substring(0, 100) : ''
        };
      });

      // 1. Log raw event for history
      this.queue.enqueue({
        type: 'event',
        data: {
          timestamp: Date.now(),
          event_type: 'file_edit',
          file_path: relativePath,
          metadata: JSON.stringify({
            languageId: document.languageId,
            changeCount: changes.length,
            changes: changeSummary,
            affectedFunctions: affectedFunctionsList
          })
        }
      });

      console.log(`[ContextIngestion] Stored event with ${changeSummary.length} changes at line ${changeSummary[0]?.range.start.line} (1-based)`);

      // 2. Log Action for Vector Search (Searchable Context)
      // Create a rich natural language description of what happened
      let description = `User edited ${relativePath}`;
      
      if (affectedFunctionsList.length > 0) {
          description += ` in function(s): ${affectedFunctionsList.join(', ')}`;
      }
      
      // Add details about the type of changes
      const totalCharsAdded = changes.reduce((sum, c) => sum + c.text.length, 0);
      const totalCharsRemoved = changes.reduce((sum, c) => sum + c.rangeLength, 0);
      
      if (totalCharsAdded > 0 && totalCharsRemoved === 0) {
          description += `. Added ${totalCharsAdded} characters`;
      } else if (totalCharsRemoved > 0 && totalCharsAdded === 0) {
          description += `. Removed ${totalCharsRemoved} characters`;
      } else if (totalCharsAdded > 0 && totalCharsRemoved > 0) {
          description += `. Modified code (added ${totalCharsAdded}, removed ${totalCharsRemoved} chars)`;
      }
      
      // Add a snippet of what was changed for better vector search
      if (changes.length > 0 && changes[0].text.length > 0 && changes[0].text.length < 100) {
          const snippet = changes[0].text.replace(/\n/g, ' ').trim();
          if (snippet) {
              description += `. Change: "${snippet}"`;
          }
      }

      this.queue.enqueue({
        type: 'action',
        data: {
          session_id: this.sessionManager.getSessionId(),
          timestamp: Date.now(),
          description: description,
          diff: JSON.stringify(changeSummary),
          files: JSON.stringify([relativePath])
        }
      });

      console.log(`[ContextIngestion] Queued action for embedding: "${description.substring(0, 100)}..."`);

      this.logToOutput(`[FILE_EDIT] ${relativePath} (${changes.length} changes)${affectedFunctionsList.length > 0 ? ` in ${affectedFunctionsList.join(', ')}` : ''}`);
    } catch (error) {
      console.error('Error logging file_edit:', error);
    }
  }

  private async handleGitCommit(commit: GitCommitEvent): Promise<void> {
    try {
      this.queue.enqueue({
        type: 'event',
        data: {
          timestamp: Date.now(), // Or parse commit.date
          event_type: 'git_commit',
          file_path: 'root', // Commits affect the repo
          metadata: JSON.stringify({
            hash: commit.hash,
            message: commit.message,
            author: commit.author,
            files: commit.files
          })
        }
      });

      // Log Action for Vector Search
      this.queue.enqueue({
        type: 'action',
        data: {
          session_id: this.sessionManager.getSessionId(),
          timestamp: Date.now(),
          description: `User committed changes: ${commit.message}`,
          diff: '', // We could fetch diff if needed, but message is usually enough for high-level context
          files: JSON.stringify(commit.files)
        }
      });

      this.logToOutput(`[GIT_COMMIT] ${commit.hash} - ${commit.message}`);
      console.log(`Logged git commit: ${commit.hash}`);
    } catch (error) {
      console.error('Error logging git_commit:', error);
    }
  }

  private shouldIgnoreFile(uri: vscode.Uri): boolean {
    const fsPath = uri.fsPath;

    // Only process file scheme
    if (uri.scheme !== 'file') {
      return true;
    }

    // Check for ignored directories using path segments to avoid partial matches
    // e.g. "my_build_script.ts" should not be ignored just because it has "build"
    const pathSegments = fsPath.split(path.sep);
    const ignoredDirs = ['.git', 'node_modules', '.next', 'dist', 'out', 'build', 'coverage'];

    return pathSegments.some(segment => ignoredDirs.includes(segment));
  }

  private logToOutput(message: string): void {
    if (this.outputChannel) {
      this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
    }
  }
}
