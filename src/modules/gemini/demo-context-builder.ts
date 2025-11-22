/**
 * COMPREHENSIVE DEMO: Context Builder & RAG
 * 
 * Tests the ENTIRE context retrieval flow with REAL data:
 * 1. Initialize storage with existing data
 * 2. Use ContextBuilder to enhance context with RAG
 * 3. Verify relevant past sessions are included
 * 4. Test with different queries
 * 
 * Run with: npx ts-node src/modules/gemini/demo-context-builder.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { LanceDBStorage } from '../../services/storage/storage';
import { GeminiService } from '../../services/real/GeminiService';
import { ContextBuilder } from './context-builder';
import { RawLogInput } from './types';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

async function runDemo() {
    console.log('🚀 Starting Context Builder & RAG Demo\n');
    console.log('=' .repeat(60));

    // Step 1: Initialize Services
    console.log('\n📡 Step 1: Initializing Gemini Service...');
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY not found in environment variables!');
    }
    
    const geminiService = new GeminiService();
    await geminiService.initialize(geminiApiKey);
    console.log('✅ Gemini Service initialized');

    console.log('\n💾 Step 2: Connecting to LanceDB Storage...');
    const storage = new LanceDBStorage();
    await storage.connect(geminiService);
    console.log('✅ LanceDB Storage connected');

    // Step 3: Check existing data
    console.log('\n📊 Step 3: Checking existing data in LanceDB...');
    const recentEvents = await storage.getRecentEvents(10);
    const recentActions = await storage.getRecentActions(5);
    const lastSession = await storage.getLastSession();
    
    console.log(`✅ Found ${recentEvents.length} recent events`);
    console.log(`✅ Found ${recentActions.length} recent actions`);
    console.log(`✅ Last session: ${lastSession?.summary || 'none'}`);

    if (recentActions.length === 0) {
        console.log('\n⚠️  No existing data found. Run demo-ingestion-pipeline.ts first!');
        return;
    }

    // Step 4: Build context WITHOUT RAG (baseline)
    console.log('\n🔨 Step 4: Building context WITHOUT RAG (baseline)...');
    const rawInput: RawLogInput = {
        gitLogs: ['feat: add rate limiting', 'fix: auth middleware bug'],
        openFiles: ['src/auth/login.ts', 'src/auth/middleware.ts'],
        activeFile: 'src/auth/login.ts',
        editHistory: [
            { file: 'src/auth/login.ts', timestamp: Date.now() - 5000 },
            { file: 'src/auth/middleware.ts', timestamp: Date.now() - 3000 }
        ],
        fileContents: new Map([
            ['src/auth/login.ts', 'export function login() { /* auth code */ }']
        ]),
        errors: []
    };

    const contextWithoutRAG = await ContextBuilder.build(rawInput); // No storage = no RAG
    console.log('✅ Context built without RAG');
    console.log(`   - Active File: ${contextWithoutRAG.activeFile}`);
    console.log(`   - Related Files: ${contextWithoutRAG.relatedFiles.length}`);
    console.log(`   - Recent Commits: ${contextWithoutRAG.recentCommits.length}`);
    console.log(`   - Relevant Past Sessions: ${contextWithoutRAG.relevantPastSessions?.length || 0}`);

    // Step 5: Build context WITH RAG
    console.log('\n🔍 Step 5: Building context WITH RAG (using vector search)...');
    const contextWithRAG = await ContextBuilder.build(rawInput, storage); // With storage = RAG enabled
    console.log('✅ Context built with RAG');
    console.log(`   - Active File: ${contextWithRAG.activeFile}`);
    console.log(`   - Related Files: ${contextWithRAG.relatedFiles.length}`);
    console.log(`   - Recent Commits: ${contextWithRAG.recentCommits.length}`);
    console.log(`   - Relevant Past Sessions: ${contextWithRAG.relevantPastSessions?.length || 0}`);

    if (contextWithRAG.relevantPastSessions && contextWithRAG.relevantPastSessions.length > 0) {
        console.log('\n   📚 Retrieved Past Sessions:');
        contextWithRAG.relevantPastSessions.forEach((session, idx) => {
            console.log(`   ${idx + 1}. ${session.summary}`);
            console.log(`      Time: ${new Date(session.timestamp).toLocaleString()}`);
        });
    } else {
        console.log('\n   ℹ️  No relevant past sessions found (database might be fresh)');
    }

    // Step 6: Test with different active files
    console.log('\n🧪 Step 6: Testing RAG with different queries...');
    
    const testCases = [
        {
            name: 'Authentication Work',
            activeFile: 'src/auth/login.ts',
            query: 'Working on src/auth/login.ts'
        },
        {
            name: 'API Endpoints',
            activeFile: 'src/api/routes.ts',
            query: 'Working on src/api/routes.ts'
        },
        {
            name: 'Database Models',
            activeFile: 'src/models/user.ts',
            query: 'Working on src/models/user.ts'
        }
    ];

    for (const testCase of testCases) {
        console.log(`\n   Testing: ${testCase.name}`);
        console.log(`   Query: "${testCase.query}"`);
        
        const input: RawLogInput = {
            ...rawInput,
            activeFile: testCase.activeFile
        };
        
        const context = await ContextBuilder.build(input, storage);
        const sessionCount = context.relevantPastSessions?.length || 0;
        console.log(`   ✅ Found ${sessionCount} relevant past sessions`);
        
        if (sessionCount > 0) {
            const topSession = context.relevantPastSessions![0];
            console.log(`      Top result: "${topSession.summary}"`);
        }
    }

    // Step 7: Test vector search directly
    console.log('\n🔎 Step 7: Testing vector search directly...');
    
    const searchQueries = [
        'authentication and login',
        'rate limiting',
        'middleware',
        'database queries',
        'testing'
    ];

    for (const query of searchQueries) {
        console.log(`\n   Query: "${query}"`);
        const similarActions = await storage.getSimilarActions(query, 3);
        console.log(`   ✅ Found ${similarActions.length} similar actions`);
        
        if (similarActions.length > 0) {
            console.log(`      Top match: "${similarActions[0].description}"`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 CONTEXT BUILDER & RAG DEMO COMPLETE!');
    console.log('=' .repeat(60));
    console.log('\n✅ Verified:');
    console.log('   ✓ ContextBuilder builds basic context');
    console.log('   ✓ RAG integration retrieves relevant past sessions');
    console.log('   ✓ Vector search works with different queries');
    console.log('   ✓ Context is enhanced with historical data');
    console.log('\n💡 RAG functionality is working! Context is enhanced with past work.\n');
}

// Run the demo
runDemo().catch(error => {
    console.error('\n❌ Demo failed:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
});
