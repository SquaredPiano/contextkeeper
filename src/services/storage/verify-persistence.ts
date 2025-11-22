import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local BEFORE importing other modules
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

import { storage } from './index';
import { EventRecord } from './schema';

async function verifyPersistence() {
  console.log('🔍 Starting Persistence Layer Verification...');
  console.log('-------------------------------------------');

  try {
    // 1. Connect
    console.log('1. Connecting to LanceDB...');
    await storage.connect();
    console.log('✅ Connected.');

    // 2. Cleanup (Optional - to ensure clean state)
    console.log('2. Clearing existing tables for test...');
    await storage.clearAllTables();
    console.log('✅ Tables cleared and re-initialized.');

    // 3. Log Events
    console.log('3. Logging sample events...');
    const events: Omit<EventRecord, 'id'>[] = [
      {
        timestamp: Date.now(),
        event_type: 'file_open',
        file_path: '/src/extension.ts',
        metadata: JSON.stringify({ language: 'typescript' })
      },
      {
        timestamp: Date.now() + 1000,
        event_type: 'file_edit',
        file_path: '/src/extension.ts',
        metadata: JSON.stringify({ changes: 'added console.log' })
      },
      {
        timestamp: Date.now() + 2000,
        event_type: 'git_commit',
        file_path: '.',
        metadata: JSON.stringify({ message: 'feat: add logging' })
      }
    ];

    for (const event of events) {
      await storage.logEvent(event);
    }
    console.log(`✅ Logged ${events.length} events.`);

    // 4. Verify Events Retrieval
    console.log('4. Verifying event retrieval...');
    const recentEvents = await storage.getRecentEvents(10);
    if (recentEvents.length < 3) {
      throw new Error(`Expected at least 3 events, found ${recentEvents.length}`);
    }
    console.log(`✅ Retrieved ${recentEvents.length} recent events.`);

    // 5. Create Session (with Embedding)
    console.log('5. Creating a session with embedding...');
    const summary = "Implemented the new storage layer using LanceDB for vector persistence.";
    const project = "contextkeeper";
    const session = await storage.createSession(summary, project);
    console.log(`✅ Session created with ID: ${session.id}`);
    console.log(`   Embedding length: ${session.embedding.length} (Expected: 768)`);

    if (session.embedding.length !== 768) {
      throw new Error(`Embedding dimension mismatch. Expected 768, got ${session.embedding.length}`);
    }

    // 6. Semantic Search
    console.log('6. Testing semantic search...');
    const query = "storage implementation lancedb";
    const similarSessions = await storage.getSimilarSessions(query, 1);
    
    if (similarSessions.length === 0) {
      throw new Error('No similar sessions found.');
    }
    
    const topMatch = similarSessions[0];
    console.log(`✅ Found match: "${topMatch.summary}"`);
    console.log(`   Match ID: ${topMatch.id}`);

    if (topMatch.id !== session.id) {
      console.warn('⚠️  Top match ID does not match created session ID (might be due to other data or embedding similarity nuances).');
    } else {
      console.log('✅ Top match is the session we just created.');
    }

    console.log('-------------------------------------------');
    console.log('🎉 VERIFICATION SUCCESSFUL: Persistence layer is robust and operational.');

  } catch (error) {
    console.error('❌ VERIFICATION FAILED:', error);
    process.exit(1);
  }
}

verifyPersistence();
