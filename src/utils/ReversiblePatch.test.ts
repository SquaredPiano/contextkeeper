import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReversiblePatchManager, ReversibleFix } from './ReversiblePatch';
import * as vscode from 'vscode';

// Mock VS Code API
const mockShowInformationMessage = vi.fn();
const mockShowErrorMessage = vi.fn();
const mockShowWarningMessage = vi.fn();
const mockExecuteCommand = vi.fn();
const mockApplyEdit = vi.fn();
const mockOpenTextDocument = vi.fn();
const mockGetText = vi.fn();
const mockPositionAt = vi.fn();
const mockOffsetAt = vi.fn();
const mockEdit = vi.fn();

let mockDocument: any;
let mockEditor: any;
let mockActiveEditor: any;

vi.mock('vscode', () => {
  return {
    window: {
      showInformationMessage: mockShowInformationMessage,
      showErrorMessage: mockShowErrorMessage,
      showWarningMessage: mockShowWarningMessage,
      activeTextEditor: null,
      showTextDocument: vi.fn(),
    },
    workspace: {
      openTextDocument: mockOpenTextDocument,
      applyEdit: mockApplyEdit,
    },
    commands: {
      executeCommand: mockExecuteCommand,
    },
    Uri: {
      file: (path: string) => ({ fsPath: path, toString: () => `file://${path}` }),
    },
    Range: class {
      constructor(public start: any, public end: any) {}
      intersection(other: any) {
        return this.start.line === other.start.line ? this : null;
      }
      isEqual(other: any) {
        return this.start.line === other.start.line && this.end.line === other.end.line;
      }
    },
    Position: class {
      constructor(public line: number, public character: number) {}
    },
    WorkspaceEdit: class {
      private edits: Map<any, any[]> = new Map();
      
      replace(uri: any, range: any, newText: string) {
        if (!this.edits.has(uri)) {
          this.edits.set(uri, []);
        }
        this.edits.get(uri)!.push({ range, newText });
      }
      
      get(uri: any) {
        return this.edits.get(uri) || [];
      }
    },
  };
});

