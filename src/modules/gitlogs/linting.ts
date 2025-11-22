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
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error(`Linting failed: ${response.statusText}`);
    }

    const result: any = await response.json();

    // Convert warnings to VS Code diagnostics
    if (result.warnings && Array.isArray(result.warnings)) {
      for (const warning of result.warnings) {
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

        // Add source and code if available
        diagnostic.source = "ContextKeeper";
        if (warning.code) {
          diagnostic.code = warning.code;
        }

        // Add related information if available
        if (warning.suggestedFix) {
          diagnostic.relatedInformation = [
            new vscode.DiagnosticRelatedInformation(
              new vscode.Location(doc.uri, range),
              `Suggested fix: ${warning.suggestedFix}`
            ),
          ];
        }

        diagnostics.push(diagnostic);
      }
    }

    // Update the diagnostic collection
    collection.set(doc.uri, diagnostics);

    // Log results
    if (diagnostics.length > 0) {
      console.log(
        `[Linting] Found ${diagnostics.length} issue(s) in ${doc.fileName}`
      );
    }
  } catch (error: any) {
    console.error(`[Linting] Error linting ${doc.fileName}:`, error);
    // On error, clear diagnostics to avoid stale data
    collection.delete(doc.uri);
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
