import { VoiceType, ElevenLabsModule } from './index';
import { getVoiceId } from './voices';
import { MockPlayer } from './mock';
import { AudioPlayer } from './audio-player';
import { IVoiceService } from '../../services/interfaces';

export class ElevenLabsService implements ElevenLabsModule, IVoiceService {
  private apiKey: string | null = null;
  private fallbackMode: boolean = false;
  private mock: MockPlayer = new MockPlayer();
  private audioPlayer: AudioPlayer = new AudioPlayer();
  private queue: Array<{
    text: string;
    voice: VoiceType;
    resolve: () => void;
    reject: (err: any) => void;
  }> = [];
  private isProcessing: boolean = false;

  async initialize(apiKey: string): Promise<void> {
    this.apiKey = apiKey || null;
    
    if (!this.apiKey) {
      this.fallbackMode = true;
      return;
    }

    // Verify API key with a lightweight user request instead of generating audio
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const res = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': this.apiKey },
        signal: controller.signal
      });
      
      clearTimeout(timeout);

      if (!res.ok) {
        console.warn(`[ElevenLabs] API Key verification failed: ${res.status}`);
        this.fallbackMode = true;
      }
    } catch (err) {
      console.warn('[ElevenLabs] Connection check failed, using fallback', err);
      this.fallbackMode = true;
    }
  }

  isReady(): boolean {
    return !this.fallbackMode && !!this.apiKey;
  }

  isEnabled(): boolean {
    return this.isReady();
  }

  clearQueue(): void {
    this.queue = [];
  }

  async speak(text: string, voice: VoiceType = 'casual'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ text, voice, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const item = this.queue.shift();

    if (!item) {
      this.isProcessing = false;
      return;
    }

    try {
      await this.performSpeak(item.text, item.voice);
      item.resolve();
    } catch (error) {
      console.error(`Error speaking "${item.text}":`, error);
      item.resolve(); // Resolve anyway to keep queue moving
    } finally {
      this.isProcessing = false;
      this.processQueue();
    }
  }

  private async performSpeak(text: string, voice: VoiceType): Promise<void> {
    if (this.fallbackMode || !this.apiKey) {
      await this.mock.play(text, voice);
      return;
    }

    const voiceId = getVoiceId(voice);
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
    const body = JSON.stringify({ text });

    console.log(`[ElevenLabs] Requesting TTS for: "${text}" (Voice: ${voiceId})`);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout for generation

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body,
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) {
        console.warn(`ElevenLabs API error: ${res.status} ${res.statusText}`);
        await this.mock.play(text, voice);
        return;
      }

      const audioData = await res.arrayBuffer();
      await this.audioPlayer.play(audioData);

    } catch (error) {
      console.error('[ElevenLabs] Network error:', error);
      await this.mock.play(text, voice);
    }
  }
}
