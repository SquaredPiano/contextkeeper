import { VoiceType, ElevenLabsModule } from './index';
import { getVoiceId } from './voices';
import { MockPlayer } from './mock';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';

export class ElevenLabsService implements ElevenLabsModule {
  private apiKey: string | null = null;
  private fallbackMode: boolean = false;
  private mock: MockPlayer = new MockPlayer();
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
      // No API key -> fallback immediately
      this.fallbackMode = true;
      return;
    }

    // Try a lightweight test to check if the API is usable. If it fails, use fallback.
    try {
      await this.speak('Test', 'casual');
    } catch (err) {
      console.warn('ElevenLabs unavailable, using fallback');
      this.fallbackMode = true;
    }
  }

  isReady(): boolean {
    return !this.fallbackMode && !!this.apiKey;
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
    if (this.fallbackMode || !this.apiKey) {
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
      cmd = 'afplay';
      args = [filePath];
    } else if (platform === 'linux') {
      // Requirement asks for `aplay`, but aplay typically only supports WAV.
      // ElevenLabs returns MP3. `mpg123` is standard for CLI MP3 playback.
      // If `aplay` is strictly required, we would need to convert or request PCM.
      // Falling back to `mpg123` for MP3 support.
      cmd = 'mpg123';
      args = ['-q', filePath];
    } else if (platform === 'win32') {
      // Use Powershell to play sync
      cmd = 'powershell.exe';
      args = ['-c', `Add-Type -AssemblyName presentationCore;` +
        `[System.Windows.Media.MediaPlayer]$player = New-Object System.Windows.Media.MediaPlayer;` +
        `$player.Open([System.Uri]::new('${filePath}'));` +
        `$player.Play();` +
        `Start-Sleep -s 2`];
    } else {
      // Unknown platform: fallback to console
      console.log(`[AUDIO] saved to ${filePath}`);
      return;
    }

    await new Promise<void>((resolve) => {
      try {
        const child = spawn(cmd, args, { stdio: 'ignore', detached: false });
        child.on('error', () => resolve());
        // Some players exit quickly; wait a short period before cleaning up
        child.on('close', () => resolve());
        // Fallback timeout
        setTimeout(() => resolve(), 8000);
      } catch (e) {
        resolve();
      }
    });

    // Attempt to remove file, but don't block on errors
    fs.unlink(filePath).catch(() => { /* ignore */ });
  }
}
