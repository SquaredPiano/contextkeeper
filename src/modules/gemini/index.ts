import { GeminiContext, Analysis, CodeFix } from './types';

export interface GeminiModule {
  initialize(apiKey: string): Promise<void>;

  analyzeCode(code: string, context: GeminiContext): Promise<Analysis>;
  generateTests(code: string): Promise<string>;
  fixError(code: string, error: string): Promise<CodeFix>;

  isReady(): boolean;
  enableMockMode(): void;
}

export * from "./gemini-client";
export * from "./context-builder";
export * from "./types";
