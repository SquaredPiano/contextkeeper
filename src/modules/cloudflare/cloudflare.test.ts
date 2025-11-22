import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CloudflareClient } from './client';
import worker from './worker';

// Mock global fetch for client tests
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('CloudflareClient', () => {
  let client: CloudflareClient;

  beforeEach(() => {
    client = new CloudflareClient('https://api.example.com');
    fetchMock.mockReset();
  });

  it('should call the correct endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ fixed: 'code', linted: true })
    });

    await client.lint('const x = 1');
    
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/lint',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ code: 'const x = 1' })
      })
    );
  });

  it('should handle timeouts', async () => {
    client = new CloudflareClient('https://api.example.com', 100); // 100ms timeout
    
    fetchMock.mockImplementation(async (url, options) => {
      return new Promise((resolve, reject) => {
        const signal = options?.signal;
        if (signal?.aborted) {
          return reject(new Error('Aborted'));
        }
        
        const timer = setTimeout(() => {
          resolve({ ok: true, json: async () => ({}) });
        }, 200);

        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Aborted'));
        });
      });
    });

    const result = await client.lint('code');
    expect(result).toBeNull();
  });

  it('should handle API errors', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500
    });

    const result = await client.lint('code');
    expect(result).toBeNull();
  });
});

describe('CloudflareWorker', () => {
  it('should detect python and scan risks', async () => {
    const request = new Request('https://worker.dev/lint', {
      method: 'POST',
      body: JSON.stringify({ code: 'import os\nos.system("rm -rf /")' })
    });

    const response = await worker.fetch(request);
    const data: any = await response.json();

    expect(data.language).toBe('python');
    expect(data.severity).toBe('medium'); // os.system is medium
    expect(data.warnings).toHaveLength(1);
    expect(data.warnings[0].message).toContain('os.system');
  });

  it('should detect JS and lint', async () => {
    const request = new Request('https://worker.dev/lint', {
      method: 'POST',
      body: JSON.stringify({ code: 'function test(){return 1}' })
    });

    const response = await worker.fetch(request);
    const data: any = await response.json();

    expect(data.language).toBe('js');
    expect(data.linted).toBe(true);
    // The naive linter adds spaces
    expect(data.fixed).toContain('function test ('); 
  });

  it('should handle invalid JSON', async () => {
    const request = new Request('https://worker.dev/lint', {
      method: 'POST',
      body: 'invalid-json'
    });

    const response = await worker.fetch(request);
    expect(response.status).toBe(400);
  });
});
