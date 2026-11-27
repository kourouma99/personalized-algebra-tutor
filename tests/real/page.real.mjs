// The REAL page (index.html + main.js) with the REAL JSXGraph 1.10.1 and KaTeX 0.16.11 in jsdom.
// Clicks every concept and fails on any thrown error or console.error.
// node tests/real/page.real.mjs [url query, e.g. "?dev=1"]  (npm run test:real runs both)
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { JSDOM, VirtualConsole } from "jsdom";

import { ROOT as dir, RUNS } from "../helpers.mjs";
const query = process.argv[2] ?? "";
const require = createRequire(import.meta.url);

const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (e) => errors.push(`jsdomError: ${e.message} ${e.detail?.stack ?? ""}`));
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
const dom = new JSDOM(html, { url: `http://localhost:3000/${query}`, pretendToBeVisual: true, virtualConsole });
const { window } = dom;

// jsdom has no layout: give elements a size and the SVG helpers JSXGraph calls
Object.defineProperty(window.HTMLElement.prototype, "clientWidth", { get: () => 600 });
Object.defineProperty(window.HTMLElement.prototype, "clientHeight", { get: () => 360 });
window.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 40, height: 14 });
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
const matrix = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, scale: matrix, translate: matrix, inverse: matrix, multiply: matrix });
window.SVGElement.prototype.getScreenCTM = matrix;
window.SVGElement.prototype.getCTM = matrix;
window.SVGElement.prototype.createSVGMatrix = matrix;
window.SVGElement.prototype.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return { x: 0, y: 0 }; } });
window.HTMLElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, right: 600, bottom: 360, width: 600, height: 360, x: 0, y: 0 });
window.Element.prototype.scrollIntoView = () => {};

globalThis.window = window;
globalThis.document = window.document;
for (const k of ["HTMLElement", "SVGElement", "Node", "Element", "getComputedStyle", "matchMedia", "requestAnimationFrame"]) {
  if (!(k in globalThis)) globalThis[k] = typeof window[k] === "function" && k[0] === k[0].toLowerCase() ? window[k].bind(window) : window[k];
}
globalThis.CSS = { escape: (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`), supports: () => true };
for (const [k, v] of Object.entries({ appVersion: "5.0 (Windows)", userAgent: "Mozilla/5.0 (Windows NT 10.0) jsdom", maxTouchPoints: 0 })) {
  try { Object.defineProperty(globalThis.navigator, k, { value: v, configurable: true }); } catch {}
}
globalThis.JXG = require(path.join(dir, "node_modules/jsxgraph/distrib/jsxgraphcore.js"));
window.JXG = globalThis.JXG;
window.JXG.Options.board.renderer = "svg";
globalThis.katex = require(path.join(dir, "node_modules/katex/dist/katex.js"));
window.katex = globalThis.katex;

const origError = console.error;
console.error = (...a) => errors.push(`console.error: ${a.map((x) => x?.stack ?? String(x)).join(" ")}`);
const origLog = console.log;
console.log = (...a) => { if (a[0] !== "response:") origLog(...a); };
process.on("uncaughtException", (e) => {
  // a failed assertion in this script must fail the run, not be swallowed
  if (e?.code === "ERR_ASSERTION") { origLog(`FAILED: ${e.message}`); process.exit(1); }
  errors.push(`uncaught: ${e.stack}`);
});

const load = (p) => import(pathToFileURL(path.join(dir, p)).href);
await load("js/main.js");
await new Promise((r) => setTimeout(r, 20));
const { state } = await load("js/state.js");
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const hidden = (id) => document.getElementById(id).hidden;

function report(label) {
  if (errors.length) {
    origLog(`\n${label}: ${errors.length} error(s)`);
    for (const e of errors.slice(0, 3)) origLog("  " + e.split("\n").slice(0, 6).join("\n  "));
  }
}

for (const name of ["Quadratic", "Exponential", "Linear", "Quadratic"]) {
  const btn = $$("#concept-picker button").find((b) => b.textContent === name);
  assert.ok(btn, `concept button ${name}`);
  errors.length = 0;
  try { btn.click(); } catch (e) { errors.push(`click threw: ${e.stack}`); }
  await new Promise((r) => setTimeout(r, 10));
  report(name);
  assert.deepEqual(errors, [], `${name}: no errors`);
  if (name === "Quadratic") {
    assert.equal(state.concept.id, "quadratic");
    assert.ok(hidden("flow") && !hidden("table") && !hidden("formula") && !hidden("graph"), "quadratic: all-at-once page");
    assert.ok($("#scenario h2")?.textContent, "quadratic story shown");
    assert.ok($$("#table tbody tr").length > 0, "quadratic table rows");
    assert.ok($("#formula .katex"), "quadratic formula rendered by KaTeX");
    const board = Object.values(window.JXG.boards).find((b) => b.container === "graph-surface");
    assert.ok(board && board.objectsList.some((o) => o.elType === "curve"), "quadratic graph drawn");
    for (const interest of $$("#interest-picker .interest-buttons button")) {
      errors.length = 0;
      interest.click();
      report(`Quadratic / ${interest.textContent}`);
      assert.deepEqual(errors, [], `quadratic ${interest.textContent}: no errors`);
      assert.ok($("#scenario h2"), `quadratic ${interest.textContent} story`);
    }
    for (let i = 0; i < 20; i++) {
      errors.length = 0;
      document.getElementById("new-scenario-btn").click();
      report(`Quadratic new scenario ${i}`);
      assert.deepEqual(errors, [], "quadratic new scenario: no errors");
    }
  } else {
    assert.ok(state.flowRun && !hidden("flow"), `${name}: guided flow`);
  }
}
origLog("real page test passed: Quadratic, Exponential, Linear, Quadratic again — no errors");

// With ?dev=1: leave each guided flow from every step (answered or not) to Quadratic
if (query.includes("dev=1")) {
  const click = (name) => $$("#concept-picker button").find((b) => b.textContent === name).click();
  const devAnswerStep = () => { for (let g = 0; g < 20 && $$("#flow .btn-dev").length; g++) $$("#flow .btn-dev")[0].click(); };
  let failures = 0;
  for (const from of ["Linear", "Exponential"]) {
    for (let stepIndex = 0; stepIndex < 6; stepIndex++) {
      for (const answered of [false, true]) {
        click(from);
        if (stepIndex > 0) [...$$("#step-sequence li")][stepIndex].querySelector("button").click();
        if (answered) devAnswerStep();
        errors.length = 0;
        try { click("Quadratic"); } catch (e) { errors.push("click threw: " + e.stack); }
        await new Promise((r) => setTimeout(r, 5));
        const okPage = state.concept.id === "quadratic" && hidden("flow") && !hidden("table") && !hidden("graph") && $$("#table tbody tr").length > 0;
        if (errors.length || !okPage) {
          failures++;
          report(`${from} step ${stepIndex}${answered ? " (answered)" : ""} -> Quadratic${okPage ? "" : " [page wrong]"}`);
        }
        errors.length = 0;
        document.getElementById("graph-mode-btn").click();
        document.getElementById("graph-mode-btn").click();
        if (errors.length) { failures++; report(`explore toggle after ${from} step ${stepIndex}`); }
      }
    }
  }
  origLog(failures ? `${failures} failing path(s)` : "all paths to Quadratic OK");
  assert.equal(failures, 0, "every path to Quadratic works");
}
