export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: Date;
  files?: string[];
}

export interface GitBranch {
  name: string;
  current: boolean;
}

export interface GitContext {
  recentCommits: GitCommit[];
  currentBranch: string;
  uncommittedChanges: string[];
}

export interface GitLogOptions {
  repoPath?: string;
  maxCommits?: number;
}
