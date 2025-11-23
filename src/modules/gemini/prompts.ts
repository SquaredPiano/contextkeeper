import { GeminiContext } from './types';

export class PromptTemplates {
  static codeAnalysis(code: string, context: GeminiContext): string {
    const relatedFilesStr = context.relatedFiles.length > 0 
      ? context.relatedFiles.join(", ") 
      : "None";
    
    const commitsStr = context.recentCommits.length > 0
      ? context.recentCommits.join("\n- ")
      : "None";

    const errorsStr = context.recentErrors.length > 0
      ? context.recentErrors.join("\n- ")
      : "None";

    const pastSessionsStr = context.relevantPastSessions && context.relevantPastSessions.length > 0
      ? context.relevantPastSessions.map(s => `- ${new Date(s.timestamp).toLocaleDateString()}: ${s.summary}`).join("\n")
      : "None";

    return `
You are an expert AI coding assistant. Your task is to analyze the provided code within the context of the user's current workflow.

CONTEXT:
- Active File: ${context.activeFile || "Unknown"}
- Related Open Files: ${relatedFilesStr}
- Recent Git Commits:
- ${commitsStr}
- Recent Workspace Errors:
- ${errorsStr}
- Edit Frequency: ${context.editCount} edits in session
- Relevant Past Sessions (from Vector DB):
${pastSessionsStr}

GIT DIFF SUMMARY (Recent changes):
${context.gitDiffSummary}

CODE TO ANALYZE:
\`\`\`
${code}
\`\`\`

INSTRUCTIONS:
Analyze the code for:
1.  **Correctness**: Logic errors, bugs, potential runtime issues.
2.  **Quality**: Code smells, maintainability, readability.
3.  **Contextual Relevance**: Does this code align with the recent commits and changes?
4.  **Security**: Potential vulnerabilities.

Respond in valid JSON format ONLY:
{
  "issues": [
    { "line": number, "severity": "error"|"warning"|"info", "message": "string" }
  ],
  "suggestions": ["string"],
  "risk_level": "low"|"medium"|"high",
  "summary": "Brief summary of what the user seems to be working on based on this code and context",
  "context_analysis": "Analysis of how this code fits into the broader project context"
}
    `.trim();
  }
  
  static testGeneration(functionCode: string): string {
    return `
Generate comprehensive unit tests for the following function using Vitest.
Include imports, describe blocks, and it blocks covering happy paths and edge cases.

Code:
\`\`\`
${functionCode}
\`\`\`
    `.trim();
  }
  
  static batchProcess(files: Map<string, string>, context: GeminiContext): string {
    const fileList = Array.from(files.entries()).map(([name, content]) => `
--- FILE: ${name} ---
${content}
---------------------
`).join("\n");

    const commitsStr = context.recentCommits.length > 0
      ? context.recentCommits.join("\n- ")
      : "None";

    return `
You are an expert AI coding assistant. Perform a deep, batched analysis on the following files.

CONTEXT:
- Recent Git Commits:
- ${commitsStr}
- Git Diff Summary:
${context.gitDiffSummary}

FILES TO PROCESS:
${fileList}

INSTRUCTIONS:
For EACH file provided above, perform the following:
1.  **Analyze**: Find bugs, logic errors, and code smells.
2.  **Generate Tests**: Create a comprehensive unit test suite (Vitest) for the file.
3.  **Suggest Fixes**: For any "error" or "high" severity issue found, provide detailed explanations on how to fix them.

IMPORTANT CONSTRAINTS:
1. DO NOT generate fixed code, patches, diffs, or code modifications.
2. DO NOT include code snippets in suggestedFixes.
3. ONLY provide explanations and guidance - let the developer implement the fixes.

Respond in valid JSON format ONLY with this structure:
{
  "globalSummary": "Overview of the changes and health of these files",
  "files": [
    {
      "file": "filename",
      "analysis": {
        "issues": [ { "line": number, "severity": "error"|"warning"|"info", "message": "string" } ],
        "suggestions": ["string"],
        "risk_level": "low"|"medium"|"high",
        "summary": "File specific summary"
      },
      "generatedTests": "string (full test file content)",
      "suggestedFixes": []
    }
  ]
}

NOTE: The suggestedFixes array should be empty or omitted. All fix guidance should be in the analysis.issues[].message and analysis.suggestions fields instead.
    `.trim();
  }
  
  static errorFix(code: string, error: string): string {
    return `
Analyze the following error in the code. Provide suggestions on how to fix it, but DO NOT generate or provide fixed code.

Error:
${error}

Code:
\`\`\`
${code}
\`\`\`

IMPORTANT CONSTRAINTS:
1. DO NOT generate or provide fixed code, patches, diffs, or code modifications.
2. DO NOT include code snippets, code examples, or code blocks in your response.
3. ONLY provide a detailed explanation of what's wrong and how to fix it.

INSTRUCTIONS:
Analyze the error and the code. Explain what's causing the error and provide clear, actionable guidance on how to fix it. Your explanation should be detailed enough that a developer can make the fix themselves, but MUST NOT include any actual code.

Respond in valid JSON format ONLY:
{
  "fixedCode": "REPLACE_WITH_ORIGINAL_CODE_AS_IS",
  "confidence": number (0.0 to 1.0, based on your confidence in the diagnosis),
  "explanation": "string (detailed explanation of what's wrong and how to fix it, WITHOUT any code examples or code blocks)"
}

CRITICAL: In the "fixedCode" field, you MUST return the exact original code that was provided above, unchanged. Do NOT modify it. The explanation field should contain all guidance on how to fix the issue.
    `.trim();
  }

  /**
   * Prompt for idle improvements workflow.
   * Generates tests, summary, and recommendations ONLY.
   * MUST NOT generate code patches or fixes.
   */
  static idleImprovements(context: GeminiContext): string {
    const relatedFilesStr = context.relatedFiles.length > 0 
      ? context.relatedFiles.join(", ") 
      : "None";
    
    const commitsStr = context.recentCommits.length > 0
      ? context.recentCommits.slice(0, 5).join("\n- ")
      : "None";

    const pastSessionsStr = context.relevantPastSessions && context.relevantPastSessions.length > 0
      ? context.relevantPastSessions.map(s => 
          `- ${new Date(s.timestamp).toLocaleDateString()}: ${s.summary}`
        ).join("\n")
      : "None";

    return `
You MUST respond with ONLY valid JSON. No explanations, no markdown, no conversational text.

CONTEXT:
- Active File: ${context.activeFile || "Unknown"}
- Related Files: ${relatedFilesStr}
- Recent Commits: ${commitsStr}
- Edit Count: ${context.editCount}
- Git Diff: ${context.gitDiffSummary || "No changes"}
- Past Sessions: ${pastSessionsStr}
- User Intent: ${context.userIntent || "General improvements"}

YOUR TASK:
Analyze the codebase and respond with ONLY this JSON structure (no other text):

{
  "summary": "Human-readable summary of current state and improvements",
  "tests": [
    "// Complete test file content as string"
  ],
  "recommendations": [
    {
      "priority": "high",
      "message": "Actionable recommendation"
    }
  ]
}

CRITICAL RULES:
1. Response must be ONLY valid JSON
2. No markdown code blocks (no \`\`\`)
3. No conversational text before or after JSON
4. No code patches or fixes
5. Tests should be complete test files as strings
6. Recommendations must be actionable but not include code

RESPOND WITH JSON ONLY:`.trim();
  }
}
