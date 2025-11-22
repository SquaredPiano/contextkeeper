/**
 * Migration script to sync local LanceDB data to LanceDB Cloud
 * This preserves all existing events, sessions, and actions from local storage
 */

import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import * as os from 'os';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

async function migrateToCloud() {
  console.log('🚀 Starting migration from local LanceDB to LanceDB Cloud...\n');

  try {
    // Connect to local database
    const localDbPath = path.join(os.homedir(), '.contextkeeper', 'lancedb');
    console.log(`📂 Connecting to local database at: ${localDbPath}`);
    const localDb = await lancedb.connect(localDbPath);

    // Connect to cloud database
    const apiKey = process.env.LANCE_DB_API_KEY;
    const dbName = process.env.LANCEDB_DB_NAME || 'contextkeeper';
    
    if (!apiKey) {
      throw new Error('LANCE_DB_API_KEY not found in environment variables');
    }

    const cloudUri = `db://${dbName}`;
    console.log(`☁️  Connecting to LanceDB Cloud: ${cloudUri}\n`);
    const cloudDb = await lancedb.connect(cloudUri, { apiKey });

    // Get table names from local DB
    const localTables = await localDb.tableNames();
    console.log(`📊 Found ${localTables.length} tables in local database: ${localTables.join(', ')}\n`);

    // Migrate each table
    for (const tableName of localTables) {
      console.log(`\n🔄 Migrating table: ${tableName}`);
      console.log('─'.repeat(50));

      try {
        // Open local table
        const localTable = await localDb.openTable(tableName);
        
        // Read all data from local table
        const data = await localTable.query().toArray();
        console.log(`  📥 Read ${data.length} records from local ${tableName}`);

        if (data.length === 0) {
          console.log(`  ⏭️  Skipping empty table ${tableName}`);
          continue;
        }

        // Filter out init/placeholder records
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const filteredData = data.filter((record: any) => {
          if (tableName === 'events') {
            return record.timestamp > 0 && record.file_path !== '/init';
          } else if (tableName === 'sessions' || tableName === 'actions') {
            return record.timestamp > 0 && record.summary !== 'init' && record.description !== 'init';
          }
          return true;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }).map((record: any) => {
          // Clean up embedding arrays - convert to plain number arrays
          if (record.embedding && typeof record.embedding === 'object') {
            if (Array.isArray(record.embedding)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              record.embedding = record.embedding.map((v: any) => Number(v));
            } else {
              // Handle typed arrays or other embedding formats
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              record.embedding = Array.from(record.embedding as any).map((v: any) => Number(v));
            }
          }
          return record;
        });

        console.log(`  ✨ Filtered to ${filteredData.length} real records (excluding init data)`);

        if (filteredData.length === 0) {
          console.log(`  ⏭️  No real data to migrate for ${tableName}`);
          continue;
        }

        // Check if cloud table exists
        const cloudTables = await cloudDb.tableNames();
        let cloudTable: lancedb.Table;

        if (cloudTables.includes(tableName)) {
          console.log(`  📂 Opening existing cloud table: ${tableName}`);
          cloudTable = await cloudDb.openTable(tableName);
          
          // Get existing count
          const existingData = await cloudTable.query().limit(5).toArray();
          console.log(`  📊 Cloud table has ${existingData.length > 0 ? 'existing' : 'no'} data`);
        } else {
          console.log(`  🆕 Creating new cloud table: ${tableName}`);
          cloudTable = await cloudDb.createTable(tableName, filteredData.slice(0, 1));
          filteredData.shift(); // Remove first record as it was used to create table
        }

        // Upload data in batches
        if (filteredData.length > 0) {
          const batchSize = 100;
          for (let i = 0; i < filteredData.length; i += batchSize) {
            const batch = filteredData.slice(i, i + batchSize);
            await cloudTable.add(batch);
            console.log(`  📤 Uploaded batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`);
          }
        }

        console.log(`  ✅ Successfully migrated ${filteredData.length} records to cloud ${tableName}`);

      } catch (error) {
        console.error(`  ❌ Error migrating table ${tableName}:`, error);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 Migration completed successfully!');
    console.log('='.repeat(50));
    console.log('\n📝 Summary:');
    console.log(`   Local DB: ${localDbPath}`);
    console.log(`   Cloud DB: ${cloudUri}`);
    console.log(`   Tables migrated: ${localTables.join(', ')}`);
    console.log('\n💡 Your extension will now use LanceDB Cloud by default.');
    console.log('   You can verify the data at: https://cloud.lancedb.com/\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateToCloud()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
