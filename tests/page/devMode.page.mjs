// Dev mode test: the real page in jsdom with ?dev=1 (or without, with "off").
// node tests/page/devMode.page.mjs [on|off]  (npm test runs both)
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

import { ROOT as dir, RUNS } from "../helpers.mjs";
const devOn = (process.argv[2] ?? "on") === "on";
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
const dom = new JSDOM(html, { url: devOn ? "http://localhost:3000/?dev=1" : "http://localhost:3000/?dev=0", pretendToBeVisual: true });
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
window.Element.prototype.scrollIntoView = () => {};
globalThis.katex = { render: (latex, el) => { el.textContent = latex; } };
const element = () => ({ on() {}, setAttribute() {} });
window.JXG = { JSXGraph: { initBoard: () => ({ create: element }), freeBoard() {} } };
globalThis.JXG = window.JXG;
const origLog = console.log;
console.log = (...a) => { if (a[0] !== "response:") origLog(...a); };

const load = (p) => import(pathToFileURL(path.join(dir, p)).href);
await load("js/main.js");
await new Promise((r) => setTimeout(r, 10));
const { state } = await load("js/state.js");
const $$ = (sel) => [...document.querySelectorAll(sel)];
const devButtons = () => $$("#flow .btn-dev");
const stepLinks = () => $$("#step-sequence .step-link");

if (!devOn) {
  // Without ?dev=1: no Auto-answer anywhere, only visited steps are links
  for (const concept of ["Linear", "Exponential", "Quadratic"]) {
    const btn = $$("#concept-picker button").find((b) => b.textContent === concept);
    if (!btn) continue;
    btn.click();
    if (!state.flowRun) continue; // concept without a guided flow
    assert.equal(devButtons().length, 0, `${concept}: no Auto-answer without ?dev=1`);
    assert.equal(stepLinks().length, 0, `${concept}: no step links on a fresh run without ?dev=1`);
    $$("#flow .flow-nav button").find((b) => b.textContent === "Skip for now")?.click();
    assert.equal(devButtons().length, 0);
    assert.equal(stepLinks().length, 1, "only the visited step is a link");
  }
  origLog("dev off: no dev buttons, normal step bar");
  process.exit(0);
}

// With ?dev=1: every step is a link from the start, Auto-answer completes every step
const conceptButtons = $$("#concept-picker button").filter((b) => ["Linear", "Exponential", "Quadratic"].includes(b.textContent));
for (const conceptBtn of conceptButtons) {
  const name = conceptBtn.textContent;
  for (let round = 0; round < 3; round++) {
    $$("#concept-picker button").find((b) => b.textContent === name).click();
    const run = state.flowRun;
    if (!run) { assert.equal(devButtons().length, 0, `${name}: no flow, no dev buttons`); break; }
    assert.equal(stepLinks().length, run.steps.length - 1, `${name}: all other steps clickable from the start`);

    // jump straight to the last step, then back to the first, through the step bar
    stepLinks().at(-1).click();
    assert.equal(state.step, run.steps.length - 1, "jumped to the last step");
    stepLinks()[0].click();
    assert.equal(state.step, 0);

    for (let s = 0; s < run.steps.length; s++) {
      // keep pressing Auto-answer until the step is done (items appear one at a time)
      for (let guard = 0; guard < 20 && devButtons().length; guard++) devButtons()[0].click();
      const open = run.steps[s].items.filter((it) => !run.progress[it.id]?.done).map((it) => it.id);
      assert.deepEqual(open, [], `${name} step ${s} (${run.steps[s].id}, format ${run.steps[2].format}): all items done`);
      assert.ok(run.steps[s].items.every((it) => !run.progress[it.id].revealed), "auto-answers count as correct, not revealed");
      const next = $$("#flow .flow-nav button").find((b) => b.textContent === "Next");
      if (next) next.click();
    }
    assert.match(document.querySelector("#flow .flow-done").textContent, /finished every step/);
    const devEntries = state.responses.filter((r) => r.dev);
    assert.ok(devEntries.length > 0 && devEntries.every((r) => r.correct !== false), "dev answers logged with dev: true, all correct");
  }
  origLog(`dev on: ${name} completed 3 times with Auto-answer only`);
}
origLog("dev mode test passed");
