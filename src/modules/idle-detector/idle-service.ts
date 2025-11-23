import * as vscode from 'vscode';
import { IdleDetector } from './idle-detector';
import { IIdleService, IdleConfig } from './types';
import { IStorageService, IVoiceService } from '../../services/interfaces';
import { EventRecord } from '../../services/storage/schema';
import { IAIService } from '../../services/interfaces';
import type { Orchestrator } from '../orchestrator/orchestrator';
import type { AutonomousAgent } from '../autonomous/AutonomousAgent';

// Hardcoded idle threshold: 15 seconds exactly
const DEFAULT_IDLE_THRESHOLD_MS = 15000;

export interface IdleImprovementsResult {
    summary: string;
    tests: string[];
    recommendations: Array<{ priority: 'high' | 'medium' | 'low'; message: string }>;
    sessionId?: string;
}

export class IdleService implements IIdleService {
    private detector: IdleDetector;
    private lastSessionTime: number = Date.now();
    private isEnabled: boolean = true;
    private storage: IStorageService;
    private onIdleCallback?: () => Promise<void>;
    private aiService: IAIService | null = null;
    private voiceService: IVoiceService | null = null;
    private workDoneWhileIdle: string[] = [];
    private isHandlingIdle: boolean = false; // Prevent duplicate handling
    private uiUpdateCallback?: (result: IdleImprovementsResult) => void; // NEW: Callback for UI updates
    private lastIdleSummary: string = ''; // Store summary for TTS when user returns

    constructor(
        storage: IStorageService, 
        config: IdleConfig = { thresholdMs: DEFAULT_IDLE_THRESHOLD_MS }, 
        aiService?: IAIService,
        voiceService?: IVoiceService
    ) {
        this.detector = new IdleDetector(config);
        this.storage = storage;
        this.aiService = aiService || null;
        this.voiceService = voiceService || null;
    }

    public async initialize(): Promise<void> {
        console.log('[IdleService] Initializing...');
        
        this.detector.on('idle', () => this.handleIdle());
        this.detector.on('active', () => this.handleActive());
        
        this.detector.start();
    }

    public dispose(): void {
        this.detector.dispose();
    }

    /**
     * Register a callback to be invoked when user goes idle
     */
    public onIdle(callback: () => Promise<void>): void {
        this.onIdleCallback = callback;
    }

    /**
     * Register a callback for UI updates when idle improvements complete
     */
    public onIdleImprovementsComplete(callback: (result: IdleImprovementsResult) => void): void {
        this.uiUpdateCallback = callback;
    }

    // Store references to orchestrator and autonomous agent
    private orchestrator: Orchestrator | null = null;
    private autonomousAgent: AutonomousAgent | null = null;

    /**
     * Set the orchestrator and autonomous agent for idle improvements workflow
     */
    setWorkflowServices(orchestrator: Orchestrator, autonomousAgent: AutonomousAgent): void {
        this.orchestrator = orchestrator;
        this.autonomousAgent = autonomousAgent;
    }

    /**
     * Update the idle threshold dynamically
     */
    public updateThreshold(ms: number): void {
        if (this.detector) {
            this.detector.setThreshold(ms);
            console.log(`[IdleService] Updated threshold to ${ms}ms`);
        }
    }

    private async handleIdle(): Promise<void> {
        if (!this.isEnabled) { return; }
        
        // Check if already handling idle to prevent duplicates
        if (this.isHandlingIdle) {
            console.log('[IdleService] Already handling idle, ignoring duplicate event');
            return;
        }

        console.log('[IdleService] User went idle! Starting ONE-TIME idle improvements workflow...');
        
        // Pause the detector - we'll resume when user comes back
        this.detector.stop();
        
        // Reset work tracker
        this.workDoneWhileIdle = [];

        try {
            // Silent operation - no blocking notifications
            
            // If orchestrator and autonomous agent are set, use new workflow
            if (this.orchestrator && this.autonomousAgent) {
                await this.handleIdleImprovements(this.orchestrator, this.autonomousAgent);
            } else {
                // Fallback to legacy callback if provided
            if (this.onIdleCallback) {
                try {
                    await this.onIdleCallback();
                } catch (error) {
                        console.error('[IdleService] Legacy callback failed:', error);
                    }
                }
            }

        } catch (error) {
            console.error('[IdleService] Error handling idle state:', error);
                }
            }

    /**
     * Main entry point for idle improvements workflow.
     * Orchestrates the sequence but performs no work itself.
     */
    async handleIdleImprovements(
        orchestrator: Orchestrator, // Orchestrator instance
        autonomousAgent: AutonomousAgent // AutonomousAgent instance
    ): Promise<IdleImprovementsResult | null> {
        if (this.isHandlingIdle) {
            console.log('[IdleService] Already handling idle improvements');
            return null;
            }

        this.isHandlingIdle = true;

        try {
            console.log('[IdleService] Starting idle improvements workflow...');

            // Step 1: Create a SINGLE timestamped branch for this idle session
            await autonomousAgent.ensureIdleBranch();
            console.log('[IdleService] ✓ Branch created');

            // Step 2: Request Orchestrator to collect and analyze context
            const result = await orchestrator.analyzeForIdleImprovements();
            console.log('[IdleService] ✓ Context analyzed');

            // Step 3: Request Autonomous to store session/test artifacts in LanceDB and track AI edits
            // This also EXECUTES the generated tests
            if (result) {
                await autonomousAgent.storeIdleResults(result, this.storage, orchestrator);
                console.log('[IdleService] ✓ Tests generated and executed');
            }

            // Step 4: Run linting on active file and create CodeAction fix suggestions
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                console.log('[IdleService] Running lint analysis on active file...');
                try {
                    // Get VS Code diagnostics for active file
                    const diagnostics = vscode.languages.getDiagnostics(activeEditor.document.uri);
                    if (diagnostics.length > 0) {
                        console.log(`[IdleService] Found ${diagnostics.length} lint issues`);
                        
                        // Request autonomous agent to create lint fix suggestions
                        // This will use the CodeActionProvider to show Keep/Undo UI
                        await autonomousAgent.createLintFixSuggestions(
                            activeEditor.document.uri,
                            diagnostics
                        );
                        console.log('[IdleService] ✓ Lint fixes created');
                    } else {
                        console.log('[IdleService] No lint issues found in active file');
                    }
                } catch (lintError) {
                    console.warn('[IdleService] Lint fix creation failed:', lintError);
                    // Continue anyway - don't fail the whole workflow
                }
            }

            // Step 5: Display results to user
            if (result) {
                this.displayIdleResults(result);
                
                // NEW: Send to UI via callback
                if (this.uiUpdateCallback) {
                    this.uiUpdateCallback(result);
                }
            }

            return result || null;

        } catch (error) {
            console.error('[IdleService] Idle improvements workflow failed:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Idle improvements failed: ${errorMsg}`);
            return null;
        } finally {
            this.isHandlingIdle = false;
        }
    }

