"use client";

import { useState, useMemo, type ComponentPropsWithoutRef } from "react";
import {
  Trophy,
  DollarSign,
  Clock,
  Target,
  TrendingUp,
  Filter,
  ChevronDown,
  Sparkles,
  Calendar,
  Grid3X3,
  X,
  Code,
  Zap,
  Cpu,
  Gauge,
} from "lucide-react";
import benchmarkData from "../data/benchmark-results.json";
import detailsData from "../data/benchmark-details.json";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ScatterChart,
  Scatter,
  Cell,
  LabelList,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useIsMobile } from "@/hooks/use-mobile";

const OptiBenchLogo = ({ className }: { className?: string }) => (
  <div className={`relative ${className}`}>
    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl blur-lg opacity-50" />
    <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 shadow-lg shadow-emerald-500/25">
      <Zap className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2.5} />
    </div>
  </div>
);

interface ModelData {
  model: string;
  // old Q&A format
  correct?: number;
  incorrect?: number;
  errors?: number;
  totalTests?: number;
  successRate?: number;
  errorRate?: number;
  averageDuration?: number;
  totalCost?: number;
  averageCostPerTest?: number;
  // new optimization format
  testsRun?: number;
  compiled?: number;
  avgSpeedup?: number;
  maxSpeedup?: number;
  avgTimeMs?: number;
}

interface TestResult {
  model: string;
  testId: string;
  testName: string;
  compiled: boolean;
  correct: boolean;
  speedup: number;
  baselineTimeMs: number;
  optimizedTimeMs: number;
  duration: number;
  compileError?: string;
  optimizedCode?: string;
}

interface DetailsData {
  results: TestResult[];
  metadata?: any;
}

function withAlpha(color: string, alpha: number) {
  if (color.startsWith("hsl("))
    return color.replace("hsl(", "hsla(").replace(")", `, ${alpha})`);
  if (color.startsWith("rgb("))
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  return color;
}

