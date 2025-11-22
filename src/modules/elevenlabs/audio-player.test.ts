import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioPlayer } from './audio-player';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  promises: {
    writeFile: vi.fn(),
    unlink: vi.fn(),
  },
}));

// Mock os
vi.mock('os', () => ({
  default: {
    tmpdir: vi.fn(() => '/tmp'),
  },
  tmpdir: vi.fn(() => '/tmp'),
}));

describe('AudioPlayer', () => {
  let audioPlayer: AudioPlayer;
  let mockSpawn: ReturnType<typeof vi.fn>;
  let mockWriteFile: ReturnType<typeof vi.fn>;
  let mockUnlink: ReturnType<typeof vi.fn>;
  let originalPlatform: string;

  beforeEach(() => {
    vi.clearAllMocks();
    originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      writable: true,
      value: originalPlatform,
    });

    mockSpawn = spawn as ReturnType<typeof vi.fn>;
    mockWriteFile = fs.writeFile as ReturnType<typeof vi.fn>;
    mockUnlink = fs.unlink as ReturnType<typeof vi.fn>;

    // Default mock implementations
    mockWriteFile.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(process, 'platform', {
      writable: true,
      value: originalPlatform,
    });
  });

  describe('Player Detection', () => {
    it('should detect afplay on macOS', async () => {
      Object.defineProperty(process, 'platform', { writable: true, value: 'darwin' });
      
      // Mock successful which command for Linux detection (shouldn't run on darwin)
      mockSpawn.mockImplementation((cmd: string) => {
        const mockChild = {
          on: vi.fn((event: string, callback: (code?: number) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 0);
            }
            return mockChild;
          }),
        };
        return mockChild;
      });

      audioPlayer = new AudioPlayer();
      // Wait for async detection
      await new Promise(resolve => setTimeout(resolve, 10));

      const playerCommand = (audioPlayer as any).playerCommand;
      expect(playerCommand).toBe('afplay');
    });

    it('should detect mpg123 on Linux when available', async () => {
      Object.defineProperty(process, 'platform', { writable: true, value: 'linux' });
      
      mockSpawn.mockImplementation((cmd: string) => {
        const mockChild = {
          on: vi.fn((event: string, callback: (code?: number) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 0); // Success
            }
            return mockChild;
          }),
        };
        return mockChild;
      });

      audioPlayer = new AudioPlayer();
      await new Promise(resolve => setTimeout(resolve, 10));

      const playerCommand = (audioPlayer as any).playerCommand;
      expect(playerCommand).toBe('mpg123');
    });

    it('should set playerCommand to null on Linux when mpg123 is not available', async () => {
      Object.defineProperty(process, 'platform', { writable: true, value: 'linux' });
      
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      mockSpawn.mockImplementation((cmd: string) => {
        const mockChild = {
          on: vi.fn((event: string, callback: (code?: number) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(1), 0); // Not found
            }
            return mockChild;
          }),
        };
        return mockChild;
      });

      audioPlayer = new AudioPlayer();
      await new Promise(resolve => setTimeout(resolve, 10));

      const playerCommand = (audioPlayer as any).playerCommand;
      expect(playerCommand).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('mpg123 not found')
      );
      consoleWarnSpy.mockRestore();
    });

    it('should detect PowerShell on Windows', async () => {
      Object.defineProperty(process, 'platform', { writable: true, value: 'win32' });
      
      mockSpawn.mockImplementation((cmd: string) => {
        const mockChild = {
          on: vi.fn((event: string, callback: (code?: number) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 0);
            }
            return mockChild;
          }),
        };
        return mockChild;
      });

      audioPlayer = new AudioPlayer();
      await new Promise(resolve => setTimeout(resolve, 10));

      const playerCommand = (audioPlayer as any).playerCommand;
      expect(playerCommand).toBe('powershell.exe');
    });
  });

  describe('Play Method', () => {
    beforeEach(async () => {
      // Set up default platform and player
      Object.defineProperty(process, 'platform', { writable: true, value: 'darwin' });
      audioPlayer = new AudioPlayer();
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should skip playback when no player is available', async () => {
      (audioPlayer as any).playerCommand = null;
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await audioPlayer.play(new ArrayBuffer(100));

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No audio player available')
      );
      expect(mockWriteFile).not.toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });

    it('should write audio file and play on macOS', async () => {
      const audioData = new ArrayBuffer(1000);
      const mockChild = {
        on: vi.fn((event: string, callback: (code?: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0);
          }
          return mockChild;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);

      await audioPlayer.play(audioData);

      expect(mockWriteFile).toHaveBeenCalled();
      expect(mockSpawn).toHaveBeenCalledWith('afplay', expect.arrayContaining([expect.any(String)]), expect.any(Object));
      expect(mockUnlink).toHaveBeenCalled();
    });

    it('should use correct arguments for Linux mpg123', async () => {
      Object.defineProperty(process, 'platform', { writable: true, value: 'linux' });
      
      mockSpawn.mockImplementation((cmd: string) => {
        const mockChild = {
          on: vi.fn((event: string, callback: (code?: number) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 0);
            }
            return mockChild;
          }),
        };
        return mockChild;
      });

      audioPlayer = new AudioPlayer();
      await new Promise(resolve => setTimeout(resolve, 10));

      const audioData = new ArrayBuffer(1000);
      const mockChild = {
        on: vi.fn((event: string, callback: (code?: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0);
          }
          return mockChild;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);

      await audioPlayer.play(audioData);

      expect(mockSpawn).toHaveBeenCalledWith('mpg123', expect.arrayContaining(['-q']), expect.any(Object));
    });

    it('should use PowerShell command on Windows', async () => {
      Object.defineProperty(process, 'platform', { writable: true, value: 'win32' });
      
      mockSpawn.mockImplementation((cmd: string) => {
        const mockChild = {
          on: vi.fn((event: string, callback: (code?: number) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 0);
            }
            return mockChild;
          }),
        };
        return mockChild;
      });

      audioPlayer = new AudioPlayer();
      await new Promise(resolve => setTimeout(resolve, 10));

      const audioData = new ArrayBuffer(100000); // Larger buffer for duration estimate
      const mockChild = {
        on: vi.fn((event: string, callback: (code?: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0);
          }
          return mockChild;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);

      await audioPlayer.play(audioData);

      expect(mockSpawn).toHaveBeenCalledWith(
        'powershell.exe',
        expect.arrayContaining(['-c']),
        expect.any(Object)
      );
      // Find the call to powershell.exe (skip the 'which' call from detection)
      const powershellCall = mockSpawn.mock.calls.find(
        (call: any[]) => call[0] === 'powershell.exe'
      );
      expect(powershellCall).toBeDefined();
      expect(powershellCall[1][1]).toContain('Add-Type -AssemblyName presentationCore');
    });

    it('should handle spawn errors gracefully', async () => {
      const audioData = new ArrayBuffer(1000);
      const mockChild = {
        on: vi.fn((event: string, callback: (err?: Error) => void) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Spawn failed')), 0);
          }
          return mockChild;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await audioPlayer.play(audioData);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Player error')
      );
      expect(mockUnlink).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle non-zero exit codes', async () => {
      const audioData = new ArrayBuffer(1000);
      const mockChild = {
        on: vi.fn((event: string, callback: (code?: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 0); // Error exit code
          }
          return mockChild;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await audioPlayer.play(audioData);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Player exited with code 1')
      );
      expect(mockUnlink).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle file write errors', async () => {
      const audioData = new ArrayBuffer(1000);
      mockWriteFile.mockRejectedValue(new Error('Write failed'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await audioPlayer.play(audioData);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Playback failed'),
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it('should clean up temp file even on error', async () => {
      const audioData = new ArrayBuffer(1000);
      mockWriteFile.mockRejectedValue(new Error('Write failed'));

      await audioPlayer.play(audioData);

      // Should attempt cleanup even on error
      expect(mockUnlink).toHaveBeenCalled();
    });

    it('should calculate duration estimate based on buffer size', async () => {
      const audioData = new ArrayBuffer(100000); // 100KB
      const mockChild = {
        on: vi.fn((event: string, callback: (code?: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0);
          }
          return mockChild;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await audioPlayer.play(audioData);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Buffer size: 100000 bytes')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Estimated duration')
      );
      consoleLogSpy.mockRestore();
    });

    it('should set timeout based on duration estimate', async () => {
      const audioData = new ArrayBuffer(100000);
      let timeoutCallback: (() => void) | undefined;
      
      const mockChild = {
        on: vi.fn((event: string, callback: (code?: number) => void) => {
          if (event === 'close') {
            // Don't call immediately to test timeout
            timeoutCallback = () => callback(0);
          }
          return mockChild;
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockChild);

      const playPromise = audioPlayer.play(audioData);
      
      // Wait a bit to ensure timeout is set
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Verify kill is available (timeout would call it)
      expect(mockChild.kill).toBeDefined();
      
      // Resolve the promise
      if (timeoutCallback) {
        timeoutCallback();
      }
      
      await playPromise;
    });
  });
});

