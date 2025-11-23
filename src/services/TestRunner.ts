import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export interface TestRunResult {
  passed: number;
  failed: number;
  total: number;
  duration: number;
  output: string;
  error?: string;
  framework: TestFramework;
}

export enum TestFramework {
  Vitest = 'vitest',
  Jest = 'jest',
  Mocha = 'mocha',
  C = 'c',
  Cpp = 'cpp',
  Unknown = 'unknown'
}

/**
 * TestRunner - Executes generated tests using child_process and captures results
 * Automatically detects test framework from package.json
 */
export class TestRunner {
  private workspaceRoot: string;
  private framework: TestFramework = TestFramework.Unknown;

  constructor(workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
  }

  /**
   * Detect test framework from package.json or file extension
   */
  async detectFramework(testFilePath?: string): Promise<TestFramework> {
    // First, try to detect from file extension if test file path is provided
    if (testFilePath) {
      const ext = path.extname(testFilePath).toLowerCase();
      if (ext === '.c') {
        this.framework = TestFramework.C;
        console.log(`[TestRunner] Detected C test file from extension`);
        return this.framework;
      } else if (ext === '.cpp' || ext === '.cc' || ext === '.cxx') {
        this.framework = TestFramework.Cpp;
        console.log(`[TestRunner] Detected C++ test file from extension`);
        return this.framework;
      }
    }

    // Try to detect from package.json for JS/TS projects
    try {
      const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      // Priority order: vitest > jest > mocha
      if (deps['vitest']) {
        this.framework = TestFramework.Vitest;
      } else if (deps['jest'] || deps['@types/jest']) {
        this.framework = TestFramework.Jest;
      } else if (deps['mocha'] || deps['@types/mocha']) {
        this.framework = TestFramework.Mocha;
      } else {
        this.framework = TestFramework.Unknown;
      }

      console.log(`[TestRunner] Detected test framework: ${this.framework}`);
      return this.framework;
    } catch (error) {
      // If no package.json and no file extension match, return Unknown
      // This is expected for C/C++ projects
      if (testFilePath) {
        const ext = path.extname(testFilePath).toLowerCase();
        if (ext === '.c' || ext === '.cpp' || ext === '.cc' || ext === '.cxx') {
          // Already handled above, but just in case
          return this.framework;
        }
      }
      console.log(`[TestRunner] No package.json found (expected for C/C++ projects)`);
      this.framework = TestFramework.Unknown;
      return TestFramework.Unknown;
    }
  }

  /**
   * Run tests for a specific file
   */
  async runTests(testFilePath: string): Promise<TestRunResult> {
    const startTime = Date.now();

    // Detect framework from test file path first
    await this.detectFramework(testFilePath);

    if (this.framework === TestFramework.Unknown) {
      return {
        passed: 0,
        failed: 0,
        total: 0,
        duration: 0,
        output: '',
        error: 'No test framework detected. For JS/TS projects, please install vitest, jest, or mocha. For C/C++ projects, ensure gcc/g++ is available.',
        framework: TestFramework.Unknown
      };
    }

    console.log(`[TestRunner] Running tests with ${this.framework}: ${testFilePath}`);

    try {
      const command = this.buildTestCommand(testFilePath);
      console.log(`[TestRunner] 🧪 Executing command: ${command}`);
      console.log(`[TestRunner] 📁 Working directory: ${this.workspaceRoot}`);

      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workspaceRoot,
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 // 1MB buffer
      });

      const duration = Date.now() - startTime;
      const output = stdout + stderr;

      // Parse results based on framework
      const result = this.parseTestOutput(output, duration);
      
      console.log(`[TestRunner] ✅ Test execution complete:`);
      console.log(`[TestRunner]    ✔️  Passed: ${result.passed}`);
      console.log(`[TestRunner]    ❌ Failed: ${result.failed}`);
      console.log(`[TestRunner]    ⏱️  Duration: ${result.duration}ms`);
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const output = error.stdout || '';
      const stderr = error.stderr || '';
      const fullOutput = output + stderr;

      // For C/C++ projects, provide better error messages
      if ((this.framework === TestFramework.C || this.framework === TestFramework.Cpp) && 
          (error.message?.includes('gcc') || error.message?.includes('g++') || 
           stderr.includes('gcc') || stderr.includes('g++') || 
           error.message?.includes('command not found') || stderr.includes('command not found'))) {
        console.error('[TestRunner] C/C++ compiler not found. Please install gcc (for C) or g++ (for C++)');
        return {
          passed: 0,
          failed: 0,
          total: 0,
          duration,
          output: fullOutput,
          error: 'C/C++ compiler (gcc/g++) not found. Please install a C compiler to run tests.',
          framework: this.framework
        };
      }

      // Even on error, try to parse results (tests may have failed but runner succeeded)
      if (output) {
        const result = this.parseTestOutput(fullOutput, duration);
        result.error = error.message;
        return result;
      }

      console.error('[TestRunner] Test execution failed:', error);
      
