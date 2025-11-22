import { IGitService, GitCommit } from '../interfaces';
import simpleGit, { SimpleGit } from 'simple-git';
import * as vscode from 'vscode';

export class GitService implements IGitService {
    private git: SimpleGit;
    private workspaceRoot: string;

    constructor(workspaceRoot?: string) {
        this.workspaceRoot = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        this.git = simpleGit(this.workspaceRoot);
    }

    async createBranch(name: string): Promise<void> {
        try {
            await this.git.checkoutLocalBranch(name);
            console.log(`Created and checked out branch: ${name}`);
        } catch (error: any) {
            console.error(`Failed to create branch ${name}:`, error);
            throw error;
        }
    }

    async commit(message: string, files: string[] = ['.']): Promise<void> {
        try {
            await this.git.add(files);
            await this.git.commit(message);
            console.log(`Committed changes: ${message}`);
        } catch (error: any) {
            console.error('Failed to commit:', error);
            throw error;
        }
    }

    async applyDiff(diff: string): Promise<void> {
        try {
            await this.git.applyPatch(diff);
        } catch (error: any) {
            console.error('Failed to apply diff:', error);
            throw error;
        }
    }

    async getCurrentBranch(): Promise<string> {
        const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
        return branch ?? 'unknown';
    }

    async getRecentCommits(count: number): Promise<GitCommit[]> {
        try {
            const log = await this.git.log({ maxCount: count });
            return log.all.map(c => ({
                hash: c.hash,
                message: c.message,
                author: c.author_name,
                date: new Date(c.date)
            }));
        } catch (error) {
            console.warn('Failed to get git log:', error);
            return [];
        }
    }
}
