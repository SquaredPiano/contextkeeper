import { VoiceType, ElevenLabsModule } from './index';
import * as vscode from 'vscode';
import { getVoiceId } from './voices';
import { MockPlayer } from './mock';
import { promises as fs } from 'fs';
import * as os from 'os';
import { IVoiceService } from '../../services/interfaces';
import fetch from 'node-fetch';
import * as path from 'path';
import { exec } from 'child_process';

export class ElevenLabsService implements IVoiceService {
  private apiKey: string | undefined;
  private initialized: boolean = false;
  private voiceId: string = 'JBFqnCBsd6RMkjVDRZzb'; // Example Voice ID (George)
  private mock: MockPlayer;
  private fallbackMode: boolean = false;

  constructor() {
    this.mock = new MockPlayer();
  }

  initialize(apiKey: string) {
    if (!apiKey) {
      console.warn('ElevenLabsService: No API key provided.');
      this.fallbackMode = true;
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
    const globalVoice = vscode.workspace.getConfiguration('copilot').get('voice.enabled', true);
    const elevenEnabled = vscode.workspace.getConfiguration('copilot').get('voice.elevenEnabled', true);
    return (this.initialized || this.fallbackMode) && globalVoice && elevenEnabled;
  }

  setEnabled(enabled: boolean): void {
    // Update the setting
    vscode.workspace.getConfiguration('copilot').update('voice.elevenEnabled', enabled, true);
  }

  async speak(text: string, voiceStyle?: 'casual' | 'professional' | 'encouraging'): Promise<void> {
    if (!this.initialized && !this.fallbackMode) {
      console.warn('ElevenLabsService not initialized, skipping speech.');
      return;
    }

    // Map voiceStyle to VoiceType
    const voice: VoiceType = (voiceStyle === 'casual' ? 'casual' : 
                              voiceStyle === 'encouraging' ? 'encouraging' : 
                              'professional') as VoiceType;

    try {
      await this.performSpeak(text, voice);
    } catch (error) {
      console.error(`Error speaking "${text}":`, error);
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
    let command: string;

    if (platform === 'darwin') {
      command = `afplay "${filePath}"`;
    } else if (platform === 'win32') {
      // Use PowerShell to play audio on Windows without external dependencies
      command = `powershell -c (New-Object Media.SoundPlayer "${filePath}").PlaySync()`;
    } else {
      command = `aplay "${filePath}"`; // Linux (requires alsa-utils)
    }

    exec(command, async (error) => {
      if (error) {
        console.error(`Failed to play audio: ${error.message}`);
      }
      // Clean up file after playing (regardless of success/failure)
      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.error('Failed to delete temp audio file:', err);
      }
    });
  }
}
