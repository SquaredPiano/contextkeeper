import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

import { storage } from '../storage/index';
import { ActionRecord } from '../storage/schema';

async function verifyActionIngestion() {
    console.log('🔍 Starting Action Ingestion Verification...');
    console.log('-------------------------------------------');

    try {
        // 1. Connect & Clean
        await storage.connect();
        await storage.clearAllTables();
        console.log('✅ Storage connected and cleared.');

        // 2. Simulate User Actions (Ingestion)
        console.log('2. Simulating user actions...');

        const actions: Omit<ActionRecord, 'id' | 'embedding'>[] = [
            {
                session_id: 'session-1',
                timestamp: Date.now() - 5000,
                description: 'User edited src/utils/helper.ts. Fixed a bug in the date formatter.',
                diff: '...',
                files: JSON.stringify(['src/utils/helper.ts'])
            },
            {
                session_id: 'session-1',
                timestamp: Date.now() - 2000,
                description: 'User edited src/components/Button.tsx. Added a new onClick handler.',
                diff: '...',
                files: JSON.stringify(['src/components/Button.tsx'])
            },
            {
                session_id: 'session-1',
                timestamp: Date.now() - 1000,
                description: 'User edited src/api/client.ts. Refactored the fetch logic.',
                diff: '...',
                files: JSON.stringify(['src/api/client.ts'])
            }
        ];

        for (const action of actions) {
            await storage.addAction(action);
        }
        console.log(`✅ Ingested ${actions.length} actions.`);

        // 3. Verify Vector Search
        console.log('3. Verifying Vector Search...');

        const query = "I was working on the Button component";
        console.log(`   Query: "${query}"`);

        const results = await storage.getSimilarActions(query, 1);

        if (results.length > 0) {
            const bestMatch = results[0];
            console.log(`   Best Match: "${bestMatch.description}"`);

            if (bestMatch.description.includes('Button.tsx')) {
                console.log('✅ CORRECT: Found the relevant action.');
            } else {
                throw new Error(`❌ INCORRECT: Expected Button action, got '${bestMatch.description}'`);
            }
        } else {
            throw new Error('❌ INCORRECT: No results found.');
        }

        console.log('-------------------------------------------');
        console.log('🎉 ACTION VERIFICATION SUCCESSFUL');

    } catch (error) {
        console.error('❌ VERIFICATION FAILED:', error);
        process.exit(1);
    }
}

verifyActionIngestion();
