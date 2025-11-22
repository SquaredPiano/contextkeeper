import * as lancedb from '@lancedb/lancedb';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { IStorageService } from '../interfaces';
import { EventRecord, SessionRecord, ActionRecord } from './schema';
import { GeminiService } from '../real/GeminiService';

export class LanceDBStorage implements IStorageService {
  private db: lancedb.Connection | null = null;
  private eventsTable: lancedb.Table | null = null;
  private sessionsTable: lancedb.Table | null = null;
  private actionsTable: lancedb.Table | null = null;
  private embeddingService: GeminiService | undefined;

  constructor() { }

  /**
   * Connects to LanceDB Cloud or falls back to local instance.
   * @param embeddingService Optional service for generating embeddings.
   */
  async connect(embeddingService?: GeminiService): Promise<void> {
    try {
      this.embeddingService = embeddingService;
      
      // Check for LanceDB Cloud credentials
      const apiKey = process.env.LANCE_DB_API_KEY;
      const dbName = process.env.LANCEDB_DB_NAME || 'contextkeeper';
      
      if (apiKey) {
        // Connect to LanceDB Cloud
        const cloudUri = `db://${dbName}`;
        console.log('Connecting to LanceDB Cloud:', cloudUri);
        this.db = await lancedb.connect(cloudUri, { apiKey });
        console.log('Connected to LanceDB Cloud successfully');
      } else {
        // Fallback to local LanceDB
        console.log('LANCE_DB_API_KEY not found, using local LanceDB');
        const dbPath = path.join(os.homedir(), '.contextkeeper', 'lancedb');

        if (!fs.existsSync(dbPath)) {
          fs.mkdirSync(dbPath, { recursive: true });
        }

        this.db = await lancedb.connect(dbPath);
        console.log('Connected to local LanceDB at', dbPath);
      }

      await this.initializeTables();
    } catch (error) {
      console.error('Failed to connect to LanceDB:', error);
      // We don't throw here to allow the extension to activate even if DB fails, 
      // but in a real FAANG app we might want to handle this more gracefully or retry.
    }
  }

