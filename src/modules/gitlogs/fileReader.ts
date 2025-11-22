  import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";

export interface FileData {
  filePath: string;
  content: string;
}

export interface FileReaderOptions {
  maxFileSize?: number; // bytes, default 100KB
  includePattern?: string;
  excludePattern?: string;
}

let outputChannel: vscode.OutputChannel | undefined;

function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("File Reader");
  }
  return outputChannel;
}

/**
 * Reads all code files from the workspace
 */
export async function readAllFilesHandler(options: FileReaderOptions = {}): Promise<FileData[]> {
  // Ensure a workspace is open
  if (!vscode.workspace.workspaceFolders) {
    vscode.window.showErrorMessage("❌ No folder or workspace opened!");
    return [];
  }

  const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const fileData: FileData[] = [];
  let skippedFiles = 0;
  const maxFileSize = options.maxFileSize || 100000;
  const includePattern = options.includePattern || "**/*.{ts,js,tsx,jsx,json,md}";
  const excludePattern = options.excludePattern || "{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/build/**}";

  try {
    const channel = getOutputChannel();
    channel.appendLine(`[${new Date().toISOString()}] Starting file scan...`);
    
    // Find all files in the workspace (excluding common ignores)
    const files = await vscode.workspace.findFiles(includePattern, excludePattern);

    channel.appendLine(`Found ${files.length} files matching pattern.`);

    // Process files in parallel chunks to avoid blocking but also not overwhelm FS
    const chunkSize = 10;
    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (fileUri) => {
        const filePath = fileUri.fsPath;
        try {
          const stats = await fs.stat(filePath);
          if (stats.size > maxFileSize) {
            skippedFiles++;
            return;
          }
          
          const content = await fs.readFile(filePath, "utf-8");
          fileData.push({
            filePath: path.relative(workspaceRoot, filePath),
            content,
          });
        } catch (fileError) {
          console.warn(`Skipping file: ${filePath}`, fileError);
          skippedFiles++;
        }
      }));
    }

    channel.appendLine(`Successfully read ${fileData.length} files. Skipped ${skippedFiles}.`);
    
    if (fileData.length > 0) {
      channel.appendLine(`Sample files:`);
      fileData.slice(0, 5).forEach((file) => {
        channel.appendLine(`- ${file.filePath} (${file.content.length} chars)`);
      });
    }
    
    // Only show channel if explicitly requested or on error? 
    // For now, let's not force show it to avoid annoyance.
    // channel.show(); 

    return fileData;
  } catch (error) {
    const msg = `Error reading files: ${error instanceof Error ? error.message : String(error)}`;
    vscode.window.showErrorMessage(msg);
    console.error(msg);
    return [];
  }
}
