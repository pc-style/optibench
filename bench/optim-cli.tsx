#!/usr/bin/env node
// CLI for running optimization benchmarks

import React, { useEffect, useMemo, useState } from "react";
import { render, Box, Text, useApp } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import {
  runOptimizationTest,
  cleanupWorkDir,
  type OptimizationSuite,
  type OptimizationResult,
} from "./optimization-runner";
import { freeModels, googleModels, DRY_RUN_CONFIG, OUTPUT_DIRECTORY } from "./constants";

function ensureRefUnref(stream: any) {
  if (!stream) return stream;
  if (typeof stream.ref !== "function") stream.ref = () => {};
  if (typeof stream.unref !== "function") stream.unref = () => {};
  return stream;
}

const stdin = ensureRefUnref(process.stdin as any);
const stdout = ensureRefUnref(process.stdout as any);
const stderr = ensureRefUnref(process.stderr as any);

// combine free + google models
const models = [...freeModels, ...googleModels];

function useBenchRoot() {
  const here = fileURLToPath(import.meta.url);
  return dirname(here);
}

async function findOptimSuites(testsDir: string) {
  const entries = await readdir(testsDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && e.name.endsWith(".json"));
  const suites: Array<{ filePath: string; suite: OptimizationSuite }> = [];

  for (const f of files) {
    try {
      const filePath = join(testsDir, f.name);
      const raw = await readFile(filePath, "utf-8");
      const json = JSON.parse(raw);
      // check if it's an optimization suite (has tests with 'code' field)
      if (json?.tests?.[0]?.code) {
        suites.push({ filePath, suite: json as OptimizationSuite });
      }
    } catch {}
  }
  return suites;
}

function formatDefaultVersion() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type ModelStats = {
  testsRun: number;
  testsTotal: number;
  compiled: number;
  correct: number;
  totalSpeedup: number;
  avgSpeedup: number;
  running: boolean;
};

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const width = 40;
  const ratio = total > 0 ? completed / total : 0;
  const filled = Math.round(width * ratio);
  const empty = width - filled;
  const percent = total > 0 ? Math.floor(ratio * 100) : 0;
  return (
    <Text>
      [<Text color="green">{"█".repeat(filled)}</Text>
      <Text color="gray">{"░".repeat(empty)}</Text>] <Text color="cyan">{percent}%</Text>
    </Text>
  );
}

function pad(str: string, width: number) {
  if (str.length >= width) return str.slice(0, width);
  return str.padEnd(width);
}

function padLeft(str: string, width: number) {
  if (str.length >= width) return str.slice(-width);
  return str.padStart(width);
}