  private async initializeTables(): Promise<void> {
    if (!this.db) { throw new Error('Database not connected'); }

    // Create or open events table
    const tableNames = await this.db.tableNames();

    if (!tableNames.includes('events')) {
      this.eventsTable = await this.db.createTable('events', [
        {
          id: uuidv4(),
          timestamp: 0, // Old timestamp to avoid interfering with queries
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
          timestamp: 0,
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
          timestamp: 0,
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

  private async getEmbedding(text: string): Promise<number[]> {
    if (this.embeddingService) {
      try {
        return await this.embeddingService.getEmbedding(text);
      } catch (error) {
        console.warn('Failed to generate embedding, using zero vector:', error);
      }
    }
    // Fallback or mock if no service or error
    return new Array(768).fill(0);
  }

  async logEvent(event: Omit<EventRecord, 'id'>): Promise<void> {
    if (!this.eventsTable) { throw new Error('Events table not initialized'); }

    const record: EventRecord = {
      id: uuidv4(),
      ...event,
      metadata: typeof event.metadata === 'string' ? event.metadata : JSON.stringify(event.metadata || {})
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.eventsTable.add([record as any]);
  }

  async createSession(summary: string, project: string): Promise<SessionRecord> {
    if (!this.sessionsTable) { throw new Error('Sessions table not initialized'); }

    const embedding = await this.getEmbedding(summary);

    const session: SessionRecord = {
      id: uuidv4(),
      timestamp: Date.now(),
      summary,
      embedding,
      project,
      event_count: 0
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.sessionsTable.add([session as any]);
    return session;
  }

  async addAction(action: Omit<ActionRecord, 'id' | 'embedding'>): Promise<void> {
    if (!this.actionsTable) { throw new Error('Actions table not initialized'); }

    const embedding = await this.getEmbedding(action.description);

    const record: ActionRecord = {
      id: uuidv4(),
      ...action,
      embedding,
      files: typeof action.files === 'string' ? action.files : JSON.stringify(action.files || [])
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.actionsTable.add([record as any]);
  }

  async getLastSession(): Promise<SessionRecord | null> {
    if (!this.sessionsTable) { throw new Error('Sessions table not initialized'); }

    // Assuming append-only, we want the last inserted. 
    // Ideally we sort by timestamp DESC.
    const results = await this.sessionsTable
      .query()
      .limit(10) // Fetch last 10 to be safe
      .toArray();

    if (results.length === 0) { return null; }

    // Sort by timestamp descending
    const sorted = results.sort((a: unknown, b: unknown) => {
      const sessionA = a as SessionRecord;
      const sessionB = b as SessionRecord;
      return sessionB.timestamp - sessionA.timestamp;
    });
    return sorted[0] as SessionRecord;
  }

  async getSimilarSessions(queryText: string, topK: number = 5): Promise<SessionRecord[]> {
    if (!this.sessionsTable) { throw new Error('Sessions table not initialized'); }

    const embedding = await this.getEmbedding(queryText);

    const results = await this.sessionsTable
      .vectorSearch(embedding)
      .limit(topK)
      .toArray();

    return results as SessionRecord[];
  }

  async getSimilarActions(queryText: string, topK: number = 5): Promise<ActionRecord[]> {
    if (!this.actionsTable) { throw new Error('Actions table not initialized'); }

    const embedding = await this.getEmbedding(queryText);

    const results = await this.actionsTable
      .vectorSearch(embedding)
      .limit(topK)
      .toArray();

    return results as ActionRecord[];
  }

  async getRecentEvents(limit: number = 50): Promise<EventRecord[]> {
    if (!this.eventsTable) {
      // Auto-initialize if not ready (lazy loading)
      if (this.db) {
        await this.initializeTables();
      } else {
        await this.connect();
      }

      if (!this.eventsTable) {
        throw new Error('Events table could not be initialized');
      }
    }

    // Fetch more than we need to ensure we get enough after filtering
    // LanceDB might have init records or other non-relevant data
    const results = await this.eventsTable
      .query()
      .limit(Math.max(limit * 3, 500)) // Fetch generously
      .toArray();

    // Sort by timestamp descending
    const sorted = results.sort((a: unknown, b: unknown) => {
      const eventA = a as EventRecord;
      const eventB = b as EventRecord;
      return eventB.timestamp - eventA.timestamp;
    });
    
    // Filter out init/placeholder events (timestamp 0)
    const filtered = sorted.filter((e: unknown) => {
      const event = e as EventRecord;
      return event.timestamp > 0 && event.file_path !== '/init';
    });
    
    return filtered.slice(0, limit) as EventRecord[];
  }

  async getRecentActions(limit: number = 10): Promise<ActionRecord[]> {
    if (!this.actionsTable) { throw new Error('Actions table not initialized'); }

    const results = await this.actionsTable
      .query()
      .limit(limit * 2)
      .toArray();

    const sorted = results.sort((a: unknown, b: unknown) => {
      const actionA = a as ActionRecord;
      const actionB = b as ActionRecord;
      return actionB.timestamp - actionA.timestamp;
    });
    return sorted.slice(0, limit) as ActionRecord[];
  }

  /**
   * Retrieves the file path of the most recent file edit or open event.
   * Useful for determining where the user left off.
   */
  async getLastActiveFile(): Promise<string | null> {
    if (!this.eventsTable) { throw new Error('Events table not initialized'); }

    const results = await this.eventsTable
      .query()
      .where("event_type IN ('file_edit', 'file_open')")
      .limit(10)
      .toArray();

    if (results.length === 0) { return null; }

    const sorted = results.sort((a: unknown, b: unknown) => {
      const eventA = a as EventRecord;
      const eventB = b as EventRecord;
      return eventB.timestamp - eventA.timestamp;
    });
    return (sorted[0] as EventRecord).file_path;
  }

  // Helper for testing/cleanup
  async clearAllTables(): Promise<void> {
    if (!this.db) { throw new Error('Database not connected'); }

    const tables = ['events', 'sessions', 'actions'];
    for (const table of tables) {
      try {
        await this.db.dropTable(table);
      } catch {
        // Ignore if table doesn't exist
      }
    }
    // Re-initialize to create empty tables
    await this.initializeTables();
  }
}
