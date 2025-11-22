import { VoiceType, ElevenLabsModule } from './index';
import * as vscode from 'vscode';
import { getVoiceId } from './voices';
import { MockPlayer } from './mock';
import { promises as fs } from 'fs';
import * as os from 'os';
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
      await this.performSpeak(item.text, item.voice);
      item.resolve();
    } catch (error) {
      console.error(`Error speaking "${item.text}":`, error);
      // Don't reject the promise to avoid unhandled rejections crashing the extension,
      // just log it. Or we could reject if the caller wants to handle it.
      // For now, let's resolve so the queue continues.
      item.resolve(); 
    } finally {
      this.isProcessing = false;
      // Process next item
      this.processQueue();
    }
  }

  private async performSpeak(text: string, voice: VoiceType): Promise<void> {
    // Respect user preferences: global voice enabled + ElevenLabs-specific enabled
    const globalVoice = vscode.workspace.getConfiguration('copilot').get('voice.enabled', true);
    const elevenEnabled = vscode.workspace.getConfiguration('copilot').get('voice.elevenEnabled', true);

    if (!globalVoice || !elevenEnabled || this.fallbackMode || !this.apiKey) {
      await this.mock.play(text, voice);
      return;
    }

    const voiceId = getVoiceId(voice);

    // Make the request to ElevenLabs TTS endpoint.
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
    const body = JSON.stringify({ text });

    console.log(`[ElevenLabs] Requesting TTS for: "${text}" (Voice: ${voiceId})`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body
    });

    if (!res.ok) {
      // If the API returns an error, fall back to console logging
      console.warn(`ElevenLabs API error: ${res.status} ${res.statusText}`);
      await this.mock.play(text, voice);
      return;
    }

    const audioData = await res.arrayBuffer();
    await this.playAudio(audioData);
  }

  private async playAudio(data: ArrayBuffer): Promise<void> {
    // Write to temporary file and play using platform-native tool
    const buffer = Buffer.from(data);
    const tmpDir = os.tmpdir();
    const fileName = `elevenlabs_${Date.now()}.mp3`;
    const filePath = path.join(tmpDir, fileName);

    await fs.writeFile(filePath, buffer);

    console.log(`[Audio] Playing ${fileName}...`);

    const platform = process.platform;
    let cmd: string;
    let args: string[] = [];

    if (platform === 'darwin') {
      command = `afplay "${filePath}"`;
    } else if (platform === 'win32') {
      // Use PowerShell to play audio on Windows without external dependencies
      command = `powershell -c (New-Object Media.SoundPlayer "${filePath}").PlaySync()`;
    } else {
      command = `aplay "${filePath}"`; // Linux (requires alsa-utils)
    }

    exec(command, (error) => {
      if (error) {
        console.error(`Failed to play audio: ${error.message}`);
      } else {
        // Clean up file after playing
        fs.unlink(filePath, (err) => {
            if (err) console.error('Failed to delete temp audio file:', err);
        }); 
      }
    });
  }
}
