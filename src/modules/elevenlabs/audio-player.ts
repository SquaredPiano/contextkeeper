import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

export class AudioPlayer {
  private playerCommand: string | null = null;

  constructor() {
    this.detectPlayer();
  }

  private async detectPlayer(): Promise<void> {
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

  async play(audioData: ArrayBuffer): Promise<void> {
    if (!this.playerCommand) {
      console.log('[Audio] No audio player available, skipping playback.');
      return;
    }

    const buffer = Buffer.from(audioData);
    const tmpDir = os.tmpdir();
    const fileName = `elevenlabs_${Date.now()}.mp3`;
    const filePath = path.join(tmpDir, fileName);

    try {
      await fs.writeFile(filePath, buffer);
      
      const platform = process.platform;
      let args: string[] = [];
      let durationEstimate = 10000; // Default 10s

      // Rough estimate: 1MB mp3 ~ 1 minute. 
      // buffer.length is bytes. 
      // 100KB ~ 6 seconds.
      // 128kbps = 16KB/s.
      // Let's be more generous with the estimate.
      durationEstimate = Math.max(5000, (buffer.length / 10000) * 1000); 
      
      console.log(`[Audio] Buffer size: ${buffer.length} bytes. Estimated duration: ${durationEstimate}ms`);

      if (platform === 'darwin') {
        args = [filePath];
      } else if (platform === 'linux') {
        args = ['-q', filePath];
      } else if (platform === 'win32') {
        // Improved PowerShell command that waits for media to end
        // Note: This is still tricky in pure PowerShell without blocking the UI thread too much
        // We'll stick to a simpler approach but use the estimated duration
        const seconds = Math.ceil(durationEstimate / 1000) + 1;
        args = ['-c', `Add-Type -AssemblyName presentationCore;` +
          `$player = New-Object System.Windows.Media.MediaPlayer;` +
          `$player.Open([System.Uri]::new('${filePath}'));` +
          `$player.Play();` +
          `Start-Sleep -s ${seconds}`];
      }

      await new Promise<void>((resolve) => {
        console.log(`[Audio] Spawning: ${this.playerCommand} ${args.join(' ')}`);
        
        // Use 'pipe' to capture output for debugging
        const child = spawn(this.playerCommand!, args, { stdio: 'pipe', detached: false });
        
        child.stdout?.on('data', (data) => console.log(`[Audio Player stdout]: ${data}`));
        child.stderr?.on('data', (data) => console.error(`[Audio Player stderr]: ${data}`));
        
        const timeout = setTimeout(() => {
          try { child.kill(); } catch {}
          resolve();
        }, durationEstimate + 2000); // Add buffer

        child.on('error', (err) => {
          console.error(`[Audio] Player error: ${err.message}`);
          clearTimeout(timeout);
          resolve();
        });

        child.on('close', (code) => {
          if (code !== 0) {
            console.error(`[Audio] Player exited with code ${code}`);
          }
          clearTimeout(timeout);
          resolve();
        });
      });

    } catch (error) {
      console.error('[Audio] Playback failed:', error);
    } finally {
      fs.unlink(filePath).catch(() => { /* ignore */ });
    }
  }
}
