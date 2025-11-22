import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { promisify } from 'util';
import { exec as execCb } from 'child_process';
import { GitService } from '../../modules/gitlogs/GitService';

const execAsync = promisify(execCb);

export interface GitCommitEvent {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

// Minimal interface for VS Code Git API
interface GitExtension {
    getAPI(version: number): GitAPI;
}

interface GitAPI {
    repositories: Repository[];
    onDidOpenRepository: vscode.Event<Repository>;
    onDidCloseRepository: vscode.Event<Repository>;
}

interface Repository {
    rootUri: vscode.Uri;
    state: RepositoryState;
    log(options?: Record<string, unknown>): Promise<Commit[]>;
}

interface RepositoryState {
    HEAD: Branch | undefined;
    onDidChange: vscode.Event<void>;
}

interface Branch {
    commit?: string;
}

interface Commit {
    hash: string;
    message: string;
    authorName?: string;
    authorDate?: Date;
    parents?: string[];
}

export class GitWatcher extends EventEmitter {
  private disposables: vscode.Disposable[] = [];
  private lastCommitHash: string | undefined;
  private repository: Repository | undefined;
  private gitService: GitService;

  constructor(private workspaceRoot: string) {
    super();
    this.gitService = new GitService(workspaceRoot);
  }

  public async start(): Promise<void> {
    try {
        const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
        if (!gitExtension) {
            console.warn('Git extension not found');
            return;
        }

        const git = gitExtension.exports.getAPI(1);
        
        // Find the repository for the current workspace
        this.repository = git.repositories.find(r => r.rootUri.fsPath === this.workspaceRoot);
        
        if (!this.repository) {
            // Wait for repository to be opened
            const disposable = git.onDidOpenRepository(repo => {
                if (repo.rootUri.fsPath === this.workspaceRoot) {
                    this.repository = repo;
                    this.setupRepositoryListener();
                    disposable.dispose();
                }
            });
            this.disposables.push(disposable);
        } else {
            this.setupRepositoryListener();
        }

        console.log('GitWatcher started (Event-driven).');

    } catch (error) {
        console.error('Failed to start GitWatcher:', error);
    }
  }

  private setupRepositoryListener() {
      if (!this.repository) { return; }

      // Initial state
      this.lastCommitHash = this.repository.state.HEAD?.commit;

      // Listen for changes
      const disposable = this.repository.state.onDidChange(async () => {
          await this.checkHead();
      });
      this.disposables.push(disposable);
  }

  private async checkHead() {
      if (!this.repository) { return; }

      const currentHash = this.repository.state.HEAD?.commit;
      
      if (currentHash && currentHash !== this.lastCommitHash) {
          // Commit changed!
          this.lastCommitHash = currentHash;

          // Fetch commit details
          try {
              // Get the commit details. We might need to fetch more than one if multiple commits happened.
              // For simplicity in this "Thin Path", we fetch the latest commit.
              const commits = await this.repository.log({ maxEntries: 1, ref: currentHash });
              
              if (commits.length > 0) {
                  const commit = commits[0];
                  
                  // Get file list from git
                  let files: string[] = [];
                  try {
                      // Use git show to get files changed in this commit
                      const { stdout } = await execAsync(
                          `git show --name-only --pretty=format: ${commit.hash}`,
                          { cwd: this.workspaceRoot, timeout: 2000 }
                      );
                      
                      files = stdout
                          .trim()
                          .split('\n')
                          .filter(line => line.trim().length > 0 && !line.startsWith('commit'));
                  } catch (fileError) {
                      console.warn(`[GitWatcher] Failed to get files for commit ${commit.hash}:`, fileError);
                      // Fallback: try to get files from recent commits using GitService
                      try {
                          const recentCommits = await this.gitService.getRecentCommits(1);
                          if (recentCommits.length > 0 && recentCommits[0].hash === commit.hash) {
                              files = recentCommits[0].files || [];
                          }
                      } catch (fallbackError) {
                          console.warn(`[GitWatcher] Fallback file retrieval also failed:`, fallbackError);
                      }
                  }
                  
                  const event: GitCommitEvent = {
                      hash: commit.hash,
                      message: commit.message,
                      author: commit.authorName || 'Unknown',
                      date: commit.authorDate?.toISOString() || new Date().toISOString(),
                      files: files
                  };
                  
                  console.log(`[GitWatcher] Emitting commit event: ${commit.hash} with ${files.length} files`);
                  this.emit('commit', event);
              }
          } catch (e) {
              const errorMsg = e instanceof Error ? e.message : String(e);
              console.error(`[GitWatcher] Error fetching commit details: ${errorMsg}`, e);
          }
      }
  }

  public stop(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    console.log('GitWatcher stopped.');
  }
}
