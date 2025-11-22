import { Risk, Severity, Language } from "../types";

export function getOverallSeverity(risks: Risk[]): Severity {
  if (!risks.length) { return "none"; }
  if (risks.some(r => r.severity === "high")) { return "high"; }
  if (risks.some(r => r.severity === "medium")) { return "medium"; }
  return "low";
}

export function scanPythonRisks(code: string): Risk[] {
  const risks: Risk[] = [];

  // Use word boundaries \b to avoid matching inside other words
  if (/\beval\s*\(/.test(code)) {
    risks.push({ message: "Use of eval() is unsafe", severity: "high" });
  }

  if (/\bexec\s*\(/.test(code)) {
    risks.push({ message: "Use of exec() is unsafe", severity: "high" });
  }

  if (/os\.system\s*\(/.test(code)) {
    risks.push({ message: "os.system() may risk shell injection", severity: "medium" });
  }

  if (/subprocess\.Popen\s*\(/.test(code)) {
    risks.push({ message: "subprocess.Popen() may risk shell injection", severity: "medium" });
  }

  if (/while\s+True\s*:/.test(code) && !/\bbreak\b/.test(code)) {
    risks.push({ message: "Possible infinite loop: 'while True' has no break", severity: "medium" });
  }

  if (/hashlib\.(md5|sha1)/.test(code)) {
    risks.push({ message: "Weak crypto algorithm detected (md5/sha1)", severity: "medium" });
  }

  // Hard-coded password detection (simple heuristic)
  if (/password\s*=\s*["'][^"']+["']/.test(code)) {
    risks.push({ message: "Hard-coded password detected", severity: "high" });
  }

  return risks;
}

export function scanJsTsRisks(code: string, lang: Language): Risk[] {
  const risks: Risk[] = [];

  // Unsafe eval / Function constructor
  if (/\beval\s*\(/.test(code)) {
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
