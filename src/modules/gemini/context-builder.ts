import { GeminiContext, RawLogInput } from './types';
import { IStorageService } from '../../services/interfaces';

export class ContextBuilder {
  static async build(raw: RawLogInput, storage?: IStorageService): Promise<GeminiContext> {
    const {
      gitLogs = [],
      gitDiff = "",
      openFiles = [],
      activeFile = null,
      errors = [],
      editHistory = [],
      fileContents = new Map(),
      projectStructure,
      dependencies
    } = raw;

    // 1. Identify related files based on active file
    // Simple heuristic: same directory or imported (mock logic for imports)
    const relatedFiles = openFiles.filter(f => f !== activeFile);
    
    // 2. Summarize Git Diff (don't just truncate, maybe prioritize modified files)
    let diffSummary = gitDiff || "";
    if (diffSummary.length > 8000) {
      diffSummary = diffSummary.substring(0, 8000) + "\n... [truncated]";
    }

    // 3. Build open file contents map for context
    const openFileContents = new Map<string, string>();
    if (activeFile && fileContents.has(activeFile)) {
      openFileContents.set(activeFile, fileContents.get(activeFile)!);
    }
    // Add other open files if small enough? For now just active.

    // 4. Fetch relevant past sessions from Vector DB
    let relevantPastSessions: Array<{ summary: string; timestamp: number }> = [];
    if (storage && (activeFile || gitDiff)) {
      try {
        // Query based on active file or diff
        const query = activeFile ? `Working on ${activeFile}` : gitDiff.substring(0, 100);
        const sessions = await storage.getSimilarSessions(query, 3);
        relevantPastSessions = sessions.map(s => ({
          summary: s.summary,
          timestamp: s.timestamp
        }));
      } catch (e) {
        console.warn("Failed to fetch similar sessions:", e);
      }
    }

    return {
      activeFile: activeFile || null,
      recentCommits: gitLogs.slice(0, 10), // Increased context
      recentErrors: errors.slice(0, 5),
      gitDiffSummary: diffSummary,
      editCount: editHistory.length,
      relatedFiles: relatedFiles,
      openFileContents: openFileContents,
      projectStructure,
      dependencies,
      relevantPastSessions
    };
  }
}

