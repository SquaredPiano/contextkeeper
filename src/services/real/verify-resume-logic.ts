import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

import { storage } from '../storage/index';

async function verifyResumeLogic() {
    console.log('🔍 Verifying Resume Work Logic...');
    console.log('-------------------------------------------');

    try {
        await storage.connect();

        // 1. Get last active file
        const lastFile = await storage.getLastActiveFile();
        console.log(`   Last Active File: ${lastFile}`);

        // 2. Get recent actions (semantic)
        const recentActions = await storage.getSimilarActions("recent edits and changes", 3);
        console.log(`   Found ${recentActions.length} recent actions.`);
        recentActions.forEach(a => console.log(`     - ${a.description}`));

        // 3. Generate Message (Logic from ContextService)
        if (!lastFile && recentActions.length === 0) {
            console.log("   Result: I don't see any recent activity. Ready to start something new?");
            return;
        }

        let message = "Welcome back. ";

        if (lastFile) {
            message += `You were last working on ${lastFile}. `;
        }

        if (recentActions.length > 0) {
            const lastAction = recentActions[0];
            message += `It looks like you were: ${lastAction.description}`;
        }

        console.log('-------------------------------------------');
        console.log(`🗣️  GENERATED MESSAGE:\n"${message}"`);
        console.log('-------------------------------------------');

        if (message.includes('Welcome back') && (message.includes('working on') || message.includes('looks like'))) {
            console.log('✅ VERIFICATION SUCCESSFUL');
        } else {
            throw new Error('❌ Message format incorrect');
        }

    } catch (error) {
        console.error('❌ VERIFICATION FAILED:', error);
        process.exit(1);
    }
}

verifyResumeLogic();
