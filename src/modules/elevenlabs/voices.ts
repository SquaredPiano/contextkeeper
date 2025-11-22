import { VoiceType } from './index';

export const voiceMap: Record<VoiceType, string> = {
  casual: 'casual-voice-id',
  professional: 'professional-voice-id',
  encouraging: 'encouraging-voice-id'
};

export function getVoiceId(voice: VoiceType): string {
  return voiceMap[voice] || voiceMap.casual;
}
