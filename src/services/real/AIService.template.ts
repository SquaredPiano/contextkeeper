/**
 * TEMPLATE: Real AI Service
 * 
 * Copy this file and implement the TODOs to create your real AIService.
 * This service calls the Gemini API for code analysis.
 * 
 * INTEGRATION: Replace MockAIService with this in extension.ts
 */

import { EventEmitter } from 'events';
// import { GoogleGenerativeAI } from '@google/generative-ai'; // TODO: npm install @google/generative-ai
import * as vscode from 'vscode';
import {
	IAIService,
	AIAnalysis,
	Issue,
	Suggestion,
	CodeFix,
	DeveloperContext,
} from '../interfaces';

export class AIService extends EventEmitter implements IAIService {
	// TODO: Initialize Gemini
	// private genAI: GoogleGenerativeAI;
	// private model: any;

	constructor() {
		super();
		// TODO: Get API key from config and initialize
		// const config = vscode.workspace.getConfiguration('copilot');
		// const apiKey = config.get<string>('gemini.apiKey');
		// this.genAI = new GoogleGenerativeAI(apiKey);
		// this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
	}

	/**
	 * Analyze code using Gemini AI
	 */
	async analyze(code: string, context: DeveloperContext): Promise<AIAnalysis> {
		try {
			this.emit('analysisStarted');

			// TODO: Construct prompt with code + context
			const prompt = this.buildAnalysisPrompt(code, context);

			// TODO: Call Gemini API
			// Progress updates
			this.emit('analysisProgress', 25, 'Sending to AI...');
			
			// const result = await this.model.generateContent(prompt);
			// const response = result.response.text();
			
			this.emit('analysisProgress', 75, 'Parsing results...');

			// TODO: Parse AI response into AIAnalysis format
			const analysis = this.parseAIResponse(''); // Pass actual response

			this.emit('analysisProgress', 100, 'Complete!');
			this.emit('analysisComplete', analysis);

			return analysis;

		} catch (error: any) {
			this.emit('error', error);
			throw error;
		}
	}

	/**
	 * Generate unit tests for code
	 */
	async generateTests(code: string): Promise<string> {
		// TODO: Call Gemini with test generation prompt
		const prompt = `Generate comprehensive unit tests for the following code using vitest:

\`\`\`typescript
${code}
\`\`\`

Include:
- Test for normal cases
- Test for edge cases
- Test for error conditions
- Use descriptive test names
`;

		// TODO: Call API and return test code
		return '';
	}

	/**
	 * Fix error in code
	 */
	async fixError(code: string, error: string): Promise<CodeFix> {
		// TODO: Call Gemini to suggest fix
		const prompt = `Fix the following error in this code:

Error: ${error}

Code:
\`\`\`typescript
${code}
\`\`\`

Provide:
1. Fixed code
2. Explanation of the fix
3. Diff showing changes
`;

		// TODO: Parse response into CodeFix format
		return {
			fixedCode: code,
			explanation: '',
			diff: '',
		};
	}

	/**
	 * Explain code functionality
	 */
	async explainCode(code: string): Promise<string> {
		// TODO: Call Gemini with explanation prompt
		const prompt = `Explain what this code does in clear, concise language:

\`\`\`typescript
${code}
\`\`\`

Include:
- Main purpose
- Key functionality
- Important patterns or techniques used
`;

		return '';
	}

	/**
	 * Summarize text
	 */
	async summarize(text: string): Promise<string> {
		// TODO: Call Gemini to summarize the text
		return '';
	}

	/**
	 * Create a plan based on goal and context
	 */
	async plan(goal: string, context: DeveloperContext): Promise<string> {
		// TODO: Call Gemini to generate a plan
		return '';
	}

	/**
	 * Build analysis prompt with context
	 */
	private buildAnalysisPrompt(code: string, context: DeveloperContext): string {
		// TODO: Construct comprehensive prompt with:
		// - Code to analyze
		// - Developer context (recent edits, git info, etc.)
		// - Instructions for what to look for
		// - Output format specification

		return `You are an expert code analyst. Analyze this TypeScript code and provide:

1. Issues found (errors, warnings, info)
2. Suggestions for improvement
3. Risk level assessment
4. Confidence score

Context:
- Current file: ${context.files.activeFile}
- Recent commits: ${context.git.recentCommits.length}
- Total edits this session: ${context.session.totalEdits}
- Risky files: ${context.session.riskyFiles.join(', ')}

Code to analyze:
\`\`\`typescript
${code}
\`\`\`

Return analysis as JSON in this format:
{
  "issues": [
    {
      "file": "filename",
      "line": 42,
      "column": 10,
      "severity": "error|warning|info",
      "message": "Description",
      "suggestedFix": "How to fix",
      "codeSnippet": "Relevant code"
    }
  ],
  "suggestions": [
    {
      "type": "refactor|performance|security|style",
      "message": "Suggestion text",
      "file": "filename",
      "line": 42
    }
  ],
  "riskLevel": "low|medium|high",
  "confidence": 0.85
}
`;
	}

	/**
	 * Parse AI response into structured format
	 */
	private parseAIResponse(response: string): AIAnalysis {
		// TODO: Parse JSON response from AI
		// Handle cases where AI returns markdown-wrapped JSON
		// Validate structure matches AIAnalysis interface
		
		try {
			// Strip markdown code blocks if present
			let jsonStr = response.trim();
			if (jsonStr.startsWith('```')) {
				jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '');
			}

			const parsed = JSON.parse(jsonStr);

			// Add unique IDs to issues
			parsed.issues.forEach((issue: Issue, index: number) => {
				issue.id = `issue-${Date.now()}-${index}`;
			});

			parsed.timestamp = new Date();

			return parsed as AIAnalysis;

		} catch (error) {
			console.error('Failed to parse AI response:', error);
			console.error('Response was:', response);
			
			// Return empty analysis on parse failure
			return {
				issues: [],
				suggestions: [],
				riskLevel: 'low',
				confidence: 0,
				timestamp: new Date(),
			};
		}
	}

	/**
	 * Get issues grouped by file (for tree view)
	 */
	getIssuesByFile(): any[] {
		// TODO: Implement if needed, or remove
		return [];
	}
}
