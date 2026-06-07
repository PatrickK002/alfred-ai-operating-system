import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { buildProductionPreflight } from "../app-metadata.js";

try {
  loadEnvFile(resolve(process.cwd(), ".env"));
} catch (error) {
  if (error.code !== "ENOENT") {
    console.warn(`Could not load .env: ${error.message}`);
  }
}

const allowWarnings = process.argv.includes("--allow-warnings");
const jsonOnly = process.argv.includes("--json");
const preflight = buildProductionPreflight(process.env);

if (jsonOnly) {
  console.log(JSON.stringify(preflight, null, 2));
} else {
  console.log(`Alfred production preflight: ${preflight.summary}`);
  console.log(`Target environment: ${preflight.targetEnvironment}`);
  console.log(`Go-live ready: ${preflight.goLiveReady ? "yes" : "no"}`);
  console.log(`Provider keys: ${preflight.apiKeyReadiness.summary}`);
  for (const check of preflight.checks) {
    const marker = check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : "BLOCK";
    console.log(`${marker} ${check.label}: ${check.message}`);
    if (check.status !== "pass") console.log(`  Next: ${check.action}`);
  }
}

if (!preflight.goLiveReady && !allowWarnings) {
  process.exitCode = 1;
}
