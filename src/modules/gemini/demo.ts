// src/modules/gemini/demo.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from "fs";
import { GeminiClient } from "./gemini-client";

// Load environment variables from .env file in workspace root
const envPath = path.resolve(__dirname, '../../../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn("⚠️  .env file not found or could not be loaded:", result.error.message);
} else {
  console.log("✅ .env loaded successfully");
}

console.log("DEMO RUNNING FROM FILE:", __filename);

async function demo() {
  console.log("🧠 Gemini AI Module Demo\n");

  const client = new GeminiClient();
  const apiKey = process.env.GEMINI_API_KEY || "";
  
  if (!apiKey || apiKey.trim() === "") {
    console.log("⚠️  No GEMINI_API_KEY found in .env, using MOCK mode");
    // Enable mock mode BEFORE initializing
    client.enableMockMode();
    // Initialize in mock mode - the initialize() method will now respect mock mode
    await client.initialize("mock-key");
  } else {
    console.log("🔑 API Key found, initializing real client...");
    await client.initialize(apiKey);
  }

  console.log("1. Analyzing buggy code...");
  
  const buggyPath = path.join(__dirname, "example", "buggy-code.ts");
  let buggyCode = "";
  
  try {
    buggyCode = fs.readFileSync(buggyPath, "utf-8");
  } catch (e) {
    console.warn("Could not read buggy-code.ts, using fallback string");
    buggyCode = `
    function calculateTotal(items) {
      let total = 0;
      for (let i = 0; i < items.length; i++) {
        total += items[i].price;
      }
      return total;
    }
    `;
  }

  try {
    const analysis = await client.analyzeCode(buggyCode, {
      activeFile: "buggy-code.ts",
      recentCommits: ["fix: update user model", "feat: add auth"],
      recentErrors: [],
      gitDiffSummary: "",
      editCount: 12,
      relatedFiles: ["user.ts", "auth.ts"]
    });

    console.log("Issues:", analysis.issues.length);
    console.log("Risk:", analysis.risk_level);
    console.log("Suggestions:", analysis.suggestions);
    if (analysis.summary) {
      console.log("Summary:", analysis.summary);
    }
  } catch (err: any) {
    console.error("Analysis failed:", err.message);
  }

  console.log("\n2. Generating tests...");
  try {
    const tests = await client.generateTests(`
      function add(a, b) { return a + b; }
    `);
    console.log(tests.substring(0, 100) + "...");
  } catch (err: any) {
    console.error("Test generation failed:", err.message);
  }

  console.log("\n3. Fixing error...");
  try {
    const fix = await client.fixError(
      `const user = data.user; user.email.toLowerCase();`,
      `TypeError: Cannot read property 'toLowerCase' of undefined`
    );
    console.log("Fixed Code:", fix.fixedCode);
  } catch (err: any) {
    console.error("Fix error failed:", err.message);
  }

  console.log("\n✓ Demo complete");
}

demo();

