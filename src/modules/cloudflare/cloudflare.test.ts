import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CloudflareClient } from './client';
import worker from './worker';
import { detectLanguage } from './utils/language';
import { scanPythonRisks, scanJsTsRisks } from './utils/security';
import { lintJsTs } from './utils/linter';

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

describe('Language Detection', () => {
  it('should detect python', () => {
    expect(detectLanguage('def foo(): pass')).toBe('python');
    expect(detectLanguage('import os')).toBe('python');
  });

  it('should detect typescript', () => {
    expect(detectLanguage('const x: number = 1; import foo from "bar";')).toBe('ts');
    expect(detectLanguage('interface User { name: string; }')).toBe('ts');
  });

  it('should detect javascript', () => {
    expect(detectLanguage('const x = 1;')).toBe('js');
    expect(detectLanguage('function foo() {}')).toBe('js');
  });

  it('should detect go', () => {
    expect(detectLanguage('package main')).toBe('go');
  });

  it('should detect json', () => {
    expect(detectLanguage('{"a": 1}')).toBe('json');
  });
});

describe('Security Scanner', () => {
  it('should detect eval in JS', () => {
    const risks = scanJsTsRisks('eval("alert(1)")', 'js');
    expect(risks).toHaveLength(1);
    expect(risks[0].severity).toBe('high');
  });

  it('should detect hardcoded passwords in Python', () => {
    const risks = scanPythonRisks('password = "secret"');
    expect(risks).toHaveLength(1);
    expect(risks[0].severity).toBe('high');
  });
});

describe('Linter', () => {
  it('should add semicolons', () => {
    const code = 'const x = 1\nconst y = 2';
    const fixed = lintJsTs(code);
    expect(fixed).toContain('const x = 1;');
    expect(fixed).toContain('const y = 2;');
  });

  it('should fix spacing', () => {
    const code = 'if(true){';
    const fixed = lintJsTs(code);
    expect(fixed).toContain('if (true)');
  });
});
