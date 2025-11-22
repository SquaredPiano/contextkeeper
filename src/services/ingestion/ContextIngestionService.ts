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

    // 3. Ensure Storage is Connected
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
    // File Open (Active Editor Change)
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
          this.handleFileOpen(editor.document);
        }
      })
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
      // Calculate a rough "diff" or summary of changes
      const changeSummary = changes.map(c => ({
        range: c.range,
        textLength: c.text.length,
        textPreview: c.text.substring(0, 50).replace(/\n/g, '\\n')
      }));

      const relativePath = vscode.workspace.asRelativePath(document.uri);

      // Identify function context
      let functionName: string | undefined;
      try {
        const symbols = await getDocumentSymbols(document.uri);
        // Check the first change to see if it falls within a function
        if (changes.length > 0) {
            functionName = findFunctionAtPosition(symbols, changes[0].range.start);
        }
      } catch (e) {
        // Ignore symbol errors during edit processing
      }

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
            function: functionName
          })
        }
      });

      // 2. Log Action for Vector Search (Searchable Context)
      // We create a natural language description of what happened
      let description = `User edited ${relativePath} (${document.languageId}). Changed ${changes.length} sections.`;
      if (functionName) {
          description += ` Modified function: ${functionName}.`;
      }

      this.queue.enqueue({
        type: 'action',
        data: {
          session_id: this.sessionManager.getSessionId(),
          timestamp: Date.now(),
          description: description,
          diff: JSON.stringify(changeSummary), // Store diff summary for now
          files: JSON.stringify([relativePath])
        }
      });

      this.logToOutput(`[FILE_EDIT] ${relativePath} (${changes.length} changes)${functionName ? ` in ${functionName}` : ''}`);
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
