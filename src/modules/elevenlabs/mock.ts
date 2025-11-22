import { VoiceType } from './index';

export class MockPlayer {
  async play(text: string, voice: VoiceType = 'casual'): Promise<void> {
    // Simple console fallback for environments without ElevenLabs access
    console.log(`[VOICE - ${voice}]: ${text}`);
  }
}
