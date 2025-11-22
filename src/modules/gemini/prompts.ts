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
3.  **Suggest Fixes**: For any "error" or "high" severity issue found, provide a corrected code snippet.

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
      "suggestedFixes": [
        {
          "issueId": "issue-index (0, 1, etc)",
          "fix": { "fixedCode": "string", "confidence": number, "explanation": "string" }
        }
      ]
    }
  ]
}
    `.trim();
  }
  
  static errorFix(code: string, error: string): string {
    return `
Fix the following error in the code. Return ONLY the fixed code block without markdown formatting if possible, or inside a single code block.

Error:
${error}

Code:
\`\`\`
${code}
\`\`\`
    `.trim();
  }
}


