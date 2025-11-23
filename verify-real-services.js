"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GeminiService_1 = require("./src/services/real/GeminiService");
const elevenlabs_1 = require("./src/modules/elevenlabs/elevenlabs");
const storage_1 = require("./src/services/storage/storage");
// Mock VS Code API
const mockVscode = {
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/tmp/test-workspace' } }],
        getConfiguration: () => ({ get: () => '' })
    },
    window: {
        createOutputChannel: () => ({ appendLine: console.log })
    }
};
global.vscode = mockVscode;
async function verify() {
    console.log('--- Verifying Real Services ---');
    // 1. Initialize Gemini Service
    console.log('\n1. Testing GeminiService...');
    const gemini = new GeminiService_1.GeminiService();
    // We might not have a key, so expect a warning
    await gemini.initialize(process.env.GEMINI_API_KEY || '');
    if (gemini.isInitialized) {
        console.log('GeminiService initialized (with key).');
    }
    else {
        console.log('GeminiService not initialized (no key), skipping analysis test.');
    }
    // 2. Initialize ElevenLabs Service
    console.log('\n2. Testing ElevenLabsService...');
    const voice = new elevenlabs_1.ElevenLabsService();
    voice.initialize(process.env.ELEVENLABS_API_KEY || '');
    if (voice.isEnabled()) {
        console.log('ElevenLabsService enabled.');
        // await voice.speak("Hello, this is a test."); // Uncomment to test actual audio (might fail in CI/headless)
    }
    else {
        console.log('ElevenLabsService disabled (no key).');
    }
    // 3. Initialize Storage with Gemini
    console.log('\n3. Testing Storage with Gemini Embeddings...');
    const storage = new storage_1.LanceDBStorage();
    await storage.connect(gemini);
    // Test embedding generation (via storage -> gemini)
    // If gemini is not init, it should use fallback
    try {
        await storage.createSession("Test Session", "Test Project");
        console.log('Session created successfully.');
    }
    catch (e) {
        console.error('Failed to create session:', e);
    }
    console.log('\n--- Verification Complete ---');
}
verify().catch(console.error);
//# sourceMappingURL=verify-real-services.js.map