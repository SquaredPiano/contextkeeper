import * as vscode from "vscode";
import { GitService } from "./GitService";
import { GitCommit } from "./types";

/**
 * @deprecated Use GitService instead
 */
export async function getLogsWithGitlog(repoPath?: string): Promise<GitCommit[]> {
  const workspaceFolder = repoPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (!workspaceFolder) {
    throw new Error("No workspace folder found");
  }

  const gitService = new GitService(workspaceFolder);
  return gitService.getRecentCommits(10);
}
