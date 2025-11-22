import { ElevenLabsService } from './elevenlabs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from root
dotenv.config({ path: path.join(__dirname, '../../../.env') });

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function demo() {
  console.log('🎤 ElevenLabs Module Demo\n');

  const service = new ElevenLabsService();
  // Load API key from environment variable (supports ELEVEN_LABS_API_KEY from .env)
  const apiKey = process.env.ELEVEN_LABS_API_KEY || process.env.ELEVENLABS_API_KEY || '';
  
  if (!apiKey) {
    console.warn('⚠️ No API Key found in .env or environment variables. Using fallback mock mode.');
  } else {
    console.log('✅ API Key found.');
  }

  console.log('🔊 Testing system audio with "say" command (macOS only)...');
  try {
    const { spawn } = require('child_process');
    await new Promise<void>((resolve) => {
      const child = spawn('say', ['System audio check']);
      child.on('close', () => resolve());
    });
    console.log('Did you hear "System audio check"?');
    await sleep(1000);
  } catch (e) {
    console.log('Skipping system audio check (not on macOS or failed)');
  }

  await service.initialize(apiKey);

  console.log('Testing voices...\n');

  await service.speak("I've fixed 5 linting errors while you were away", 'casual');
  await sleep(2000);

  await service.speak('Critical error detected on line 42', 'professional');
  await sleep(2000);

  await service.speak('Great job! All tests passing', 'encouraging');

  console.log('\n✓ Demo complete');
}

if (require.main === module) {
  demo().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
