import gitlog from "gitlog"; // Default import, not named import
import * as vscode from "vscode";

export async function getLogsWithGitlog(): Promise<any[]> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (!workspaceFolder) {
    throw new Error("No workspace folder found");
  }

  const commits = await gitlog({
    repo: workspaceFolder,
    number: 10,
    fields: ["hash", "authorName", "authorDate", "subject"],
  });

  return commits;
}
