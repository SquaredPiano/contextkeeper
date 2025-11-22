import { Language } from "../types";

export function detectLanguage(code: string): Language {
  const trimmed = code.trim();

  // JSON detection
  if (/^\{[\s\S]*\}$/.test(trimmed) && !/(function|package|=>)/.test(code)) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {}
  }

  // Python detection
  // Look for def function_name(...): or specific python imports
  if (/def\s+\w+\(.*\)\s*:/.test(code) || 
      /import\s+os\b/.test(code) || 
      /import\s+sys\b/.test(code) || 
      /from\s+\w+\s+import/.test(code) ||
      /if\s+__name__\s*==\s*["']__main__["']/.test(code)) {
    return "python";
  }

  // Go detection
  if (/package\s+\w+/.test(code) || /func\s+\w+\(/.test(code)) {
    return "go";
  }

  // TypeScript detection
  // Look for type annotations, interfaces, or specific TS keywords
  if ((/:\s*\w+/.test(code) && /import\s+/.test(code)) || 
      /interface\s+\w+/.test(code) || 
      /type\s+\w+\s*=/.test(code) ||
      /:\s*(string|number|boolean|any|void)\b/.test(code)) {
    return "ts";
  }

  // JavaScript detection
  if (/import\s+|export\s+|function\s+|\=\>|const\s+|let\s+|var\s+/.test(code)) {
    return "js";
  }

  return "unknown";
}
