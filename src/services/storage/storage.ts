import * as lancedb from '@lancedb/lancedb';
import { v4 as uuidv4 } from 'uuid';
import { EventRecord, SessionRecord, ActionRecord } from './schema';
import { generateEmbedding } from './embeddings';
import { IEmbeddingService, IStorageService } from '../interfaces';

export class LanceDBStorage implements IStorageService {
  private db: lancedb.Connection | null = null;
  private eventsTable: lancedb.Table | null = null;
  private sessionsTable: lancedb.Table | null = null;
  private actionsTable: lancedb.Table | null = null;
  private embeddingService: IEmbeddingService | null = null;

  async connect(embeddingService?: IEmbeddingService): Promise<void> {
    if (embeddingService) {
      this.embeddingService = embeddingService;
    }
    if (this.db) { return; } // Already connected

    const uri = `db://${process.env.LANCEDB_DB_NAME}`;
    this.db = await lancedb.connect(uri, {
      apiKey: process.env.LANCE_DB_API_KEY,
      region: 'us-east-1'
    });

    await this.initializeTables();
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
      return this.embeddingService.getEmbedding(text);
    }
    return generateEmbedding(text);
  }

  async logEvent(event: Omit<EventRecord, 'id'>): Promise<void> {
    if (!this.eventsTable) { throw new Error('Events table not initialized'); }
    
    const record: EventRecord = {
      id: uuidv4(),
      ...event,
      metadata: typeof event.metadata === 'string' ? event.metadata : JSON.stringify(event.metadata || {})
    };

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

    await this.actionsTable.add([record as any]);
  }

  async getLastSession(): Promise<SessionRecord | null> {
    if (!this.sessionsTable) { throw new Error('Sessions table not initialized'); }

    // Assuming append-only, we want the last inserted. 
    // Ideally we sort by timestamp DESC.
    // LanceDB JS SDK might not support sort() directly in all versions, 
    // but let's try to fetch more and sort in memory if needed, or rely on insertion order.
    // For robustness, let's fetch the last few and sort.
    const results = await this.sessionsTable
      .query()
      .limit(10) // Fetch last 10 to be safe
      .toArray();

    if (results.length === 0) { return null; }

    // Sort by timestamp descending
    const sorted = results.sort((a, b) => (b.timestamp as number) - (a.timestamp as number));
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

    // Fetch more than limit to ensure we get the absolute latest if they are not strictly ordered on disk
    // But usually they are.
    const results = await this.eventsTable
      .query()
      .limit(limit * 2) 
      .toArray();

    // Sort by timestamp descending
    const sorted = results.sort((a, b) => (b.timestamp as number) - (a.timestamp as number));
    return sorted.slice(0, limit) as EventRecord[];
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

    const sorted = results.sort((a, b) => (b.timestamp as number) - (a.timestamp as number));
    return (sorted[0] as EventRecord).file_path;
  }

  // Helper for testing/cleanup
  async clearAllTables(): Promise<void> {
    if (!this.db) { throw new Error('Database not connected'); }
    
    const tables = ['events', 'sessions', 'actions'];
    for (const table of tables) {
      try {
        await this.db.dropTable(table);
      } catch (e) {
        // Ignore if table doesn't exist
      }
    }
    // Re-initialize to create empty tables
    await this.initializeTables();
  }
}
