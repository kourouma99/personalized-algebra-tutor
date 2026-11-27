// Quadratic in the real page (jsdom, KaTeX/JSXGraph stubbed). Fails on ANY page error.
// Run with `npm test` (or node tests/page/quadratic.page.mjs).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM, VirtualConsole } from "jsdom";
import { ROOT, load } from "../helpers.mjs";

const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (e) => errors.push(`page error: ${e.message}`));
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
const dom = new JSDOM(html, { url: "http://localhost:3000/", pretendToBeVisual: true, virtualConsole });
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
window.Element.prototype.scrollIntoView = () => {};
globalThis.katex = { render: (latex, el) => { el.textContent = latex; } };
const boards = [];
const element = () => ({ on() {}, setAttribute() {} });
window.JXG = {
  JSXGraph: {
    initBoard: (id, opts) => { const b = { id, opts, created: [], create(type, args) { this.created.push({ type, args }); return element(); } }; boards.push(b); return b; },
    freeBoard() {},
  },
};
globalThis.JXG = window.JXG;
const origError = console.error;
console.error = (...a) => errors.push(`console.error: ${a.join(" ")}`);
const origLog = console.log;
console.log = (...a) => { if (a[0] !== "response:") origLog(...a); };

await load("js/main.js");
await new Promise((r) => setTimeout(r, 10));
const { state } = await load("js/state.js");
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const hidden = (id) => document.getElementById(id).hidden;
const noErrors = (label) => {
  assert.deepEqual(errors, [], `${label}: page errors`);
};

function checkQuadraticPage(label) {
  assert.equal(state.concept.id, "quadratic", label);
  const { a, h, k } = state.params;
  assert.ok(hidden("flow") && !hidden("scenario") && !hidden("table") && !hidden("formula") && !hidden("graph"), `${label}: all-at-once page`);
  assert.ok($("#scenario h2")?.textContent, `${label}: story title`);
  assert.ok(!/\{\w+\}/.test($("#scenario").textContent), `${label}: no unfilled {placeholders}`);
  const rows = $$("#table tbody tr").map((tr) => [...tr.children].map((td) => Number(td.textContent)));
  assert.equal(rows.length, 2 * h + 1, `${label}: table from x = 0 to 2h`);
  assert.ok(rows.every(([x, y]) => y === a * (x - h) ** 2 + k), `${label}: table values from evaluate`);
  assert.ok($("#formula").textContent.includes(state.concept.formulaLatex(state.params)), `${label}: formula`);
  const graph = boards.filter((b) => b.id === "graph-surface").at(-1);
  assert.ok(graph && graph.created.some((e) => e.type === "curve"), `${label}: graph drawn`);
}

// from a fresh page
$$("#concept-picker button").find((b) => b.textContent === "Quadratic").click();
noErrors("open Quadratic");
checkQuadraticPage("open Quadratic");

// every interest, and many new scenarios
for (const btn of $$("#interest-picker .interest-buttons button")) {
  btn.click();
  noErrors(`interest ${btn.textContent}`);
  checkQuadraticPage(`interest ${btn.textContent}`);
}
for (let i = 0; i < 25; i++) {
  document.getElementById("new-scenario-btn").click();
  noErrors(`new scenario ${i}`);
  checkQuadraticPage(`new scenario ${i}`);
}

// coming back from the middle of the other concepts' flows
for (const from of ["Linear", "Exponential"]) {
  $$("#concept-picker button").find((b) => b.textContent === from).click();
  $$("#flow .flow-nav button").find((b) => b.textContent === "Skip for now")?.click();
  $$("#flow .flow-nav button").find((b) => b.textContent === "Skip for now")?.click();
  $$("#concept-picker button").find((b) => b.textContent === "Quadratic").click();
  noErrors(`${from} -> Quadratic`);
  checkQuadraticPage(`${from} -> Quadratic`);
}
document.getElementById("graph-mode-btn").click();
noErrors("explore toggle");
origLog("quadratic page test passed");
