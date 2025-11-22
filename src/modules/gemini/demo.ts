// src/modules/gemini/demo.ts
console.log("DEMO RUNNING FROM FILE:", __filename);

import { GeminiClient } from "./gemini-client";
import * as fs from "fs";

async function demo() {
  console.log("🧠 Gemini AI Module Demo\n");

  const client = new GeminiClient();
  await client.initialize(process.env.GEMINI_API_KEY || "");

  console.log("1. Analyzing buggy code...");
  import path from "path";

const buggyPath = "../examples/buggy-code.ts";
const buggyCode = fs.readFileSync(buggyPath, "utf-8");



  const analysis = await client.analyzeCode(buggy, {
    recentCommits: 5,
    editCount: 12,
    relatedFiles: ["user.ts", "auth.ts"]
  });

  console.log("Issues:", analysis.issues.length);
  console.log("Risk:", analysis.risk_level);

  console.log("\n2. Generating tests...");
  const tests = await client.generateTests(`
    function add(a, b) { return a + b; }
  `);
  console.log(tests);

  console.log("\n3. Fixing error...");
  const fix = await client.fixError(
    `const user = data.user; user.email.toLowerCase();`,
    `TypeError: Cannot read property 'toLowerCase' of undefined`
  );
  console.log(fix);

  console.log("\n✓ Demo complete");
}

demo();
