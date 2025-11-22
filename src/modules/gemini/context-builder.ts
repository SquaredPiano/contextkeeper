export interface RawLogInput {
  gitLogs?: string[];
  gitDiff?: string;
  openFiles?: string[];
  activeFile?: string;
  errors?: string[];
  editHistory?: Array<{ file: string; timestamp: number }>;
}

export interface GeminiContext {
  activeFile: string | null;
  recentCommits: string[];
  recentErrors: string[];
  gitDiffSummary: string;
  editCount: number;
  relatedFiles: string[];
}

export class ContextBuilder {
  static build(raw: RawLogInput): GeminiContext {
    const {
      gitLogs = [],
      gitDiff = "",
      openFiles = [],
      activeFile = null,
      errors = [],
      editHistory = []
    } = raw;

    return {
      activeFile,
      recentCommits: gitLogs.slice(0, 5),
      recentErrors: errors.slice(0, 5),
      gitDiffSummary:
        gitDiff.length > 4000
          ? gitDiff.substring(0, 4000) + "... [truncated]"
          : gitDiff,
      editCount: editHistory.length,
      relatedFiles: openFiles.filter(f => f !== activeFile)
    };
  }
}

