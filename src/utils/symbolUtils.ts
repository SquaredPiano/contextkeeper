import * as vscode from 'vscode';

/**
 * Finds the function or method symbol that contains the given position.
 * Enhanced to handle React components, arrow functions, and other patterns.
 * @param symbols List of document symbols
 * @param pos The position to check
 * @returns The name of the function/method, or undefined if not found
 */
export function findFunctionAtPosition(
    symbols: vscode.DocumentSymbol[],
    pos: vscode.Position
): string | undefined {
    for (const symbol of symbols) {
        if (symbol.range.contains(pos)) {
            // Check if this symbol itself is a function-like construct
            if (
                symbol.kind === vscode.SymbolKind.Function ||
                symbol.kind === vscode.SymbolKind.Method ||
                symbol.kind === vscode.SymbolKind.Constructor ||
                symbol.kind === vscode.SymbolKind.Variable || // Arrow functions assigned to variables
                symbol.kind === vscode.SymbolKind.Constant   // Const arrow functions
            ) {
                // For variables/constants, check if they might be components (capitalized)
                if (symbol.kind === vscode.SymbolKind.Variable || symbol.kind === vscode.SymbolKind.Constant) {
                    // If it's a capitalized name, it's likely a React component
                    if (symbol.name[0] === symbol.name[0].toUpperCase()) {
                        return symbol.name;
                    }
                    // Also check if name contains "Component", "Handler", "Hook", etc.
                    if (/Component|Handler|Hook|Function|Callback/.test(symbol.name)) {
                        return symbol.name;
                    }
                } else {
                    return symbol.name;
                }
            }
            
            // Recursively search children
            const child = findFunctionAtPosition(symbol.children, pos);
            if (child) {
                return child;
            }
        }
    }
    return undefined;
}

/**
 * Retrieves the document symbols for a given document.
 * @param uri The URI of the document
 * @returns A promise resolving to an array of DocumentSymbols
 */
export async function getDocumentSymbols(uri: vscode.Uri): Promise<vscode.DocumentSymbol[]> {
    try {
        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            uri
        );
        return symbols || [];
    } catch (e) {
        console.warn(`Failed to get symbols for ${uri.fsPath}:`, e);
        return [];
    }
}
