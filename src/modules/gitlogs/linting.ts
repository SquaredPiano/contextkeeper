import * as vscode from "vscode";

/**
 * Lint a document and update the diagnostic collection
 * This function performs linting and creates VS Code diagnostics
 */
export async function refreshDiagnostics(
  doc: vscode.TextDocument,
  collection: vscode.DiagnosticCollection
): Promise<void> {
  // Only lint certain file types
  const validExtensions = [".ts", ".js", ".tsx", ".jsx", ".py"];
  const fileExt = doc.fileName.substring(doc.fileName.lastIndexOf("."));
  
  if (!validExtensions.includes(fileExt)) {
    // Clear diagnostics for non-code files
    collection.delete(doc.uri);
    return;
  }

  try {
    const code = doc.getText();
    const diagnostics: vscode.Diagnostic[] = [];

    // Get linting endpoint from settings
    const config = vscode.workspace.getConfiguration("contextkeeper");
    const endpoint =
      config.get<string>("lintingEndpoint") ||
      "https://contextkeeper-worker.workers.dev/lint";

    // Call linting endpoint
    // Check if endpoint is the default placeholder and skip if so
    if (endpoint.includes("contextkeeper-worker.workers.dev")) {
      // Fallback to local linting if no remote is configured
      const localIssues = LocalLinter.lint(code, fileExt.replace('.', ''));
      updateDiagnostics(doc, collection, localIssues);
      return;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error(`Linting failed: ${response.statusText}`);
    }

    const result: any = await response.json();
    updateDiagnostics(doc, collection, result.warnings || []);

  } catch (error: any) {
    // Suppress fetch errors for remote linting to avoid noise
    if (error.message && (error.message.includes("fetch failed") || error.message.includes("ENOTFOUND"))) {
      console.warn(`[Linting] Remote linting unavailable, falling back to local: ${error.message}`);
      // Fallback to local
      const localIssues = LocalLinter.lint(doc.getText(), doc.languageId);
      updateDiagnostics(doc, collection, localIssues);
      return;
    }
    console.error(`[Linting] Error linting ${doc.fileName}:`, error);
    // On error, clear diagnostics to avoid stale data
    collection.delete(doc.uri);
  }
}

function updateDiagnostics(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection, issues: any[]) {
    const diagnostics: vscode.Diagnostic[] = [];
    
    for (const warning of issues) {
        const line = Math.max(0, (warning.line || 1) - 1); // Convert to 0-based
        const column = Math.max(0, (warning.column || 1) - 1);
        
        const range = new vscode.Range(
          line,
          column,
          line,
          Math.max(column + 1, doc.lineAt(line).range.end.character)
        );

        const severity = mapSeverityToDiagnostic(warning.severity);
        const diagnostic = new vscode.Diagnostic(
          range,
          warning.message || "Linting issue",
          severity
        );

        diagnostic.source = "ContextKeeper";
        diagnostics.push(diagnostic);
    }
    collection.set(doc.uri, diagnostics);
}

class LocalLinter {
    static lint(code: string, language: string): any[] {
        const issues: any[] = [];
        const lines = code.split('\n');

        // 1. Check for console.log usage
        const consoleLogRegex = /console\.log\(/g;
        let match;
        while ((match = consoleLogRegex.exec(code)) !== null) {
            const lineIndex = code.substring(0, match.index).split('\n').length;
            issues.push({
                line: lineIndex,
                message: 'Avoid using console.log in production code.',
                severity: 'warning'
            });
        }

        // 2. Check for TODOs
        const todoRegex = /\/\/ TODO:/g;
        while ((match = todoRegex.exec(code)) !== null) {
            const lineIndex = code.substring(0, match.index).split('\n').length;
            issues.push({
                line: lineIndex,
                message: 'Found a TODO comment.',
                severity: 'info'
            });
        }

        // 3. Check for 'any' type (TypeScript)
        if (language === 'typescript' || language === 'ts' || language === 'tsx') {
            const anyRegex = /: any/g;
            while ((match = anyRegex.exec(code)) !== null) {
                const lineIndex = code.substring(0, match.index).split('\n').length;
                issues.push({
                    line: lineIndex,
                    message: 'Avoid using "any" type. Be explicit.',
                    severity: 'warning'
                });
            }
        }

        return issues;
    }
}


/**
 * Map severity string to VS Code DiagnosticSeverity
 */
function mapSeverityToDiagnostic(
  severity: string
): vscode.DiagnosticSeverity {
  switch (severity?.toLowerCase()) {
    case "error":
      return vscode.DiagnosticSeverity.Error;
    case "warning":
      return vscode.DiagnosticSeverity.Warning;
    case "info":
      return vscode.DiagnosticSeverity.Information;
    default:
      return vscode.DiagnosticSeverity.Warning;
  }
}

/**
 * Lint all open documents
 */
export async function refreshAllDiagnostics(
  collection: vscode.DiagnosticCollection
): Promise<void> {
  const openDocuments = vscode.workspace.textDocuments;
  for (const doc of openDocuments) {
    await refreshDiagnostics(doc, collection);
  }
}
