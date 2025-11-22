import { AutonomousAgent } from './src/modules/autonomous/AutonomousAgent';
import { DeveloperContext } from './src/services/interfaces';

// Mock VS Code API
const mockVscode = {
    window: {
        activeTextEditor: {
            document: {
                uri: { fsPath: '/tmp/test.ts' },
                getText: () => "const x: number = 'string';", // Error code
                positionAt: () => ({ line: 0, character: 0 }),
                save: async () => { }
            }
        },
        showInformationMessage: console.log,
        showErrorMessage: console.error
    },
    languages: {
        getDiagnostics: () => [{
            severity: 0, // Error
            message: "Type 'string' is not assignable to type 'number'.",
            range: { start: { line: 0 }, end: { line: 0 } }
        }]
    },
    DiagnosticSeverity: { Error: 0 },
    WorkspaceEdit: class {
        replace() { console.log('WorkspaceEdit.replace called'); }
    },
    workspace: {
        applyEdit: async () => { console.log('Applied Edit'); return true; }
    },
    Range: class { }
};
(global as any).vscode = mockVscode;

// Mock Services
const mockGit = { createBranch: async () => { } };
const mockAI = {
    fixError: async (code: string, error: string) => {
        console.log(`AI Fixing Error: ${error}`);
        return { fixedCode: "const x: string = 'string';", explanation: "Fixed type mismatch" };
    }
};
const mockContext = { collectContext: async () => ({} as DeveloperContext) };

async function verify() {
    console.log('--- Verifying Auto-Fix Logic ---');

    const agent = new AutonomousAgent(mockGit as any, mockAI as any, mockContext as any);

    // Access private method via any cast for testing
    await (agent as any).runAutoFix({} as DeveloperContext);

    console.log('--- Verification Complete ---');
}

verify().catch(console.error);
