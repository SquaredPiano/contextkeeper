import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export interface FileData {
  filePath: string;
  content: string;
}

/**
 * Reads all code files from the workspace
 */
export async function readAllFilesHandler(): Promise<FileData[]> {
  // Ensure a workspace is open
  if (!vscode.workspace.workspaceFolders) {
    vscode.window.showErrorMessage("❌ No folder or workspace opened!");
    return [];
  }

  const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const fileData: FileData[] = [];
  let skippedFiles = 0;

  try {
    vscode.window.showInformationMessage("📚 Finding files...");

    // Find all files in the workspace (excluding common ignores)
    const files = await vscode.workspace.findFiles(
      "**/*.{ts,js,tsx,jsx,json,md}", // Only specific file types
      "{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/build/**}"
    );

    vscode.window.showInformationMessage(`📖 Reading ${files.length} files...`);

    for (const fileUri of files) {
      const filePath = fileUri.fsPath;

      try {
        // Read file content
        const content = fs.readFileSync(filePath, "utf-8");
        // Skip files larger than 100KB
        if (content.length > 100000) {
          console.log(`Skipping large file: ${filePath}`);
          skippedFiles++;
          continue;
        }
        fileData.push({
          filePath: path.relative(workspaceRoot, filePath),
          content,
        });
      } catch (fileError) {
        // Skip files that can't be read (binary, permissions, etc.)
        console.log(`Skipping file: ${filePath}`, fileError); // ✅ Fixed
        skippedFiles++;
        continue;
      }
    }
    // Log the collected data
    console.log(`Successfully read ${fileData.length} files:`, fileData); // ✅ Fixed

    if (skippedFiles > 0) {
      vscode.window.showInformationMessage(
        `✅ Read ${fileData.length} files (skipped ${skippedFiles})`
      );
    } else {
      vscode.window.showInformationMessage(
        `✅ Successfully read ${fileData.length} files!`
      );
    }

    // Show sample in output channel
    const outputChannel = vscode.window.createOutputChannel("File Reader");
    outputChannel.clear();
    outputChannel.appendLine(`=== Files Read: ${fileData.length} ===\n`);

    fileData.slice(0, 5).forEach((file) => {
      outputChannel.appendLine(`📄 ${file.filePath}`);
      outputChannel.appendLine(`   Size: ${file.content.length} chars`);
      outputChannel.appendLine("");
    });

    if (fileData.length > 5) {
      outputChannel.appendLine(`... and ${fileData.length - 5} more files`);
    }
    outputChannel.show();
    return fileData;
  } catch (error) {
    vscode.window.showErrorMessage(
      ` Error: ${error instanceof Error ? error.message : String(error)}`
    );
    console.error("Error reading files:", error);
    return [];
  }
}
