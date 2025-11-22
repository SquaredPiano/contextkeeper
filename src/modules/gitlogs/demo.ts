// Mock vscode for CLI usage since gitlog.ts imports it
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id: string) {
  if (id === 'vscode') {
    return {
      workspace: {
        workspaceFolders: []
      },
      Uri: {
        file: (path: string) => ({ fsPath: path })
      }
    };
  }
  return originalRequire.apply(this, arguments);
};

import { getLogsWithGitlog } from './gitlog';
import * as path from 'path';

// We need to mock vscode module because it's imported in gitlog.ts
// When running via ts-node, we can use module-alias or just mock the object if we were using a test runner.
// However, since we are running a raw script, the import "vscode" will fail if not handled.
// A simple workaround for this demo is to rely on the fact that we passed the path explicitly,
// so the vscode part of the code won't be reached/used if we are careful.
// BUT, the `import * as vscode` at the top level will crash Node if 'vscode' module isn't found.

// To make this runnable in Node without VS Code, we usually separate the "VS Code adapter" from the "Core Logic".
// Since we just refactored `getLogsWithGitlog` to take a path, we still have the import.
// We can use a mock-require approach or just catch the error? No, import happens at parse time.

// STRATEGY: We will create a mock 'vscode' module in node_modules for this demo to work, 
// OR we can just use a try-catch block in the real file? 
// Actually, the cleanest way for a demo of a VS Code extension module is to mock the module loader 
// or just accept that we can't easily run it if it has hard imports of 'vscode'.

// Let's try a different approach for the demo: 
// We will create a wrapper that mocks the module resolution for 'vscode'.
// OR simpler: We can just create a dummy vscode.js in the directory and map it in tsconfig? No.

// Let's try to run it. If it fails on "cannot find module vscode", we know we need to mock it.
// Since we are in a dev environment, we can install `mock-require` or similar, but let's try to be dependency-light.

// Actually, let's just create a simple demo that assumes we can run it. 
// If it fails, I will create a `vscode.js` mock in the root or use module-alias.

async function demo() {
  console.log('📜 GitLogs Module Demo\n');
  
  try {
    const cwd = process.cwd();
    console.log(`Reading git logs from: ${cwd}`);
    
    const logs = await getLogsWithGitlog(cwd);
    
    console.log(`\nFound ${logs.length} commits:\n`);
    logs.forEach((log: any) => {
      console.log(`[${log.hash.substring(0, 7)}] ${log.authorDate} - ${log.subject} (${log.authorName})`);
    });
    
    console.log('\n✓ Demo complete');
  } catch (error) {
    console.error('Error running demo:', error);
  }
}

demo();
