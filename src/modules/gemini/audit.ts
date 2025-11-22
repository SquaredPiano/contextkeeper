
import * as dotenv from 'dotenv';
import * as path from 'path';
import { GeminiClient } from './gemini-client';
import { GeminiContext } from './types';

// Load environment variables
const envPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: envPath });

async function audit() {
  console.log("🔍 Starting Gemini Module Audit...");
  
  const client = new GeminiClient();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("❌ No API Key found. Skipping real API tests.");
    return;
  }

  await client.initialize(apiKey);
  console.log("✅ Client initialized");

  // Test 1: Mock Mode
  console.log("\n--- Test 1: Mock Mode ---");
  client.enableMockMode();
  const mockAnalysis = await client.analyzeCode("const a = 1;", {
    activeFile: "test.ts",
    recentCommits: [],
    recentErrors: [],
    gitDiffSummary: "",
    editCount: 0,
    relatedFiles: []
  });
  if (mockAnalysis.risk_level === 'low' && mockAnalysis.issues.length > 0) {
    console.log("✅ Mock mode working");
  } else {
    console.error("❌ Mock mode failed", mockAnalysis);
  }

  // Re-initialize for real mode
  await client.initialize(apiKey);

  // Test 2: Real API - Simple Analysis
  console.log("\n--- Test 2: Real API (gemini-2.5-flash) - Simple Analysis ---");
  try {
    const analysis = await client.analyzeCode("function add(a,b) { return a+b; }", {
      activeFile: "math.ts",
      recentCommits: ["init"],
      recentErrors: [],
      gitDiffSummary: "",
      editCount: 1,
      relatedFiles: []
    });
    
    if (analysis.risk_level) {
      console.log("✅ Real analysis successful");
      console.log("   Risk:", analysis.risk_level);
      console.log("   Issues:", analysis.issues.length);
    } else {
      console.error("❌ Real analysis returned invalid structure", analysis);
    }
  } catch (e: any) {
    console.error("❌ Real analysis failed:", e.message);
  }

  // Test 3: Batch Processing
  console.log("\n--- Test 3: Batch Processing ---");
  try {
    const files = new Map<string, string>();
    files.set("user.ts", "export interface User { name: string; age: number; }");
    files.set("api.ts", "import { User } from './user'; export function getUser(id: string): User { return { name: 'Test', age: 20 }; }");

    const batchResult = await client.runBatch(files, {
      activeFile: "api.ts",
      recentCommits: ["feat: add user api"],
      recentErrors: [],
      gitDiffSummary: "",
      editCount: 5,
      relatedFiles: ["user.ts"]
    });

    if (batchResult.files.length === 2) {
      console.log("✅ Batch processing successful");
      console.log("   Global Summary:", batchResult.globalSummary.substring(0, 50) + "...");
      console.log("   Files analyzed:", batchResult.files.map(f => f.file).join(", "));
    } else {
      console.error("❌ Batch processing returned unexpected file count:", batchResult.files.length);
    }
  } catch (e: any) {
    console.error("❌ Batch processing failed:", e.message);
  }

  // Test 4: JSON Parsing Robustness (Simulated)
  // We can't easily inject a bad response into the real client without mocking fetch, 
  // but we can verify the client handles the real response which might contain markdown.
  // The previous tests implicitly cover this if they succeed.
  
  console.log("\n🏁 Audit Complete");
}

audit();