      return {
        passed: 0,
        failed: 0,
        total: 0,
        duration,
        output: fullOutput,
        error: error.message || 'Test execution failed',
        framework: this.framework
      };
    }
  }

  /**
   * Build test command based on detected framework
   */
  private buildTestCommand(testFilePath: string): string {
    const relativePath = path.relative(this.workspaceRoot, testFilePath);

    switch (this.framework) {
      case TestFramework.Vitest:
        return `npx vitest run "${relativePath}" --reporter=verbose`;
      
      case TestFramework.Jest:
        return `npx jest "${relativePath}" --verbose --no-cache`;
      
      case TestFramework.Mocha:
        return `npx mocha "${relativePath}" --reporter spec`;
      
      case TestFramework.C:
        // Compile and run C test file
        const outputPath = testFilePath.replace(/\.c$/, '.out');
        return `gcc -o "${outputPath}" "${testFilePath}" && "${outputPath}"`;
      
      case TestFramework.Cpp:
        // Compile and run C++ test file
        const cppOutputPath = testFilePath.replace(/\.(cpp|cc|cxx)$/, '.out');
        return `g++ -o "${cppOutputPath}" "${testFilePath}" && "${cppOutputPath}"`;
      
      default:
        throw new Error(`Unknown test framework: ${this.framework}`);
    }
  }

  /**
   * Parse test output to extract pass/fail counts
   */
  private parseTestOutput(output: string, duration: number): TestRunResult {
    const result: TestRunResult = {
      passed: 0,
      failed: 0,
      total: 0,
      duration,
      output,
      framework: this.framework
    };

    try {
      switch (this.framework) {
        case TestFramework.Vitest:
          result.passed = this.extractNumber(output, /Test Files\s+(\d+)\s+passed/i) || 
                         this.extractNumber(output, /Tests\s+(\d+)\s+passed/i) || 0;
          result.failed = this.extractNumber(output, /Test Files\s+(\d+)\s+failed/i) ||
                         this.extractNumber(output, /Tests\s+(\d+)\s+failed/i) || 0;
          result.total = result.passed + result.failed;
          break;

        case TestFramework.Jest:
          result.passed = this.extractNumber(output, /(\d+)\s+passed/i) || 0;
          result.failed = this.extractNumber(output, /(\d+)\s+failed/i) || 0;
          result.total = this.extractNumber(output, /Tests:\s+\d+\s+failed,\s+(\d+)\s+total/i) ||
                        (result.passed + result.failed);
          break;

        case TestFramework.Mocha:
          result.passed = this.extractNumber(output, /(\d+)\s+passing/i) || 0;
          result.failed = this.extractNumber(output, /(\d+)\s+failing/i) || 0;
          result.total = result.passed + result.failed;
          break;

        case TestFramework.C:
        case TestFramework.Cpp:
          // For C/C++ tests, check if "All tests passed!" appears in output
          // Count test functions by looking for "test_" prefix in the source
          if (output.includes('All tests passed!')) {
            // Try to count test functions from output or assume all passed
            const testMatches = output.match(/test_\w+/g);
            result.total = testMatches ? testMatches.length : 1;
            result.passed = result.total;
            result.failed = 0;
          } else if (output.includes('Assertion failed') || output.includes('assertion') || output.includes('Aborted')) {
            // Test failed - try to extract info
            result.failed = 1;
            result.total = 1;
            result.passed = 0;
          } else {
            // If we can't determine, assume success if program ran without error
            result.passed = output.includes('All tests passed!') ? 1 : 0;
            result.failed = result.passed === 0 ? 1 : 0;
            result.total = 1;
          }
          break;
      }
    } catch (error) {
      console.error('[TestRunner] Failed to parse test output:', error);
    }

    return result;
  }

  /**
   * Extract number from regex match
   */
  private extractNumber(text: string, regex: RegExp): number | null {
    const match = text.match(regex);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Run all tests in workspace
   */
  async runAllTests(): Promise<TestRunResult> {
    if (this.framework === TestFramework.Unknown) {
      await this.detectFramework();
    }

    const startTime = Date.now();

    try {
      const command = this.buildAllTestsCommand();
      console.log(`[TestRunner] Running all tests: ${command}`);

      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workspaceRoot,
        timeout: 60000, // 60 second timeout
        maxBuffer: 2 * 1024 * 1024 // 2MB buffer
      });

      const duration = Date.now() - startTime;
      const output = stdout + stderr;

      return this.parseTestOutput(output, duration);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const output = (error.stdout || '') + (error.stderr || '');
      
      const result = this.parseTestOutput(output, duration);
      result.error = error.message;
      return result;
    }
  }

  /**
   * Build command to run all tests
   */
  private buildAllTestsCommand(): string {
    switch (this.framework) {
      case TestFramework.Vitest:
        return 'npx vitest run --reporter=verbose';
      
      case TestFramework.Jest:
        return 'npx jest --verbose --no-cache';
      
      case TestFramework.Mocha:
        return 'npx mocha --reporter spec';
      
      default:
        throw new Error(`Unknown test framework: ${this.framework}`);
    }
  }
}
