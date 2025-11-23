"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AutonomousAgent_1 = require("./src/modules/autonomous/AutonomousAgent");
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
    Range: class {
    }
};
global.vscode = mockVscode;
// Mock Services
const mockGit = { createBranch: async () => { } };
const mockAI = {
    fixError: async (code, error) => {
        console.log(`AI Fixing Error: ${error}`);
        return { fixedCode: "const x: string = 'string';", explanation: "Fixed type mismatch" };
    }
};
const mockContext = { collectContext: async () => ({}) };
async function verify() {
    console.log('--- Verifying Auto-Fix Logic ---');
    const agent = new AutonomousAgent_1.AutonomousAgent(mockGit, mockAI, mockContext);
    // Access private method via any cast for testing
    await agent.runAutoFix({});
    console.log('--- Verification Complete ---');
}
verify().catch(console.error);
//# sourceMappingURL=verify-auto-fix.js.map