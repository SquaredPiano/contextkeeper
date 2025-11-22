export interface EventRecord {
  id: string;
  timestamp: number;
  event_type: 'file_open' | 'file_edit' | 'file_close' | 'git_commit' | 'function_edit';
  file_path: string;
  metadata: string; // JSON stringified object
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
  description: string;
  diff: string;
  files: string; // JSON stringified array
  embedding: number[]; // 768-dim vector
}
