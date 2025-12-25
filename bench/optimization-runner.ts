// optimization benchmark runner
// compiles and benchmarks AI-optimized code against baseline

import { generateText } from "ai";
import { writeFile, readFile, mkdir, rm } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import type { RunnableModel } from "./constants";

export type OptimizationTest = {
  id: string;
  name: string;
  description: string;
  code: string; // unoptimized C code
  benchmarkIterations: number; // how many times to run for timing
  expectedOutput?: string; // for correctness check (optional)
  compilerFlags?: string[]; // e.g. ["-O0"] for baseline
};

export type OptimizationSuite = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tests: OptimizationTest[];
};

export type OptimizationResult = {
  model: string;
  testId: string;
  testName: string;

  // compilation
  compiled: boolean;
  compileError?: string;

  // correctness
  correct: boolean;
  actualOutput?: string;
  expectedOutput?: string;

  // performance
  baselineTimeMs: number;
  optimizedTimeMs: number;
  speedup: number; // baseline / optimized (>1 means faster)

  // meta
  optimizedCode?: string;
  duration: number; // time to get response from model
  tokensUsed: number;
};

async function runCommand(
  cmd: string,
  args: string[],
  options?: { timeout?: number; input?: string }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      timeout: options?.timeout ?? 30000,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => (stdout += data.toString()));
    proc.stderr.on("data", (data) => (stderr += data.toString()));

    if (options?.input) {
      proc.stdin.write(options.input);
      proc.stdin.end();
    }

    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? -1 });
    });

    proc.on("error", (err) => {
      resolve({ stdout, stderr: err.message, exitCode: -1 });
    });
  });
}

async function compileC(
  sourceFile: string,
  outputFile: string,
  flags: string[] = []
): Promise<{ success: boolean; error?: string }> {
  const result = await runCommand("gcc", [
    ...flags,
    "-o",
    outputFile,
    sourceFile,
    "-lm", // link math library
  ]);

  if (result.exitCode !== 0) {
    return { success: false, error: result.stderr };
  }
  return { success: true };
}

async function runBenchmark(
  executable: string,
  iterations: number
): Promise<{ timeMs: number; output: string; error?: string }> {
  const times: number[] = [];
  let output = "";

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await runCommand(executable, [], { timeout: 60000 });
    const elapsed = performance.now() - start;

    if (result.exitCode !== 0) {
      return { timeMs: 0, output: "", error: result.stderr || "Runtime error" };
    }

    times.push(elapsed);
    if (i === 0) output = result.stdout.trim();
  }

  // use median time
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];

  return { timeMs: median, output };
}

