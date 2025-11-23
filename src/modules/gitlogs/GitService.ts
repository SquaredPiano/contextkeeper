import { GitCommit } from "./types";
import { IGitService } from "../../services/interfaces";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

export class GitService implements IGitService {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  public async getRecentCommits(limit: number = 10): Promise<GitCommit[]> {
    try {
      // Dynamic import to handle ESM module in CJS environment
      const gitlogModule = await import("gitlog");
      // @ts-ignore
      const gitlog = gitlogModule.default || gitlogModule;
      // @ts-ignore
      const promiseFunc = gitlog.gitlogPromise || gitlog;

      const commits = await promiseFunc({
        repo: this.repoPath,
        number: limit,
        fields: ["hash", "authorName", "authorDate", "subject", "files"],
      });

      return commits.map((c: { hash: string; authorName: string; authorDate: string; subject: string; files?: string[] }) => ({
        hash: c.hash,
        message: c.subject,
        author: c.authorName,
        date: new Date(c.authorDate),
        files: c.files || [],
      }));
    } catch (error) {
      console.error("Failed to fetch git logs:", error);
      return [];
    }
  }

  public async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execPromise('git branch --show-current', { cwd: this.repoPath });
      const branch = stdout.trim();
      return branch || "unknown";
    } catch (e) {
      console.warn(`[GitService] Failed to get current branch: ${e instanceof Error ? e.message : String(e)}`);
      return "unknown";
    }
  }

  public async getUncommittedChanges(): Promise<string[]> {
    try {
      // Get list of modified, added, and deleted files
      const { stdout: statusStdout } = await execPromise('git status --porcelain', { cwd: this.repoPath });
      
      if (!statusStdout || !statusStdout.trim()) {
        return [];
      }

      // Parse porcelain format: XY filename
      // X = index status, Y = working tree status
      // M = modified, A = added, D = deleted, R = renamed, C = copied
      const changes: string[] = [];
      const lines = statusStdout.trim().split('\n');
      
      for (const line of lines) {
        if (line.length < 3) {
          continue;
        }
        
        const status = line.substring(0, 2);
        const filePath = line.substring(3).trim();
        
        // Only include files that have actual changes (not just untracked)
        if (status[0] !== '?' && status[1] !== '?') {
          changes.push(filePath);
        }
      }
      
      return changes;
    } catch (e) {
      console.warn(`[GitService] Failed to get uncommitted changes: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  }

  public async createBranch(name: string): Promise<void> {
    await execPromise(`git checkout -b ${name}`, { cwd: this.repoPath });
  }

  public async commit(message: string, files: string[] = ['.']): Promise<void> {
    await execPromise(`git add ${files.join(' ')} && git commit -m "${message}"`, { cwd: this.repoPath });
  }

  public async applyDiff(_diff: string): Promise<void> {
    // This is complex to implement with just exec, usually requires a patch file
    // For now, we'll leave it as a placeholder or implement basic apply
    throw new Error("Method not implemented.");
  }

  public async getBranches(): Promise<string[]> {
    try {
      const { stdout } = await execPromise('git branch', { cwd: this.repoPath });
      return stdout
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('*'))
        .map(line => line.replace(/^\*\s*/, '').trim());
    } catch (error) {
      console.warn('Failed to get branches:', error);
      return [];
    }
  }

  public async checkoutBranch(branchName: string): Promise<void> {
    try {
      await execPromise(`git checkout ${branchName}`, { cwd: this.repoPath });
    } catch (error: unknown) {
      console.error(`Failed to checkout branch ${branchName}:`, error);
      throw error;
    }
  }

  public async deleteBranch(branchName: string, force: boolean = false): Promise<void> {
    try {
      const flag = force ? '-D' : '-d';
      await execPromise(`git branch ${flag} ${branchName}`, { cwd: this.repoPath });
    } catch (error: unknown) {
      console.error(`Failed to delete branch ${branchName}:`, error);
      throw error;
    }
  }

  public async mergeBranch(branchName: string): Promise<void> {
    try {
      await execPromise(`git merge ${branchName}`, { cwd: this.repoPath });
    } catch (error: unknown) {
      console.error(`Failed to merge branch ${branchName}:`, error);
      throw error;
    }
  }
}
