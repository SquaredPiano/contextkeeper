
/**
 * robustly parses JSON from a string that might contain markdown code blocks or other text.
 */
export function parseJsonFromText<T>(text: string, fallback: T): T {
  try {
    // 1. Try to find JSON within markdown code blocks
    const markdownJsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    const matches = [...text.matchAll(markdownJsonRegex)];
    
    for (const match of matches) {
      try {
        return JSON.parse(match[1]) as T;
      } catch (e) {
        // Continue to next match if parsing fails
      }
    }

    // 2. If no markdown blocks or parsing failed, try to find the first '{' and last '}'
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonStr = text.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(jsonStr) as T;
      } catch (e) {
        // Fall through
      }
    }

    // 3. Try parsing the whole text
    return JSON.parse(text) as T;
  } catch (e) {
    console.warn("Failed to parse JSON from text:", e);
    return fallback;
  }
}
