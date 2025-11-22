# LanceDB Vector Storage Implementation

## Context
You are implementing a persistent storage layer for a VSCode extension that tracks developer activity (file edits, git commits, etc.), summarizes sessions when idle, and retrieves context when users return. The storage must support semantic search via embeddings.

## Project Structure
```
src/services/storage/
  ├── schema.ts          # TypeScript interfaces
  ├── Storage.ts         # LanceDB implementation
  ├── embeddings.ts      # Embedding generation (Gemini)
  └── index.ts           # Exports singleton instance
```

## Requirements

### 1. Install Dependencies
```bash
npm install @lancedb/lancedb
npm install uuid
npm install @types/uuid --save-dev
```

### 2. Environment Variables
Add to your `.env`:
```
LANCEDB_API_KEY=your_lancedb_cloud_api_key
LANCEDB_DB_NAME=contextkeeper
GEMINI_API_KEY=your_existing_gemini_key
```

Get LanceDB API key from: https://cloud.lancedb.com/

---

## Implementation Instructions

### File 1: `src/services/storage/schema.ts`

Define these exact interfaces:

```typescript
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
```

### File 2: `src/services/storage/embeddings.ts`

Create embedding generation utility using your existing Gemini client:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(generateEmbedding));
}
```

### File 3: `src/services/storage/Storage.ts`

Implement the LanceDB storage class:

```typescript
import * as lancedb from '@lancedb/lancedb';
import { v4 as uuidv4 } from 'uuid';
import { EventRecord, SessionRecord, ActionRecord } from './schema';
import { generateEmbedding } from './embeddings';

export class LanceDBStorage {
  private db: lancedb.Connection | null = null;
  private eventsTable: lancedb.Table | null = null;
  private sessionsTable: lancedb.Table | null = null;
  private actionsTable: lancedb.Table | null = null;

  async connect(): Promise<void> {
    const uri = `db://${process.env.LANCEDB_DB_NAME}`;
    this.db = await lancedb.connect(uri, {
      apiKey: process.env.LANCEDB_API_KEY,
      region: 'us-east-1'
    });

    await this.initializeTables();
  }

  private async initializeTables(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');

    // Create or open events table
    const tableNames = await this.db.tableNames();
    
    if (!tableNames.includes('events')) {
      this.eventsTable = await this.db.createTable('events', [
        {
          id: uuidv4(),
          timestamp: Date.now(),
          event_type: 'file_open',
          file_path: '/init',
          metadata: '{}'
        }
      ]);
    } else {
      this.eventsTable = await this.db.openTable('events');
    }

    if (!tableNames.includes('sessions')) {
      this.sessionsTable = await this.db.createTable('sessions', [
        {
          id: uuidv4(),
          timestamp: Date.now(),
          summary: 'init',
          embedding: new Array(768).fill(0),
          project: 'init',
          event_count: 0
        }
      ]);
    } else {
      this.sessionsTable = await this.db.openTable('sessions');
    }

    if (!tableNames.includes('actions')) {
      this.actionsTable = await this.db.createTable('actions', [
        {
          id: uuidv4(),
          session_id: 'init',
          timestamp: Date.now(),
          description: 'init',
          diff: '',
          files: '[]',
          embedding: new Array(768).fill(0)
        }
      ]);
    } else {
      this.actionsTable = await this.db.openTable('actions');
    }
  }

  async logEvent(event: Omit<EventRecord, 'id'>): Promise<void> {
    if (!this.eventsTable) throw new Error('Events table not initialized');
    
    const record: EventRecord = {
      id: uuidv4(),
      ...event,
      metadata: typeof event.metadata === 'string' ? event.metadata : JSON.stringify(event.metadata || {})
    };

    await this.eventsTable.add([record]);
  }

  async createSession(summary: string, project: string): Promise<SessionRecord> {
    if (!this.sessionsTable) throw new Error('Sessions table not initialized');

    const embedding = await generateEmbedding(summary);
    
    const session: SessionRecord = {
      id: uuidv4(),
      timestamp: Date.now(),
      summary,
      embedding,
      project,
      event_count: 0
    };

    await this.sessionsTable.add([session]);
    return session;
  }

