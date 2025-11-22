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
  private playerCommand: string | null = null;

  async initialize(apiKey: string): Promise<void> {
    this.apiKey = apiKey || null;
    
    // Check for audio player availability
    await this.checkPlayerAvailability();

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

  clearQueue(): void {
    this.queue = [];
  }

  private async checkPlayerAvailability(): Promise<void> {
    const platform = process.platform;
    if (platform === 'darwin') {
      this.playerCommand = 'afplay';
    } else if (platform === 'linux') {
      // Check if mpg123 is available
      try {
        await new Promise((resolve, reject) => {
          const child = spawn('which', ['mpg123']);
          child.on('close', (code) => code === 0 ? resolve(true) : reject());
          child.on('error', reject);
        });
        this.playerCommand = 'mpg123';
      } catch {
        console.warn('mpg123 not found, audio playback will be disabled on Linux');
        this.playerCommand = null;
      }
    } else if (platform === 'win32') {
      this.playerCommand = 'powershell.exe';
    }
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
    if (!this.playerCommand) {
      console.log('[Audio] No audio player available, skipping playback.');
      return;
    }

    // Write to temporary file and play using platform-native tool
    const buffer = Buffer.from(data);
    const tmpDir = os.tmpdir();
    const fileName = `elevenlabs_${Date.now()}.mp3`;
    const filePath = path.join(tmpDir, fileName);

    try {
      await fs.writeFile(filePath, buffer);
      console.log(`[Audio] Playing ${fileName}...`);

      const platform = process.platform;
      let args: string[] = [];

      if (platform === 'darwin') {
        args = [filePath];
      } else if (platform === 'linux') {
        args = ['-q', filePath];
      } else if (platform === 'win32') {
        args = ['-c', `Add-Type -AssemblyName presentationCore;` +
          `[System.Windows.Media.MediaPlayer]$player = New-Object System.Windows.Media.MediaPlayer;` +
          `$player.Open([System.Uri]::new('${filePath}'));` +
          `$player.Play();` +
          `Start-Sleep -s 2`];
      }

      await new Promise<void>((resolve) => {
        const child = spawn(this.playerCommand!, args, { stdio: 'ignore', detached: false });
        
        const timeout = setTimeout(() => {
          try { child.kill(); } catch {}
          resolve();
        }, 10000); // 10s timeout

        child.on('error', (err) => {
          console.error(`[Audio] Player error: ${err.message}`);
          clearTimeout(timeout);
          resolve();
        });

        child.on('close', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

    } catch (error) {
      console.error('[Audio] Playback failed:', error);
    } finally {
      // Attempt to remove file
      fs.unlink(filePath).catch(() => { /* ignore */ });
    }
  }
}
