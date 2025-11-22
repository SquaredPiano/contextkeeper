import { VoiceType } from './index';

export const voiceMap: Record<VoiceType, string> = {
  // Using standard ElevenLabs voices:
  // Rachel (American, calm)
  casual: '21m00Tcm4TlvDq8ikWAM',
  // Antoni (American, well-modulated)
  professional: 'ErXwobaYiN019PkySvjV',
  // Josh (American, deep)
  encouraging: 'TxGEqnHWrfWFTfGW9XjX'
};

export function getVoiceId(voice: VoiceType): string {
  return voiceMap[voice] || voiceMap.casual;
}
