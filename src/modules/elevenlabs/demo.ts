import { ElevenLabsService } from './elevenlabs';

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function demo() {
  console.log('🎤 ElevenLabs Module Demo\n');

  const service = new ElevenLabsService();
  // Load API key from environment variable (supports ELEVEN_LABS_API_KEY from .env)
  const apiKey = process.env.ELEVEN_LABS_API_KEY || process.env.ELEVENLABS_API_KEY || '';
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