  async addAction(action: Omit<ActionRecord, 'id' | 'embedding'>): Promise<void> {
    if (!this.actionsTable) throw new Error('Actions table not initialized');

    const embedding = await generateEmbedding(action.description);
    
    const record: ActionRecord = {
      id: uuidv4(),
      ...action,
      embedding,
      files: typeof action.files === 'string' ? action.files : JSON.stringify(action.files || [])
    };

    await this.actionsTable.add([record]);
  }

  async getLastSession(): Promise<SessionRecord | null> {
    if (!this.sessionsTable) throw new Error('Sessions table not initialized');

    const results = await this.sessionsTable
      .query()
      .limit(1)
      .toArray();

    return results.length > 0 ? (results[0] as SessionRecord) : null;
  }

  async getSimilarSessions(queryText: string, topK: number = 5): Promise<SessionRecord[]> {
    if (!this.sessionsTable) throw new Error('Sessions table not initialized');

    const embedding = await generateEmbedding(queryText);
    
    const results = await this.sessionsTable
      .vectorSearch(embedding)
      .limit(topK)
      .toArray();

    return results as SessionRecord[];
  }

  async getRecentEvents(limit: number = 50): Promise<EventRecord[]> {
    if (!this.eventsTable) throw new Error('Events table not initialized');

    const results = await this.eventsTable
      .query()
      .limit(limit)
      .toArray();

    return results as EventRecord[];
  }
}
```

### File 4: `src/services/storage/index.ts`

Export singleton instance:

```typescript
import { LanceDBStorage } from './Storage';

export const storage = new LanceDBStorage();

// Initialize on import (async IIFE)
(async () => {
  try {
    await storage.connect();
    console.log('✓ LanceDB storage initialized');
  } catch (error) {
    console.error('✗ Failed to initialize storage:', error);
  }
})();

export * from './schema';
export * from './Storage';
export * from './embeddings';
```

---

## Integration Example

```typescript
// In your extension.ts or idle detector
import { storage } from './services/storage';

// 1. Log events as they happen
await storage.logEvent({
  timestamp: Date.now(),
  event_type: 'file_edit',
  file_path: vscode.window.activeTextEditor?.document.uri.fsPath || '',
  metadata: JSON.stringify({ lines: 42 })
});

// 2. When user goes idle, create session
const recentEvents = await storage.getRecentEvents(100);
const summary = await geminiClient.generateSummary(recentEvents);
const session = await storage.createSession(summary, workspaceName);

// 3. When user returns, get last session
const lastSession = await storage.getLastSession();
if (lastSession) {
  await elevenLabs.speak(lastSession.summary);
}

// 4. Semantic search (future feature)
const similar = await storage.getSimilarSessions('bug fix authentication', 5);
```

---

## Testing Checklist

1. ✅ LanceDB connection established
2. ✅ Tables created (events, sessions, actions)
3. ✅ Event logging works
4. ✅ Session creation with embeddings works
5. ✅ Last session retrieval works
6. ✅ Semantic search returns relevant results
7. ✅ All methods handle errors gracefully

---

## Critical Notes

- **Embedding dimensions**: Gemini `text-embedding-004` produces 768-dimensional vectors
- **Region**: Using `us-east-1` (change if needed)
- **API Key**: Store in `.env`, never commit
- **Initialization**: Tables are created with dummy records on first run (LanceDB requirement)
- **Error handling**: All async methods should be wrapped in try-catch in production
- **Rate limits**: Gemini embeddings API has rate limits; consider batching for production

---

## Next Steps After Implementation

1. Test the full flow: event → idle → session → retrieval
2. Integrate with your existing Gemini context builder
3. Connect to ElevenLabs TTS for session summaries
4. Add error handling and logging throughout
5. Implement session update logic (event_count tracking)

---

## Success Criteria

When complete, you should be able to:
- ✅ Track 100+ events without errors
- ✅ Create sessions with semantic embeddings
- ✅ Query similar sessions with natural language
- ✅ Retrieve last session instantly on user return
- ✅ Storage persists across VSCode restarts