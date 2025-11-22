/**
 * Issues Tree View Provider
 * 
 * Displays issues in a hierarchical tree structure:
 * - Root: Files with issues
 * - Children: Individual issues in each file
 */

import * as vscode from 'vscode';
import { Issue, AIAnalysis } from '../services/interfaces';

export class IssuesTreeProvider implements vscode.TreeDataProvider<IssueTreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<IssueTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private issues: Issue[] = [];
	private groupedIssues: Map<string, Issue[]> = new Map();

	constructor() {}

	/**
	 * Update the tree with new analysis results
	 */
	updateAnalysis(analysis: AIAnalysis): void {
		this.issues = analysis.issues;
		this.groupByFile();
		this.refresh();
	}

	/**
	 * Clear all issues
	 */
	clear(): void {
		this.issues = [];
		this.groupedIssues.clear();
		this.refresh();
	}

	/**
	 * Refresh the tree view
	 */
	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: IssueTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: IssueTreeItem): Thenable<IssueTreeItem[]> {
		if (!element) {
			// Root level: return file groups
			return Promise.resolve(this.getFileGroupItems());
		} else {
			// Child level: return issues for this file
			return Promise.resolve(this.getIssueItems(element.resourceUri!.fsPath));
		}
	}

	private groupByFile(): void {
		this.groupedIssues.clear();
		
		for (const issue of this.issues) {
			if (!this.groupedIssues.has(issue.file)) {
				this.groupedIssues.set(issue.file, []);
			}
			this.groupedIssues.get(issue.file)!.push(issue);
		}
	}

	private getFileGroupItems(): IssueTreeItem[] {
		const items: IssueTreeItem[] = [];

		for (const [file, issues] of this.groupedIssues.entries()) {
			const errorCount = issues.filter(i => i.severity === 'error').length;
			const warningCount = issues.filter(i => i.severity === 'warning').length;
			const infoCount = issues.filter(i => i.severity === 'info').length;

			const fileName = file.split('/').pop() || file;
			const label = `${fileName} (${issues.length})`;
			
			let description = [];
			if (errorCount > 0) {description.push(`${errorCount} errors`);}
			if (warningCount > 0) {description.push(`${warningCount} warnings`);}
			if (infoCount > 0) {description.push(`${infoCount} info`);}

			const item = new IssueTreeItem(
				label,
				vscode.TreeItemCollapsibleState.Expanded,
				'file'
			);
			item.description = description.join(', ');
			item.resourceUri = vscode.Uri.file(file);
			item.iconPath = new vscode.ThemeIcon('file');
			item.contextValue = 'fileGroup';

			items.push(item);
		}

		return items;
	}

	private getIssueItems(file: string): IssueTreeItem[] {
		const issues = this.groupedIssues.get(file) || [];
		
		return issues.map(issue => {
			const item = new IssueTreeItem(
				issue.message,
				vscode.TreeItemCollapsibleState.None,
				'issue'
			);

			item.description = `Line ${issue.line}`;
			item.tooltip = this.createTooltip(issue);
			item.iconPath = this.getIconForSeverity(issue.severity);
			item.contextValue = 'issue';
			
			// Click to navigate to issue
			item.command = {
				command: 'copilot.navigateToIssue',
				title: 'Go to Issue',
				arguments: [issue.file, issue.line, issue.column],
			};

			// Store issue data for context menu actions
			item.issueData = issue;

			return item;
		});
	}

	private createTooltip(issue: Issue): vscode.MarkdownString {
		const tooltip = new vscode.MarkdownString();
		tooltip.supportHtml = true;
		tooltip.isTrusted = true;

		tooltip.appendMarkdown(`**${issue.severity.toUpperCase()}**: ${issue.message}\n\n`);
		tooltip.appendMarkdown(`**Location**: ${issue.file}:${issue.line}:${issue.column}\n\n`);
		
		if (issue.codeSnippet) {
			tooltip.appendMarkdown(`**Code**:\n\`\`\`\n${issue.codeSnippet}\n\`\`\`\n\n`);
		}
		
		if (issue.suggestedFix) {
			tooltip.appendMarkdown(`**Suggested Fix**: ${issue.suggestedFix}`);
		}

		return tooltip;
	}

	private getIconForSeverity(severity: string): vscode.ThemeIcon {
		switch (severity) {
			case 'error':
				return new vscode.ThemeIcon('error', new vscode.ThemeColor('editorError.foreground'));
			case 'warning':
				return new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
			case 'info':
				return new vscode.ThemeIcon('info', new vscode.ThemeColor('editorInfo.foreground'));
			default:
				return new vscode.ThemeIcon('circle-outline');
		}
	}
}

/**
 * Tree item for issues tree view
 */
class IssueTreeItem extends vscode.TreeItem {
	issueData?: Issue;

	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly type: 'file' | 'issue'
	) {
		super(label, collapsibleState);
	}
}
