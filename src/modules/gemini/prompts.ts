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
  
  static testGeneration(functionCode: string, language: string = 'typescript', framework?: string): string {
    // Auto-detect testing framework based on language if not provided
    const testingFramework = framework || this.getDefaultFramework(language);
    
    // Language-specific test templates
    const languageInstructions: Record<string, string> = {
      'typescript': `Generate comprehensive unit tests using ${testingFramework}.
Include proper TypeScript type annotations.
Use describe() and it() blocks for test organization.
Import syntax: import { describe, it, expect } from '${testingFramework === 'Vitest' ? 'vitest' : '@jest/globals'}';`,
      
      'javascript': `Generate comprehensive unit tests using ${testingFramework}.
Use describe() and it() blocks for test organization.
Import syntax: const { describe, it, expect } = require('${testingFramework === 'Vitest' ? 'vitest' : '@jest/globals'}');`,
      
      'python': `Generate comprehensive unit tests using ${testingFramework}.
Use proper Python test class structure.
Import syntax: import pytest (or import unittest).
Use test_ prefix for test functions.`,
      
      'java': `Generate comprehensive unit tests using ${testingFramework}.
Use @Test annotations.
Import syntax: import org.junit.Test; import static org.junit.Assert.*;`,
      
      'go': `Generate comprehensive unit tests using Go's testing package.
Use func TestXxx(t *testing.T) pattern.
Import syntax: import "testing"`,
    };

    const instructions = languageInstructions[language] || 
      `Generate comprehensive unit tests in ${language} using ${testingFramework}.`;

    return `
${instructions}

Include tests covering:
- Happy paths (normal expected inputs)
- Edge cases (boundary conditions, empty inputs)
- Error cases (invalid inputs, exceptions)

Code to test:
\`\`\`${language}
${functionCode}
\`\`\`

Generate ONLY the test code, no explanations. The test code must be in ${language}, not JavaScript.
    `.trim();
  }

  private static getDefaultFramework(language: string): string {
    const frameworks: Record<string, string> = {
      'typescript': 'Vitest',
      'javascript': 'Jest',
      'python': 'pytest',
      'java': 'JUnit',
      'go': 'testing',
      'rust': 'cargo test',
      'csharp': 'xUnit'
    };
    return frameworks[language] || 'appropriate testing framework';
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
      ? context.recentCommits.slice(0, 5).join("\n  ")
      : "None";

    const pastSessionsStr = context.relevantPastSessions && context.relevantPastSessions.length > 0
      ? context.relevantPastSessions.map(s => 
          `- ${new Date(s.timestamp).toLocaleDateString()}: ${s.summary}`
        ).join("\n")
      : "None";

    return `
You MUST respond with ONLY valid JSON. No explanations, no markdown, no conversational text.

==== WHAT THE USER WAS ACTUALLY DOING (THEIR RECENT CODE CHANGES) ====
${context.gitDiffSummary}

==== CURRENT WORKSPACE STATE ====
- Currently editing: ${context.activeFile || "Unknown"}
- Other open files: ${relatedFilesStr}
- Number of edits made: ${context.editCount}
- Recent commits:
  ${commitsStr}

==== HISTORICAL CONTEXT (for reference only) ====
${pastSessionsStr || "No previous sessions"}

==== YOUR TASK ====
Based on the ACTUAL CODE CHANGES shown above (in "WHAT THE USER WAS ACTUALLY DOING"), write a summary that describes:
1. What file/function they were working on
2. What kind of changes they made (adding features, fixing bugs, refactoring, etc.)
3. What the code change was trying to accomplish

DO NOT talk about issues or problems unless that's clearly what they were working on.
DO NOT give generic summaries like "working on a file" - be SPECIFIC about what they changed.
USE the actual code snippets above to understand their work.

EXAMPLE GOOD SUMMARY:
"While you were away, I noticed you were working on the CanvasPage component in page.tsx, specifically adding TanStack Query integration for data fetching and implementing upload zones for multiple file types (notes, flashcards, quizzes, slides). You added Framer Motion animations and integrated with your backend API to fetch project data."

EXAMPLE BAD SUMMARY:
"While you were away, you were working on page.tsx and made some changes to the code."

RESPOND WITH THIS EXACT JSON STRUCTURE:

{
  "summary": "While you were away, I noticed you were working on [BE SPECIFIC: file name, function name, line numbers]. [Describe the ACTUAL changes they made based on the code above]. [What were they trying to accomplish?]",
  "tests": [
    "// Complete test file content as string - generate tests for the SPECIFIC functions/components they edited"
  ],
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "message": "Specific, actionable recommendation related to their actual work"
    }
  ]
}

CRITICAL RULES:
1. Response must be ONLY valid JSON
2. No markdown code blocks (no \`\`\`)
3. Summary must reference ACTUAL code changes from above
4. Tests should be for the SPECIFIC code they edited
5. Recommendations must be contextual to their work
6. FOCUS on describing their WORK, not critiquing it

GENERATE THE JSON NOW:`.trim();
  }
}
