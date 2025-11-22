/**
 * Verification script to test LanceDB Cloud connection and data persistence
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { LanceDBStorage } from './storage';
import { GeminiService } from '../real/GeminiService';

dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

async function verifyCloudConnection() {
  console.log('🧪 Testing LanceDB Cloud Connection & Data Pipeline\n');
  console.log('='.repeat(60));

  try {
    // 1. Initialize Gemini for embeddings
    console.log('\n📡 Step 1: Initializing Gemini Service for embeddings...');
    const geminiService = new GeminiService();
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found in environment');
    }
    
    await geminiService.initialize(apiKey);
    console.log('   ✅ Gemini Service initialized');

    // 2. Connect to cloud storage
    console.log('\n☁️  Step 2: Connecting to LanceDB Cloud...');
    const storage = new LanceDBStorage();
    await storage.connect(geminiService);
    console.log('   ✅ Connected to LanceDB Cloud');

    // 3. Test event logging
    console.log('\n📝 Step 3: Testing event logging...');
    await storage.logEvent({
      timestamp: Date.now(),
      event_type: 'file_open',
      file_path: '/test/verification.ts',
      metadata: JSON.stringify({ test: true, timestamp: new Date().toISOString() })
    });
    console.log('   ✅ Event logged successfully');

    // 4. Test session creation with embeddings
    console.log('\n📦 Step 4: Testing session creation with embeddings...');
    const session = await storage.createSession(
      'Verification test session - testing cloud connectivity and embedding generation',
      'contextkeeper-test'
    );
    console.log(`   ✅ Session created: ${session.id}`);
    console.log(`   📊 Summary: ${session.summary}`);
    console.log(`   🔢 Embedding dimension: ${session.embedding.length}`);

    // 5. Test action logging with embeddings
    console.log('\n⚡ Step 5: Testing action logging with embeddings...');
    await storage.addAction({
      session_id: session.id,
      timestamp: Date.now(),
      description: 'Tested cloud connection and verified that embeddings are being generated and stored correctly',
      diff: '+ verified cloud connection\n+ tested embeddings',
      files: JSON.stringify(['/test/verification.ts'])
    });
    console.log('   ✅ Action logged successfully');

    // 6. Test retrieval
    console.log('\n🔍 Step 6: Testing data retrieval...');
    
    const recentEvents = await storage.getRecentEvents(5);
    console.log(`   ✅ Retrieved ${recentEvents.length} recent events`);
    console.log(`   📌 Latest event: ${recentEvents[0]?.event_type} - ${recentEvents[0]?.file_path}`);

    const recentActions = await storage.getRecentActions(5);
    console.log(`   ✅ Retrieved ${recentActions.length} recent actions`);
    console.log(`   📌 Latest action: ${recentActions[0]?.description.substring(0, 50)}...`);

    // 7. Test vector search
    console.log('\n🔎 Step 7: Testing vector similarity search...');
    const similarActions = await storage.getSimilarActions('testing and verification', 3);
    console.log(`   ✅ Found ${similarActions.length} similar actions`);
    similarActions.slice(0, 3).forEach((action, idx) => {
      console.log(`   ${idx + 1}. ${action.description.substring(0, 60)}...`);
    });

    const similarSessions = await storage.getSimilarSessions('cloud database testing', 3);
    console.log(`   ✅ Found ${similarSessions.length} similar sessions`);
    similarSessions.slice(0, 3).forEach((session, idx) => {
      console.log(`   ${idx + 1}. ${session.summary.substring(0, 60)}...`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\n✨ Cloud Connection Summary:');
    console.log(`   Database: ${process.env.LANCEDB_DB_NAME}`);
    console.log(`   Status: Connected & Operational`);
    console.log(`   Features Verified:`);
    console.log(`     ✓ Event logging`);
    console.log(`     ✓ Session creation with embeddings`);
    console.log(`     ✓ Action logging with embeddings`);
    console.log(`     ✓ Data retrieval`);
    console.log(`     ✓ Vector similarity search`);
    console.log('\n💡 Your extension is now fully connected to LanceDB Cloud!');
    console.log('   View your data at: https://cloud.lancedb.com/\n');

  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED:', error);
    process.exit(1);
  }
}

// Run verification
verifyCloudConnection()
  .then(() => {
    console.log('✅ Verification complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
