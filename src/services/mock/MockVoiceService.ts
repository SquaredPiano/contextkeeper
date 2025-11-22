/**
 * Mock Voice Service
 * 
 * Simulates voice notifications by showing console logs.
 * INTEGRATION: Replace with real VoiceService that calls ElevenLabs API.
 */

import * as vscode from 'vscode';
import { IVoiceService } from '../interfaces';

export class MockVoiceService implements IVoiceService {
	private enabled: boolean;

	constructor() {
		// Read from configuration
		this.enabled = vscode.workspace.getConfiguration('copilot').get('voice.enabled', true);
	}

	async speak(
		text: string,
		voice: 'casual' | 'professional' | 'encouraging' = 'professional'
	): Promise<void> {
		if (!this.enabled) {
			console.log('[Mock Voice] Voice disabled, skipping notification');
			return;
		}

		console.log(`[Mock Voice] Would speak: "${text}" (${voice} voice)`);
		
		// Show notification as visual feedback
		const icon = this.getIconForVoice(voice);
		vscode.window.showInformationMessage(`${icon} ${text}`);
		
		// Simulate speech duration
		await this.delay(text.length * 50); // ~50ms per character
	}

	isEnabled(): boolean {
		return this.enabled;
	}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
		vscode.workspace.getConfiguration('copilot').update('voice.enabled', enabled, true);
	}

	private getIconForVoice(voice: string): string {
		switch (voice) {
			case 'casual':
				return '[Casual]';
			case 'encouraging':
				return '[Encouraging]';
			case 'professional':
			default:
				return '[Bot]';
		}
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
