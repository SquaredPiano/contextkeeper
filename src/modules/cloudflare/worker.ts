import { detectLanguage } from "./utils/language";
import { lintJsTs } from "./utils/linter";
import { getOverallSeverity, scanJsTsRisks, scanPythonRisks } from "./utils/security";
import { Risk, Severity } from "./types";

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
