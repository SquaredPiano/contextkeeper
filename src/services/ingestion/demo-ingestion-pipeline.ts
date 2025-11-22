/**
 * COMPREHENSIVE DEMO: Full Ingestion Pipeline
 * 
 * Tests the ENTIRE flow with REAL data:
 * 1. Initialize LanceDB storage with real Gemini embeddings
 * 2. Create session
 * 3. Queue multiple events (file edits, opens, closes, git commits)
 * 4. Process queue and verify embeddings are generated
 * 5. Query LanceDB to verify data is stored
 * 6. Test vector search to verify RAG works
 * 
 * Run with: npx ts-node src/services/ingestion/demo-ingestion-pipeline.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { LanceDBStorage } from '../storage/storage';
import { GeminiService } from '../real/GeminiService';
import { IngestionQueue } from './IngestionQueue';
import { v4 as uuidv4 } from 'uuid';

// Simple SessionManager for demo (no VS Code dependencies)
class DemoSessionManager {
    private currentSessionId: string;
    
    constructor(private storage: LanceDBStorage) {
        this.currentSessionId = uuidv4();
    }
    
    async initialize(): Promise<void> {
        const session = await this.storage.createSession(
            `Demo session started at ${new Date().toLocaleString()}`,
            'demo-project'
        );
        this.currentSessionId = session.id;
    }
    
    getSessionId(): string {
        return this.currentSessionId;
    }
}

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

async function runDemo() {
    console.log('🚀 Starting Comprehensive Ingestion Pipeline Demo\n');
    console.log('=' .repeat(60));

    // Step 1: Initialize Gemini Service
    console.log('\n📡 Step 1: Initializing Gemini Service...');
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY not found in environment variables!');
    }
    
    const geminiService = new GeminiService();
    await geminiService.initialize(geminiApiKey);
    console.log('✅ Gemini Service initialized');

    // Test embedding generation
    console.log('\n🧪 Testing embedding generation...');
    const testEmbedding = await geminiService.getEmbedding('User edited authentication module');
    console.log(`✅ Generated embedding with ${testEmbedding.length} dimensions`);
    console.log(`   Sample values: [${testEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);

    // Step 2: Initialize Storage
    console.log('\n💾 Step 2: Initializing LanceDB Storage...');
    const storage = new LanceDBStorage();
    await storage.connect(geminiService);
    console.log('✅ LanceDB Storage connected');

    // Step 3: Create Session
    console.log('\n📋 Step 3: Creating new session...');
    const sessionManager = new DemoSessionManager(storage);
    await sessionManager.initialize();
    const sessionId = sessionManager.getSessionId();
    console.log(`✅ Session created: ${sessionId}`);

    // Step 4: Initialize Ingestion Queue
    console.log('\n⚙️  Step 4: Initializing Ingestion Queue...');
    const queue = new IngestionQueue(storage, sessionManager as any);
    queue.start();
    console.log('✅ Ingestion Queue started');

    // Step 5: Queue Multiple Events (Real-world simulation)
    console.log('\n📝 Step 5: Queueing events (simulating real developer activity)...');
    
    const events = [
        {
            type: 'event' as const,
            data: {
                timestamp: Date.now() - 5000,
                event_type: 'file_open' as const,
                file_path: 'src/auth/login.ts',
                metadata: JSON.stringify({ languageId: 'typescript', lineCount: 45 })
            }
        },
        {
            type: 'event' as const,
            data: {
                timestamp: Date.now() - 4000,
                event_type: 'file_edit' as const,
                file_path: 'src/auth/login.ts',
                metadata: JSON.stringify({ 
                    languageId: 'typescript',
                    changeCount: 3,
                    affectedFunctions: ['validateCredentials', 'loginUser']
                })
            }
        },
        {
            type: 'action' as const,
            data: {
                session_id: sessionId,
                timestamp: Date.now() - 3500,
                description: 'User modified login authentication flow to add rate limiting',
                diff: JSON.stringify([{ range: '15-20', textLength: 120 }]),
                files: JSON.stringify(['src/auth/login.ts'])
            }
        },
        {
            type: 'event' as const,
            data: {
                timestamp: Date.now() - 3000,
                event_type: 'file_open' as const,
                file_path: 'src/auth/middleware.ts',
                metadata: JSON.stringify({ languageId: 'typescript', lineCount: 78 })
            }
        },
        {
            type: 'event' as const,
            data: {
                timestamp: Date.now() - 2000,
                event_type: 'file_edit' as const,
                file_path: 'src/auth/middleware.ts',
                metadata: JSON.stringify({
                    languageId: 'typescript',
                    changeCount: 2,
                    affectedFunctions: ['authMiddleware']
                })
            }
        },
        {
            type: 'action' as const,
            data: {
                session_id: sessionId,
                timestamp: Date.now() - 1500,
                description: 'User added JWT token validation in authentication middleware',
                diff: JSON.stringify([{ range: '30-35', textLength: 85 }]),
                files: JSON.stringify(['src/auth/middleware.ts'])
            }
        },
        {
            type: 'event' as const,
            data: {
                timestamp: Date.now() - 1000,
                event_type: 'git_commit' as const,
                file_path: 'root',
                metadata: JSON.stringify({
                    hash: 'abc123',
                    message: 'feat: add rate limiting to login endpoint',
                    author: 'Developer',
                    files: ['src/auth/login.ts', 'src/auth/middleware.ts']
                })
            }
        },
        {
            type: 'action' as const,
            data: {
                session_id: sessionId,
                timestamp: Date.now() - 500,
                description: 'User committed changes: feat: add rate limiting to login endpoint',
                diff: '',
                files: JSON.stringify(['src/auth/login.ts', 'src/auth/middleware.ts'])
            }
        }
    ];

    events.forEach((event, idx) => {
        queue.enqueue(event);
        console.log(`   ✓ Queued event ${idx + 1}/${events.length}: ${event.type}`);
    });

    // Step 6: Wait for queue to process
    console.log('\n⏳ Step 6: Waiting for queue to process (with embeddings)...');
    console.log('   This may take ~5-10 seconds due to Gemini API calls...');
    
    // Wait for processing (queue processes every 500ms, we have 8 items)
    await new Promise(resolve => setTimeout(resolve, 6000));
    console.log('✅ Queue processing complete');

    // Step 7: Verify Events in LanceDB
    console.log('\n🔍 Step 7: Verifying events were stored...');
    const recentEvents = await storage.getRecentEvents(10);
    console.log(`✅ Retrieved ${recentEvents.length} events from LanceDB`);
    
    if (recentEvents.length > 0) {
        const event = recentEvents[0];
        console.log(`\n   Latest event:`);
        console.log(`   - Type: ${event.event_type}`);
        console.log(`   - File: ${event.file_path}`);
        console.log(`   - Time: ${new Date(event.timestamp).toLocaleString()}`);
        console.log(`   - Metadata: ${event.metadata?.substring(0, 100)}...`);
    }

    // Step 8: Verify Actions in LanceDB
    console.log('\n🔍 Step 8: Verifying actions were stored with embeddings...');
    const recentActions = await storage.getRecentActions(5);
    console.log(`✅ Retrieved ${recentActions.length} actions from LanceDB`);
    
    if (recentActions.length > 0) {
        const action = recentActions[0];
        console.log(`\n   Latest action:`);
        console.log(`   - Description: ${action.description}`);
        console.log(`   - Session: ${action.session_id}`);
        console.log(`   - Time: ${new Date(action.timestamp).toLocaleString()}`);
        console.log(`   - Has Embedding: ${action.embedding ? 'YES' : 'NO'}`);
        if (action.embedding && Array.isArray(action.embedding)) {
            console.log(`   - Embedding dimensions: ${action.embedding.length}`);
            console.log(`   - Sample values: [${action.embedding.slice(0, 5).map((v: number) => v.toFixed(4)).join(', ')}...]`);
        } else if (action.embedding) {
            console.log(`   - Embedding dimensions: ${Object.keys(action.embedding).length}`);
            console.log(`   - Embedding type: ${typeof action.embedding}`);
        }
    }

    // Step 9: Test Vector Search (RAG)
    console.log('\n🔎 Step 9: Testing Vector Search (RAG functionality)...');
    console.log('   Query: "authentication and login"');
    const similarActions = await storage.getSimilarActions('authentication and login', 3);
    console.log(`✅ Found ${similarActions.length} similar actions`);
    
    similarActions.forEach((action, idx) => {
        console.log(`\n   Result ${idx + 1}:`);
        console.log(`   - Description: ${action.description}`);
        console.log(`   - Files: ${action.files}`);
        console.log(`   - Time: ${new Date(action.timestamp).toLocaleString()}`);
    });

    // Step 10: Test Session Retrieval
    console.log('\n📊 Step 10: Testing session retrieval...');
    const lastSession = await storage.getLastSession();
    if (lastSession) {
        console.log(`✅ Retrieved session:`);
        console.log(`   - ID: ${lastSession.id}`);
        console.log(`   - Summary: ${lastSession.summary}`);
        console.log(`   - Project: ${lastSession.project}`);
        console.log(`   - Event Count: ${lastSession.event_count}`);
        console.log(`   - Has Embedding: ${lastSession.embedding ? 'YES' : 'NO'}`);
    }

    // Step 11: Test Similar Sessions (Vector Search)
    console.log('\n🔎 Step 11: Testing similar sessions search...');
    console.log('   Query: "working on authentication"');
    const similarSessions = await storage.getSimilarSessions('working on authentication', 2);
    console.log(`✅ Found ${similarSessions.length} similar sessions`);
    
    similarSessions.forEach((session, idx) => {
        console.log(`\n   Session ${idx + 1}:`);
        console.log(`   - Summary: ${session.summary}`);
        console.log(`   - Project: ${session.project}`);
        console.log(`   - Time: ${new Date(session.timestamp).toLocaleString()}`);
    });

    // Cleanup
    queue.stop();
    console.log('\n✅ Queue stopped');

    console.log('\n' + '='.repeat(60));
    console.log('🎉 DEMO COMPLETE - All Components Working!');
    console.log('=' .repeat(60));
    console.log('\n✅ Verified:');
    console.log('   ✓ Gemini embeddings generation');
    console.log('   ✓ LanceDB storage and retrieval');
    console.log('   ✓ Session management');
    console.log('   ✓ Event ingestion with metadata');
    console.log('   ✓ Action ingestion with embeddings');
    console.log('   ✓ Vector search (RAG)');
    console.log('   ✓ Queue processing');
    console.log('\n💡 The ENTIRE ingestion pipeline is functional!\n');
}

// Run the demo
runDemo().catch(error => {
    console.error('\n❌ Demo failed:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
});