    private displayIdleResults(result: IdleImprovementsResult): void {
        // Store summary for TTS when user returns
        this.lastIdleSummary = result.summary;
        
        // Display friendly summary and test suggestions
        const message = [
            `📋 **Idle Analysis Complete**`,
            ``,
            `**Summary:**`,
            result.summary,
            ``,
            result.recommendations.length > 0 ? `**Recommendations:**` : '',
            ...result.recommendations.slice(0, 3).map(r => `- [${r.priority.toUpperCase()}] ${r.message}`),
            ``,
            result.tests.length > 0 ? `✅ Generated ${result.tests.length} test file(s)` : ''
        ].filter(Boolean).join('\n');

        // Track work done while idle for display when user returns
        this.workDoneWhileIdle.push(`🔍 Analysis: ${result.summary}`);
        if (result.tests.length > 0) {
            this.workDoneWhileIdle.push(`✅ Generated ${result.tests.length} test file(s)`);
        }
        result.recommendations.slice(0, 3).forEach(rec => {
            this.workDoneWhileIdle.push(`💡 [${rec.priority.toUpperCase()}] ${rec.message}`);
        });

        // Show notification without blocking
        vscode.window.showInformationMessage(
            `Idle analysis complete. Generated ${result.tests.length} test file(s) and ${result.recommendations.length} recommendations.`,
            'View Details'
        ).then(selection => {
            if (selection === 'View Details') {
                // Could open a webview or show in output channel
                console.log('[IdleService] Idle improvements result:', message);
        }
        });
    }

    private handleActive(): void {
        console.log('[IdleService] User is BACK! Restarting idle detection.');
        this.lastSessionTime = Date.now();
        
        // Restart the detector for the next idle period
        if (this.isEnabled) {
            this.detector.start();
        }
        
        // Use TTS to speak the summary if available (for sponsor track demo)
        if (this.voiceService && this.lastIdleSummary) {
            try {
                console.log('[IdleService] Speaking summary via ElevenLabs...');
                this.voiceService.speak(
                    `Welcome back! While you were away: ${this.lastIdleSummary}`,
                    'casual'
                );
            } catch (error) {
                console.warn('[IdleService] TTS failed:', error);
            }
        }
        
        // Show summary of work done while idle
        if (this.workDoneWhileIdle.length > 0) {
            const summary = [
                '🎯 **Work Completed While You Were Away:**',
                '',
                ...this.workDoneWhileIdle
            ].join('\n');
            
            vscode.window.showInformationMessage(
                '👋 Welcome back! I completed some work while you were away.',
                'Show Details'
            ).then(selection => {
                if (selection === 'Show Details') {
                    vscode.window.showInformationMessage(summary, { modal: true });
                }
            });
            
            // Clear the tracker
            this.workDoneWhileIdle = [];
        }
    }

    private async generateSessionSummary(events: EventRecord[]): Promise<string> {
        // Try to use Gemini AI for intelligent summarization
        if (this.aiService) {
            try {
                // Format events into an activity log
                const activityLog = events.map(event => {
                    const timestamp = new Date(event.timestamp).toLocaleTimeString();
                    const eventType = event.event_type.replace(/_/g, ' ');
                    const filePath = event.file_path || 'unknown';
                    const details = event.metadata ? JSON.stringify(event.metadata) : '';
                    return `[${timestamp}] ${eventType}: ${filePath}${details ? ` (${details})` : ''}`;
                }).join('\n');

                const summary = await this.aiService.summarize(activityLog);
                console.log('[IdleService] Generated AI summary via Gemini');
                return summary;
            } catch (error) {
                console.warn('[IdleService] AI summary failed, falling back to heuristic:', error);
                // Fall through to heuristic summary
            }
        }

        // Fallback: Simple heuristic summary
        const fileEdits = events.filter(e => e.event_type === 'file_edit');
        const fileOpens = events.filter(e => e.event_type === 'file_open');
        
        const uniqueFiles = new Set(fileEdits.map(e => e.file_path));
        const editCount = fileEdits.length;
        
        if (editCount === 0) {
            return `Reviewed ${fileOpens.length} files including ${fileOpens[0]?.file_path || 'none'}.`;
        }

        const filesList = Array.from(uniqueFiles).slice(0, 3).join(', ');
        const more = uniqueFiles.size > 3 ? ` and ${uniqueFiles.size - 3} others` : '';
        
        return `Worked on ${filesList}${more}. Made ${editCount} edits.`;
    }
}
