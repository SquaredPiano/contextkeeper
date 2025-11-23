import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Simple test file generator - creates test files in proper location with no user confirmation.
 * For use in idle workflow where AI generates tests automatically.
 */
export class TestFileGenerator {
    /**
     * Create a test file in the appropriate location
     * @param sourceFilePath - Path to the source file being tested
     * @param testContent - The generated test code (MUST be in same language as source)
     * @param testFileName - Optional custom test filename (will be auto-generated if not provided)
     * @param language - Optional language override (auto-detected from sourceFilePath if not provided)
     * @returns The URI of the created test file, or null if creation failed
     */
    async createTestFile(
        sourceFilePath: string,
        testContent: string,
        testFileName?: string,
        language?: string
    ): Promise<vscode.Uri | null> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                console.error('[TestFileGenerator] No workspace folder found');
                return null;
            }

            const workspaceRoot = workspaceFolder.uri.fsPath;

            // Detect language from source file if not provided
            const detectedLanguage = language || this.detectLanguage(sourceFilePath);
            console.log(`[TestFileGenerator] Detected language: ${detectedLanguage}`);

            // Determine test directory: src/tests/ if src/ exists, otherwise tests/
            const srcDir = path.join(workspaceRoot, 'src');
            const hasSrcDir = fs.existsSync(srcDir);
            const testDir = hasSrcDir 
                ? path.join(workspaceRoot, 'src', 'tests')
                : path.join(workspaceRoot, 'tests');

            // Ensure test directory exists
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true });
                console.log(`[TestFileGenerator] Created test directory: ${testDir}`);
            }

            // Generate test filename if not provided
            const finalTestFileName = testFileName || this.generateTestFileName(sourceFilePath);
            const testFilePath = path.join(testDir, finalTestFileName);

            // Check if test file already exists
            if (fs.existsSync(testFilePath)) {
                console.log(`[TestFileGenerator] Test file already exists: ${testFilePath}`);
                // Create a versioned filename with timestamp
                const timestamp = Date.now();
                const ext = path.extname(finalTestFileName);
                const base = path.basename(finalTestFileName, ext);
                const versionedFileName = `${base}.${timestamp}${ext}`;
                const versionedFilePath = path.join(testDir, versionedFileName);
                
                // Write to versioned file instead
                fs.writeFileSync(versionedFilePath, testContent, 'utf-8');
                console.log(`[TestFileGenerator] Created versioned test file: ${versionedFilePath}`);
                
                const uri = vscode.Uri.file(versionedFilePath);
                
                // Open the file
                await vscode.window.showTextDocument(uri, { preview: false });
                
                return uri;
            }

            // Write the test file
            fs.writeFileSync(testFilePath, testContent, 'utf-8');
            console.log(`[TestFileGenerator] Created test file: ${testFilePath}`);

            const uri = vscode.Uri.file(testFilePath);
            
            // Open the file
            await vscode.window.showTextDocument(uri, { preview: false });

            return uri;
        } catch (error) {
            console.error('[TestFileGenerator] Failed to create test file:', error);
            vscode.window.showErrorMessage(`Failed to create test file: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    /**
     * Generate a test filename based on the source file
     * Follows conventions: .test.ts, .test.js, test_*.py
     */
    private generateTestFileName(sourceFilePath: string): string {
        const ext = path.extname(sourceFilePath);
        const baseName = path.basename(sourceFilePath, ext);

        // Handle different language conventions
        if (ext === '.ts' || ext === '.tsx') {
            return `${baseName}.test.ts`;
        } else if (ext === '.js' || ext === '.jsx') {
            return `${baseName}.test.js`;
        } else if (ext === '.py') {
            return `test_${baseName}.py`;
        } else {
            // Default: add .test before extension
            return `${baseName}.test${ext}`;
        }
    }

    /**
     * Detect the language from the source file extension
     * Used to ensure tests are generated in the same language
     */
    private detectLanguage(sourceFilePath: string): string {
        const ext = path.extname(sourceFilePath);
        
        const languageMap: Record<string, string> = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.py': 'python',
            '.java': 'java',
            '.go': 'go',
            '.rs': 'rust',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp',
            '.rb': 'ruby',
            '.php': 'php'
        };

        return languageMap[ext] || 'unknown';
    }

    /**
     * Get the appropriate testing framework for the language
     */
    private getTestingFramework(language: string): string {
        const frameworkMap: Record<string, string> = {
            'typescript': 'Jest',
            'javascript': 'Jest',
            'python': 'pytest',
            'java': 'JUnit',
            'go': 'testing package',
            'rust': 'cargo test',
            'cpp': 'Google Test',
            'c': 'CUnit',
            'csharp': 'xUnit',
            'ruby': 'RSpec',
            'php': 'PHPUnit'
        };

        return frameworkMap[language] || 'Unknown';
    }

    /**
     * Create multiple test files in batch
     * @param tests - Array of {sourceFile, content, fileName?}
     * @returns Array of created test file URIs
     */
    async createTestFiles(tests: Array<{
        sourceFile: string;
        content: string;
        fileName?: string;
    }>): Promise<vscode.Uri[]> {
        const createdFiles: vscode.Uri[] = [];

        for (const test of tests) {
            const uri = await this.createTestFile(test.sourceFile, test.content, test.fileName);
            if (uri) {
                createdFiles.push(uri);
            }
        }

        if (createdFiles.length > 0) {
            vscode.window.showInformationMessage(
                `✅ Created ${createdFiles.length} test file(s)`,
                'Show Files'
            ).then(selection => {
                if (selection === 'Show Files') {
                    // Open the first test file
                    vscode.window.showTextDocument(createdFiles[0]);
                }
            });
        }

        return createdFiles;
    }
}
