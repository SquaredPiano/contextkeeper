// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { getLogsWithGitlog } from "./modules/gitlogs/gitlog";
import { FileWatcher } from "./modules/gitlogs/fileWatcher";
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "contextkeeper" is now active!');
  let fileWatcher: FileWatcher | null = null;

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "contextkeeper.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from contextkeeper!");
    }
  );

  const testGitlog = vscode.commands.registerCommand(
    "contextkeeper.testGitlog",
    async () => {
      try {
        vscode.window.showInformationMessage("Fetching git logs...");

        const logs = await getLogsWithGitlog();

        const outputChannel =
          vscode.window.createOutputChannel("ContextKeeper");
        outputChannel.clear();
        outputChannel.appendLine("=== Recent Git Commits ===");
        logs.forEach((commit: any, i: number) => {
          outputChannel.appendLine(`\n${i + 1}. ${commit.subject}`);
          outputChannel.appendLine(`   Author: ${commit.authorName}`);
          outputChannel.appendLine(`   Hash: ${commit.hash}`);
          outputChannel.appendLine(`   Date: ${commit.authorDate}`);
        });
        outputChannel.show();

        vscode.window.showInformationMessage(
          `✅ Found ${logs.length} commits!`
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`❌ Error: ${err.message}`);
        console.error("Gitlog error:", err);
      }
    }
  );

  const startWatcher = vscode.commands.registerCommand(
    "contextkeeper.startAutoLint",
    () => {
      if (fileWatcher) {
        vscode.window.showWarningMessage("Auto-lint is already running!");
        return;
      }

      // Get the linting endpoint from settings (or use default)
      const config = vscode.workspace.getConfiguration("contextkeeper");
      const endpoint =
        config.get<string>("lintingEndpoint") ||
        "https://contextkeeper-worker.workers.dev/lint";

      fileWatcher = new FileWatcher(endpoint);
      fileWatcher.start();

      vscode.window.showInformationMessage(
        "🔍 Auto-lint enabled! Files will be checked on save."
      );
    }
  );

  // Command to stop auto-linting
  const stopWatcher = vscode.commands.registerCommand(
    "contextkeeper.stopAutoLint",
    () => {
      if (!fileWatcher) {
        vscode.window.showWarningMessage("Auto-lint is not running!");
        return;
      }

      fileWatcher.stop();
      fileWatcher = null;

      vscode.window.showInformationMessage("⏸️ Auto-lint disabled.");
    }
  );

  context.subscriptions.push(testGitlog);
  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
