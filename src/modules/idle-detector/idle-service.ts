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
    private abortController: AbortController | null = null; // Controller to abort pending idle work

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
        console.log('[IdleService] Initializing idle detection...');
        console.log('[IdleService] Workflow status:', {
            hasOrchestrator: !!this.orchestrator,
            hasAutonomousAgent: !!this.autonomousAgent,
            hasCallback: !!this.onIdleCallback
        });
        
        this.detector.on('idle', () => this.handleIdle());
        this.detector.on('active', () => this.handleActive());
        
        vscode.commands.registerCommand('contextkeeper.checkIdleStatus', () => {
            const state = this.detector.getState();
            const msg = `Idle Detector Status:\n` +
                `• Running: ${state.isMonitoring}\n` +
                `• Current State: ${state.isIdle ? 'IDLE' : 'ACTIVE'}\n` +
                `• Threshold: ${state.thresholdMs}ms (${state.thresholdMs / 1000}s)\n` +
                `• Timer Active: ${state.hasTimer}\n` +
                `• Currently Processing: ${this.isHandlingIdle}\n` +
                `• Orchestrator: ${this.orchestrator ? '✅' : '❌'}\n` +
                `• AutonomousAgent: ${this.autonomousAgent ? '✅' : '❌'}`;
            vscode.window.showInformationMessage(msg);
        });
        
        this.detector.start();
        console.log('[IdleService] ✅ Idle detection started');
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
        console.log('[IdleService] ✅ Workflow services configured:', {
            hasOrchestrator: !!this.orchestrator,
            hasAutonomousAgent: !!this.autonomousAgent
        });
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
        if (!this.isEnabled || this.isHandlingIdle) { 
            console.log(`[IdleService] Skipping idle - enabled: ${this.isEnabled}, already handling: ${this.isHandlingIdle}`);
            return; 
        }

        console.log('[IdleService] 🌙 User went IDLE - starting workflow...');
        this.isHandlingIdle = true;
        this.workDoneWhileIdle = [];
        
        // Create abort controller for this idle session
        this.abortController = new AbortController();

        try {
            if (this.orchestrator && this.autonomousAgent) {
                console.log('[IdleService] ✅ Orchestrator and AutonomousAgent available - starting workflow');
                await this.handleIdleImprovements(this.orchestrator, this.autonomousAgent);
            } else {
                console.warn('[IdleService] ⚠️  Cannot start idle workflow:', {
                    hasOrchestrator: !!this.orchestrator,
                    hasAutonomousAgent: !!this.autonomousAgent,
                    hasCallback: !!this.onIdleCallback
                });
                
                if (this.onIdleCallback) {
                    console.log('[IdleService] Falling back to onIdleCallback');
                    try {
                        await this.onIdleCallback();
                    } catch (error) {
                        console.error('[IdleService] Callback failed:', error);
                    }
                } else {
                    console.error('[IdleService] ❌ No workflow configured - idle detection is running but has no action to perform!');
                }
            }
        } catch (error) {
            // Check if error is due to abort
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('[IdleService] Idle workflow aborted by user activity');
            } else {
                console.error('[IdleService] Idle workflow error:', error);
            }
        } finally {
            this.abortController = null;
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
        // Note: isHandlingIdle is already set to true by handleIdle()
        // No need to check again here

        try {
            console.log('[IdleService] Starting idle improvements workflow...');

            // Check if aborted before starting
            this.abortController?.signal.throwIfAborted();

            // Step 1: Create a SINGLE timestamped branch for this idle session
            await autonomousAgent.ensureIdleBranch();
            console.log('[IdleService] ✓ Branch created');

            // Check if aborted after branch creation
            this.abortController?.signal.throwIfAborted();

            // Step 2: Request Orchestrator to collect and analyze context
            const result = await orchestrator.analyzeForIdleImprovements();
            console.log('[IdleService] ✓ Context analyzed');

            // Check if aborted after analysis
            this.abortController?.signal.throwIfAborted();

            // Step 3: Request Autonomous to store session/test artifacts in LanceDB and track AI edits
            // This also EXECUTES the generated tests
            if (result) {
                await autonomousAgent.storeIdleResults(result, this.storage, orchestrator);
                console.log('[IdleService] ✓ Tests generated and executed');
            }

            // Check if aborted after test generation
            this.abortController?.signal.throwIfAborted();

            // Step 4: Run linting on active file and create CodeAction fix suggestions
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                console.log('[IdleService] Running lint analysis on active file...');
                try {
                    // Get VS Code diagnostics for active file
                    const diagnostics = vscode.languages.getDiagnostics(activeEditor.document.uri);
                    if (diagnostics.length > 0) {
                        console.log(`[IdleService] Found ${diagnostics.length} lint issues`);
                        
                        // Check if aborted before lint fixes
                        this.abortController?.signal.throwIfAborted();
                        
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
            // Re-throw abort errors so they can be caught in handleIdle
            if (error instanceof Error && error.name === 'AbortError') {
                throw error;
            }
            
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
        this.lastSessionTime = Date.now();
        
        // CRITICAL: Stop any pending work immediately by aborting
        if (this.isHandlingIdle && this.abortController) {
            console.log('[IdleService] User returned - aborting pending idle workflow');
            this.abortController.abort();
            this.isHandlingIdle = false;
        }
        
        // Speak the summary via TTS
        if (this.voiceService && this.lastIdleSummary) {
            try {
                this.voiceService.speak(
                    `Welcome back! While you were away: ${this.lastIdleSummary}`,
                    'casual'
                );
            } catch (error) {
                console.warn('[IdleService] TTS failed:', error);
            }
        }
        
        // Show work completed notification
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
