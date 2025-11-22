// cloudflare/client.ts
// VSCode-side API wrapper to call the Cloudflare worker

export type CloudflareLintResult = {
    fixed: string;
    language: string;
    linted: boolean;
    severity: "none" | "low" | "medium" | "high";
    warnings: { message: string; severity: string }[];
  };
  
export class CloudflareClient {
  private url: string;
  private timeoutMs: number;

  constructor(url: string, timeoutMs = 3000) {
    this.url = url.replace(/\/+$/, ""); // remove trailing slash
    this.timeoutMs = timeoutMs;
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {reject(new Error("Cloudflare timeout"));}, this.timeoutMs);
      promise
        .then((res) => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  async lint(code: string): Promise<CloudflareLintResult | null> {
    try {
      const response = await this.withTimeout(
        fetch(`${this.url}/lint`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code })
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
  