function extractCodeFromResponse(response: string): string | null {
  // try to find code block
  const codeBlockMatch = response.match(/```(?:c|cpp)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // if no code block, check if response looks like C code
  if (response.includes("#include") || response.includes("int main")) {
    return response.trim();
  }

  return null;
}

export async function runOptimizationTest(options: {
  model: RunnableModel;
  test: OptimizationTest;
  systemPrompt: string;
  workDir: string;
  silent?: boolean;
}): Promise<OptimizationResult> {
  const { model, test, systemPrompt, workDir, silent } = options;
  const startTime = performance.now();

  // ensure work directory exists
  if (!existsSync(workDir)) {
    await mkdir(workDir, { recursive: true });
  }

  const baselineSource = join(workDir, `${test.id}_baseline.c`);
  const baselineBinary = join(workDir, `${test.id}_baseline`);
  const optimizedSource = join(workDir, `${test.id}_optimized.c`);
  const optimizedBinary = join(workDir, `${test.id}_optimized`);

  // write and compile baseline
  await writeFile(baselineSource, test.code);
  const baselineCompile = await compileC(
    baselineSource,
    baselineBinary,
    test.compilerFlags ?? ["-O0"]
  );

  if (!baselineCompile.success) {
    return {
      model: model.name,
      testId: test.id,
      testName: test.name,
      compiled: false,
      compileError: `Baseline failed to compile: ${baselineCompile.error}`,
      correct: false,
      baselineTimeMs: 0,
      optimizedTimeMs: 0,
      speedup: 0,
      duration: performance.now() - startTime,
      tokensUsed: 0,
    };
  }

  // run baseline benchmark
  const baselineRun = await runBenchmark(baselineBinary, test.benchmarkIterations);
  if (baselineRun.error) {
    return {
      model: model.name,
      testId: test.id,
      testName: test.name,
      compiled: false,
      compileError: `Baseline runtime error: ${baselineRun.error}`,
      correct: false,
      baselineTimeMs: 0,
      optimizedTimeMs: 0,
      speedup: 0,
      duration: performance.now() - startTime,
      tokensUsed: 0,
    };
  }

  // get optimization from model
  const prompt = `Optimize this C code for maximum performance. Return ONLY the optimized code, no explanations.

\`\`\`c
${test.code}
\`\`\``;

  let optimizedCode: string | null = null;
  let tokensUsed = 0;

  try {
    const result = await generateText({
      model: model.llm,
      system: systemPrompt,
      prompt,
      temperature: 0.3,
      providerOptions: model.providerOptions,
    });

    tokensUsed = result.usage?.totalTokens ?? 0;
    optimizedCode = extractCodeFromResponse(result.text);

    if (!optimizedCode) {
      return {
        model: model.name,
        testId: test.id,
        testName: test.name,
        compiled: false,
        compileError: "Could not extract code from model response",
        correct: false,
        baselineTimeMs: baselineRun.timeMs,
        optimizedTimeMs: 0,
        speedup: 0,
        duration: performance.now() - startTime,
        tokensUsed,
      };
    }
  } catch (err) {
    return {
      model: model.name,
      testId: test.id,
      testName: test.name,
      compiled: false,
      compileError: `Model error: ${err}`,
      correct: false,
      baselineTimeMs: baselineRun.timeMs,
      optimizedTimeMs: 0,
      speedup: 0,
      duration: performance.now() - startTime,
      tokensUsed: 0,
    };
  }

  // write and compile optimized code
  await writeFile(optimizedSource, optimizedCode);
  const optimizedCompile = await compileC(
    optimizedSource,
    optimizedBinary,
    ["-O3", "-march=native"] // let gcc also optimize
  );

  if (!optimizedCompile.success) {
    return {
      model: model.name,
      testId: test.id,
      testName: test.name,
      compiled: false,
      compileError: optimizedCompile.error,
      correct: false,
      baselineTimeMs: baselineRun.timeMs,
      optimizedTimeMs: 0,
      speedup: 0,
      optimizedCode,
      duration: performance.now() - startTime,
      tokensUsed,
    };
  }

  // run optimized benchmark
  const optimizedRun = await runBenchmark(optimizedBinary, test.benchmarkIterations);
  if (optimizedRun.error) {
    return {
      model: model.name,
      testId: test.id,
      testName: test.name,
      compiled: true,
      correct: false,
      compileError: `Optimized runtime error: ${optimizedRun.error}`,
      baselineTimeMs: baselineRun.timeMs,
      optimizedTimeMs: 0,
      speedup: 0,
      optimizedCode,
      duration: performance.now() - startTime,
      tokensUsed,
    };
  }

  // check correctness
  const correct =
    !test.expectedOutput ||
    optimizedRun.output === test.expectedOutput ||
    optimizedRun.output === baselineRun.output;

  // calculate speedup
  const speedup =
    optimizedRun.timeMs > 0 ? baselineRun.timeMs / optimizedRun.timeMs : 0;

  if (!silent) {
    console.log(
      `${model.name} | ${test.name}: ${speedup.toFixed(2)}x speedup (${baselineRun.timeMs.toFixed(1)}ms -> ${optimizedRun.timeMs.toFixed(1)}ms)`
    );
  }

  return {
    model: model.name,
    testId: test.id,
    testName: test.name,
    compiled: true,
    correct,
    actualOutput: optimizedRun.output,
    expectedOutput: test.expectedOutput ?? baselineRun.output,
    baselineTimeMs: baselineRun.timeMs,
    optimizedTimeMs: optimizedRun.timeMs,
    speedup,
    optimizedCode,
    duration: performance.now() - startTime,
    tokensUsed,
  };
}

// cleanup work directory
export async function cleanupWorkDir(workDir: string) {
  if (existsSync(workDir)) {
    await rm(workDir, { recursive: true, force: true });
  }
}