describe('ReversiblePatchManager', () => {
  let manager: ReversiblePatchManager;
  let testUri: vscode.Uri;
  let testRange: vscode.Range;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset singleton
    (ReversiblePatchManager as any).instance = null;
    manager = ReversiblePatchManager.getInstance();
    
    testUri = vscode.Uri.file('/test/file.ts');
    testRange = new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(0, 10)
    );

    // Setup default mocks
    mockDocument = {
      getText: mockGetText,
      version: 1,
      positionAt: mockPositionAt,
      offsetAt: mockOffsetAt,
      uri: testUri,
    };

    mockEditor = {
      document: mockDocument,
      edit: mockEdit,
    };

    mockGetText.mockReturnValue('original text');
    mockOpenTextDocument.mockResolvedValue(mockDocument);
    mockApplyEdit.mockResolvedValue(true);
    mockEdit.mockResolvedValue(true);
    mockShowInformationMessage.mockResolvedValue('Keep');
    mockPositionAt.mockImplementation((offset: number) => new vscode.Position(0, offset));
    mockOffsetAt.mockImplementation((pos: any) => pos.character);
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ReversiblePatchManager.getInstance();
      const instance2 = ReversiblePatchManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('applyFix with active editor', () => {
    beforeEach(() => {
      (vscode.window as any).activeTextEditor = mockEditor;
    });

    it('should use TextEditor.edit() when editor is active', async () => {
      await manager.applyFix(testUri, testRange, 'new text');

      expect(mockEdit).toHaveBeenCalled();
      expect(mockApplyEdit).not.toHaveBeenCalled();
    });

    it('should store fix information', async () => {
      await manager.applyFix(testUri, testRange, 'new text');

      expect(manager.hasUndoableFix()).toBe(true);
    });

    it('should show Undo/Keep prompt', async () => {
      await manager.applyFix(testUri, testRange, 'new text');

      expect(mockShowInformationMessage).toHaveBeenCalledWith(
        'Fix applied',
        'Undo',
        'Keep'
      );
    });

    it('should execute undo command when user chooses Undo', async () => {
      mockShowInformationMessage.mockResolvedValue('Undo');

      await manager.applyFix(testUri, testRange, 'new text');

      expect(mockExecuteCommand).toHaveBeenCalledWith('undo');
    });

    it('should clear fix when user chooses Keep', async () => {
      mockShowInformationMessage.mockResolvedValue('Keep');

      await manager.applyFix(testUri, testRange, 'new text');

      expect(manager.hasUndoableFix()).toBe(false);
    });
  });

  describe('applyFix without active editor', () => {
    beforeEach(() => {
      (vscode.window as any).activeTextEditor = null;
    });

    it('should use WorkspaceEdit when no editor is active', async () => {
      await manager.applyFix(testUri, testRange, 'new text');

      expect(mockApplyEdit).toHaveBeenCalled();
      expect(mockEdit).not.toHaveBeenCalled();
    });

    it('should store original text before applying', async () => {
      mockGetText.mockReturnValue('original text');

      await manager.applyFix(testUri, testRange, 'new text');

      expect(mockGetText).toHaveBeenCalledWith(testRange);
    });

    it('should handle failed edit application', async () => {
      mockApplyEdit.mockResolvedValue(false);

      await manager.applyFix(testUri, testRange, 'new text');

      expect(mockShowErrorMessage).toHaveBeenCalledWith('Failed to apply fix');
      expect(manager.hasUndoableFix()).toBe(false);
    });
  });

  describe('applyFixWithEdit', () => {
    it('should apply WorkspaceEdit and show prompt', async () => {
      const edit = new vscode.WorkspaceEdit();
      edit.replace(testUri, testRange, 'new text');

      await manager.applyFixWithEdit(testUri, edit, 'original text', testRange);

      expect(mockApplyEdit).toHaveBeenCalledWith(edit);
      expect(mockShowInformationMessage).toHaveBeenCalled();
    });

    it('should extract newText from WorkspaceEdit', async () => {
      const edit = new vscode.WorkspaceEdit();
      edit.replace(testUri, testRange, 'extracted text');

      await manager.applyFixWithEdit(testUri, edit, 'original text', testRange);

      expect(manager.hasUndoableFix()).toBe(true);
    });
  });

  describe('undo', () => {
    beforeEach(() => {
      (vscode.window as any).activeTextEditor = null;
    });

    it('should return false if no fix to undo', async () => {
      const result = await manager.undo();

      expect(result).toBe(false);
      expect(mockShowWarningMessage).toHaveBeenCalledWith('No fix to undo');
    });

    it('should undo fix using exact range match', async () => {
      // Setup: apply a fix first
      mockGetText.mockReturnValue('new text'); // After fix
      await manager.applyFix(testUri, testRange, 'new text');
      
      // Now test undo
      mockGetText.mockImplementation((range?: any) => {
        if (!range) return 'new text'; // Full document
        return 'new text'; // At range
      });
      
      const result = await manager.undo();

      expect(mockApplyEdit).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should try multiple undo strategies', async () => {
      // Apply fix
      await manager.applyFix(testUri, testRange, 'new text');
      
      // Mock document to return newText at range (strategy 1 should work)
      mockGetText.mockImplementation((range?: any) => {
        if (!range) return 'new text in document';
        return 'new text';
      });

      const result = await manager.undo();

      expect(result).toBe(true);
    });

    it('should use VS Code undo command if editor is active and recent', async () => {
      (vscode.window as any).activeTextEditor = {
        document: {
          ...mockDocument,
          version: 2, // Only 1 edit since our fix (version 1)
        },
      };

      // Apply fix
      await manager.applyFix(testUri, testRange, 'new text');
      
      // Update stored fix to have documentVersion
      (manager as any).lastFix = {
        file: testUri,
        originalText: 'original text',
        newText: 'new text',
        range: testRange,
        documentVersion: 1,
      };

      mockShowInformationMessage.mockResolvedValue('Undo');
      const result = await manager.undo();

      expect(mockExecuteCommand).toHaveBeenCalledWith('undo');
    });
  });

  describe('hasUndoableFix', () => {
    it('should return false when no fix stored', () => {
      expect(manager.hasUndoableFix()).toBe(false);
    });

    it('should return true when fix is stored', async () => {
      await manager.applyFix(testUri, testRange, 'new text');
      expect(manager.hasUndoableFix()).toBe(true);
    });
  });

  describe('clearLastFix', () => {
    it('should clear stored fix', async () => {
      await manager.applyFix(testUri, testRange, 'new text');
      expect(manager.hasUndoableFix()).toBe(true);

      manager.clearLastFix();
      expect(manager.hasUndoableFix()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors during applyFix', async () => {
      mockOpenTextDocument.mockRejectedValue(new Error('File not found'));

      await manager.applyFix(testUri, testRange, 'new text');

      expect(mockShowErrorMessage).toHaveBeenCalled();
      expect(manager.hasUndoableFix()).toBe(false);
    });

    it('should handle errors during undo', async () => {
      // Apply fix first
      await manager.applyFix(testUri, testRange, 'new text');
      
      // Make undo fail
      mockOpenTextDocument.mockRejectedValue(new Error('File not found'));

      const result = await manager.undo();

      expect(result).toBe(false);
      expect(mockShowErrorMessage).toHaveBeenCalled();
    });
  });
});

