export class PromptTemplates {
  static codeAnalysis(code: string, context: CodeContext): string {
    return  `

    You are a code quality assistant. Analyze this code and provide:
1. Linting issues (with line numbers)
2. Logic errors or bugs
3. Performance improvements
4. Code smell patterns

Context:
- Recent commits: ${context.recentCommits}
- File edit frequency: ${context.editCount}
- Related files: ${context.relatedFiles}
- Active file: ${context.activeFile}
- Recent commits: ${context.recentCommits.join(", ")}
- Recent errors: ${context.recentErrors.join(", ")}
- Edit count: ${context.editCount}
- Related files: ${context.relatedFiles.join(", ")}
- Git diff summary: 
${context.gitDiffSummary}

Code:
\`\`\`
${code}
\`\`\`
Respond in JSON format:
{th
  "issues": [{"line": 10, "severity": "error", "message": "..."}],
  "suggestions": ["..."],
  "risk_level": "low|medium|high"
    "summary": "string"
}
    `.trim();
  }
  
  static testGeneration(functionCode: string): string {
    return `Generate unit tests for this function...`;
  }
  
  static errorFix(code: string, error: string): string {
    return `Fix this error in the code...`;
  }
}


