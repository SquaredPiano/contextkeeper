// the language detector
function detectLanguage(code: string): "js" | "ts" | "python" | "go" | "json" | "unknown" {
    const trimmed = code.trim()
  
    // JSON detection (must parse cleanly and lack code keywords)
    if (/^\{[\s\S]*\}$/.test(trimmed) && !/(function|package|=>)/.test(code)) {
      try { JSON.parse(trimmed); return "json" } catch {}
    }
  
    if (/def\s+\w+\(.*\)\s*:/.test(code)) return "python"
    if (/package\s+\w+/.test(code) || /func\s+\w+\(/.test(code)) return "go"
    if (/:\s*\w+/.test(code) && /import\s+/.test(code)) return "ts"
    if (/import\s+|export\s+|function\s+|\=\>/.test(code)) return "js"
  
    return "unknown"
  }
  
  // scanning for python (python can cause issues with linting)
  function scanPythonRisks(code: string): string[] {
    const warn: string[] = []
  
    if (/[^a-zA-Z_]eval\s*\(/.test(code)) warn.push("Use of eval() is unsafe")
    if (/exec\s*\(/.test(code)) warn.push("Use of exec() is unsafe")
    if (/os\.system\s*\(/.test(code)) warn.push("os.system() may risk shell injection")
    if (/subprocess\.Popen\s*\(/.test(code)) warn.push("subprocess.Popen() may risk shell injection")
    if (/while\s+True\s*:/.test(code) && !/break/.test(code)) warn.push("Possible infinite loop: 'while True' has no break")
    if (/hashlib\.(md5|sha1)/.test(code)) warn.push("Weak crypto algorithm detected (md5/sha1)")
    if (/password\s*=\s*["'][^"']+["']/.test(code)) warn.push("Hard-coded password detected")
  
    return warn
  }
  
  // js and ts fast lints
  function lintJsTs(code: string): string {
    let fixed = code
  
    // Semicolons at end of lines
    fixed = fixed.replace(/([^;{}\s])\n/g, "$1;\n")
  
    // == → === if not part of !=
    fixed = fixed.replace(/([^!])==([^=])/g, "$1=== $2")
  
    // Spaces after keywords (if, for, while, switch)
    fixed = fixed.replace(/\b(if|for|while|switch)\(/g, "$1 (")
  
    // Space around operators (=, +, -, *, /, <, >)
    fixed = fixed.replace(/\s*([=+\-*/<>])\s*/g, " $1 ")
  
    // Remove unused imports
    fixed = fixed.replace(/import\s+(\w+)[^;\n]*;\n/g, (line, name) => fixed.includes(name) ? line : "")
  
    // Trim trailing whitespace + collapse blank lines
    fixed = fixed.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n")
  
    // Primitive indentation (2 spaces)
    return fixed
      .split("\n")
      .map(line => {
        const depth = (line.match(/{/g)?.length || 0) - (line.match(/}/g)?.length || 0)
        return "  ".repeat(Math.max(depth, 0)) + line.trim()
      })
      .join("\n")
  }
  
  // our worker
  export default {
    async fetch(request: Request): Promise<Response> {
      const { pathname } = new URL(request.url)
  
      // Health check
      if (request.method === "GET" && pathname === "/") {
        return new Response("OK", { status: 200 })
      }
  
      if (request.method === "POST" && pathname === "/lint") {
        try {
          const { code } = await request.json() as { code?: string }
          if (!code || typeof code !== "string") {
            return new Response(JSON.stringify({ error: "Missing or invalid 'code' field" }), {
              status: 400, headers: { "Content-Type": "application/json" }
            })
          }
  
          const lang = detectLanguage(code)
  
          // Python → Security scan only (NO auto-fix)
          if (lang === "python") {
            return new Response(JSON.stringify({
              fixed: code,
              language: lang,
              linted: false,
              warnings: scanPythonRisks(code)
            }), { status: 200, headers: { "Content-Type": "application/json" } })
          }
  
          // Unsupported languages → return untouched
          if (lang !== "js" && lang !== "ts") {
            return new Response(JSON.stringify({
              fixed: code,
              language: lang,
              linted: false
            }), { status: 200, headers: { "Content-Type": "application/json" } })
          }
  
          // JS/TS → Apply fast linting
          const fixed = lintJsTs(code)
          return new Response(JSON.stringify({ fixed, language: lang, linted: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
  
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400, headers: { "Content-Type": "application/json" }
          })
        }
      }
  
      return new Response("Not Found", { status: 404 })
    }
  }
  
  