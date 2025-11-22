// types
type Language = "js" | "ts" | "python" | "go" | "json" | "unknown";
type Severity = "none" | "low" | "medium" | "high";

type Risk = {
  message: string;
  severity: Severity;
};

// language detection
function detectLanguage(code: string): Language {
  const trimmed = code.trim();

  // JSON detection
  if (/^\{[\s\S]*\}$/.test(trimmed) && !/(function|package|=>)/.test(code)) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {}
  }

  if (/def\s+\w+\(.*\)\s*:/.test(code)) {return "python";}
  if (/package\s+\w+/.test(code) || /func\s+\w+\(/.test(code)) {return "go";}
  if (/:\s*\w+/.test(code) && /import\s+/.test(code)) {return "ts";}
  if (/import\s+|export\s+|function\s+|\=\>/.test(code)) {return "js";}

  return "unknown";
}

// security aggregation
function getOverallSeverity(risks: Risk[]): Severity {
  if (!risks.length) {return "none";}
  if (risks.some(r => r.severity === "high")) {return "high";}
  if (risks.some(r => r.severity === "medium")) {return "medium";}
  return "low";
}

// python scan
function scanPythonRisks(code: string): Risk[] {
  const risks: Risk[] = [];

  if (/[^a-zA-Z_]eval\s*\(/.test(code)) {
    risks.push({ message: "Use of eval() is unsafe", severity: "high" });
  }

  if (/exec\s*\(/.test(code)) {
    risks.push({ message: "Use of exec() is unsafe", severity: "high" });
  }

  if (/os\.system\s*\(/.test(code)) {
    risks.push({ message: "os.system() may risk shell injection", severity: "medium" });
  }

  if (/subprocess\.Popen\s*\(/.test(code)) {
    risks.push({ message: "subprocess.Popen() may risk shell injection", severity: "medium" });
  }

  if (/while\s+True\s*:/.test(code) && !/break/.test(code)) {
    risks.push({ message: "Possible infinite loop: 'while True' has no break", severity: "medium" });
  }

  if (/hashlib\.(md5|sha1)/.test(code)) {
    risks.push({ message: "Weak crypto algorithm detected (md5/sha1)", severity: "medium" });
  }

  if (/password\s*=\s*["'][^"']+["']/.test(code)) {
    risks.push({ message: "Hard-coded password detected", severity: "high" });
  }

  return risks;
}

// js and ts security and quality scan
function scanJsTsRisks(code: string, lang: Language): Risk[] {
  const risks: Risk[] = [];

  // Unsafe eval / Function constructor
  if (/[^a-zA-Z_]eval\s*\(/.test(code)) {
    risks.push({ message: "Use of eval() is unsafe in JS/TS", severity: "high" });
  }

  if (/new\s+Function\s*\(/.test(code)) {
    risks.push({ message: "Use of Function constructor is unsafe", severity: "high" });
  }

  // DOM injection risks
  if (/document\.write\s*\(/.test(code)) {
    risks.push({ message: "document.write() can lead to XSS", severity: "medium" });
  }

  if (/\.innerHTML\s*=/.test(code)) {
    risks.push({ message: "Direct assignment to innerHTML can be unsafe", severity: "medium" });
  }

  // Local storage secrets
  if (/localStorage\.setItem\s*\(\s*["'](token|auth|password|secret)["']/i.test(code)) {
    risks.push({ message: "Possible credential stored in localStorage", severity: "high" });
  }

  // Weak crypto in JS
  if (/crypto\.createHash\s*\(\s*["'](md5|sha1)["']\s*\)/.test(code)) {
    risks.push({ message: "Weak crypto algorithm (md5/sha1) in JS", severity: "medium" });
  }

  // TS specific: any usage
  if (lang === "ts") {
    if (/:\s*any\b/.test(code)) {
      risks.push({ message: "TypeScript 'any' type used, weak type safety", severity: "medium" });
    }

    if (/\bfunction\s+\w+\s*\(([^)]*)\)/.test(code) && /:\s*any\b/.test(code)) {
      risks.push({ message: "Function with 'any' typed parameters in TS", severity: "medium" });
    }

    if (/\w+!\./.test(code)) {
      risks.push({ message: "Non-null assertion operator '!' used, may hide null errors", severity: "low" });
    }
  }

  return risks;
}

// js and ts light lints
function lintJsTs(code: string): string {
  let fixed = code;

  // Semicolons at end of lines
  fixed = fixed.replace(/([^;{}\s])\n/g, "$1;\n");

  // == → === if not part of !=
  fixed = fixed.replace(/([^!])==([^=])/g, "$1=== $2");

  // Spaces after keywords (if, for, while, switch)
  fixed = fixed.replace(/\b(if|for|while|switch)\(/g, "$1 (");

  // Space around operators
  fixed = fixed.replace(/\s*([=+\-*/<>])\s*/g, " $1 ");

  // Remove unused imports
  fixed = fixed.replace(/import\s+(\w+)[^;\n]*;\n/g, (line, name) => {return fixed.includes(name) ? line : "";});

  // Trim trailing whitespace + collapse blank lines
  fixed = fixed.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n");

  return fixed
    .split("\n")
    .map(line => {
      const depth = (line.match(/{/g)?.length || 0) - (line.match(/}/g)?.length || 0);
      return "  ".repeat(Math.max(depth, 0)) + line.trim();
    })
    .join("\n");
}

// worker
export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    // Simple health check
    if (request.method === "GET" && pathname === "/") {
      return new Response("OK", { status: 200 });
    }

    if (request.method === "POST" && pathname === "/lint") {
      try {
        const { code } = await request.json() as { code?: string };

        if (!code || typeof code !== "string") {
          return new Response(JSON.stringify({ error: "Missing or invalid 'code' field" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        const language = detectLanguage(code);

        // Python: risk scan only
        if (language === "python") {
          const risks = scanPythonRisks(code);
          const severity = getOverallSeverity(risks);

          return new Response(JSON.stringify({
            fixed: code,
            language,
            linted: false,
            severity,
            warnings: risks
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        // JS / TS: lint + risk scan
        if (language === "js" || language === "ts") {
          const fixed = lintJsTs(code);
          const risks = scanJsTsRisks(code, language);
          const severity = getOverallSeverity(risks);

          return new Response(JSON.stringify({
            fixed,
            language,
            linted: true,
            severity,
            warnings: risks
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        // Other languages: return unchanged
        return new Response(JSON.stringify({
          fixed: code,
          language,
          linted: false,
          severity: "none" as Severity,
          warnings: [] as Risk[]
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });

      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
