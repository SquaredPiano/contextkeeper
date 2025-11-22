// src/modules/gemini/prompts.ts

import type { CodeContext } from "./types";

export class PromptTemplates {
  static codeAnalysis(code: string, context: CodeContext): string {
    return `
Analyze this code and return:
- issues with line numbers
- suggestions
- risk level

Recent commits: ${context.recentCommits}
Edit frequency: ${context.editCount}
Related files: ${context.relatedFiles.join(", ")}

CODE:
\`\`\`ts
${code}
\`\`\`

Respond USING JSON:
{
  "issues": [...],
  "suggestions": [...],
  "risk_level": "low|medium|high"
}
    `.trim();
  }

  static testGeneration(fn: string) {
    return `
Write Jest tests for this function:

\`\`\`ts
${fn}
\`\`\`
    `;
  }

  static errorFix(code: string, error: string) {
    return `
Fix the following error:

CODE:
\`\`\`ts
${code}
\`\`\`

ERROR:
${error}

Return JSON:
{
  "fixedCode": "...",
  "confidence": 0-100
}
    `;
  }
}
