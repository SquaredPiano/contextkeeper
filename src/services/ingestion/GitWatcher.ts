import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { GitService } from '../../modules/gitlogs/GitService';

export interface GitCommitEvent {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

export class GitWatcher extends EventEmitter {
  private lastCommitHash: string | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private isPolling: boolean = false;
  private gitService: GitService;

  constructor(private workspaceRoot: string, private intervalMs: number = 30000) {
    super();
    this.gitService = new GitService(workspaceRoot);
  }

  public start(): void {
    if (this.pollInterval) { return; }
    
    // Initial check
    this.checkGitLog();
    
    // Start polling
    this.pollInterval = setInterval(() => {
      this.checkGitLog();
    }, this.intervalMs);
    
    console.log('GitWatcher started.');
  }

  public stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    console.log('GitWatcher stopped.');
  }

  private async checkGitLog(): Promise<void> {
    if (this.isPolling) { return; }
    this.isPolling = true;

    try {
      const logs = await this.gitService.getRecentCommits(10);
      
      if (!logs || logs.length === 0) {
        this.isPolling = false;
        return;
      }

      // If it's the first run, just set the last commit and return (or process all? let's process latest)
      if (!this.lastCommitHash) {
        this.lastCommitHash = logs[0].hash;
        this.isPolling = false;
        return;
      }

      // Find new commits since last hash
      const newCommits: GitCommitEvent[] = [];
      for (const log of logs) {
        if (log.hash === this.lastCommitHash) { break; }
        
        newCommits.push({
          hash: log.hash,
          message: log.message,
          author: log.author,
          date: log.date.toISOString(),
          files: log.files || []
        });
      }

      // Emit events for new commits (oldest to newest)
      if (newCommits.length > 0) {
        this.lastCommitHash = newCommits[0].hash; // Update to the newest
        
        for (let i = newCommits.length - 1; i >= 0; i--) {
          this.emit('commit', newCommits[i]);
        }
      }

    } catch (error) {
      console.warn('GitWatcher error:', error);
    } finally {
      this.isPolling = false;
    }
  }
}
