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

      return commits.map((c: any) => ({
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
      return stdout.trim();
    } catch (e) {
      return "unknown";
    }
  }

  public async createBranch(name: string): Promise<void> {
    await execPromise(`git checkout -b ${name}`, { cwd: this.repoPath });
  }

  public async commit(message: string, files: string[] = ['.']): Promise<void> {
    await execPromise(`git add ${files.join(' ')} && git commit -m "${message}"`, { cwd: this.repoPath });
  }

  public async applyDiff(diff: string): Promise<void> {
    // This is complex to implement with just exec, usually requires a patch file
    // For now, we'll leave it as a placeholder or implement basic apply
    throw new Error("Method not implemented.");
  }
}
