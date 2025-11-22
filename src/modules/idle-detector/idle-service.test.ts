import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdleService } from './idle-service';
import { IdleDetector } from './idle-detector';
import { storage } from '../../services/storage';

// Mock dependencies
vi.mock('./idle-detector', () => {
  return {
    IdleDetector: vi.fn().mockImplementation(function() {
      return {
        on: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        dispose: vi.fn(),
      };
    })
  };
});

vi.mock('../../services/storage', () => ({
  storage: {
    connect: vi.fn(),
    getRecentEvents: vi.fn(),
    createSession: vi.fn(),
  }
}));

vi.mock('vscode', () => ({
  workspace: {
    name: 'TestProject'
  }
}));

describe('IdleService', () => {
  let service: IdleService;
  let mockDetectorInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    service = new IdleService({ thresholdMs: 1000 });
    
    // Get the mock instance created by the constructor
    mockDetectorInstance = (IdleDetector as any).mock.results[0].value;
  });
// ...

  it('should initialize detector and storage', async () => {
    await service.initialize();
    
    expect(mockDetectorInstance.on).toHaveBeenCalledWith('idle', expect.any(Function));
    expect(mockDetectorInstance.on).toHaveBeenCalledWith('active', expect.any(Function));
    expect(mockDetectorInstance.start).toHaveBeenCalled();
    expect(storage.connect).toHaveBeenCalled();
  });

  it('should create session on idle when events exist', async () => {
    await service.initialize();
    
    // Get the idle callback
    const idleCallback = mockDetectorInstance.on.mock.calls.find((call: any) => call[0] === 'idle')[1];
    
    // Mock storage response with events that are newer than the service's lastSessionTime
    const now = Date.now();
    (storage.getRecentEvents as any).mockResolvedValue([
      { timestamp: now + 1000, event_type: 'file_edit', file_path: 'test.ts' }
    ]);
    (storage.createSession as any).mockResolvedValue({ id: 'session-1', summary: 'test' });

    // Trigger idle
    await idleCallback();

    expect(storage.getRecentEvents).toHaveBeenCalled();
    expect(storage.createSession).toHaveBeenCalled();
  });

  it('should NOT create session on idle when NO new events', async () => {
    await service.initialize();
    
    const idleCallback = mockDetectorInstance.on.mock.calls.find((call: any) => call[0] === 'idle')[1];
    
    // Mock empty events
    (storage.getRecentEvents as any).mockResolvedValue([]);

    await idleCallback();

    expect(storage.getRecentEvents).toHaveBeenCalled();
    expect(storage.createSession).not.toHaveBeenCalled();
  });

  it('should use AI service for summary when provided', async () => {
    const mockAIService = {
      summarize: vi.fn().mockResolvedValue('AI-generated summary of your work session')
    };
    
    const serviceWithAI = new IdleService({ thresholdMs: 1000 }, mockAIService as any);
    await serviceWithAI.initialize();
    
    // Get the mock instance from the new service
    const newMockDetectorInstance = (IdleDetector as any).mock.results[(IdleDetector as any).mock.results.length - 1].value;
    const idleCallback = newMockDetectorInstance.on.mock.calls.find((call: any) => call[0] === 'idle')[1];
    
    // Mock storage response with events that are newer than the service's lastSessionTime
    const now = Date.now();
    (storage.getRecentEvents as any).mockResolvedValue([
      { timestamp: now + 1000, event_type: 'file_edit', file_path: 'test.ts' },
      { timestamp: now + 2000, event_type: 'file_open', file_path: 'test2.ts' }
    ]);
    (storage.createSession as any).mockResolvedValue({ id: 'session-1', summary: 'AI-generated summary' });

    await idleCallback();

    expect(mockAIService.summarize).toHaveBeenCalled();
    expect(storage.createSession).toHaveBeenCalledWith('AI-generated summary of your work session', expect.any(String));
  });
});
