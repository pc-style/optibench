# OptiBench

A compiler optimization benchmark for evaluating LLM performance on code optimization tasks.

## Structure

- `bench/` - Benchmark runner that tests AI models on C code optimization
- `visualizer/` - Next.js app for visualizing benchmark results

## Quick Start

Install dependencies:

```bash
bun install
```

Run a benchmark:

```bash
cd bench
bun run optim
```

Update visualizer data:

```bash
cd bench
bun run update-viz
```

Run visualizer:

```bash
cd visualizer
bun run dev
```
