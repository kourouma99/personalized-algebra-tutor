/*
  run.mjs — runs the test files, each in its own Node process (a page test needs a
  fresh copy of main.js, and dev mode reads the URL only once when it loads).

    npm test            logic tests + jsdom page walkthroughs (stubbed KaTeX/JSXGraph)
    npm run test:real   the same page with the REAL JSXGraph and KaTeX (slower, optional)

  Environment knobs (see tests/README.md):
    TEST_RUNS   random scenarios per logic test (default 400)
    PAGE_RUNS   how many times each random page walkthrough repeats (default 2)
*/
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { ROOT } from "./helpers.mjs";

const real = process.argv.includes("--real");
const PAGE_RUNS = Number(process.env.PAGE_RUNS) || 2;
const repeat = (n, job) => Array.from({ length: n }, () => job);

const jobs = real
  ? [
      ["real/graph.real.mjs"],
      ["real/page.real.mjs"],
      ["real/page.real.mjs", "?dev=1"],
    ]
  : [
      ["logic/linear.test.mjs"],
      ["logic/exponential.test.mjs"],
      ["logic/graphReading.test.mjs"],
      ...repeat(PAGE_RUNS, ["page/linear.page.mjs"]),
      ...repeat(PAGE_RUNS, ["page/exponential.page.mjs"]),
      ["page/quadratic.page.mjs"],
      ["page/devMode.page.mjs", "on"],
      ["page/devMode.page.mjs", "off"],
    ];

function runJob([file, ...args]) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(ROOT, "tests", file), ...args], { cwd: ROOT, env: process.env });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("close", (code) => resolve({ name: [file, ...args].join(" "), code, output, ms: Date.now() - started }));
  });
}

// Run several at once (they are independent processes)
const results = [];
const queue = [...jobs];
const workers = Array.from({ length: Math.min(os.cpus().length, 4) }, async () => {
  while (queue.length) {
    const result = await runJob(queue.shift());
    results.push(result);
    const mark = result.code === 0 ? "PASS" : "FAIL";
    // last meaningful line, e.g. "All 52000 checks passed."
    const summary = result.output.trim().split("\n").filter((l) => l.trim() && !/IntersectionObserver/.test(l)).at(-1) ?? "";
    console.log(`${mark}  ${result.name.padEnd(34)} ${(result.ms / 1000).toFixed(1).padStart(5)}s  ${result.code === 0 ? summary.trim().slice(0, 70) : ""}`);
  }
});
const started = Date.now();
await Promise.all(workers);

const failed = results.filter((r) => r.code !== 0);
for (const f of failed) {
  console.log(`\n---- ${f.name} (exit ${f.code}) ----`);
  const lines = f.output.split("\n").filter((l) => !/^!function|IntersectionObserver/.test(l));
  console.log(lines.slice(-25).map((l) => l.slice(0, 300)).join("\n"));
}
console.log(`\n${results.length - failed.length}/${results.length} passed in ${((Date.now() - started) / 1000).toFixed(1)}s` +
  (real ? " (real JSXGraph + KaTeX)" : ` (TEST_RUNS=${process.env.TEST_RUNS || 400}, PAGE_RUNS=${PAGE_RUNS})`));
process.exit(failed.length ? 1 : 0);
