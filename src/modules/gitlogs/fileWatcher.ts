import * as vscode from "vscode";

export class FileWatcher {
  private watcher: vscode.FileSystemWatcher | null = null;
  private disposables: vscode.Disposable[] = [];
  private lintingEndpoint: string;

  constructor(
    lintingEndpoint: string = "https://your-worker.workers.dev/lint"
  ) {
    this.lintingEndpoint = lintingEndpoint;
  }

  /**
   * Start watching files in the workspace
   */
  public start(): void {
    console.log("[FileWatcher] Starting file monitoring...");

    // Method 1: Watch specific file patterns (glob patterns)
    // This creates a watcher for TypeScript and JavaScript files
    this.watcher = vscode.workspace.createFileSystemWatcher(
      "**/*.{ts,js,tsx,jsx}", // Watch these file types
      false, // Don't ignore creates
      false, // Don't ignore changes
      false // Don't ignore deletes
    );

    // React to file creation
    this.watcher.onDidCreate((uri) => {
      console.log(`[FileWatcher] File created: ${uri.fsPath}`);
      vscode.window.showInformationMessage(`📄 New file: ${uri.fsPath}`);
    });

    // React to file changes
    this.watcher.onDidChange((uri) => {
      console.log(`[FileWatcher] File changed: ${uri.fsPath}`);
    });

    // React to file deletion
    this.watcher.onDidDelete((uri) => {
      console.log(`[FileWatcher] File deleted: ${uri.fsPath}`);
    });

    // Method 2: Watch for document saves (best for auto-linting)
    const saveWatcher = vscode.workspace.onDidSaveTextDocument(
      async (document) => {
        await this.onFileSaved(document);
      }
    );

    // Method 3: Watch for any text document changes (real-time)
    const changeWatcher = vscode.workspace.onDidChangeTextDocument((event) => {
      // Only process if there are actual content changes
      if (event.contentChanges.length > 0) {
        console.log(
          `[FileWatcher] Document modified: ${event.document.fileName}`
        );
      }
    });

    this.disposables.push(saveWatcher, changeWatcher);
  }

  /**
   * Handle file save event - auto-lint the file
   */
  private async onFileSaved(document: vscode.TextDocument): Promise<void> {
    // Only process certain file types
    const validExtensions = [".ts", ".js", ".tsx", ".jsx"];
    const fileExt = document.fileName.substring(
      document.fileName.lastIndexOf(".")
    );

    if (!validExtensions.includes(fileExt)) {
      return; // Skip non-code files
    }

    console.log(`[FileWatcher] Auto-linting: ${document.fileName}`);

    try {
      const code = document.getText();

      // Call your Cloudflare worker to lint the code
      const response = await fetch(this.lintingEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        throw new Error(`Linting failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Show results to user
      if (result.warnings && result.warnings.length > 0) {
        const message = `⚠️ ${result.warnings.length} issue(s) found in ${document.fileName}`;
        vscode.window.showWarningMessage(message);

        // Optionally show detailed warnings in output channel
        const outputChannel = vscode.window.createOutputChannel("Auto-Linter");
        outputChannel.clear();
        outputChannel.appendLine(
          `=== Linting Results for ${document.fileName} ===\n`
        );
        result.warnings.forEach((warning: any) => {
          outputChannel.appendLine(`[${warning.severity}] ${warning.message}`);
        });
        outputChannel.show();
      } else {
        vscode.window.showInformationMessage(
          `✅ No issues found in ${document.fileName}`
        );
      }

      // If linting produced a fixed version, optionally apply it
      if (result.linted && result.fixed !== code) {
        const applyFix = await vscode.window.showInformationMessage(
          "Apply auto-fix?",
          "Yes",
          "No"
        );

        if (applyFix === "Yes") {
          await this.applyFix(document, result.fixed);
        }
      }
    } catch (error) {
      console.error("[FileWatcher] Linting error:", error);
      vscode.window.showErrorMessage(`Linting failed: ${error}`);
    }
  }

  /**
   * Apply the fixed code to the document
   */
  private async applyFix(
    document: vscode.TextDocument,
    fixedCode: string
  ): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );
    edit.replace(document.uri, fullRange, fixedCode);
    await vscode.workspace.applyEdit(edit);
    await document.save();
    vscode.window.showInformationMessage("✅ Auto-fix applied!");
  }

  /**
   * Stop watching files and clean up
   */
  public stop(): void {
    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = null;
    }
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    console.log("[FileWatcher] Stopped file monitoring");
  }
}
