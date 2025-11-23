import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ReversiblePatchManager } from './ReversiblePatch';

/**
 * Test generation result
 */
export interface TestGenerationResult {
    testFileUri: vscode.Uri | null;
    language: string;
    framework: string | null;
    success: boolean;
    error?: string;
}

/**
 * Detected project configuration
 */
interface ProjectConfig {
    language: string;
    framework: string | null;
    testDir: string;
    testFilePattern: string;
}

/**
 * TestGenerator - Non-invasive test generation that:
 * 1. Detects language from workspace file
 * 2. Detects test framework from dependencies
 * 3. Generates tests in the same language
 * 4. Saves to tests/ folder
 * 5. Uses reversible patches for undo capability
 * 6. NEVER modifies source files
 */
export class TestGenerator {
    private patchManager: ReversiblePatchManager;
    private aiService?: any; // Optional AI service for generating test content

    constructor(aiService?: any) {
        this.patchManager = ReversiblePatchManager.getInstance();
        this.aiService = aiService;
    }

    /**
     * Generate scoped tests for a document
     * @param document - The source document to generate tests for
     * @param analysis - Optional analysis result (can be any type)
     * @returns Promise resolving to the URI of the created test file, or null if failed
     */
    public async generateScopedTests(
        document: vscode.TextDocument,
        analysis?: any
    ): Promise<vscode.Uri | null> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                console.error('[TestGenerator] No workspace folder found');
                return null;
            }

            const workspaceRoot = workspaceFolder.uri.fsPath;
            const config = await this.detectProjectConfig(document, workspaceRoot);

            // Generate test content using AI or template
            const testContent = await this.generateTestContent(document, config, analysis);

            // Determine test file path
            const testFilePath = this.getTestFilePath(document, config, workspaceRoot);

            // Create test file using reversible patch system
            const testFileUri = await this.createTestFileWithUndo(testFilePath, testContent);

            return testFileUri;

        } catch (error) {
            console.error('[TestGenerator] Failed to generate tests:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to generate tests: ${errorMsg}`);
            return null;
        }
    }

    /**
     * Detect project configuration (language, framework, test directory)
     */
    private async detectProjectConfig(
        document: vscode.TextDocument,
        workspaceRoot: string
    ): Promise<ProjectConfig> {
        // 1. Detect language from document
        const language = this.detectLanguage(document);

        // 2. Detect test framework from dependencies
        const framework = await this.detectTestFramework(workspaceRoot, language);

        // 3. Determine test directory
        const testDir = this.getTestDirectory(workspaceRoot);

        // 4. Determine test file naming pattern
        const testFilePattern = this.getTestFilePattern(language, framework);

        return {
            language,
            framework,
            testDir,
            testFilePattern
        };
    }

    /**
     * Detect programming language from document
     */
    private detectLanguage(document: vscode.TextDocument): string {
        const languageId = document.languageId;
        const ext = path.extname(document.fileName);

        // Map VS Code language IDs to our language names
        const languageMap: Record<string, string> = {
            'typescript': 'typescript',
            'javascript': 'javascript',
            'python': 'python',
            'java': 'java',
            'go': 'go',
            'rust': 'rust',
            'cpp': 'cpp',
            'c': 'c',
            'csharp': 'csharp',
            'ruby': 'ruby',
            'php': 'php'
        };

        // Try languageId first, then extension
        return languageMap[languageId] || languageMap[ext] || 'typescript';
    }

    /**
     * Detect test framework from project dependencies
     */
    private async detectTestFramework(workspaceRoot: string, language: string): Promise<string | null> {
        // JavaScript/TypeScript: Check package.json
        if (language === 'typescript' || language === 'javascript') {
            const packageJsonPath = path.join(workspaceRoot, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                try {
                    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                    
                    // Check for common test frameworks
                    if (deps['jest'] || deps['@jest/globals']) {
                        return 'jest';
                    }
                    if (deps['vitest']) {
                        return 'vitest';
                    }
                    if (deps['mocha']) {
                        return 'mocha';
                    }
                    if (deps['jasmine']) {
                        return 'jasmine';
                    }
                } catch (error) {
                    console.warn('[TestGenerator] Failed to parse package.json:', error);
                }
            }
        }

        // Python: Check requirements.txt or pyproject.toml
        if (language === 'python') {
            const requirementsPath = path.join(workspaceRoot, 'requirements.txt');
            const pyprojectPath = path.join(workspaceRoot, 'pyproject.toml');
            
            if (fs.existsSync(requirementsPath)) {
                try {
                    const requirements = fs.readFileSync(requirementsPath, 'utf-8');
                    if (requirements.includes('pytest')) {
                        return 'pytest';
                    }
                    if (requirements.includes('unittest')) {
                        return 'unittest';
                    }
                } catch (error) {
                    console.warn('[TestGenerator] Failed to read requirements.txt:', error);
                }
            }
            
            if (fs.existsSync(pyprojectPath)) {
                try {
                    const pyproject = fs.readFileSync(pyprojectPath, 'utf-8');
                    if (pyproject.includes('pytest')) {
                        return 'pytest';
                    }
                } catch (error) {
                    console.warn('[TestGenerator] Failed to read pyproject.toml:', error);
                }
            }
        }

        // Go: Check go.mod (presence indicates Go test)
        if (language === 'go') {
            const goModPath = path.join(workspaceRoot, 'go.mod');
            if (fs.existsSync(goModPath)) {
                return 'go-test'; // Go has built-in testing
            }
        }

        // Rust: Check Cargo.toml (presence indicates cargo test)
        if (language === 'rust') {
            const cargoPath = path.join(workspaceRoot, 'Cargo.toml');
            if (fs.existsSync(cargoPath)) {
                return 'cargo-test'; // Rust has built-in testing
            }
        }

        // No framework detected
        return null;
    }

    /**
     * Get test directory path
     */
    private getTestDirectory(workspaceRoot: string): string {
        // Check if tests/ directory exists
        const testsDir = path.join(workspaceRoot, 'tests');
        if (fs.existsSync(testsDir)) {
            return testsDir;
        }

        // Check if src/tests/ exists
        const srcTestsDir = path.join(workspaceRoot, 'src', 'tests');
        if (fs.existsSync(srcTestsDir)) {
            return srcTestsDir;
        }

        // Default: create tests/ at root
        return testsDir;
    }

    /**
     * Get test file naming pattern based on language and framework
     */
    private getTestFilePattern(language: string, framework: string | null): string {
        // TypeScript/JavaScript: .test.ts or .test.js
        if (language === 'typescript') {
            return '.test.ts';
        }
        if (language === 'javascript') {
            return '.test.js';
        }

        // Python: test_*.py (pytest/unittest convention)
        if (language === 'python') {
            return 'test_*.py';
        }

        // Go: *_test.go
        if (language === 'go') {
            return '_test.go';
        }

        // Rust: *_test.rs or tests/*.rs
        if (language === 'rust') {
            return '_test.rs';
        }

        // Default: .test.{ext}
        return '.test';
    }

    /**
     * Generate test file path
     */
    private getTestFilePath(
        document: vscode.TextDocument,
        config: ProjectConfig,
        workspaceRoot: string
    ): string {
        const sourceFileName = path.basename(document.fileName);
        const ext = path.extname(sourceFileName);
        const baseName = path.basename(sourceFileName, ext);

        // Ensure test directory exists
        if (!fs.existsSync(config.testDir)) {
            fs.mkdirSync(config.testDir, { recursive: true });
        }

        // Generate test filename based on pattern
        let testFileName: string;
        
        if (config.language === 'python') {
            testFileName = `test_${baseName}.py`;
        } else if (config.language === 'go') {
            testFileName = `${baseName}_test.go`;
        } else if (config.language === 'rust') {
            testFileName = `${baseName}_test.rs`;
        } else {
            // TypeScript/JavaScript default
            testFileName = `${baseName}.test${ext}`;
        }

        return path.join(config.testDir, testFileName);
    }

    /**
     * Generate test content (template or AI-generated)
     */
    private async generateTestContent(
        document: vscode.TextDocument,
        config: ProjectConfig,
        analysis?: any
    ): Promise<string> {
        const sourceCode = document.getText();
        const sourceFileName = path.basename(document.fileName);

        // Try to use AI service if available (even without framework detection)
        if (this.aiService) {
            try {
                // Use AI to generate tests (supports language and optional framework)
                if (typeof this.aiService.generateTests === 'function') {
                    const aiGenerated = await this.aiService.generateTests(sourceCode, config.language, config.framework || undefined);
                    if (aiGenerated && aiGenerated.trim().length > 0) {
                        console.log(`[TestGenerator] AI generated tests for ${config.language}`);
                        // Strip markdown code blocks if present
                        return this.stripMarkdownCodeBlocks(aiGenerated);
                    }
                }
            } catch (error) {
                console.warn('[TestGenerator] AI test generation failed, falling back to template:', error);
            }
        }

        // If framework is detected, generate framework-specific template
        if (config.framework) {
            return this.generateFrameworkTemplate(sourceCode, config, sourceFileName);
        }

        // No framework detected - generate minimal TODO template
        return this.generateMinimalTemplate(config, sourceFileName);
    }

    /**
     * Generate framework-specific test template
     */
    private generateFrameworkTemplate(
        sourceCode: string,
        config: ProjectConfig,
        sourceFileName: string
    ): string {
        const baseName = path.basename(sourceFileName, path.extname(sourceFileName));

        switch (config.framework) {
            case 'jest':
            case 'vitest':
                return `import { describe, it, expect } from '${config.framework}';
// TODO: Import the functions/classes from ${sourceFileName}

describe('${baseName}', () => {
  // TODO: Add test cases
  it('should work correctly', () => {
    // TODO: Write test assertions
    expect(true).toBe(true);
  });
});
`;

            case 'pytest':
                return `import pytest
# TODO: Import the functions/classes from ${sourceFileName}

def test_${baseName}():
    # TODO: Write test assertions
    assert True
`;

            case 'go-test':
                return `package ${baseName}

import "testing"

// TODO: Add test functions
func Test${this.toTitleCase(baseName)}(t *testing.T) {
    // TODO: Write test assertions
    t.Log("Test placeholder")
}
`;

            case 'cargo-test':
                return `#[cfg(test)]
mod tests {
    use super::*;

    // TODO: Add test functions
    #[test]
    fn test_${baseName}() {
        // TODO: Write test assertions
        assert!(true);
    }
}
`;

            default:
                return this.generateMinimalTemplate(config, sourceFileName);
        }
    }

    /**
     * Generate minimal TODO template when no framework is detected
     */
    private generateMinimalTemplate(config: ProjectConfig, sourceFileName: string): string {
        const baseName = path.basename(sourceFileName, path.extname(sourceFileName));
        const commentStyle = config.language === 'python' ? '#' : '//';

        // Generate language-specific minimal templates
        if (config.language === 'c' || config.language === 'cpp') {
            return `#include <assert.h>
#include <stdio.h>
#include "${sourceFileName}"

// Test file for ${sourceFileName}
// Generated automatically - safe to remove if not needed

void test_${baseName}_basic(void) {
    // TODO: Add test cases for ${baseName}
    // Example:
    // int result = function_to_test();
    // assert(result == expected_value);
    printf("Test placeholder for ${baseName}\\n");
}

int main(void) {
    test_${baseName}_basic();
    printf("All tests passed!\\n");
    return 0;
}
`;
        }

        if (config.language === 'python') {
            return `${commentStyle} Test file for ${sourceFileName}
${commentStyle} Generated automatically - safe to remove if not needed
${commentStyle}
${commentStyle} TODO: Add test cases for ${baseName}
${commentStyle} TODO: Import necessary testing framework
${commentStyle} TODO: Write test assertions
`;
        }

        return `${commentStyle} Test file for ${sourceFileName}
${commentStyle} Generated automatically - safe to remove if not needed
${commentStyle}
${commentStyle} TODO: Add test cases for ${baseName}
${commentStyle} TODO: Import necessary testing framework
${commentStyle} TODO: Write test assertions
`;
    }

    /**
     * Create test file with undo capability using ReversiblePatchManager
     */
    private async createTestFileWithUndo(
        testFilePath: string,
        testContent: string
    ): Promise<vscode.Uri | null> {
        try {
            const testFileUri = vscode.Uri.file(testFilePath);
            
            // Check if file already exists
            const fileExists = fs.existsSync(testFilePath);
            let originalContent = '';

            if (fileExists) {
                // Read existing content for undo
                originalContent = fs.readFileSync(testFilePath, 'utf-8');
            }

            // Create the test file
            fs.writeFileSync(testFilePath, testContent, 'utf-8');

            // If file was created (not overwritten), show undo option to delete it
            if (!fileExists) {
                // For new files, show undo option to delete the file (non-blocking)
                // Don't await - fire and forget, but handle cancellation gracefully
                Promise.resolve(vscode.window.showInformationMessage(
                    'Test file created',
                    'Undo Test Creation',
                    'Keep'
                )).then(choice => {
                if (choice === 'Undo Test Creation') {
                    // Delete the file
                    try {
                            if (fs.existsSync(testFilePath)) {
                        fs.unlinkSync(testFilePath);
                        vscode.window.showInformationMessage('Test file creation undone');
                            }
                    } catch (deleteError) {
                        console.error('[TestGenerator] Failed to delete test file:', deleteError);
                    }
                    }
                }).catch((error: unknown) => {
                    // Ignore cancellation errors - file was already created
                    if (error && typeof error === 'object' && 'name' in error && error.name === 'Canceled') {
                        // Silently ignore cancellation
                        return;
                    }
                    console.warn('[TestGenerator] Notification error (non-fatal):', error);
                });

                // Return immediately - file is already created
                return testFileUri;
            } else {
                // File existed - use reversible patch for content changes
                // First, we need to open the document to get the current state
                const document = await vscode.workspace.openTextDocument(testFileUri);
                const currentText = document.getText();
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(currentText.length)
                );

                // Use patch manager to apply the change with undo capability
                await this.patchManager.applyFix(testFileUri, fullRange, testContent);
                return testFileUri;
            }

        } catch (error) {
            // If the error is a cancellation but the file was already written, return the URI
            if (error && typeof error === 'object' && 'name' in error && error.name === 'Canceled') {
                // Check if file was successfully created before cancellation
                if (fs.existsSync(testFilePath)) {
                    console.log('[TestGenerator] Operation canceled but file was created, returning URI');
                    return vscode.Uri.file(testFilePath);
                }
            }
            
            console.error('[TestGenerator] Failed to create test file:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            
            // Only show error if file doesn't exist
            if (!fs.existsSync(testFilePath)) {
            vscode.window.showErrorMessage(`Failed to create test file: ${errorMsg}`);
            }
            
            return null;
        }
    }

    /**
     * Strip markdown code blocks from AI-generated content
     * Removes ```language and ``` from the beginning and end
     */
    private stripMarkdownCodeBlocks(content: string): string {
        let cleaned = content.trim();
        
        // Remove opening code block (```language or ```)
        cleaned = cleaned.replace(/^```[a-z]*\n?/i, '');
        
        // Remove closing code block (```)
        cleaned = cleaned.replace(/\n?```$/i, '');
        
        return cleaned.trim();
    }

    /**
     * Helper: Convert string to TitleCase
     */
    private toTitleCase(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

