import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

import { storage } from '../storage/index';
import { EventRecord } from '../storage/schema';

async function verifyIngestionAndContext() {
  console.log('🔍 Starting Ingestion & Context Verification...');
  console.log('-------------------------------------------');

  try {
    // 1. Connect & Clean
    await storage.connect();
    await storage.clearAllTables();
    console.log('✅ Storage connected and cleared.');

    // 2. Simulate User Activity (Ingestion)
    console.log('2. Simulating user activity...');
    
    const events: Omit<EventRecord, 'id'>[] = [
      {
        timestamp: Date.now() - 10000,
        event_type: 'file_open',
        file_path: 'src/utils/helper.ts',
        metadata: JSON.stringify({ languageId: 'typescript' })
      },
      {
        timestamp: Date.now() - 8000,
        event_type: 'file_edit',
        file_path: 'src/utils/helper.ts',
        metadata: JSON.stringify({ changeCount: 1 })
      },
      {
        timestamp: Date.now() - 5000,
        event_type: 'file_open',
        file_path: 'src/components/Button.tsx',
        metadata: JSON.stringify({ languageId: 'typescriptreact' })
      },
      {
        timestamp: Date.now() - 2000, // LATEST ACTIVE FILE
        event_type: 'file_edit',
        file_path: 'src/components/Button.tsx',
        metadata: JSON.stringify({ changeCount: 5 })
      },
      {
        timestamp: Date.now() - 1000,
        event_type: 'git_commit', // Should be ignored by getLastActiveFile
        file_path: 'root',
        metadata: JSON.stringify({ message: 'fix button' })
      }
    ];

    for (const event of events) {
      await storage.logEvent(event);
    }
    console.log(`✅ Ingested ${events.length} events.`);

    // 3. Verify "Latest Context" Retrieval
    console.log('3. Verifying "Latest Active File" retrieval...');
    const lastFile = await storage.getLastActiveFile();
    
    console.log(`   Result: ${lastFile}`);
    
    if (lastFile === 'src/components/Button.tsx') {
      console.log('✅ CORRECT: Identified the last active file.');
    } else {
      throw new Error(`❌ INCORRECT: Expected 'src/components/Button.tsx', got '${lastFile}'`);
    }

    // 4. Verify Recent Events Sorting
    console.log('4. Verifying event sorting...');
    const recent = await storage.getRecentEvents(5);
    const latestEvent = recent[0];
    
    // The git commit was the last one (timestamp - 1000)
    if (latestEvent.event_type === 'git_commit') {
      console.log('✅ CORRECT: Most recent event is the git commit.');
    } else {
      throw new Error(`❌ INCORRECT: Expected 'git_commit', got '${latestEvent.event_type}'`);
    }

    console.log('-------------------------------------------');
    console.log('🎉 INGESTION VERIFICATION SUCCESSFUL');

  } catch (error) {
    console.error('❌ VERIFICATION FAILED:', error);
    process.exit(1);
  }
}

verifyIngestionAndContext();
