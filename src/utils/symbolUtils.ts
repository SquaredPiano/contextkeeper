import * as vscode from 'vscode';

/**
 * Finds the function or method symbol that contains the given position.
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
            if (
                symbol.kind === vscode.SymbolKind.Function ||
                symbol.kind === vscode.SymbolKind.Method ||
                symbol.kind === vscode.SymbolKind.Constructor
            ) {
                return symbol.name;
            }
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
