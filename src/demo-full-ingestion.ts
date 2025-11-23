/**
 * Full Ingestion & GenAI Demo
 * 
 * This demo proves the entire ingestion pipeline works:
 * 1. Collects git logs, branch, uncommitted changes
 * 2. Reads workspace files
 * 3. Runs orchestrator pipeline
 * 4. Shows GenAI analysis results
 * 
 * Run with: npm run demo:ingestion
 * or: npx tsx src/demo-full-ingestion.ts
 */

// Install mock VSCode BEFORE any other imports that might use vscode
import { installMockVSCode } from './utils/mock-vscode';
const workspaceRoot = process.cwd();
installMockVSCode(workspaceRoot);

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { GitService } from './modules/gitlogs/GitService';
import { Orchestrator, OrchestratorConfig, PipelineResult, FileAnalysisResult } from './modules/orchestrator/orchestrator';

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn("⚠️  .env file not found or could not be loaded:", result.error.message);
} else {
  console.log("✅ .env loaded successfully");
}

// ANSI colors for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(emoji: string, message: string, color: string = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function section(title: string) {
  console.log(`\n${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

async function demoFullIngestion() {
  section('🚀 FULL INGESTION & GENAI DEMO');
  
  const workspaceRoot = process.cwd();
  log('📁', `Workspace: ${workspaceRoot}`, colors.cyan);

  // ========================================================================
  // STEP 1: Test Git Service (Git Logs, Branch, Uncommitted Changes)
  // ========================================================================
  section('STEP 1: Git Context Collection');

  let commits: Array<{ hash: string; message: string; author: string; date: Date; files?: string[] }> = [];
  
  try {
    const gitService = new GitService(workspaceRoot);
    
    // Get recent commits
    log('📜', 'Fetching git commits...', colors.yellow);
    commits = await gitService.getRecentCommits(10);
    if (commits.length > 0) {
      log('✅', `Found ${commits.length} recent commits:`, colors.green);
      commits.slice(0, 5).forEach((commit, idx) => {
        const shortHash = commit.hash.substring(0, 7);
        const date = commit.date.toLocaleDateString();
        console.log(`   ${idx + 1}. [${shortHash}] ${date} - ${commit.message}`);
        console.log(`      Author: ${commit.author} | Files: ${commit.files?.length || 0}`);
      });
      if (commits.length > 5) {
        console.log(`   ... and ${commits.length - 5} more commits`);
      }
    } else {
      log('⚠️', 'No git commits found (repository may be empty or not initialized)', colors.yellow);
    }

    // Get current branch
    log('🌿', 'Fetching current branch...', colors.yellow);
    const branch = await gitService.getCurrentBranch();
    if (branch !== 'unknown') {
      log('✅', `Current branch: ${branch}`, colors.green);
    } else {
      log('⚠️', 'Could not determine current branch', colors.yellow);
    }

    // Get uncommitted changes
    log('📝', 'Checking for uncommitted changes...', colors.yellow);
    const uncommitted = await gitService.getUncommittedChanges();
    if (uncommitted.length > 0) {
      log('✅', `Found ${uncommitted.length} uncommitted changes:`, colors.green);
      uncommitted.slice(0, 10).forEach((file, idx) => {
        console.log(`   ${idx + 1}. ${file}`);
      });
      if (uncommitted.length > 10) {
        console.log(`   ... and ${uncommitted.length - 10} more files`);
      }
    } else {
      log('✅', 'No uncommitted changes (working directory clean)', colors.green);
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log('❌', `Git service error: ${errorMsg}`, colors.red);
    console.error(error);
  }

  // ========================================================================
  // STEP 2: Test File Reading
  // ========================================================================
  section('STEP 2: Workspace File Collection');

  try {
    log('📂', 'Reading workspace files...', colors.yellow);
    
    // Note: readAllFilesHandler requires VSCode, so we'll use a fallback
    // For standalone demo, we'll read files directly
    const files: Array<{ filePath: string; content: string }> = [];
    const includePattern = /\.(ts|js|tsx|jsx|json|md)$/;
    const excludeDirs = ['node_modules', '.git', 'dist', 'out', 'build', 'coverage'];
    const maxFileSize = 100000; // 100KB

    function shouldIncludeFile(filePath: string): boolean {
      const segments = filePath.split(path.sep);
      return !excludeDirs.some(dir => segments.includes(dir)) && 
             includePattern.test(filePath) &&
             !filePath.includes('node_modules');
    }

    function readFilesRecursive(dir: string, baseDir: string = dir): void {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(baseDir, fullPath);

          if (entry.isDirectory()) {
            if (!shouldIncludeFile(relativePath)) {
              continue;
            }
            readFilesRecursive(fullPath, baseDir);
          } else if (entry.isFile()) {
            if (!shouldIncludeFile(relativePath)) {
              continue;
            }
            
            try {
              const stats = fs.statSync(fullPath);
              if (stats.size > maxFileSize) {
                console.log(`   ⚠️  Skipping large file: ${relativePath} (${stats.size} bytes)`);
                continue;
              }
              
              const content = fs.readFileSync(fullPath, 'utf-8');
              files.push({
                filePath: relativePath,
                content
              });
            } catch (err) {
              console.log(`   ⚠️  Error reading ${relativePath}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      } catch {
        // Ignore permission errors
      }
    }

    readFilesRecursive(workspaceRoot);

    if (files.length > 0) {
      log('✅', `Found ${files.length} files in workspace:`, colors.green);
      files.slice(0, 10).forEach((file, idx) => {
        console.log(`   ${idx + 1}. ${file.filePath} (${file.content.length} chars)`);
      });
      if (files.length > 10) {
        console.log(`   ... and ${files.length - 10} more files`);
      }
    } else {
      log('⚠️', 'No files found matching patterns', colors.yellow);
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log('❌', `File reading error: ${errorMsg}`, colors.red);
    console.error(error);
  }

  // ========================================================================
  // STEP 3: Test GenAI Analysis (Direct)
  // ========================================================================
  section('STEP 3: GenAI Analysis');

  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const cloudflareWorkerUrl = process.env.CLOUDFLARE_WORKER_URL || 'https://your-worker.workers.dev';

  if (!geminiApiKey) {
    log('⚠️', 'No GEMINI_API_KEY found - will use MOCK mode', colors.yellow);
    log('💡', 'Set GEMINI_API_KEY in .env for real GenAI analysis', colors.cyan);
  } else {
    log('🔑', 'Gemini API key found - using REAL GenAI', colors.green);
  }

  // Find a sample file to analyze
  let sampleFile: { filePath: string; content: string } | null = null;
  try {
    const includePattern = /\.(ts|js|tsx|jsx)$/;
    const excludeDirs = ['node_modules', '.git', 'dist', 'out', 'build', 'coverage'];

    function shouldIncludeFile(filePath: string): boolean {
      const segments = filePath.split(path.sep);
      return !excludeDirs.some(dir => segments.includes(dir)) && 
             includePattern.test(filePath);
    }

    function findSampleFile(dir: string, baseDir: string = dir): { filePath: string; content: string } | null {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(baseDir, fullPath);

          if (entry.isDirectory()) {
            if (!shouldIncludeFile(relativePath)) continue;
            const found = findSampleFile(fullPath, baseDir);
            if (found) return found;
          } else if (entry.isFile() && shouldIncludeFile(relativePath)) {
            try {
              const stats = fs.statSync(fullPath);
              if (stats.size > 50000) continue; // Skip large files
              
              const content = fs.readFileSync(fullPath, 'utf-8');
              if (content.length > 100 && content.length < 5000) {
                return { filePath: relativePath, content };
              }
            } catch (err) {
              // Skip
            }
          }
        }
      } catch (err) {
        // Ignore
      }
      return null;
    }

    const foundFile = findSampleFile(workspaceRoot);
    if (foundFile) {
      sampleFile = foundFile;
    }

    if (sampleFile) {
      log('📄', `Found sample file to analyze: ${sampleFile.filePath}`, colors.green);
    } else {
      log('⚠️', 'No suitable sample file found, creating one...', colors.yellow);
      // Create a sample file for demo
      const sampleCode = `
// Sample code for GenAI analysis demo
function calculateTotal(items: any[]) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price;
  }
  return total;
}

function processUser(user: any) {
  return user.email.toLowerCase();
}
      `.trim();
      sampleFile = { filePath: 'demo-sample.ts', content: sampleCode };
    }
  } catch (error) {
    log('⚠️', 'Could not find sample file, using fallback', colors.yellow);
    sampleFile = {
      filePath: 'demo-sample.ts',
      content: `function calculateTotal(items) { let total = 0; for (let i = 0; i < items.length; i++) { total += items[i].price; } return total; }`
    };
  }

  // Use orchestrator with mocked VSCode
  log('🎼', 'Using Orchestrator Pipeline (with mocked VSCode)', colors.cyan);
    
    const config: OrchestratorConfig = {
      cloudflareWorkerUrl,
      geminiApiKey,
      analyzeAllFiles: false,
      maxFilesToAnalyze: 5,
    };

    const orchestrator = new Orchestrator(config);

    // Set up event listeners
  orchestrator.on('initialized', () => {
    log('✅', 'Orchestrator initialized', colors.green);
  });

  orchestrator.on('contextCollectionStarted', () => {
    log('📊', 'Collecting context...', colors.yellow);
  });

  orchestrator.on('contextCollectionWarning', (data: { warnings: string[] }) => {
    log('⚠️', `Context collection warnings: ${data.warnings.join(', ')}`, colors.yellow);
  });

  orchestrator.on('contextCollectionError', (data: { type: string; error: string }) => {
    log('❌', `Context collection error (${data.type}): ${data.error}`, colors.red);
  });

  orchestrator.on('pipelineStarted', () => {
    log('🚀', 'Running analysis pipeline...', colors.cyan);
  });

  orchestrator.on('pipelineProgress', (message: string) => {
    console.log(`   ${colors.blue}→${colors.reset} ${message}`);
  });

  orchestrator.on('pipelineComplete', (result: PipelineResult) => {
    section('PIPELINE RESULTS');
    
    log('✅', 'Pipeline Complete!', colors.green);
    console.log(`\n${colors.bright}Summary:${colors.reset}`);
    console.log(`  📁 Files Analyzed: ${result.summary.totalFiles}`);
    console.log(`  ⚠️  Files with Issues: ${result.summary.filesWithIssues}`);
    console.log(`  🐛 Total Issues: ${result.summary.totalIssues}`);
    console.log(`  🎯 Overall Risk: ${colors.bright}${getRiskColor(result.summary.overallRiskLevel)}${result.summary.overallRiskLevel.toUpperCase()}${colors.reset}`);

    // Show context collected
    console.log(`\n${colors.bright}Context Collected:${colors.reset}`);
    console.log(`  📜 Git Commits: ${result.context.git.commits.length}`);
    console.log(`  🌿 Branch: ${result.context.git.currentBranch || 'unknown'}`);
    console.log(`  📝 Uncommitted: ${result.context.git.uncommittedChanges?.length || 0} files`);
    console.log(`  📂 Workspace Files: ${result.context.files.allFiles.length}`);
    console.log(`  📖 Open Files: ${result.context.files.openFiles.length}`);
    console.log(`  ✏️  Recent Edits: ${result.context.files.recentlyEdited.length}`);

    // Show file analyses
    if (result.fileAnalyses.length > 0) {
      console.log(`\n${colors.bright}File Analyses:${colors.reset}`);
      result.fileAnalyses.forEach((analysis: FileAnalysisResult, idx: number) => {
        console.log(`\n${colors.cyan}${idx + 1}. ${analysis.filePath}${colors.reset}`);
        
        if (analysis.lintResult) {
          const lint = analysis.lintResult;
          console.log(`   ${colors.yellow}📋 Lint Results:${colors.reset}`);
          console.log(`      Warnings: ${lint.warnings.length}`);
          console.log(`      Severity: ${lint.severity}`);
          if (lint.warnings.length > 0) {
            lint.warnings.slice(0, 3).forEach((w, i) => {
              console.log(`        ${i + 1}. ${w.message}`);
            });
            if (lint.warnings.length > 3) {
              console.log(`        ... and ${lint.warnings.length - 3} more warnings`);
            }
          }
        }

        if (analysis.geminiAnalysis) {
          const ai = analysis.geminiAnalysis;
          console.log(`   ${colors.magenta}🤖 GenAI Analysis:${colors.reset}`);
          console.log(`      Risk Level: ${getRiskColor(ai.risk_level)}${ai.risk_level.toUpperCase()}${colors.reset}`);
          console.log(`      Issues Found: ${ai.issues?.length || 0}`);
          
          if (ai.issues && ai.issues.length > 0) {
            console.log(`      ${colors.bright}Issues:${colors.reset}`);
            ai.issues.slice(0, 5).forEach((issue, i) => {
              const severityColor = getSeverityColor(issue.severity);
              console.log(`        ${i + 1}. [Line ${issue.line}] ${severityColor}${issue.severity.toUpperCase()}${colors.reset}: ${issue.message}`);
            });
            if (ai.issues.length > 5) {
              console.log(`        ... and ${ai.issues.length - 5} more issues`);
            }
          }

          if (ai.suggestions && ai.suggestions.length > 0) {
            console.log(`      ${colors.bright}Suggestions:${colors.reset}`);
            ai.suggestions.slice(0, 3).forEach((suggestion, i) => {
              console.log(`        ${i + 1}. ${suggestion}`);
            });
            if (ai.suggestions.length > 3) {
              console.log(`        ... and ${ai.suggestions.length - 3} more suggestions`);
            }
          }

          if (ai.summary) {
            console.log(`      ${colors.bright}Summary:${colors.reset} ${ai.summary}`);
          }

          if (ai.context_analysis) {
            console.log(`      ${colors.bright}Context Analysis:${colors.reset} ${ai.context_analysis.substring(0, 200)}...`);
          }
        }

        if (analysis.fixAction) {
          const fix = analysis.fixAction;
          const fixColor = fix.type === 'auto' ? colors.green : fix.type === 'prompt' ? colors.yellow : colors.red;
          console.log(`   ${fixColor}🔧 Fix Action: ${fix.type.toUpperCase()}${colors.reset}`);
          console.log(`      Reason: ${fix.reason}`);
        }

        if (analysis.errors.length > 0) {
          console.log(`   ${colors.red}❌ Errors:${colors.reset}`);
          analysis.errors.forEach((err, i) => {
            console.log(`      ${i + 1}. ${err}`);
          });
        }
      });
    } else {
      log('⚠️', 'No files were analyzed', colors.yellow);
      log('💡', 'Make sure you have files open or set analyzeAllFiles: true', colors.cyan);
    }
  });

  orchestrator.on('pipelineError', (error: unknown) => {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log('❌', `Pipeline error: ${errorMsg}`, colors.red);
    console.error(error);
  });

    try {
      log('🔧', 'Initializing orchestrator...', colors.yellow);
      await orchestrator.initialize();
      
      log('▶️', 'Running pipeline...', colors.cyan);
      await orchestrator.runPipeline();
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log('❌', `Orchestrator failed: ${errorMsg}`, colors.red);
      console.error(err);
    }
  
  section('✅ DEMO COMPLETE');
  log('🎉', 'All ingestion and GenAI analysis complete!', colors.green);
  log('💡', 'Check the results above to see what was collected and analyzed', colors.cyan);
}

function getRiskColor(risk: string): string {
  switch (risk) {
    case 'high': return colors.red;
    case 'medium': return colors.yellow;
    case 'low': return colors.green;
    default: return colors.reset;
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'error': return colors.red;
    case 'warning': return colors.yellow;
    case 'info': return colors.cyan;
    default: return colors.reset;
  }
}

// Run the demo
if (require.main === module) {
  demoFullIngestion()
    .then(() => {
      console.log('\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Demo failed:', err);
      process.exit(1);
    });
}

export { demoFullIngestion };

