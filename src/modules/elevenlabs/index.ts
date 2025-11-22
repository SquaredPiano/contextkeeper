export type VoiceType = 'casual' | 'professional' | 'encouraging';

export interface ElevenLabsModule {
  initialize(apiKey: string): Promise<void>;
  speak(text: string, voice?: VoiceType): Promise<void>;
  isReady(): boolean;
}

export { ElevenLabsService } from './elevenlabs';
export { MockPlayer } from './mock';
export { voiceMap } from './voices';
