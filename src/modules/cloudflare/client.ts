// cloudflare/client.ts
// VSCode-side API wrapper to call the Cloudflare worker

import { CloudflareLintResult } from "./types";
export { CloudflareLintResult };

export class CloudflareClient {
  private url: string;
  private timeoutMs: number;

  constructor(url: string, timeoutMs = 3000) {
    this.url = url.replace(/\/+$/, ""); // remove trailing slash
    this.timeoutMs = timeoutMs;
  }

  private async withTimeout<T>(promiseFactory: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const result = await promiseFactory(controller.signal);
      clearTimeout(timeout);
      return result;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  async lint(code: string): Promise<CloudflareLintResult | null> {
    try {
      const response = await this.withTimeout((signal) => 
        fetch(`${this.url}/lint`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
          signal
        })
      );

      if (!response.ok) {
        // Worker responded but with an error (400 or 500)
        console.warn("Cloudflare error status:", response.status);
        return null;
      }

      const result = await response.json();
      return result as CloudflareLintResult;

    } catch (err) {
      // Worker did not respond or had network issues / timeout
      console.warn("Cloudflare unreachable:", err);
      return null;
    }
  }
}
  