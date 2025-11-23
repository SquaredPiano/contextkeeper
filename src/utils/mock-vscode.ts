/**
 * Mock VSCode Module for Demo Scripts
 * 
 * This provides a mock implementation of the VSCode API for use in standalone demos.
 * It allows demo scripts to run without requiring the actual VSCode extension host.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface MockVSCode {
  workspace: {
    workspaceFolders: Array<{ uri: { fsPath: string } }> | undefined;
    textDocuments: Array<{ fileName: string; uri: { fsPath: string } }>;
    findFiles: (include: string, exclude: string) => Promise<Array<{ fsPath: string }>>;
  };
  window: {
    activeTextEditor: {
      document: {
        fileName: string;
        getText: () => string;
      };
      selection: {
        active: {
          line: number;
          character: number;
        };
      };
    } | undefined;
    createOutputChannel: (name: string) => MockOutputChannel;
    showErrorMessage: (message: string) => void;
  };
  Uri: {
    file: (path: string) => { fsPath: string };
  };
}

export interface MockOutputChannel {
  appendLine: (value: string) => void;
  show: () => void;
  hide: () => void;
  dispose: () => void;
}

let mockWorkspaceRoot: string | undefined;
let mockActiveFile: string | undefined;
let mockActiveFileContent: string | undefined;

/**
 * Initialize the mock VSCode module with workspace settings
 */
export function initializeMockVSCode(workspaceRoot: string, activeFile?: string) {
  mockWorkspaceRoot = workspaceRoot;
  mockActiveFile = activeFile;
  
  if (activeFile) {
    try {
      const fullPath = path.isAbsolute(activeFile) ? activeFile : path.join(workspaceRoot, activeFile);
      if (fs.existsSync(fullPath)) {
        mockActiveFileContent = fs.readFileSync(fullPath, 'utf-8');
      }
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Create the mock VSCode module
 */
export function createMockVSCode(): MockVSCode {
  const workspaceRoot = mockWorkspaceRoot || process.cwd();
  
  // Find a sample active file if not provided
  let activeFile = mockActiveFile;
  let activeFileContent = mockActiveFileContent;
  
  if (!activeFile) {
    // Try to find a sample active file if not provided
    const extensions = ['.ts', '.js', '.tsx', '.jsx'];
    const excludeDirs = ['node_modules', '.git', 'dist', 'out', 'build', 'coverage'];
    
    function findFile(dir: string, depth: number = 0): string | undefined {
      if (depth > 3) {
        return undefined; // Limit depth
      }
      
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            if (excludeDirs.includes(entry.name)) {
              continue;
            }
            const found = findFile(path.join(dir, entry.name), depth + 1);
            if (found) {
              return found;
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              return path.join(dir, entry.name);
            }
          }
        }
      } catch {
        // Ignore errors
      }
      return undefined;
    }
    
    const found = findFile(workspaceRoot);
    if (found) {
      activeFile = found;
      try {
        activeFileContent = fs.readFileSync(activeFile, 'utf-8');
      } catch {
        // Ignore
      }
    }
  }

  // Mock output channels
  const outputChannels = new Map<string, MockOutputChannel>();
  
  const createOutputChannel = (name: string): MockOutputChannel => {
    if (!outputChannels.has(name)) {
      outputChannels.set(name, {
        appendLine: (value: string) => {
          console.log(`[${name}] ${value}`);
        },
        show: () => {
          // No-op in demo mode
        },
        hide: () => {
          // No-op in demo mode
        },
        dispose: () => {
          outputChannels.delete(name);
        }
      });
    }
    return outputChannels.get(name)!;
  };

  // Mock text documents (open files)
  const textDocuments: Array<{ fileName: string; uri: { fsPath: string } }> = [];
  if (activeFile) {
    textDocuments.push({
      fileName: activeFile,
      uri: { fsPath: activeFile }
    });
  }

  // Mock active text editor
  const activeTextEditor = activeFile && activeFileContent ? {
    document: {
      fileName: activeFile,
      getText: () => activeFileContent || ''
    },
    selection: {
      active: {
        line: 0,
        character: 0
      }
    }
  } : undefined;

  return {
    workspace: {
      workspaceFolders: [{
        uri: { fsPath: workspaceRoot }
      }],
      textDocuments,
      findFiles: async (include: string, exclude: string): Promise<Array<{ fsPath: string }>> => {
        try {
          // Parse include pattern (e.g., "**/*.{ts,js,tsx,jsx,json,md}")
          const includeExts: string[] = [];
          const extMatch = include.match(/\{([^}]+)\}/);
          if (extMatch) {
            includeExts.push(...extMatch[1].split(',').map(e => e.trim()));
          } else {
            // Default extensions if pattern doesn't specify
            includeExts.push('.ts', '.js', '.tsx', '.jsx', '.json', '.md');
          }

          // Parse exclude patterns
          const excludeDirs = new Set<string>();
          const excludeMatch = exclude.match(/\{([^}]+)\}/);
          if (excludeMatch) {
            excludeMatch[1].split(',').forEach(p => {
              const dir = p.trim().replace(/\*\*/g, '').replace(/\//g, '').replace(/\*/g, '');
              if (dir) {
                excludeDirs.add(dir);
              }
            });
          }
          // Add defaults
          excludeDirs.add('node_modules');
          excludeDirs.add('.git');
          excludeDirs.add('dist');
          excludeDirs.add('out');
          excludeDirs.add('build');
          excludeDirs.add('coverage');

          const files: string[] = [];

          function scanDir(dir: string, depth: number = 0) {
            if (depth > 10) {
              return; // Limit depth
            }
            
            try {
              const entries = fs.readdirSync(dir, { withFileTypes: true });
              
              for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(workspaceRoot, fullPath);
                const pathSegments = relativePath.split(path.sep);

                // Check if excluded
                if (pathSegments.some(seg => excludeDirs.has(seg))) {
                  continue;
                }

                if (entry.isDirectory()) {
                  scanDir(fullPath, depth + 1);
                } else if (entry.isFile()) {
                  const ext = path.extname(entry.name);
                  if (includeExts.includes(ext)) {
                    files.push(fullPath);
                  }
                }
              }
            } catch {
              // Ignore permission errors
            }
          }

          scanDir(workspaceRoot);
          return files.map(fsPath => ({ fsPath }));
        } catch (error) {
          console.warn('[MockVSCode] Error finding files:', error);
          return [];
        }
      }
    },
    window: {
      activeTextEditor,
      createOutputChannel,
      showErrorMessage: (message: string) => {
        console.error(`[VSCode Error] ${message}`);
      }
    },
    Uri: {
      file: (filePath: string) => ({ fsPath: filePath })
    }
  };
}

/**
 * Install the mock VSCode module
 * Call this before any code tries to require('vscode')
 */
export function installMockVSCode(workspaceRoot?: string, activeFile?: string) {
  if (workspaceRoot) {
    initializeMockVSCode(workspaceRoot, activeFile);
  }

  // Override require to return our mock
  const Module = require('module');
  const originalRequire = Module.prototype.require;

  Module.prototype.require = function(id: string) {
    if (id === 'vscode') {
      return createMockVSCode();
    }
    return originalRequire.apply(this, arguments);
  };
}

