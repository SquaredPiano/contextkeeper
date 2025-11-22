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
    console.log(`[FileReader] Starting file scan in workspace: ${workspaceRoot}`);
    
    // Find all files in the workspace (excluding common ignores)
    const files = await vscode.workspace.findFiles(includePattern, excludePattern);

    channel.appendLine(`Found ${files.length} files matching pattern.`);
    console.log(`[FileReader] Found ${files.length} files matching pattern`);

    if (files.length === 0) {
      const warningMsg = `No files found matching pattern: ${includePattern}. Workspace may be empty or pattern too restrictive.`;
      channel.appendLine(`⚠️  ${warningMsg}`);
      console.warn(`[FileReader] ${warningMsg}`);
    }

    // Process files in parallel chunks to avoid blocking but also not overwhelm FS
    const chunkSize = 10;
    const skippedFilesDetails: Array<{ file: string; reason: string }> = [];
    
    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (fileUri) => {
        const filePath = fileUri.fsPath;
        try {
          const stats = await fs.stat(filePath);
          if (stats.size > maxFileSize) {
            skippedFiles++;
            skippedFilesDetails.push({ file: filePath, reason: `File too large: ${stats.size} bytes (max: ${maxFileSize})` });
            return;
          }
          
          const content = await fs.readFile(filePath, "utf-8");
          fileData.push({
            filePath: path.relative(workspaceRoot, filePath),
            content,
          });
        } catch (fileError) {
          skippedFiles++;
          const errorMsg = fileError instanceof Error ? fileError.message : String(fileError);
          skippedFilesDetails.push({ file: filePath, reason: errorMsg });
          console.warn(`[FileReader] Skipping file: ${filePath} - ${errorMsg}`, fileError);
        }
      }));
    }

    channel.appendLine(`Successfully read ${fileData.length} files. Skipped ${skippedFiles}.`);
    console.log(`[FileReader] Successfully read ${fileData.length} files. Skipped ${skippedFiles}`);
    
    if (skippedFiles > 0 && skippedFilesDetails.length > 0) {
      channel.appendLine(`Skipped files (showing first 10):`);
      skippedFilesDetails.slice(0, 10).forEach(({ file, reason }) => {
        channel.appendLine(`  - ${path.relative(workspaceRoot, file)}: ${reason}`);
      });
      if (skippedFilesDetails.length > 10) {
        channel.appendLine(`  ... and ${skippedFilesDetails.length - 10} more`);
      }
    }
    
    if (fileData.length > 0) {
      channel.appendLine(`Sample files:`);
      fileData.slice(0, 5).forEach((file) => {
        channel.appendLine(`- ${file.filePath} (${file.content.length} chars)`);
      });
    } else {
      const warningMsg = "No files were successfully read. Check file patterns and permissions.";
      channel.appendLine(`⚠️  ${warningMsg}`);
      console.warn(`[FileReader] ${warningMsg}`);
    }
    
    // Only show channel if explicitly requested or on error? 
    // For now, let's not force show it to avoid annoyance.
    // channel.show(); 

    return fileData;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const msg = `Error reading files: ${errorMsg}`;
    channel.appendLine(`❌ ${msg}`);
    vscode.window.showErrorMessage(msg);
    console.error(`[FileReader] ${msg}`, error);
    return [];
  }
}
