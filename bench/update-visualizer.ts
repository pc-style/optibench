#!/usr/bin/env bun
// copies the latest summary.json and results.json to the visualizer data directory

import { readdir, readFile, writeFile, stat } from "fs/promises";
import { join, dirname } from "path";

const RESULTS_DIR = "./results";
const VISUALIZER_DATA = "../visualizer/data/benchmark-results.json";
const VISUALIZER_DETAILS = "../visualizer/data/benchmark-details.json";

type LatestFiles = {
  summary: string | null;
  results: string | null;
};

async function findLatestFiles(): Promise<LatestFiles> {
  const suites = await readdir(RESULTS_DIR, { withFileTypes: true });

  let latestSummary: string | null = null;
  let latestResults: string | null = null;
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
            latestSummary = filePath;
            // find matching results file (same timestamp)
            const timestamp = file.replace("summary-", "").replace(".json", "");
            const resultsFile = `results-${timestamp}.json`;
            if (files.includes(resultsFile)) {
              latestResults = join(versionDir, resultsFile);
            }
          }
        }
      }
    }
  }

  return { summary: latestSummary, results: latestResults };
}

async function main() {
  console.log("searching for latest files...");

  const { summary, results } = await findLatestFiles();

  if (!summary) {
    console.error("no summary files found in results directory");
    process.exit(1);
  }

  console.log(`found summary: ${summary}`);

  const summaryContent = await readFile(summary, "utf-8");
  await writeFile(VISUALIZER_DATA, summaryContent);
  console.log(`copied to: ${VISUALIZER_DATA}`);

  if (results) {
    console.log(`found results: ${results}`);
    const resultsContent = await readFile(results, "utf-8");
    await writeFile(VISUALIZER_DETAILS, resultsContent);
    console.log(`copied to: ${VISUALIZER_DETAILS}`);
  }

  // parse and show quick stats
  const data = JSON.parse(summaryContent);
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
