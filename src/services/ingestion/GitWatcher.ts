import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import * as cp from 'child_process';
import * as util from 'util';

const exec = util.promisify(cp.exec);

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
    log(options?: any): Promise<Commit[]>;
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

  constructor(private workspaceRoot: string) {
    super();
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
          const oldHash = this.lastCommitHash;
          this.lastCommitHash = currentHash;

          // Fetch commit details
          try {
              // Get the commit details. We might need to fetch more than one if multiple commits happened.
              // For simplicity in this "Thin Path", we fetch the latest commit.
              const commits = await this.repository.log({ maxEntries: 1, ref: currentHash });
              
              if (commits.length > 0) {
                  const commit = commits[0];
                  
                  // Fetch changed files using git CLI
                  let files: string[] = [];
                  try {
                      const { stdout } = await exec(`git show --name-only --pretty="" ${commit.hash}`, { cwd: this.workspaceRoot });
                      files = stdout.split('\n').filter(line => line.trim() !== '');
                  } catch (gitError) {
                      console.error('Error fetching changed files via git CLI:', gitError);
                  }

                  const event: GitCommitEvent = {
                      hash: commit.hash,
                      message: commit.message,
                      author: commit.authorName || 'Unknown',
                      date: commit.authorDate?.toISOString() || new Date().toISOString(),
                      files: files
                  };
                  
                  this.emit('commit', event);
              }
          } catch (e) {
              console.error('Error fetching commit details:', e);
          }
      }
  }

  public stop(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    console.log('GitWatcher stopped.');
  }
}
