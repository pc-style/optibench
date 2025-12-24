#!/usr/bin/env bun
// copies the latest summary.json to the visualizer data directory

import { readdir, readFile, writeFile, stat } from "fs/promises";
import { join } from "path";

const RESULTS_DIR = "./results";
const VISUALIZER_DATA = "../visualizer/data/benchmark-results.json";

async function findLatestSummary(): Promise<string | null> {
  const suites = await readdir(RESULTS_DIR, { withFileTypes: true });

  let latestFile: string | null = null;
  let latestTime = 0;

  for (const suite of suites) {
    if (!suite.isDirectory() || suite.name === "cache") continue;

    const suiteDir = join(RESULTS_DIR, suite.name);
    const versions = await readdir(suiteDir, { withFileTypes: true });

    for (const version of versions) {
      if (!version.isDirectory()) continue;

      const versionDir = join(suiteDir, version.name);
      const files = await readdir(versionDir);

      for (const file of files) {
        if (file.startsWith("summary-") && file.endsWith(".json")) {
          const filePath = join(versionDir, file);
          const fileStat = await stat(filePath);

          if (fileStat.mtimeMs > latestTime) {
            latestTime = fileStat.mtimeMs;
            latestFile = filePath;
          }
        }
      }
    }
  }

  return latestFile;
}

async function main() {
  console.log("searching for latest summary...");

  const latestSummary = await findLatestSummary();

  if (!latestSummary) {
    console.error("no summary files found in results directory");
    process.exit(1);
  }

  console.log(`found: ${latestSummary}`);

  const content = await readFile(latestSummary, "utf-8");
  await writeFile(VISUALIZER_DATA, content);

  console.log(`copied to: ${VISUALIZER_DATA}`);

  // parse and show quick stats
  const data = JSON.parse(content);
  console.log("\nstats:");
  console.log(`  suite: ${data.metadata?.testSuite}`);
  console.log(`  version: ${data.metadata?.version}`);
  console.log(`  models: ${data.rankings?.length}`);

  // handle both old format (successRate) and new format (avgSpeedup)
  const topModel = data.rankings?.[0];
  if (topModel?.avgSpeedup) {
    console.log(`  top model: ${topModel.model} (${topModel.avgSpeedup.toFixed(2)}x speedup)`);
  } else if (topModel?.successRate) {
    console.log(`  top model: ${topModel.model} (${topModel.successRate.toFixed(1)}%)`);
  }
}

main().catch(console.error);
