import * as vscode from "vscode";
import { EventEmitter } from "events";
import { refreshDiagnostics, refreshAllDiagnostics } from "./linting";
import { IContextService } from "../../services/interfaces";

/**
 * LintingService manages VS Code diagnostics and triggers linting
 * on various events: git logs, file edits, opens, closes, function closes
 */
export class LintingService extends EventEmitter {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private contextService: IContextService | null = null;
  private disposables: vscode.Disposable[] = [];
  private isEnabled: boolean = true;
  private lintingDebounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 500; // ms

  constructor() {
    super();
    // Create a diagnostic collection for our extension
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection(
      "contextkeeper"
    );
  }

  /**
   * Initialize the linting service with context service
   */
  public initialize(contextService: IContextService): void {
    this.contextService = contextService;
    this.setupEventListeners();
  }

  /**
   * Enable or disable linting
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      // Clear all diagnostics when disabled
      this.diagnosticCollection.clear();
    }
  }

  /**
   * Set up event listeners for all linting triggers
   */
  private setupEventListeners(): void {
    // 1. Git logs refresh - lint when git context is updated
    if (this.contextService) {
      // Listen for context collection events (which includes git refresh)
      this.contextService.on("contextCollected", () => {
        if (this.isEnabled) {
          this.debouncedLintAll();
        }
      });
      
      // Also listen for direct git context refresh events
      this.contextService.on("gitContextRefreshed", () => {
        if (this.isEnabled) {
          this.debouncedLintAll();
        }
      });
    }

    // 2. File edits - lint on document changes
    const changeListener = vscode.workspace.onDidChangeTextDocument(
      async (event) => {
        if (!this.isEnabled) return;
        if (event.contentChanges.length === 0) return;

        // Debounce linting to avoid excessive calls
        this.debouncedLint(event.document);
      }
    );

    // 3. Files opened - lint when a file is opened
    const openListener = vscode.workspace.onDidOpenTextDocument(
      async (doc) => {
        if (!this.isEnabled) return;
        await refreshDiagnostics(doc, this.diagnosticCollection);
      }
    );

    // 4. Files closed - lint related files when a file is closed
    const closeListener = vscode.workspace.onDidCloseTextDocument(
      async (doc) => {
        if (!this.isEnabled) return;
        // Remove diagnostics for closed file
        this.diagnosticCollection.delete(doc.uri);
        // Optionally lint other open files that might be affected
        this.debouncedLintAll();
      }
    );

    // 5. Function/Component closed - lint when function is closed
    if (this.contextService && "on" in this.contextService) {
      this.contextService.on("functionClosed", async (file: string) => {
        if (!this.isEnabled) return;
        const doc = vscode.workspace.textDocuments.find(
          (d) => d.fileName === file
        );
        if (doc) {
          await refreshDiagnostics(doc, this.diagnosticCollection);
        }
      });
    }

    // 6. File context changes - lint when active editor changes
    const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(
      async (editor) => {
        if (!this.isEnabled) return;
        if (editor) {
          await refreshDiagnostics(
            editor.document,
            this.diagnosticCollection
          );
        }
      }
    );

    // Also lint on save
    const saveListener = vscode.workspace.onDidSaveTextDocument(
      async (doc) => {
        if (!this.isEnabled) return;
        await refreshDiagnostics(doc, this.diagnosticCollection);
      }
    );

    // Store all disposables
    this.disposables.push(
      changeListener,
      openListener,
      closeListener,
      editorChangeListener,
      saveListener
    );
  }

  /**
   * Debounced linting for a single document
   */
  private debouncedLint(doc: vscode.TextDocument): void {
    if (this.lintingDebounceTimer) {
      clearTimeout(this.lintingDebounceTimer);
    }

    this.lintingDebounceTimer = setTimeout(async () => {
      await refreshDiagnostics(doc, this.diagnosticCollection);
      this.lintingDebounceTimer = null;
    }, this.DEBOUNCE_DELAY);
  }

  /**
   * Debounced linting for all open documents
   */
  private debouncedLintAll(): void {
    if (this.lintingDebounceTimer) {
      clearTimeout(this.lintingDebounceTimer);
    }

    this.lintingDebounceTimer = setTimeout(async () => {
      await refreshAllDiagnostics(this.diagnosticCollection);
      this.lintingDebounceTimer = null;
    }, this.DEBOUNCE_DELAY);
  }

  /**
   * Manually trigger linting for a specific document
   */
  public async lintDocument(doc: vscode.TextDocument): Promise<void> {
    if (!this.isEnabled) return;
    await refreshDiagnostics(doc, this.diagnosticCollection);
  }

  /**
   * Manually trigger linting for all open documents
   */
  public async lintAllDocuments(): Promise<void> {
    if (!this.isEnabled) return;
    await refreshAllDiagnostics(this.diagnosticCollection);
  }

  /**
   * Get the diagnostic collection (for external access if needed)
   */
  public getDiagnosticCollection(): vscode.DiagnosticCollection {
    return this.diagnosticCollection;
  }

  /**
   * Clean up and dispose of all listeners
   */
  public dispose(): void {
    if (this.lintingDebounceTimer) {
      clearTimeout(this.lintingDebounceTimer);
    }
    this.disposables.forEach((d) => d.dispose());
    this.diagnosticCollection.dispose();
    this.disposables = [];
  }
}

