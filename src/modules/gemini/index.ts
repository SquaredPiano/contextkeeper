export interface GeminiModule {
  initialize(apiKey: string): Promise<void>;

  analyzeCode(code: string, context: any): Promise<any>;
  generateTests(code: string): Promise<string>;
  fixError(code: string, error: string): Promise<any>;

  isReady(): boolean;
  enableMockMode(): void;
}

export * from "./gemini-client";
export * from "./context-builder";
