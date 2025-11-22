export interface GeminiContext {
  activeFile: string | null;
  recentCommits: string[];
  recentErrors: string[];
  gitDiffSummary: string;
  editCount: number;
  relatedFiles: string[];
  // New fields for richer context
  projectStructure?: string;
  dependencies?: string[];
  openFileContents?: Map<string, string>; // file path -> content
  userIntent?: string; // inferred or explicit
}

export interface AnalysisIssue {
  line: number;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface Analysis {
  issues: AnalysisIssue[];
  suggestions: string[];
  risk_level: "low" | "medium" | "high";
  summary?: string;
  // New fields
  context_analysis?: string; // AI's understanding of what the user is doing
}

export interface CodeFix {
  fixedCode: string;
  confidence: number;
  explanation?: string;
}

export interface RawLogInput {
  gitLogs?: string[];
  gitDiff?: string;
  openFiles?: string[];
  activeFile?: string;
  errors?: string[];
  editHistory?: Array<{ file: string; timestamp: number }>;
  // New fields
  fileContents?: Map<string, string>;
  workspaceRoot?: string;
}
