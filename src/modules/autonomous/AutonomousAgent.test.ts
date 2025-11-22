
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutonomousAgent } from './AutonomousAgent';
import { IGitService, IAIService, IContextService, DeveloperContext } from '../../services/interfaces';
import * as vscode from 'vscode';

// Mock VS Code
vi.mock('vscode', () => {
    const mockVscode = {
        window: {
            activeTextEditor: {
                document: {
                    getText: () => "console.log('test');",
                    languageId: 'typescript',
                    fileName: '/src/test.ts',
                    uri: { fsPath: '/src/test.ts' },
                    positionAt: () => ({ line: 0, character: 0 }),
                    save: vi.fn()
                }
            },
            showInformationMessage: vi.fn(),
            showWarningMessage: vi.fn(),
            showErrorMessage: vi.fn()
        },
        workspace: {
            applyEdit: vi.fn(),
            fs: { stat: vi.fn() },
            asRelativePath: (p: string) => p
        },
        languages: {
            getDiagnostics: vi.fn().mockReturnValue([])
        },
        DiagnosticSeverity: { Error: 0 },
        WorkspaceEdit: class {
            replace = vi.fn();
            createFile = vi.fn();
            insert = vi.fn();
        },
        Range: class {},
        Position: class {},
        Uri: { file: (p: string) => ({ fsPath: p }) }
    };
    return mockVscode;
});

describe('AutonomousAgent', () => {
    let agent: AutonomousAgent;
    let mockGitService: any;
    let mockAIService: any;
    let mockContextService: any;

    beforeEach(() => {
        mockGitService = {
            createBranch: vi.fn(),
            commit: vi.fn()
        };
        mockAIService = {
            analyze: vi.fn().mockResolvedValue({ issues: [] }),
            plan: vi.fn().mockResolvedValue('Run auto-lint'),
            fixError: vi.fn(),
            generateTests: vi.fn()
        };
        mockContextService = {
            collectContext: vi.fn().mockResolvedValue({
                files: { activeFile: 'src/test.ts' },
                git: { recentCommits: [] }
            })
        };

        agent = new AutonomousAgent(
            mockGitService as IGitService,
            mockAIService as IAIService,
            mockContextService as IContextService
        );
    });

    it('should start a session and execute a plan', async () => {
        await agent.startSession();

        expect(mockContextService.collectContext).toHaveBeenCalled();
        expect(mockAIService.plan).toHaveBeenCalled();
        expect(mockGitService.createBranch).toHaveBeenCalled();
        // Should run auto-lint by default if plan says so
        expect(vscode.window.showWarningMessage).toHaveBeenCalled(); // Lint issue found (console.log)
    });

    it('should run auto-fix if plan says so', async () => {
        mockAIService.plan.mockResolvedValue('Fix the bugs');
        (vscode.languages.getDiagnostics as any).mockReturnValue([{
            message: 'Error here',
            severity: 0, // Error
            range: { start: { line: 0 } }
        }]);
        mockAIService.fixError.mockResolvedValue({ fixedCode: 'fixed' });

        await agent.startSession();

        expect(mockAIService.fixError).toHaveBeenCalled();
        expect(mockGitService.commit).toHaveBeenCalled();
    });
});