function getGradientId(prefix: string, model: string) {
  return `${prefix}-${model.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function currency(n: number) {
  return `$${n.toFixed(2)}`;
}

function barValueLabel(suffix: string, decimals: number) {
  return (props: any) => {
    const x = Number(props?.x ?? 0);
    const y = Number(props?.y ?? 0);
    const width = Number(props?.width ?? 0);
    const value = Number(props?.value ?? 0);
    const cx = x + width / 2;
    const cy = y - 6;
    return (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        className="pointer-events-none text-xs font-medium fill-neutral-300"
      >
        {value.toFixed(decimals)}
        {suffix}
      </text>
    );
  };
}

function barValueLabelHorizontal(suffix: string, decimals: number) {
  return (props: any) => {
    const x = Number(props?.x ?? 0);
    const y = Number(props?.y ?? 0);
    const width = Number(props?.width ?? 0);
    const height = Number(props?.height ?? 0);
    const value = Number(props?.value ?? 0);
    const cx = x + width + 6;
    const cy = y + height / 2;
    return (
      <text
        x={cx}
        y={cy}
        dy={3}
        textAnchor="start"
        className="pointer-events-none text-xs font-medium fill-neutral-300"
      >
        {value.toFixed(decimals)}
        {suffix}
      </text>
    );
  };
}

function barValueLabelHorizontalSmart(
  suffix: string,
  decimals: number,
  maxValue: number
) {
  return (props: any) => {
    const x = Number(props?.x ?? 0);
    const y = Number(props?.y ?? 0);
    const width = Number(props?.width ?? 0);
    const height = Number(props?.height ?? 0);
    const value = Number(props?.value ?? 0);
    const ratio = maxValue > 0 ? value / maxValue : 0;
    const inside = ratio >= 0.75; // place inside for longer bars
    const tx = inside ? x + width - 6 : x + width + 6;
    const anchor: any = inside ? "end" : "start";
    const cls = inside
      ? "pointer-events-none text-[10px] font-medium fill-neutral-50"
      : "pointer-events-none text-[10px] font-medium fill-neutral-300";
    return (
      <text
        x={tx}
        y={y + height / 2}
        dy={3}
        textAnchor={anchor}
        className={cls}
      >
        {value.toFixed(decimals)}
        {suffix}
      </text>
    );
  };
}

function truncateLabel(input: unknown, max = 14) {
  const label = String(input ?? "");
  if (label.length <= max) return label;
  return label.slice(0, Math.max(1, max - 1)) + "…";
}

function getSpeedupColor(speedup: number, compiled: boolean, correct: boolean) {
  if (!compiled) return "bg-red-900/50 text-red-300";
  if (!correct) return "bg-orange-900/50 text-orange-300";
  if (speedup >= 50) return "bg-green-600/70 text-green-100";
  if (speedup >= 10) return "bg-green-700/60 text-green-200";
  if (speedup >= 2) return "bg-emerald-800/50 text-emerald-200";
  if (speedup >= 1) return "bg-teal-900/50 text-teal-200";
  return "bg-yellow-900/50 text-yellow-300";
}

function PerTestBreakdown({
  details,
  rankings,
  selectedModels,
  getModelColor,
}: {
  details: DetailsData;
  rankings: ModelData[];
  selectedModels: string[];
  getModelColor: (model: string) => string;
}) {
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);
  const results = details?.results ?? [];

  // get unique tests and models
  const testIds = [...new Set(results.map((r) => r.testId))];
  const testNames = Object.fromEntries(
    results.map((r) => [r.testId, r.testName])
  );
  const modelNames = rankings
    .map((r) => r.model)
    .filter((m) => selectedModels.includes(m));

  // build lookup map: model -> testId -> result
  const resultMap = new Map<string, Map<string, TestResult>>();
  for (const r of results) {
    if (!resultMap.has(r.model)) {
      resultMap.set(r.model, new Map());
    }
    resultMap.get(r.model)!.set(r.testId, r);
  }

  // find best speedup per test (for highlighting)
  const bestPerTest = new Map<string, number>();
  for (const testId of testIds) {
    let best = 0;
    for (const model of modelNames) {
      const r = resultMap.get(model)?.get(testId);
      if (r && r.correct && r.speedup > best) {
        best = r.speedup;
      }
    }
    bestPerTest.set(testId, best);
  }

  if (testIds.length === 0) {
    return (
      <Card className="border-neutral-800 bg-neutral-900/70">
        <CardContent className="py-8 text-center text-neutral-400">
          No per-test data available. Run a benchmark first.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Dialog open={!!selectedResult} onOpenChange={(open) => !open && setSelectedResult(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden bg-neutral-900/95 backdrop-blur-xl border-neutral-700/50 rounded-2xl shadow-2xl shadow-black/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-sky-500/20">
                <Code className="h-4 w-4 text-cyan-400" />
              </div>
              <div>
                <span className="text-neutral-400 text-sm font-normal">{selectedResult?.model}</span>
                <span className="mx-2 text-neutral-600">→</span>
                {selectedResult?.testName}
              </div>
            </DialogTitle>
            <DialogDescription className="text-neutral-500 flex items-center gap-3 mt-2">
              {selectedResult?.compiled ? (
                selectedResult?.correct ? (
                  <>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Zap className="w-3 h-3 mr-1" />
                      {selectedResult.speedup.toFixed(2)}x faster
                    </Badge>
                    <span className="text-neutral-600">
                      {selectedResult.baselineTimeMs.toFixed(1)}ms → {selectedResult.optimizedTimeMs.toFixed(1)}ms
                    </span>
                  </>
                ) : (
                  <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Wrong output
                  </Badge>
                )
              ) : (
                <Badge className="bg-red-500/10 text-red-400 border border-red-500/20">
                  Compile failed
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] mt-4">
            {selectedResult?.compileError ? (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-red-400 flex items-center gap-2">
                  <X className="w-4 h-4" /> Compile Error
                </h4>
                <pre className="p-4 rounded-xl bg-red-950/20 border border-red-900/30 text-red-200 text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                  {selectedResult.compileError}
                </pre>
              </div>
            ) : null}
            {selectedResult?.optimizedCode ? (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
                  <Code className="w-4 h-4 text-cyan-400" /> Optimized Code
                </h4>
                <pre className="p-4 rounded-xl bg-neutral-950/50 border border-neutral-800/50 text-neutral-200 text-xs overflow-x-auto font-mono leading-relaxed">
                  {selectedResult.optimizedCode}
                </pre>
              </div>
            ) : (
              <p className="text-neutral-500">No code available</p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Card className="overflow-hidden rounded-2xl border-neutral-800/50 bg-neutral-900/50 backdrop-blur-sm shadow-xl shadow-black/20">
        <CardHeader className="pb-2 border-b border-neutral-800/50">
          <CardTitle className="flex items-center gap-3 text-white">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-sky-500/20">
              <Grid3X3 className="h-4 w-4 text-cyan-400" />
            </div>
            Optimization Heatmap
          </CardTitle>
          <CardDescription className="text-neutral-500">
            Click any cell to view the generated code. Green = best performer per test.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <ScrollArea className="w-full">
            <div className="min-w-[600px]">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-neutral-900/90 backdrop-blur-sm px-4 py-3 text-left font-medium text-neutral-400 border-b border-neutral-800/50 uppercase text-xs tracking-wider">
                      Model
                  </th>
                  {testIds.map((testId) => (
                    <th
                      key={testId}
                      className="px-3 py-3 text-center font-medium text-neutral-500 border-b border-neutral-800/50 whitespace-nowrap text-xs uppercase tracking-wider"
                      title={testNames[testId]}
                    >
                      {truncateLabel(testNames[testId], 10)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-semibold text-emerald-400 border-b border-neutral-800/50 uppercase text-xs tracking-wider">
                    Avg
                  </th>
                </tr>
              </thead>
              <tbody>
                {modelNames.map((model, idx) => {
                  const modelResults = resultMap.get(model);
                  const correctResults = testIds
                    .map((t) => modelResults?.get(t))
                    .filter((r) => r?.correct);
                  const avgSpeedup =
                    correctResults.length > 0
                      ? correctResults.reduce((s, r) => s + (r?.speedup ?? 0), 0) /
                        correctResults.length
                      : 0;

                  return (
                    <tr key={model} className="group hover:bg-neutral-800/30 transition-colors">
                      <td className="sticky left-0 z-10 bg-neutral-900/90 backdrop-blur-sm px-4 py-3 border-b border-neutral-800/30">
                        <div className="flex items-center gap-3">
                          <span className="text-neutral-600 text-xs font-mono w-4">{idx + 1}</span>
                          <div
                            className="h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-white/10"
                            style={{ backgroundColor: getModelColor(model) }}
                          />
                          <span className="text-neutral-200 truncate max-w-[140px] font-medium">
                            {model}
                          </span>
                        </div>
                      </td>
                      {testIds.map((testId) => {
                        const r = modelResults?.get(testId);
                        const isBest =
                          r?.correct &&
                          r.speedup > 0 &&
                          r.speedup === bestPerTest.get(testId);

                        if (!r) {
                          return (
                            <td
                              key={testId}
                              className="px-3 py-3 text-center border-b border-neutral-800/30 text-neutral-700"
                            >
                              -
                            </td>
                          );
                        }

                        const colorClass = getSpeedupColor(
                          r.speedup,
                          r.compiled,
                          r.correct
                        );

                        return (
                          <td
                            key={testId}
                            className={`px-3 py-3 text-center border-b border-neutral-800/30 cursor-pointer transition-all hover:scale-105 hover:z-10 ${colorClass} ${
                              isBest ? "ring-2 ring-emerald-400/50 ring-inset shadow-lg shadow-emerald-500/20" : ""
                            }`}
                            title={
                              r.compiled
                                ? r.correct
                                  ? `${r.speedup.toFixed(2)}x speedup`
                                  : "Wrong output"
                                : "Compile error"
                            }
                            onClick={() => setSelectedResult(r)}
                          >
                            {r.compiled
                              ? r.correct
                                ? `${r.speedup.toFixed(1)}x`
                                : "✗"
                              : "err"}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right border-b border-neutral-800/30 font-bold">
                        {avgSpeedup > 0 ? (
                          <span className="text-emerald-400">{avgSpeedup.toFixed(1)}x</span>
                        ) : (
                          <span className="text-neutral-600">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
    </>
  );
}

export default function BenchmarkVisualizer() {
  const { rankings, metadata } = benchmarkData as {
    rankings: ModelData[];
    metadata: any;
  };

  const [selectedModels, setSelectedModels] = useState<string[]>(
    rankings.map((m) => m.model)
  );

  const filteredRankings = rankings.filter((m) =>
    selectedModels.includes(m.model)
  );

  const isMobile = useIsMobile();
  const mobileBarHeight = Math.max(320, filteredRankings.length * 36 + 120);

  // detect if this is optimization format (has avgSpeedup) or Q&A format (has successRate)
  const isOptimFormat = rankings[0]?.avgSpeedup !== undefined;

  const totalTestsPerModel = rankings[0]?.totalTests ?? rankings[0]?.testsRun ?? 0;

  // main metric: speedup for optim, successRate for Q&A
  const mainMetricData = filteredRankings
    .map((m) => ({
      model: m.model,
      value: isOptimFormat
        ? Number((m.avgSpeedup ?? 0).toFixed(2))
        : Number((m.successRate ?? 0).toFixed(1)),
      compiled: m.compiled ?? m.correct ?? 0,
      total: m.testsRun ?? m.totalTests ?? 0,
    }))
    .sort((a, b) => b.value - a.value);

  // for backwards compatibility
  const successRateData = mainMetricData.map((d) => ({
    model: d.model,
    successRate: isOptimFormat ? d.value : d.value,
    correct: d.compiled,
    total: d.total,
  }));

  const costData = filteredRankings
    .map((m) => ({
      model: m.model,
      totalCost: Number((m.totalCost ?? 0).toFixed(4)),
    }))
    .sort((a, b) => a.totalCost - b.totalCost);

  const speedData = filteredRankings
    .map((m) => ({
      model: m.model,
      duration: Number(((m.averageDuration ?? m.avgTimeMs ?? 0) / 1000).toFixed(2)),
      durationMs: m.averageDuration ?? m.avgTimeMs ?? 0,
    }))
    .sort((a, b) => a.duration - b.duration);

  const performanceData = filteredRankings.map((m) => ({
    model: m.model.replace(/-/g, " "),
    originalModel: m.model,
    successRate: isOptimFormat ? (m.avgSpeedup ?? 0) : (m.successRate ?? 0),
    totalCost: m.totalCost ?? 0,
    duration: (m.averageDuration ?? m.avgTimeMs ?? 0) / 1000,
  }));

  // compute highlights from details
  const details = (detailsData as DetailsData)?.results ?? [];
  const highlights = useMemo(() => {
    if (!isOptimFormat || details.length === 0) return null;

    // find best single speedup
    let bestSingle = { model: "", test: "", speedup: 0 };
    for (const r of details) {
      if (r.correct && r.speedup > bestSingle.speedup) {
        bestSingle = { model: r.model, test: r.testName, speedup: r.speedup };
      }
    }

    // find best average model
    const topModel = rankings[0];

    // find hardest test (lowest average speedup)
    const testSpeedups = new Map<string, { total: number; count: number; name: string }>();
    for (const r of details) {
      if (!testSpeedups.has(r.testId)) {
        testSpeedups.set(r.testId, { total: 0, count: 0, name: r.testName });
      }
      if (r.correct) {
        const t = testSpeedups.get(r.testId)!;
        t.total += r.speedup;
        t.count++;
      }
    }
    let hardestTest = { id: "", name: "", avgSpeedup: Infinity };
    let easiestTest = { id: "", name: "", avgSpeedup: 0 };
    for (const [id, data] of testSpeedups) {
      const avg = data.count > 0 ? data.total / data.count : 0;
      if (avg > 0 && avg < hardestTest.avgSpeedup) {
        hardestTest = { id, name: data.name, avgSpeedup: avg };
      }
      if (avg > easiestTest.avgSpeedup) {
        easiestTest = { id, name: data.name, avgSpeedup: avg };
      }
    }

    // count compile failures per model
    const compileFailures = new Map<string, number>();
    for (const r of details) {
      if (!r.compiled) {
        compileFailures.set(r.model, (compileFailures.get(r.model) ?? 0) + 1);
      }
    }
    const mostReliable = [...compileFailures.entries()]
      .sort((a, b) => a[1] - b[1])[0];

    return {
      bestSingle,
      topModel: topModel?.model,
      topModelSpeedup: topModel?.avgSpeedup ?? 0,
      hardestTest,
      easiestTest,
      mostReliable: mostReliable?.[0] ?? rankings[0]?.model,
    };
  }, [details, rankings, isOptimFormat]);

  const getModelColor = (modelName: string) => {
    const colors = [
      "hsl(0, 75%, 60%)",
      "hsl(20, 85%, 60%)",
      "hsl(40, 90%, 60%)",
      "hsl(60, 85%, 55%)",
      "hsl(90, 75%, 55%)",
      "hsl(140, 70%, 50%)",
      "hsl(190, 75%, 55%)",
      "hsl(220, 80%, 60%)",
      "hsl(260, 75%, 65%)",
      "hsl(300, 70%, 65%)",
      "hsl(330, 70%, 60%)",
      "hsl(280, 60%, 62%)",
    ];
    const index = rankings.findIndex((r) => r.model === modelName);
    return colors[(index + colors.length) % colors.length];
  };

  const handleModelToggle = (modelName: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelName)
        ? prev.filter((m) => m !== modelName)
        : [...prev, modelName]
    );
  };
  const handleSelectAll = () => setSelectedModels(rankings.map((m) => m.model));
  const handleDeselectAll = () => setSelectedModels([]);

  const costMax = Math.max(0, ...costData.map((d) => d.totalCost));
  const speedMax = Math.max(0, ...speedData.map((d) => d.duration));

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-neutral-950 text-neutral-100">
      {/* background gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_1400px_900px_at_0%_0%,rgba(16,185,129,0.15),transparent_60%),radial-gradient(ellipse_1200px_800px_at_100%_0%,rgba(6,182,212,0.12),transparent_60%),radial-gradient(ellipse_800px_600px_at_50%_100%,rgba(20,184,166,0.08),transparent_60%)]" />
      {/* grid pattern overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <header className="relative mx-auto max-w-7xl px-4 pt-8 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <OptiBenchLogo />
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                OptiBench
              </h1>
              <p className="mt-0.5 text-sm text-neutral-400 flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5" />
                AI Compiler Optimization Benchmark
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20">
              <Gauge className="mr-1.5 h-3 w-3" />
              {metadata?.totalTests ?? 6} tests
            </Badge>
            <Badge className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20">
              <Cpu className="mr-1.5 h-3 w-3" />
              {metadata?.totalModels ?? rankings.length} models
            </Badge>
            {metadata?.timestamp ? (
              <Badge variant="outline" className="border-neutral-700/50 text-neutral-400 bg-neutral-900/50">
                <Calendar className="mr-1.5 h-3 w-3" />
                {new Date(metadata.timestamp).toLocaleDateString()}
              </Badge>
            ) : null}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 pb-16">
        {highlights && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* best single speedup */}
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 p-5 transition-all hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/20 to-transparent rounded-bl-full" />
              <Trophy className="h-5 w-5 text-amber-400 mb-3" />
              <div className="text-3xl font-bold text-white mb-1">
                {highlights.bestSingle.speedup.toFixed(1)}<span className="text-xl text-amber-400">x</span>
              </div>
              <div className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Peak Speedup</div>
              <div className="text-sm text-neutral-300 truncate" title={`${highlights.bestSingle.model} on ${highlights.bestSingle.test}`}>
                {truncateLabel(highlights.bestSingle.model, 18)}
              </div>
            </div>

            {/* top model */}
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 p-5 transition-all hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/20 to-transparent rounded-bl-full" />
              <Sparkles className="h-5 w-5 text-emerald-400 mb-3" />
              <div className="text-3xl font-bold text-white mb-1">
                {highlights.topModelSpeedup.toFixed(1)}<span className="text-xl text-emerald-400">x</span>
              </div>
              <div className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Best Average</div>
              <div className="text-sm text-neutral-300 truncate">
                {truncateLabel(highlights.topModel ?? "-", 18)}
              </div>
            </div>

            {/* easiest test */}
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/10 via-sky-500/5 to-transparent border border-cyan-500/20 p-5 transition-all hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/5">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/20 to-transparent rounded-bl-full" />
              <TrendingUp className="h-5 w-5 text-cyan-400 mb-3" />
              <div className="text-3xl font-bold text-white mb-1">
                {highlights.easiestTest.avgSpeedup.toFixed(1)}<span className="text-xl text-cyan-400">x</span>
              </div>
              <div className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Easiest Test</div>
              <div className="text-sm text-neutral-300 truncate" title={highlights.easiestTest.name}>
                {truncateLabel(highlights.easiestTest.name, 18)}
              </div>
            </div>

            {/* hardest test */}
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-transparent border border-rose-500/20 p-5 transition-all hover:border-rose-500/40 hover:shadow-lg hover:shadow-rose-500/5">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-rose-500/20 to-transparent rounded-bl-full" />
              <Target className="h-5 w-5 text-rose-400 mb-3" />
              <div className="text-3xl font-bold text-white mb-1">
                {highlights.hardestTest.avgSpeedup === Infinity ? "-" : <>{highlights.hardestTest.avgSpeedup.toFixed(1)}<span className="text-xl text-rose-400">x</span></>}
              </div>
              <div className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Hardest Test</div>
              <div className="text-sm text-neutral-300 truncate" title={highlights.hardestTest.name}>
                {truncateLabel(highlights.hardestTest.name || "-", 18)}
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="accuracy" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <TabsList className="max-w-full overflow-x-auto overflow-y-hidden whitespace-nowrap rounded-2xl border border-neutral-800/50 bg-neutral-900/50 backdrop-blur-sm p-1.5 shadow-lg shadow-black/20">
              <TabsTrigger
                value="accuracy"
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-neutral-400 transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-emerald-500/20"
              >
                <Zap className="h-4 w-4" /> Speedup
              </TabsTrigger>
              <TabsTrigger
                value="pertest"
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-neutral-400 transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-sky-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-cyan-500/20"
              >
                <Grid3X3 className="h-4 w-4" /> Heatmap
              </TabsTrigger>
              <TabsTrigger
                value="speed"
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-neutral-400 transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-violet-500/20"
              >
                <Clock className="h-4 w-4" /> Latency
              </TabsTrigger>
              <TabsTrigger
                value="combined"
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-neutral-400 transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-amber-500/20"
              >
                <TrendingUp className="h-4 w-4" /> Overview
              </TabsTrigger>
            </TabsList>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="rounded-xl border-neutral-700/50 bg-neutral-900/50 text-neutral-300 hover:bg-neutral-800 hover:text-white hover:border-neutral-600 transition-all sm:w-auto"
                >
                  <Filter className="mr-2 h-4 w-4" /> Models
                  <Badge className="ml-2 bg-emerald-500/20 text-emerald-400 border-0 text-xs">
                    {selectedModels.length}/{rankings.length}
                  </Badge>
                  <ChevronDown className="ml-2 h-4 w-4 text-neutral-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80 border-neutral-700/50 bg-neutral-900/95 text-white backdrop-blur-xl rounded-xl shadow-xl shadow-black/30">
                <DropdownMenuLabel className="text-neutral-300 font-medium">
                  Filter Models
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-neutral-700" />
                <div className="flex gap-2 p-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSelectAll}
                    className="flex-1 border-neutral-600 bg-neutral-800 hover:bg-neutral-700"
                  >
                    Select all
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDeselectAll}
                    className="flex-1 border-neutral-600 bg-neutral-800 hover:bg-neutral-700"
                  >
                    Clear
                  </Button>
                </div>
                <DropdownMenuSeparator className="bg-neutral-700" />
                <ScrollArea className="h-80">
                  {rankings.map((m) => (
                    <DropdownMenuItem
                      key={m.model}
                      className="group flex items-center gap-3 py-2 hover:bg-neutral-800 focus:bg-neutral-800"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Checkbox
                        id={m.model}
                        checked={selectedModels.includes(m.model)}
                        onCheckedChange={() => handleModelToggle(m.model)}
                        className="border-neutral-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: getModelColor(m.model) }}
                        />
                        <label
                          htmlFor={m.model}
                          className="cursor-pointer truncate text-sm text-neutral-200"
                        >
                          {m.model}
                        </label>
                      </div>
                      <Badge className="ml-auto bg-neutral-800 text-neutral-200">
                        {isOptimFormat
                          ? `${(m.avgSpeedup ?? 0).toFixed(2)}x`
                          : `${(m.successRate ?? 0).toFixed(1)}%`}
                      </Badge>
                    </DropdownMenuItem>
                  ))}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <TabsContent value="accuracy">
            <Card className="overflow-hidden rounded-2xl border-neutral-800/50 bg-neutral-900/50 backdrop-blur-sm shadow-xl shadow-black/20">
              <CardHeader className="pb-2 border-b border-neutral-800/50">
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                    <Zap className="h-4 w-4 text-emerald-400" />
                  </div>
                  Average Speedup by Model
                </CardTitle>
                <CardDescription className="text-neutral-500">
                  How much faster the optimized code runs compared to baseline
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    successRate: {
                      label: "Success Rate",
                      color: "hsl(142, 76%, 36%)",
                    },
                  }}
                  className="h-[420px] sm:h-[520px] w-full"
                  style={isMobile ? { height: mobileBarHeight } : undefined}
                >
                  <BarChart
                    data={successRateData}
                    layout={isMobile ? "vertical" : "horizontal"}
                    margin={
                      isMobile
                        ? { top: 10, right: 24, left: 140, bottom: 24 }
                        : { top: 10, right: 24, left: 12, bottom: 64 }
                    }
                  >
                    <defs>
                      {successRateData.map((d) => {
                        const base = getModelColor(d.model);
                        const id = getGradientId("sr", d.model);
                        return (
                          <linearGradient
                            key={id}
                            id={id}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={withAlpha(base, 0.95)}
                            />
                            <stop
                              offset="100%"
                              stopColor={withAlpha(base, 0.55)}
                            />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#303341" />
                    {isMobile ? (
                      <>
                        <XAxis
                          type="number"
                          domain={isOptimFormat ? [0, "auto"] : [0, 100]}
                          label={{
                            value: isOptimFormat ? "Speedup (x)" : "Success Rate (%)",
                            position: "insideBottom",
                            offset: -10,
                            fill: "#9ca3af",
                          }}
                          stroke="#9ca3af"
                        />
                        <YAxis
                          type="category"
                          dataKey="model"
                          width={12}
                          tick={{ fontSize: 12, fill: "#9ca3af" }}
                          tickFormatter={(v: string) => truncateLabel(v)}
                          stroke="#9ca3af"
                        />
                      </>
                    ) : (
                      <>
                        <XAxis
                          dataKey="model"
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          fontSize={12}
                          stroke="#9ca3af"
                        />
                        <YAxis
                          label={{
                            value: isOptimFormat ? "Speedup (x)" : "Success Rate (%)",
                            angle: -90,
                            position: "insideLeft",
                            fill: "#9ca3af",
                          }}
                          domain={isOptimFormat ? [0, "auto"] : [0, 100]}
                          stroke="#9ca3af"
                        />
                      </>
                    )}
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value: any) => [isOptimFormat ? `${value}x Speedup` : `${value}% Success Rate`]}
                      labelFormatter={(label: string) => `Model: ${label}`}
                    />
                    <Bar
                      dataKey="successRate"
                      radius={isMobile ? [0, 6, 6, 0] : [6, 6, 0, 0]}
                    >
                      <LabelList
                        dataKey="successRate"
                        position={isMobile ? "right" : "top"}
                        content={
                          isMobile
                            ? barValueLabelHorizontalSmart(isOptimFormat ? "x" : "%", isOptimFormat ? 2 : 1, isOptimFormat ? Math.max(...successRateData.map(d => d.successRate)) : 100)
                            : barValueLabel(isOptimFormat ? "x" : "%", isOptimFormat ? 2 : 1)
                        }
                      />
                      {successRateData.map((entry) => (
                        <Cell
                          key={entry.model}
                          fill={`url(#${getGradientId("sr", entry.model)})`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cost">
            <Card className="border-neutral-800 bg-neutral-900/70 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-white">
                  <DollarSign className="h-5 w-5 text-blue-400" /> Cost
                  efficiency by model
                </CardTitle>
                <CardDescription className="text-neutral-400">
                  Average cost per test in cents (lower is better)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    totalCost: {
                      label: "Cost per Test",
                      color: "hsl(217, 91%, 60%)",
                    },
                  }}
                  className="h-[420px] sm:h-[520px] w-full"
                  style={isMobile ? { height: mobileBarHeight } : undefined}
                >
                  <BarChart
                    data={costData}
                    layout={isMobile ? "vertical" : "horizontal"}
                    margin={
                      isMobile
                        ? { top: 10, right: 24, left: 140, bottom: 24 }
                        : { top: 10, right: 24, left: 12, bottom: 64 }
                    }
                  >
                    <defs>
                      {costData.map((d) => {
                        const base = getModelColor(d.model);
                        const id = getGradientId("ct", d.model);
                        return (
                          <linearGradient
                            key={id}
                            id={id}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={withAlpha(base, 0.95)}
                            />
                            <stop
                              offset="100%"
                              stopColor={withAlpha(base, 0.55)}
                            />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#303341" />
                    {isMobile ? (
                      <>
                        <XAxis
                          type="number"
                          label={{
                            value: "Cost to run tests",
                            position: "insideBottom",
                            offset: -10,
                            fill: "#9ca3af",
                          }}
                          stroke="#9ca3af"
                        />
                        <YAxis
                          type="category"
                          dataKey="model"
                          width={12}
                          tick={{ fontSize: 12, fill: "#9ca3af" }}
                          tickFormatter={(v: string) => truncateLabel(v)}
                          stroke="#9ca3af"
                        />
                      </>
                    ) : (
                      <>
                        <XAxis
                          dataKey="model"
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          fontSize={12}
                          stroke="#9ca3af"
                        />
                        <YAxis
                          label={{
                            value: "Cost per Test (¢)",
                            angle: -90,
                            position: "insideLeft",
                            fill: "#9ca3af",
                          }}
                          stroke="#9ca3af"
                        />
                      </>
                    )}
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value: any) => [
                        `Avg cost: \$${value} per test`,
                      ]}
                      labelFormatter={(label: string) => `Model: ${label}`}
                    />
                    <Bar
                      dataKey="totalCost"
                      radius={isMobile ? [0, 6, 6, 0] : [6, 6, 0, 0]}
                    >
                      <LabelList
                        dataKey="totalCost"
                        position={isMobile ? "right" : "top"}
                        content={
                          isMobile
                            ? barValueLabelHorizontalSmart("", 2, costMax || 1)
                            : barValueLabel("", 2)
                        }
                      />
                      {costData.map((entry) => (
                        <Cell
                          key={entry.model}
                          fill={`url(#${getGradientId("ct", entry.model)})`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="speed">
            <Card className="overflow-hidden rounded-2xl border-neutral-800/50 bg-neutral-900/50 backdrop-blur-sm shadow-xl shadow-black/20">
              <CardHeader className="pb-2 border-b border-neutral-800/50">
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                    <Clock className="h-4 w-4 text-violet-400" />
                  </div>
                  Response Latency by Model
                </CardTitle>
                <CardDescription className="text-neutral-500">
                  Average time to generate optimized code (lower is better)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    duration: {
                      label: "Response Time",
                      color: "hsl(262, 83%, 58%)",
                    },
                  }}
                  className="h-[420px] sm:h-[520px] w-full"
                  style={isMobile ? { height: mobileBarHeight } : undefined}
                >
                  <BarChart
                    data={speedData}
                    layout={isMobile ? "vertical" : "horizontal"}
                    margin={
                      isMobile
                        ? { top: 10, right: 24, left: 140, bottom: 24 }
                        : { top: 10, right: 24, left: 12, bottom: 64 }
                    }
                  >
                    <defs>
                      {speedData.map((d) => {
                        const base = getModelColor(d.model);
                        const id = getGradientId("sp", d.model);
                        return (
                          <linearGradient
                            key={id}
                            id={id}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={withAlpha(base, 0.95)}
                            />
                            <stop
                              offset="100%"
                              stopColor={withAlpha(base, 0.55)}
                            />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#303341" />
                    {isMobile ? (
                      <>
                        <XAxis
                          type="number"
                          label={{
                            value: "Response Time (s)",
                            position: "insideBottom",
                            offset: -10,
                            fill: "#9ca3af",
                          }}
                          stroke="#9ca3af"
                        />
                        <YAxis
                          type="category"
                          dataKey="model"
                          width={12}
                          tick={{ fontSize: 12, fill: "#9ca3af" }}
                          tickFormatter={(v: string) => truncateLabel(v)}
                          stroke="#9ca3af"
                        />
                      </>
                    ) : (
                      <>
                        <XAxis
                          dataKey="model"
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          fontSize={12}
                          stroke="#9ca3af"
                        />
                        <YAxis
                          label={{
                            value: "Response Time (s)",
                            angle: -90,
                            position: "insideLeft",
                            fill: "#9ca3af",
                          }}
                          stroke="#9ca3af"
                        />
                      </>
                    )}
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value: any) => [
                        `Average response time: ${value} seconds`,
                      ]}
                      labelFormatter={(label: string) => `Model: ${label}`}
                    />
                    <Bar
                      dataKey="duration"
                      radius={isMobile ? [0, 6, 6, 0] : [6, 6, 0, 0]}
                    >
                      <LabelList
                        dataKey="duration"
                        position={isMobile ? "right" : "top"}
                        content={
                          isMobile
                            ? barValueLabelHorizontalSmart(
                                "s",
                                2,
                                speedMax || 1
                              )
                            : barValueLabel("s", 2)
                        }
                      />
                      {speedData.map((entry) => (
                        <Cell
                          key={entry.model}
                          fill={`url(#${getGradientId("sp", entry.model)})`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="combined">
            <Card className="overflow-hidden rounded-2xl border-neutral-800/50 bg-neutral-900/50 backdrop-blur-sm shadow-xl shadow-black/20">
              <CardHeader className="pb-2 border-b border-neutral-800/50">
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                    <TrendingUp className="h-4 w-4 text-amber-400" />
                  </div>
                  Speedup vs Cost Analysis
                </CardTitle>
                <CardDescription className="text-neutral-500">
                  Top-left is ideal: higher speedup with lower API costs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    successRate: {
                      label: "Success Rate",
                      color: "hsl(142, 76%, 36%)",
                    },
                  }}
                  className="h-[420px] sm:h-[520px] w-full"
                  style={isMobile ? { height: 360 } : undefined}
                >
                  <ScatterChart
                    margin={{
                      top: 10,
                      right: isMobile ? 12 : 120,
                      left: 12,
                      bottom: isMobile ? 16 : 32,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#303341" />
                    <XAxis
                      type="number"
                      dataKey="totalCost"
                      name="Total Cost"
                      label={{
                        value: "Total Cost ($)",
                        position: "insideBottom",
                        offset: -20,
                        fill: "#9ca3af",
                      }}
                      stroke="#9ca3af"
                      domain={[0, "auto"]}
                      tickFormatter={(tick) => tick.toFixed(2)}
                    />
                    <YAxis
                      type="number"
                      dataKey="successRate"
                      name={isOptimFormat ? "Speedup" : "Success Rate"}
                      unit={isOptimFormat ? "x" : "%"}
                      label={{
                        value: isOptimFormat ? "Speedup (x)" : "Success Rate (%)",
                        angle: -90,
                        position: "insideLeft",
                        fill: "#9ca3af",
                      }}
                      stroke="#9ca3af"
                      domain={isOptimFormat ? [0, "auto"] : [0, 100]}
                    />
                    <ChartTooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload as any;
                          return (
                            <div className="rounded-lg border border-white/10 bg-neutral-900/95 p-3 text-neutral-100 shadow-xl">
                              <p className="font-semibold">{d.model}</p>
                              <p className="text-sm text-neutral-300">
                                {isOptimFormat
                                  ? `Speedup: ${d.successRate.toFixed(2)}x`
                                  : `Success: ${d.successRate.toFixed(1)}%`}
                              </p>
                              <p className="text-sm text-neutral-300">
                                Total cost: {currency(d.totalCost)}
                              </p>
                              <p className="text-sm text-neutral-300">
                                Time: {d.duration.toFixed(2)}s
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter data={performanceData} isAnimationActive={false}>
                      {performanceData.map((entry) => (
                        <Cell
                          key={entry.originalModel}
                          fill={getModelColor(entry.originalModel)}
                        />
                      ))}
                      {!isMobile ? (
                        <LabelList
                          dataKey="model"
                          content={({ x, y, value }: any) => {
                            const nx =
                              (typeof x === "number" ? x : Number(x)) || 0;
                            const ny =
                              (typeof y === "number" ? y : Number(y)) || 0;
                            return (
                              <text
                                x={nx + 10}
                                y={ny}
                                dy={4}
                                textAnchor="left"
                                className="pointer-events-none text-xs font-medium fill-neutral-200"
                                style={{
                                  textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                                }}
                              >
                                {String(value)}
                              </text>
                            );
                          }}
                        />
                      ) : null}
                    </Scatter>
                  </ScatterChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pertest">
            <PerTestBreakdown
              details={detailsData as DetailsData}
              rankings={rankings}
              selectedModels={selectedModels}
              getModelColor={getModelColor}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
