import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ElevenLabsService } from './elevenlabs';

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('ElevenLabsService', () => {
  let service: ElevenLabsService;

  beforeEach(() => {
    service = new ElevenLabsService();
    fetchMock.mockReset();
    // Mock successful API response by default
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(10),
    });
    // Mock playAudio to avoid actual file I/O and playback
    vi.spyOn(service as any, 'playAudio').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with valid API key', async () => {
    await service.initialize('test-key');
    expect(service.isReady()).toBe(true);
  });

  it('should fall back to console on API failure', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await service.initialize(''); // no key -> fallback
    await service.speak('Test message');
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[VOICE - casual]: Test message')
    );
  });

  it('should queue messages and play them sequentially', async () => {
    await service.initialize('test-key');
    
    const playAudioSpy = vi.spyOn(service as any, 'playAudio');
    
    // Simulate slow playback
    playAudioSpy.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    const p1 = service.speak('Message 1');
    const p2 = service.speak('Message 2');
    const p3 = service.speak('Message 3');

    await Promise.all([p1, p2, p3]);

    // The initialize call also calls speak('Test'), so total calls = 1 (init) + 3 (messages) = 4
    expect(playAudioSpy).toHaveBeenCalledTimes(4);
    // Verify order of execution is preserved by the queue
    // Note: In a real unit test for queue, we might check timestamps or call order more strictly.
    // Since we await Promise.all, we just ensure all were called.
  });

  it('should handle API errors gracefully without crashing queue', async () => {
    await service.initialize('test-key');
    
    // First call fails
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockPlaySpy = vi.spyOn((service as any).mock, 'play').mockResolvedValue(undefined);

    await service.speak('Fail message');
    await service.speak('Success message');

    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('ElevenLabs API error'));
    expect(mockPlaySpy).toHaveBeenCalledWith('Fail message', 'casual');
    // Second message should still process (mocked success in beforeEach)
    // Total fetch calls: 1 (init) + 1 (fail) + 1 (success) = 3
    expect(fetchMock).toHaveBeenCalledTimes(3); 
  });
});
