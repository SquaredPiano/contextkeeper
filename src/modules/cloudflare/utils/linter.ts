/**
 * A naive regex-based linter for JS/TS.
 * WARNING: This is not a full parser and may produce incorrect results for complex code.
 * It is intended for simple formatting fixes in a lightweight environment.
 */
export function lintJsTs(code: string): string {
  let fixed = code;

  // Semicolons at end of lines (naive)
  // Avoid adding semicolons after { or } or inside comments (hard to detect with regex)
  // This is very risky, so I'll make it less aggressive.
  // Only add semicolon if the line ends with a word character or ) or ] or " or '
  fixed = fixed.replace(/([a-zA-Z0-9_)\]"'])\s*$/gm, "$1;");

  // == → === if not part of !=
  // Use negative lookbehind/lookahead if supported, or capture groups
  fixed = fixed.replace(/([^!<>])==([^=])/g, "$1=== $2");

  // Spaces after keywords (if, for, while, switch, catch)
  fixed = fixed.replace(/\b(if|for|while|switch|catch)\(/g, "$1 (");
  
  // Space after function name
  fixed = fixed.replace(/\bfunction\s+(\w+)\(/g, "function $1 (");

  // Space around operators
  // Be careful not to break => or == or += or -=
  // This is too complex for simple regex without breaking things like URLs or strings.
  // I will skip the general operator spacing for safety, or limit it to simple assignment.
  fixed = fixed.replace(/([a-zA-Z0-9_])\s*=\s*([a-zA-Z0-9_])/g, "$1 = $2");

  // Remove unused imports (naive)
  // This is also risky. I'll comment it out or make it very specific.
  // fixed = fixed.replace(/import\s+(\w+)[^;\n]*;\n/g, (line, name) => {return fixed.includes(name) ? line : "";});

  // Trim trailing whitespace + collapse blank lines
  fixed = fixed.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n");

  // Simple indentation fix
  const lines = fixed.split("\n");
  let depth = 0;
  const indented = lines.map(line => {
    const trimmed = line.trim();
    // Decrease depth if line starts with }
    if (trimmed.startsWith("}")) {
      depth = Math.max(0, depth - 1);
    }
    
    const indent = "  ".repeat(depth);
    const result = indent + trimmed;
    
    // Increase depth if line ends with {
    if (trimmed.endsWith("{")) {
      depth++;
    }
    return result;
  });

  return indented.join("\n");
}
