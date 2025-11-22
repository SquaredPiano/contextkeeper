import { IVoiceService } from '../../services/interfaces';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';

export class ElevenLabsService implements IVoiceService {
  private apiKey: string | undefined;
  private initialized: boolean = false;
  private voiceId: string = 'JBFqnCBsd6RMkjVDRZzb'; // Example Voice ID (George)

  constructor() { }

  initialize(apiKey: string) {
    if (!apiKey) {
      console.warn('ElevenLabsService: No API key provided.');
      return;
    }
    this.apiKey = apiKey;
    this.initialized = true;
    console.log('ElevenLabsService initialized.');
  }

  get isReady(): boolean {
    return this.initialized;
  }

  clearQueue(): void {
    // No-op for now as we don't have a queue implementation yet
    console.log('ElevenLabsService: Queue cleared');
  }

  isEnabled(): boolean {
    return this.initialized;
  }

  async speak(text: string, voiceStyle?: 'casual' | 'professional' | 'encouraging'): Promise<void> {
    if (!this.initialized || !this.apiKey) {
      console.warn('ElevenLabsService not initialized, skipping speech.');
      return;
    }

    try {
      console.log(`Generating speech for: "${text.substring(0, 50)}..."`);

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const tempFile = path.join(os.tmpdir(), `contextkeeper-speech-${Date.now()}.mp3`);
      fs.writeFileSync(tempFile, buffer);

      console.log(`Audio saved to ${tempFile}, playing...`);
      this.playAudio(tempFile);

    } catch (error) {
      console.error('ElevenLabs Speech Generation Error:', error);
    }
  }

  private playAudio(filePath: string) {
    // Cross-platform audio player
    const platform = os.platform();
    let command = '';

    if (platform === 'darwin') {
      command = `afplay "${filePath}"`;
    } else if (platform === 'win32') {
      command = `start "${filePath}"`; // Or powershell
    } else {
      command = `aplay "${filePath}"`; // Linux
    }

    exec(command, (error) => {
      if (error) {
        console.error(`Failed to play audio: ${error.message}`);
      } else {
        // Clean up file after playing (optional, maybe keep for debug)
        // fs.unlinkSync(filePath); 
      }
    });
  }
}
