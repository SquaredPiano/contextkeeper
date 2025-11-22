// Git Logs Module Demo
// This demo uses GitService directly (which doesn't depend on vscode)
// instead of gitlog.ts (which imports vscode)

import { GitService } from './GitService';
import * as path from 'path';

async function demo() {
  console.log('📜 GitLogs Module Demo\n');
  
  try {
    const cwd = process.cwd();
    console.log(`Reading git logs from: ${cwd}`);
    
    // Use GitService directly instead of gitlog.ts wrapper
    // This avoids the vscode dependency issue
    const gitService = new GitService(cwd);
    const logs = await gitService.getRecentCommits(10);
    
    if (logs.length === 0) {
      console.log('⚠️  No commits found. Make sure you\'re in a git repository.');
      console.log(`Current directory: ${cwd}`);
      
      // Try to get current branch as a test
      const branch = await gitService.getCurrentBranch();
      console.log(`Current branch: ${branch}`);
      
      if (branch === 'unknown') {
        console.log('❌ Not a git repository or git is not installed.');
      } else {
        console.log('✅ Git repository detected, but no recent commits found.');
      }
      return;
    }
    
    console.log(`\n✅ Found ${logs.length} recent commits:\n`);
    logs.forEach((log) => {
      const dateStr = log.date.toLocaleDateString();
      const shortHash = log.hash.substring(0, 7);
      const filesCount = log.files?.length || 0;
      console.log(`[${shortHash}] ${dateStr} - ${log.message}`);
      console.log(`    Author: ${log.author} | Files: ${filesCount}`);
    });
    
    // Also show current branch
    const branch = await gitService.getCurrentBranch();
    console.log(`\n branch: ${branch}`);
    
    console.log('\n✓ Demo complete');
  } catch (error: any) {
    console.error('\n❌ Error running demo:', error.message);
    
    if (error.message.includes('git')) {
      console.log('\n💡 Tip: Make sure git is installed and you\'re in a git repository.');
    }
  }
}

demo();
