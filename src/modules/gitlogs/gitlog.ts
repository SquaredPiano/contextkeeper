// @ts-ignore
import * as gitlog from "gitlog";
import * as vscode from "vscode";

export async function getLogsWithGitlog(repoPath?: string): Promise<any[]> {
  const workspaceFolder = repoPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (!workspaceFolder) {
    throw new Error("No workspace folder found");
  }

  // Dynamic import to handle ESM/CJS interop issues in different environments
  // @ts-ignore
  const gl = gitlog.default || gitlog;
  // @ts-ignore
  const promiseFunc = gl.gitlogPromise || gl;

  const commits = await promiseFunc({
    repo: workspaceFolder,
    number: 10,
    fields: ["hash", "authorName", "authorDate", "subject"],
  });

  return commits;
}
