export interface EventRecord {
  id: string;
  timestamp: number;
  event_type: 'file_open' | 'file_edit' | 'file_close' | 'git_commit' | 'function_edit' | 'file_focus';
  file_path: string;
  metadata: string; // JSON stringified EventMetadata
}

/**
 * Rich metadata for file edit events
 * Contains actual code content, not just change counts
 */
export interface FileEditMetadata {
  languageId: string;
  changes: Array<{
    range: { start: { line: number; char: number }; end: { line: number; char: number } };
    addedText: string; // FULL text that was added
    removedText: string; // FULL text that was removed
    contextBefore: string; // 10 lines before the change
    contextAfter: string; // 10 lines after the change
    affectedFunction?: {
      name: string;
      fullBody: string; // ENTIRE function body
      startLine: number;
      endLine: number;
    };
  }>;
  // Snapshot of entire file content AFTER the edit (for context)
  fullFileContent?: string; // Store for small files (<10KB)
  fileSize: number; // Track size to decide what to store
}

export interface SessionRecord {
  id: string;
  timestamp: number;
  summary: string;
  embedding: number[]; // 768-dim vector from Gemini text-embedding-004
  project: string;
  event_count: number;
}

export interface ActionRecord {
  id: string;
  session_id: string;
  timestamp: number;
  description: string; // Natural language summary for vector search
  code_context: string; // JSON stringified CodeContext
  files: string; // JSON stringified array
  embedding: number[]; // 768-dim vector
}

/**
 * Rich code context for action records
 * This is what Gemini will use to generate intelligent summaries
 */
export interface CodeContext {
  // The actual code changes
  changes: Array<{
    file: string;
    language: string;
    beforeCode: string; // Code before the change
    afterCode: string; // Code after the change
    function?: string; // Function name if applicable
    fullFunctionBefore?: string; // Full function body before
    fullFunctionAfter?: string; // Full function body after
  }>;
  // Surrounding context for semantic understanding
  relatedFunctions: Array<{
    name: string;
    file: string;
    body: string;
    imports?: string[]; // Functions/modules it uses
  }>;
  // Imports and dependencies for understanding context
  imports: string[];
  // Related files that might be affected
  relatedFiles: Array<{
    path: string;
    relevance: 'import' | 'same-directory' | 'test-file' | 'similar-function';
    snippet?: string; // Key snippet if relevant
  }>;
}
