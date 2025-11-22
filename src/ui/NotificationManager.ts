/**
 * Notification Manager
 * 
 * Handles VSCode notifications and progress indicators.
 */

import * as vscode from 'vscode';

export class NotificationManager {
	/**
	 * Show a progress notification for long-running tasks
	 */
	static async withProgress<T>(
		title: string,
		task: (progress: vscode.Progress<{ increment?: number; message?: string }>) => Promise<T>
	): Promise<T> {
		return vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title,
				cancellable: false,
			},
			task
		);
	}

	/**
	 * Show a success notification
	 */
	static showSuccess(message: string, ...actions: string[]): Thenable<string | undefined> {
		return vscode.window.showInformationMessage(message, ...actions);
	}

	/**
	 * Show a warning notification
	 */
	static showWarning(message: string, ...actions: string[]): Thenable<string | undefined> {
		return vscode.window.showWarningMessage(message, ...actions);
	}

	/**
	 * Show an error notification
	 */
	static showError(message: string, ...actions: string[]): Thenable<string | undefined> {
		return vscode.window.showErrorMessage(message, ...actions);
	}

	/**
	 * Show analysis complete notification with actions
	 */
	static async showAnalysisComplete(issueCount: number): Promise<void> {
		const issueText = issueCount === 1 ? 'issue' : 'issues';
		const message = issueCount > 0
			? `🔍 Analysis complete! Found ${issueCount} ${issueText}.`
			: '✅ Analysis complete! No issues found.';

		const action = await this.showSuccess(message, 'View Results', 'Dismiss');

		if (action === 'View Results') {
			vscode.commands.executeCommand('copilot.showPanel');
		}
	}

	/**
	 * Show autonomous mode notification
	 */
	static async showAutonomousStarted(): Promise<void> {
		await this.showSuccess(
			'🤖 Autonomous mode enabled. Copilot will analyze your code when idle.',
			'Got it'
		);
	}

	/**
	 * Show autonomous analysis notification
	 */
	static async showAutonomousAnalysis(issueCount: number): Promise<void> {
		const issueText = issueCount === 1 ? 'issue' : 'issues';
		const action = await this.showSuccess(
			`🤖 Autonomous analysis complete! Found ${issueCount} ${issueText} while you were away.`,
			'View Results',
			'Dismiss'
		);

		if (action === 'View Results') {
			vscode.commands.executeCommand('copilot.showPanel');
		}
	}

	/**
	 * Show error with retry option
	 */
	static async showErrorWithRetry(
		message: string,
		retryCallback: () => Promise<void>
	): Promise<void> {
		const action = await this.showError(message, 'Retry', 'Dismiss');

		if (action === 'Retry') {
			await retryCallback();
		}
	}

	/**
	 * Show progress with steps
	 */
	static async showProgressWithSteps<T>(
		title: string,
		steps: Array<{ message: string; task: () => Promise<any> }>
	): Promise<void> {
		await this.withProgress(title, async (progress) => {
			const increment = 100 / steps.length;

			for (const step of steps) {
				progress.report({ message: step.message });
				await step.task();
				progress.report({ increment });
			}
		});
	}
}
