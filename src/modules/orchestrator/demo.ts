// Demo showing how to use the Orchestrator
import * as vscode from "vscode";
import { Orchestrator, OrchestratorConfig, PipelineResult, FileAnalysisResult } from "./orchestrator";

export async function demoOrchestrator() {
  console.log("🚀 Orchestrator Demo\n");

  const config: OrchestratorConfig = {
    cloudflareWorkerUrl:
      process.env.CLOUDFLARE_WORKER_URL ||
      "https://your-worker.workers.dev",
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    analyzeAllFiles: false,
    maxFilesToAnalyze: 10,
  };

  const orchestrator = new Orchestrator(config);

  orchestrator.on("initialized", () => console.log("✅ Orchestrator initialized"));
  orchestrator.on("contextCollectionStarted", () => console.log("📊 Collecting context..."));
  orchestrator.on("pipelineStarted", () => console.log("\n🔍 Running Analysis Pipeline..."));

  orchestrator.on("pipelineComplete", (result: PipelineResult) => {
    console.log("\n🎉 Pipeline Complete!");
    console.log(`  Analyzed: ${result.summary.totalFiles} file(s)`);
    console.log(`  Issues Found: ${result.summary.totalIssues}`);
    console.log(`  Overall Risk: ${result.summary.overallRiskLevel}`);

    result.fileAnalyses.forEach((analysis: FileAnalysisResult) => {
      console.log(`\n📄 ${analysis.filePath}`);

      if (analysis.lintResult) {
        console.log(`  Cloudflare warnings: ${analysis.lintResult.warnings.length}`);
        console.log(`  Severity: ${analysis.lintResult.severity}`);
      }

      if (analysis.fixAction) {
        console.log(`  Fix Action: ${analysis.fixAction.type} (${analysis.fixAction.reason})`);
      }

      if (analysis.geminiAnalysis) {
        console.log(`  Gemini risk level: ${analysis.geminiAnalysis.risk_level || "unknown"}`);
        console.log(`  Gemini issues: ${analysis.geminiAnalysis.issues?.length || 0}`);
      }

      if (analysis.errors.length > 0) {
        console.log(`  Errors: ${analysis.errors.join(", ")}`);
      }
    });
  });

  orchestrator.on("pipelineError", (error: unknown) => {
    console.error("Pipeline error:", error);
  });

  try {
    await orchestrator.initialize();
    await orchestrator.runPipeline();
  } catch (err) {
    console.error("Demo failed:", err);
  }
}

if (require.main === module) {
  demoOrchestrator()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

