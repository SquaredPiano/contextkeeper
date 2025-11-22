import * as vscode from 'vscode';
import { storage } from '../storage';
import { GitWatcher, GitCommitEvent } from './GitWatcher';

export class ContextIngestionService {
  private gitWatcher: GitWatcher | null = null;
  private disposables: vscode.Disposable[] = [];
  private pendingEdits: Map<string, NodeJS.Timeout> = new Map();
  private readonly EDIT_DEBOUNCE_MS = 2000;
  private outputChannel: vscode.OutputChannel | null = null;

  constructor() {}

  public async initialize(context: vscode.ExtensionContext, outputChannel?: vscode.OutputChannel): Promise<void> {
    console.log('Initializing Context Ingestion Service...');
    if (outputChannel) {
      this.outputChannel = outputChannel;
      this.outputChannel.appendLine('ContextIngestionService: Initializing...');
    }

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
      await storage.connect();
      console.log('Storage connected for ingestion.');
    } catch (error) {
      console.error('Failed to connect storage for ingestion:', error);
    }
  }

  public dispose(): void {
    this.gitWatcher?.stop();
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
      await storage.logEvent({
        timestamp: Date.now(),
        event_type: 'file_open',
        file_path: vscode.workspace.asRelativePath(document.uri),
        metadata: JSON.stringify({
          languageId: document.languageId,
          lineCount: document.lineCount
        })
      });
      this.logToOutput(`[FILE_OPEN] ${vscode.workspace.asRelativePath(document.uri)}`);
    } catch (error) {
      console.error('Error logging file_open:', error);
    }
  }

  private async handleFileClose(document: vscode.TextDocument): Promise<void> {
    if (this.shouldIgnoreFile(document.uri)) { return; }

    try {
      await storage.logEvent({
        timestamp: Date.now(),
        event_type: 'file_close',
        file_path: vscode.workspace.asRelativePath(document.uri),
        metadata: JSON.stringify({
          languageId: document.languageId
        })
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

      await storage.logEvent({
        timestamp: Date.now(),
        event_type: 'file_edit',
        file_path: vscode.workspace.asRelativePath(document.uri),
        metadata: JSON.stringify({
          languageId: document.languageId,
          changeCount: changes.length,
          changes: changeSummary
        })
      });
      this.logToOutput(`[FILE_EDIT] ${vscode.workspace.asRelativePath(document.uri)} (${changes.length} changes)`);
    } catch (error) {
      console.error('Error logging file_edit:', error);
    }
  }

  private async handleGitCommit(commit: GitCommitEvent): Promise<void> {
    try {
      await storage.logEvent({
        timestamp: Date.now(), // Or parse commit.date
        event_type: 'git_commit',
        file_path: 'root', // Commits affect the repo
        metadata: JSON.stringify({
          hash: commit.hash,
          message: commit.message,
          author: commit.author,
          files: commit.files
        })
      });
      this.logToOutput(`[GIT_COMMIT] ${commit.hash} - ${commit.message}`);
      console.log(`Logged git commit: ${commit.hash}`);
    } catch (error) {
      console.error('Error logging git_commit:', error);
    }
  }

  private shouldIgnoreFile(uri: vscode.Uri): boolean {
    const fsPath = uri.fsPath;
    return (
      uri.scheme !== 'file' ||
      fsPath.includes('.git') ||
      fsPath.includes('node_modules') ||
      fsPath.includes('.next') ||
      fsPath.includes('dist') ||
      fsPath.includes('out') ||
      fsPath.includes('build')
    );
  }

  private logToOutput(message: string): void {
    if (this.outputChannel) {
      this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
    }
  }
}
