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

    async getBranches(): Promise<string[]> {
        try {
            const branches = await this.git.branchLocal();
            return branches.all.filter(b => b !== '*').map(b => b.trim());
        } catch (error) {
            console.warn('Failed to get branches:', error);
            return [];
        }
    }

    async checkoutBranch(branchName: string): Promise<void> {
        try {
            await this.git.checkout(branchName);
            console.log(`Checked out branch: ${branchName}`);
        } catch (error: any) {
            console.error(`Failed to checkout branch ${branchName}:`, error);
            throw error;
        }
    }

    async deleteBranch(branchName: string, force: boolean = false): Promise<void> {
        try {
            console.log(`[GitService] Deleting branch: ${branchName} (force: ${force})`);
            if (force) {
                await this.git.branch(['-D', branchName]);
            } else {
                await this.git.branch(['-d', branchName]);
            }
            console.log(`[GitService] Successfully deleted branch: ${branchName}`);
        } catch (error: any) {
            console.error(`[GitService] Failed to delete branch ${branchName}:`, error);
            // Provide more helpful error message
            const errorMsg = error?.message || String(error);
            if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
                throw new Error(`Branch "${branchName}" does not exist`);
            } else if (errorMsg.includes('not fully merged')) {
                throw new Error(`Branch "${branchName}" is not fully merged. Use force delete if you want to delete it anyway.`);
            }
            throw error;
        }
    }

    async mergeBranch(branchName: string): Promise<void> {
        try {
            console.log(`[GitService] Merging branch: ${branchName} into current branch`);
            await this.git.merge([branchName, '--no-edit']); // Use --no-edit to avoid opening editor
            console.log(`[GitService] Successfully merged branch: ${branchName}`);
        } catch (error: any) {
            console.error(`[GitService] Failed to merge branch ${branchName}:`, error);
            // Provide more helpful error message
            const errorMsg = error?.message || String(error);
            if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
                throw new Error(`Branch "${branchName}" does not exist`);
            } else if (errorMsg.includes('conflict') || errorMsg.includes('CONFLICT')) {
                throw new Error(`Merge conflict detected. Please resolve conflicts manually.`);
            } else if (errorMsg.includes('already up to date')) {
                throw new Error(`Branch "${branchName}" is already up to date with current branch`);
            }
            throw error;
        }
    }
}
