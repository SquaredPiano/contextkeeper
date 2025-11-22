import { LanceDBStorage } from './storage';

export const storage = new LanceDBStorage();

export * from './schema';
export * from './storage';
export * from './embeddings';
