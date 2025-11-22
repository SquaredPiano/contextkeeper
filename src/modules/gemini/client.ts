// modules/gemini/client.ts

import fetch from "node-fetch"
import * as dotenv from "dotenv"
dotenv.config()

export type GeminiResponse<T> = {
  ok: boolean
  data?: T
  raw?: unknown  
  error?: string
}

export class GeminiClient {
  private flashURL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

  private proURL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent"

  private apiKey: string
  private timeoutMs: number

  constructor(timeoutMs = 8000) {
    this.apiKey = process.env.GEMINI_API_KEY ?? ""
    if (!this.apiKey) throw new Error("Missing GEMINI_API_KEY in .env")
    this.timeoutMs = timeoutMs
  }

  // internal request wrapper
  private async request<T>(url: string, prompt: string): Promise<GeminiResponse<T>> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const res = await fetch(`${url}?key=${this.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      })

      clearTimeout(timeout)
      const raw = await res.json()

      if (!res.ok) {
        const message =
        typeof raw === "object" &&
        raw !== null &&
        "error" in raw &&
        typeof (raw as any).error?.message === "string"
            ? (raw as any).error.message
            : "Gemini Error"

        return { ok: false, error: message, raw }

      }

      return { ok: true, data: raw as T, raw }

    } catch (err: any) {
      return {
        ok: false,
        error: err.message || "Gemini Timeout/Network Error"
      }
    }
  }


  // public api -- >Hybrid Model Logic
  // Fast refactor / formatting / small fixes
  async fastFix<T>(prompt: string): Promise<GeminiResponse<T>> {
    return this.request<T>(this.flashURL, prompt)
  }

  // Deep logic, security patches, test generation
  async deepFix<T>(prompt: string): Promise<GeminiResponse<T>> {
    return this.request<T>(this.proURL, prompt)
  }
}
