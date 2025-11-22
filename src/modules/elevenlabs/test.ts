import { ElevenLabsService } from './elevenlabs';

describe('ElevenLabsService', () => {
  it('should initialize with valid API key', async () => {
    const service = new ElevenLabsService();
    await service.initialize('test-key');
    expect(service.isReady()).toBe(true);
  });

  it('should fall back to console on API failure', async () => {
    const service = new ElevenLabsService();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await service.initialize(''); // no key -> fallback
    await service.speak('Test message');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[VOICE - casual]: Test message')
    );

    consoleSpy.mockRestore();
  });

  it('should use different voices', async () => {
    const service = new ElevenLabsService();
    const apiKey = process.env.ELEVEN_LABS_API_KEY || process.env.ELEVENLABS_API_KEY || '';
    await service.initialize(apiKey);
    
    // These should not throw (may use fallback)
    await service.speak('Casual', 'casual');
    await service.speak('Professional', 'professional');
    await service.speak('Encouraging', 'encouraging');
  });
});