const App: React.FC = () => {
  const benchRoot = useBenchRoot();
  const testsDir = useMemo(() => join(benchRoot, "tests"), [benchRoot]);
  const { exit } = useApp();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suites, setSuites] = useState<Array<{ filePath: string; suite: OptimizationSuite }>>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [version, setVersion] = useState<string>(formatDefaultVersion());
  const [stage, setStage] = useState<"pickSuite" | "version" | "running" | "done">("pickSuite");
  const [stats, setStats] = useState<Record<string, ModelStats>>({});
  const [results, setResults] = useState<OptimizationResult[]>([]);
  const [currentTest, setCurrentTest] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const found = await findOptimSuites(testsDir);
        setSuites(found);
        setLoading(false);
      } catch (e) {
        setError((e as Error).message);
        setLoading(false);
      }
    })();
  }, [testsDir]);

  useEffect(() => {
    if (stage === "running" && selectedIndex != null) {
      (async () => {
        const entry = suites[selectedIndex];
        const suite = entry.suite;
        const workDir = join(benchRoot, ".optim-work");
        const allResults: OptimizationResult[] = [];

        // init stats
        const initialStats: Record<string, ModelStats> = {};
        for (const model of models) {
          initialStats[model.name] = {
            testsRun: 0,
            testsTotal: suite.tests.length,
            compiled: 0,
            correct: 0,
            totalSpeedup: 0,
            avgSpeedup: 0,
            running: false,
          };
        }
        setStats(initialStats);

        // run models in parallel (up to 3 concurrent)
        const MAX_CONCURRENT = 3;
        const modelQueue = [...models];
        const activePromises: Promise<void>[] = [];

        const runModelTests = async (model: typeof models[0]) => {
          setStats((prev) => ({
            ...prev,
            [model.name]: { ...prev[model.name], running: true },
          }));

          for (const test of suite.tests) {
            setCurrentTest(`${model.name} / ${test.name}`);

            try {
              const result = await runOptimizationTest({
                model,
                test,
                systemPrompt: suite.systemPrompt,
                workDir: join(workDir, model.name),
                silent: true,
              });

              allResults.push(result);
              setResults([...allResults]);

              setStats((prev) => {
                const s = prev[model.name];
                const newRun = s.testsRun + 1;
                const newCompiled = s.compiled + (result.compiled ? 1 : 0);
                const newCorrect = s.correct + (result.correct ? 1 : 0);
                const newTotalSpeedup = s.totalSpeedup + (result.correct ? result.speedup : 0);
                return {
                  ...prev,
                  [model.name]: {
                    ...s,
                    testsRun: newRun,
                    compiled: newCompiled,
                    correct: newCorrect,
                    totalSpeedup: newTotalSpeedup,
                    avgSpeedup: newCorrect > 0 ? newTotalSpeedup / newCorrect : 0,
                  },
                };
              });
            } catch (err) {
              console.error(`Error running ${model.name} on ${test.name}:`, err);
              setStats((prev) => {
                const s = prev[model.name];
                return {
                  ...prev,
                  [model.name]: { ...s, testsRun: s.testsRun + 1 },
                };
              });
            }
          }

          setStats((prev) => ({
            ...prev,
            [model.name]: { ...prev[model.name], running: false },
          }));
        };

        // process models with concurrency limit
        while (modelQueue.length > 0 || activePromises.length > 0) {
          while (activePromises.length < MAX_CONCURRENT && modelQueue.length > 0) {
            const model = modelQueue.shift()!;
            const promise = runModelTests(model).then(() => {
              const idx = activePromises.indexOf(promise);
              if (idx > -1) activePromises.splice(idx, 1);
            });
            activePromises.push(promise);
          }
          if (activePromises.length > 0) {
            await Promise.race(activePromises);
          }
        }

        // save results
        const outputDir = join(OUTPUT_DIRECTORY, suite.id, version);
        if (!existsSync(outputDir)) {
          await mkdir(outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

        // create summary for visualizer
        const modelSummaries = models.map((m) => {
          const modelResults = allResults.filter((r) => r.model === m.name);
          const correct = modelResults.filter((r) => r.correct);
          const avgSpeedup = correct.length > 0
            ? correct.reduce((sum, r) => sum + r.speedup, 0) / correct.length
            : 0;

          return {
            model: m.name,
            testsRun: modelResults.length,
            compiled: modelResults.filter((r) => r.compiled).length,
            correct: correct.length,
            avgSpeedup,
            maxSpeedup: Math.max(0, ...correct.map((r) => r.speedup)),
            avgTimeMs: modelResults.reduce((sum, r) => sum + r.duration, 0) / modelResults.length,
          };
        }).sort((a, b) => b.avgSpeedup - a.avgSpeedup);

        const summary = {
          rankings: modelSummaries,
          metadata: {
            timestamp: new Date().toISOString(),
            testSuite: suite.name,
            suiteId: suite.id,
            version,
            totalModels: models.length,
            totalTests: suite.tests.length,
          },
        };

        await writeFile(
          join(outputDir, `summary-${timestamp}.json`),
          JSON.stringify(summary, null, 2)
        );

        await writeFile(
          join(outputDir, `results-${timestamp}.json`),
          JSON.stringify({ results: allResults, metadata: summary.metadata }, null, 2)
        );

        console.log(`\n\nResults saved to: ${outputDir}/`);

        // cleanup
        await cleanupWorkDir(workDir);

        setStage("done");
      })();
    }
  }, [stage, selectedIndex, suites, version, benchRoot]);

  if (loading) {
    return <Box><Text>Scanning for optimization suites…</Text></Box>;
  }

  if (error) {
    return <Box><Text color="red">Error: {error}</Text></Box>;
  }

  if (stage === "pickSuite") {
    if (suites.length === 0) {
      return (
        <Box flexDirection="column">
          <Text>No optimization suites found in {testsDir}</Text>
        </Box>
      );
    }
    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>Compiler Optimization Benchmark</Text>
        <Text color="gray">Models: {models.map((m) => m.name).join(", ")}</Text>
        <Box marginTop={1}>
          <Text>Select a test suite:</Text>
        </Box>
        <SelectInput
          items={suites.map((s, idx) => ({
            key: String(idx),
            value: idx,
            label: `${s.suite.name} (${s.suite.tests.length} tests)`,
          }))}
          onSelect={(item: any) => {
            setSelectedIndex(item.value as number);
            setStage("version");
          }}
        />
      </Box>
    );
  }

  if (stage === "version") {
    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>Compiler Optimization Benchmark</Text>
        <Text>Version label (press Enter to start):</Text>
        <Box marginTop={1}>
          <TextInput value={version} onChange={setVersion} onSubmit={() => setStage("running")} />
        </Box>
      </Box>
    );
  }

  if (stage === "running" || stage === "done") {
    const suite = selectedIndex != null ? suites[selectedIndex]?.suite : null;
    const totalTests = models.length * (suite?.tests.length ?? 0);
    const completedTests = Object.values(stats).reduce((sum, s) => sum + s.testsRun, 0);

    const rows = models.map((m) => {
      const s = stats[m.name];
      return {
        model: m.name,
        progress: s ? `${s.testsRun}/${s.testsTotal}` : "-",
        compiled: s ? `${s.compiled}` : "-",
        correct: s ? `${s.correct}` : "-",
        speedup: s && s.avgSpeedup > 0 ? `${s.avgSpeedup.toFixed(2)}x` : "-",
        running: s?.running ?? false,
      };
    });

    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>
          {stage === "done" ? "Benchmark Complete" : "Running Benchmark"}
        </Text>
        <Text color="gray">{currentTest}</Text>

        <Box flexDirection="column" marginTop={1}>
          <Text>
            <Text underline>{pad("Model", 24)}</Text>{"  "}
            <Text underline>{pad("Progress", 10)}</Text>{"  "}
            <Text underline>{pad("Compiled", 8)}</Text>{"  "}
            <Text underline>{pad("Correct", 7)}</Text>{"  "}
            <Text underline>{pad("Avg Speedup", 11)}</Text>
          </Text>
          {rows.map((r) => (
            <Text key={r.model}>
              <Text color={r.running ? "yellow" : "white"}>{pad(r.model, 24)}</Text>{"  "}
              <Text color="gray">{padLeft(r.progress, 10)}</Text>{"  "}
              <Text color="blue">{padLeft(r.compiled, 8)}</Text>{"  "}
              <Text color="green">{padLeft(r.correct, 7)}</Text>{"  "}
              <Text color="magenta">{padLeft(r.speedup, 11)}</Text>
            </Text>
          ))}
        </Box>

        <Box marginTop={1}>
          <ProgressBar completed={completedTests} total={totalTests} />
        </Box>

        {stage === "done" && (
          <Box marginTop={1}>
            <Text color="green">Done! Results saved to ./results/{suite?.id}/{version}/</Text>
          </Box>
        )}
      </Box>
    );
  }

  return null;
};

render(<App />, { stdin, stdout, stderr });
