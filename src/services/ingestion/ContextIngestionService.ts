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
    console.log('[ContextIngestionService] Initializing Context Ingestion Service...');
    if (outputChannel) {
      this.outputChannel = outputChannel;
      this.outputChannel.appendLine('[ContextIngestionService] Initializing...');
    }

    // Start the ingestion queue
    try {
      this.queue.start();
      this.logToOutput('Ingestion queue started');
      console.log('[ContextIngestionService] Ingestion queue started');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ContextIngestionService] Failed to start ingestion queue: ${errorMsg}`, error);
      this.logToOutput(`❌ Failed to start ingestion queue: ${errorMsg}`);
    }

    // 1. Setup Git Watcher
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      try {
        this.gitWatcher = new GitWatcher(workspaceRoot);
        this.gitWatcher.on('commit', (commit: GitCommitEvent) => this.handleGitCommit(commit));
        await this.gitWatcher.start();
        this.logToOutput(`Git watcher started for workspace: ${workspaceRoot}`);
        console.log(`[ContextIngestionService] Git watcher started for workspace: ${workspaceRoot}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[ContextIngestionService] Failed to start git watcher: ${errorMsg}`, error);
        this.logToOutput(`⚠️  Git watcher failed to start: ${errorMsg}`);
      }
    } else {
      const warningMsg = 'No workspace root found, Git ingestion disabled.';
      console.warn(`[ContextIngestionService] ${warningMsg}`);
      this.logToOutput(`⚠️  ${warningMsg}`);
    }

    // 2. Setup VS Code Listeners
    try {
      this.setupListeners();
      this.logToOutput('VS Code listeners setup complete');
      console.log('[ContextIngestionService] VS Code listeners setup complete');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ContextIngestionService] Failed to setup listeners: ${errorMsg}`, error);
      this.logToOutput(`❌ Failed to setup listeners: ${errorMsg}`);
    }

    // 3. Capture initial state
    if (vscode.window.activeTextEditor) {
      this.handleFileOpen(vscode.window.activeTextEditor.document);
    }

    // 4. Ensure Storage is Connected
    try {
      // await this.storage.connect(); // Assuming connection is handled externally
      console.log('[ContextIngestionService] Storage connected for ingestion.');
      this.logToOutput('Storage connected for ingestion');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ContextIngestionService] Failed to connect storage for ingestion: ${errorMsg}`, error);
      this.logToOutput(`❌ Failed to connect storage: ${errorMsg}`);
    }

    this.logToOutput('✅ Context Ingestion Service initialized');
    console.log('[ContextIngestionService] ✅ Context Ingestion Service initialized');
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
      const relativePath = vscode.workspace.asRelativePath(document.uri);
      this.queue.enqueue({
        type: 'event',
        data: {
          timestamp: Date.now(),
          event_type: 'file_open',
          file_path: relativePath,
          metadata: JSON.stringify({
            languageId: document.languageId,
            lineCount: document.lineCount
          })
        }
      });
      this.logToOutput(`[FILE_OPEN] ${relativePath}`);
      console.log(`[ContextIngestionService] File opened: ${relativePath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ContextIngestionService] Error logging file_open: ${errorMsg}`, error);
      this.logToOutput(`❌ Error logging file_open: ${errorMsg}`);
    }
  }

  private async handleFileClose(document: vscode.TextDocument): Promise<void> {
    if (this.shouldIgnoreFile(document.uri)) { return; }

    try {
      const relativePath = vscode.workspace.asRelativePath(document.uri);
      this.queue.enqueue({
        type: 'event',
        data: {
          timestamp: Date.now(),
          event_type: 'file_close',
          file_path: relativePath,
          metadata: JSON.stringify({
            languageId: document.languageId
          })
        }
      });
      this.logToOutput(`[FILE_CLOSE] ${relativePath}`);
      console.log(`[ContextIngestionService] File closed: ${relativePath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ContextIngestionService] Error logging file_close: ${errorMsg}`, error);
      this.logToOutput(`❌ Error logging file_close: ${errorMsg}`);
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
      } catch {
        console.warn('[ContextIngestion] Symbol detection failed');
      }

      const affectedFunctionsList = Array.from(affectedFunctions);

      // Get document symbols once for all changes
      let documentSymbols: vscode.DocumentSymbol[] = [];
      try {
        documentSymbols = await getDocumentSymbols(document.uri);
      } catch (error) {
        console.warn('[ContextIngestion] Failed to get document symbols:', error);
      }

      // CRITICAL: Capture FULL CODE CONTEXT, not just metadata
      const changeDetails = await Promise.all(changes.map(async (c) => {
        const startLine = c.range.start.line;
        const endLine = c.range.end.line;
        const lineCount = document.lineCount;
        
        // Get the FULL text that was added
        const addedText = c.text;
        
        // Get the FULL text that was removed (if we had access to before state)
        const removedText = c.rangeLength > 0 ? document.getText(c.range) : '';
        
        // Get 10 lines of context BEFORE (not 3)
        let contextBefore = '';
        try {
          if (startLine > 0) {
            const beforeStart = Math.max(0, startLine - 10);
            contextBefore = document.getText(new vscode.Range(beforeStart, 0, startLine, 0));
          }
        } catch (error) {
          console.warn('[ContextIngestion] Failed to get context before:', error);
        }
        
        // Get 10 lines of context AFTER
        let contextAfter = '';
        try {
          if (endLine < lineCount - 1) {
            const afterEnd = Math.min(lineCount - 1, endLine + 10);
            contextAfter = document.getText(new vscode.Range(endLine + 1, 0, afterEnd + 1, 0));
          }
        } catch (error) {
          console.warn('[ContextIngestion] Failed to get context after:', error);
        }

        // Get the FULL FUNCTION body if this edit is inside a function
        let affectedFunctionData: { name: string; fullBody: string; startLine: number; endLine: number } | undefined;
        try {
          const position = new vscode.Position(startLine, c.range.start.character);
          const functionName = findFunctionAtPosition(documentSymbols, position);
          
          if (functionName) {
            // Find the actual symbol to get its range
            const findSymbolByName = (symbols: vscode.DocumentSymbol[], name: string): vscode.DocumentSymbol | undefined => {
              for (const sym of symbols) {
                if (sym.name === name && sym.range.contains(position)) {
                  return sym;
                }
                if (sym.children) {
                  const found = findSymbolByName(sym.children, name);
                  if (found) {return found;}
                }
              }
              return undefined;
            };
            
            const functionSymbol = findSymbolByName(documentSymbols, functionName);
            if (functionSymbol) {
              affectedFunctionData = {
                name: functionName,
                fullBody: document.getText(functionSymbol.range),
                startLine: functionSymbol.range.start.line,
                endLine: functionSymbol.range.end.line
              };
            }
          }
        } catch (error) {
          console.warn('[ContextIngestion] Failed to get function context:', error);
        }

        return {
          range: { 
            start: { line: startLine + 1, char: c.range.start.character + 1 },
            end: { line: endLine + 1, char: c.range.end.character + 1 }
          },
          addedText,
          removedText,
          contextBefore,
          contextAfter,
          affectedFunction: affectedFunctionData
        };
      }));

      // Get full file content for small files (<10KB)
      const fileSize = Buffer.byteLength(document.getText(), 'utf8');
      const fullFileContent = fileSize < 10240 ? document.getText() : undefined;

      // Build rich metadata with ACTUAL CODE
      const richMetadata: import('../storage/schema').FileEditMetadata = {
        languageId: document.languageId,
        changes: changeDetails,
        fullFileContent,
        fileSize
      };

      // 1. Log raw event with RICH CONTEXT
      this.queue.enqueue({
        type: 'event',
        data: {
          timestamp: Date.now(),
          event_type: 'file_edit',
          file_path: relativePath,
          metadata: JSON.stringify(richMetadata)
        }
      });

      console.log(`[ContextIngestion] Stored event with FULL CODE CONTEXT: ${changeDetails.length} changes, ` +
        `${changeDetails.filter(c => c.affectedFunction).length} functions affected, ` +
        `file size: ${(fileSize/1024).toFixed(1)}KB`);

      // 2. Build RICH CodeContext for Action (for semantic search with actual code)
      const codeContext: import('../storage/schema').CodeContext = {
        changes: changeDetails.map((c) => ({
          file: relativePath,
          language: document.languageId,
          beforeCode: c.removedText || c.contextBefore,
          afterCode: c.addedText || c.contextAfter,
          function: c.affectedFunction?.name,
          fullFunctionBefore: c.affectedFunction?.fullBody,
          fullFunctionAfter: c.affectedFunction?.fullBody // TODO: Track before/after state
        })),
        relatedFunctions: changeDetails
          .filter(c => c.affectedFunction)
          .map(c => ({
            name: c.affectedFunction!.name,
            file: relativePath,
            body: c.affectedFunction!.fullBody
          })),
        imports: [], // TODO: Extract imports from file
        relatedFiles: [] // TODO: Find related files
      };

      // Create a rich natural language description for vector search
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

      // Queue action with RICH code context
      this.queue.enqueue({
        type: 'action',
        data: {
          session_id: this.sessionManager.getSessionId(),
          timestamp: Date.now(),
          description: description,
          code_context: JSON.stringify(codeContext),
          files: JSON.stringify([relativePath])
        }
      });

      console.log(`[ContextIngestion] Queued action with RICH CODE CONTEXT for embedding: "${description.substring(0, 100)}..."`);

      this.logToOutput(`[FILE_EDIT] ${relativePath} (${changes.length} changes)${affectedFunctionsList.length > 0 ? ` in ${affectedFunctionsList.join(', ')}` : ''}`);
      console.log(`[ContextIngestionService] File edited: ${relativePath} (${changes.length} changes)${affectedFunctionsList.length > 0 ? ` in ${affectedFunctionsList.join(', ')}` : ''}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ContextIngestionService] Error logging file_edit: ${errorMsg}`, error);
      this.logToOutput(`❌ Error logging file_edit: ${errorMsg}`);
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
          code_context: JSON.stringify({ 
            changes: [], 
            relatedFunctions: [], 
            imports: [], 
            relatedFiles: [] 
          }), // Minimal context for commits - could be enhanced to fetch actual diff
          files: JSON.stringify(commit.files)
        }
      });

      this.logToOutput(`[GIT_COMMIT] ${commit.hash} - ${commit.message} (${commit.files.length} files)`);
      console.log(`[ContextIngestionService] Logged git commit: ${commit.hash} - ${commit.message} (${commit.files.length} files)`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ContextIngestionService] Error logging git_commit: ${errorMsg}`, error);
      this.logToOutput(`❌ Error logging git_commit: ${errorMsg}`);
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
