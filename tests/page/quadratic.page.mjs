// Quadratic guided flow in the real page (jsdom, KaTeX/JSXGraph stubbed). Fails on ANY page error.
// Also checks the all-at-once page for a concept without a flow (step bar hidden).
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
window.JXG = {
  JSXGraph: {
    initBoard: (id, opts) => {
      const b = { id, box: opts.boundingbox, created: [], freed: false,
        create(type, args, attrs = {}) { const e = { type, args, attrs, on() {}, setAttribute() {} }; this.created.push(e); return e; } };
      boards.push(b);
      return b;
    },
    freeBoard(b) { b.freed = true; },
  },
};
globalThis.JXG = window.JXG;
console.error = (...a) => errors.push(`console.error: ${a.join(" ")}`);
const origLog = console.log;
console.log = (...a) => { if (a[0] !== "response:") origLog(...a); };

await load("js/main.js");
await new Promise((r) => setTimeout(r, 10));
const { state } = await load("js/state.js");
const { default: quadratic } = await load("js/concepts/algebra/quadratic.js");
const { getScenario } = await load("js/data/sampleScenarios.js");
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const hidden = (id) => document.getElementById(id).hidden;
const nav = (label) => $$("#flow .flow-nav button").find((b) => b.textContent === label);
const help = (label) => $$("#flow .flow-help button").find((b) => b.textContent === label);
const submit = (form) => form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
const item = (id) => state.flowRun.steps[state.step].items.find((i) => i.id === id);
const lastFeedback = () => $$("#flow .flow-feedback").at(-1).textContent;
const noErrors = (label) => assert.deepEqual(errors, [], `${label}: page errors`);
function type(values) {
  const form = $$("#flow form").at(-1);
  const inputs = [...form.querySelectorAll("input:not([disabled]):not([data-done])")];
  values.forEach((v, i) => { inputs[i].value = String(v); });
  submit(form);
}
function pick(id, right) {
  const it = item(id);
  const i = it.options.findIndex((o) => it.check(o.key) === right);
  [...$$("#flow .flow-choices").at(-1).querySelectorAll("button")][i].click();
}

// ---- open Quadratic: guided flow, guided story, step bar ----
$$("#concept-picker button").find((b) => b.textContent === "Quadratic").click();
noErrors("open Quadratic");
assert.ok(state.flowRun && !hidden("flow") && !hidden("step-sequence"), "quadratic is a guided flow with a step bar");
assert.ok(hidden("table") && hidden("formula") && hidden("graph"), "story only at the start");
const { a, h, k } = state.params;
const y = (x) => quadratic.evaluate(state.params, x);
const values = quadratic.storyValues(state.params);
const scenario = getScenario("quadratic", state.interest, values.variant);
const storyText = $("#scenario p").textContent;
assert.ok(storyText.includes(String(k)) && storyText.includes(String(h)), "story gives the turning point");
assert.ok(!storyText.includes(`after ${2 * h} `) && scenario.guidedStory, "guided story: no 'back at the start after 2h'");
origLog("params:", state.params, "|", $("#scenario h2").textContent);

// 1. Explore
pick("explore-predict", false);
assert.match(lastFeedback(), /Not quite/);
pick("explore-predict", true);
nav("Next").click();

// 2. Notice: rows 0, h-1, h, h+1, 2h; given h-1 and h+1
const rows = $$("#flow .flow-table tbody tr");
assert.deepEqual(rows.map((r) => Number(r.children[0].textContent)), [0, h - 1, h, h + 1, 2 * h], "rows sorted by x");
assert.deepEqual(rows.map((r) => (r.querySelector("input") ? "blank" : Number(r.children[1].textContent))),
  ["blank", y(h - 1), "blank", y(h + 1), "blank"], "h-1 and h+1 given (equal), the rest blank");
type([y(0), y(h), y(0) + 1]); // x = 2h wrong (inputs are in x order: 0, h, 2h)
assert.match($$("#flow .flow-feedback")[0].textContent, new RegExp(`check x = ${2 * h}`));
help("Need a hint?").click();
assert.match($$("#flow .flow-hint")[0].textContent, /symmetric/);
origLog("x = 2h hint:", $$("#flow .flow-hint")[0].textContent);
type([y(2 * h)]);
assert.equal($$("#flow form").length, 2, "vertex question after the table");
assert.match($$("#flow .flow-prompt").at(-1).textContent, a < 0 ? /highest/ : /lowest/);
type([h, k]);
assert.equal(lastFeedback(), "Correct!");
nav("Next").click();

// 3. Represent: y = [a](x - [h])^2 + [k], then 4 graphs
const eqText = $("#flow .flow-equation").textContent;
assert.ok(eqText.includes("y =") && eqText.includes("x -") && eqText.includes("^{2} +"), `equation layout: ${eqText}`);
assert.equal($$("#flow .flow-equation input").length, 3, "three boxes");
type([a, -h, k]);
assert.match(lastFeedback(), /Not quite/);
help("Need a hint?").click();
assert.match($$("#flow .flow-hint").at(-1).textContent, /after x - is the x of the/, "hint names only the wrong box");
type([a, h, k]);
assert.ok(!hidden("formula") && hidden("graph"), "formula after the equation");
const live = () => boards.filter((b) => b.id.startsWith("mini-") && !b.freed);
assert.equal(live().length, 4, "four small graphs");
const match = item("represent-match");
live().forEach((b, i) => {
  const g = match.options[i].graph;
  const [xs, ys] = b.created[0].args;
  assert.ok(xs.every((x, j) => Math.abs(ys[j] - (g.a * (x - g.h) ** 2 + g.k)) < 1e-6), `graph ${i} drawn from its params`);
});
$$("#flow .flow-graph-option")[match.options.findIndex((o) => o.key === "correct")].click();
assert.ok(!hidden("graph"), "graph after the right pick");
nav("Next").click();

// 4. Solve: reverse question, then the zoomed reading graph
const solve = item("solve-question");
origLog("solve:", $$("#flow .flow-prompt").at(-1).textContent, "->", solve.answer, `(${state.flowRun.steps[3].solveQuestion})`);
assert.ok(!$$("#flow .flow-prompt").at(-1).textContent.includes("{"), "question filled");
type([solve.answer]);
const read = item("solve-read");
const zoom = boards.filter((b) => b.id === "reading-solve-read" && !b.freed).at(-1);
assert.ok(zoom && zoom.box[2] < 2 * h + 2, "zoomed reading graph over 0..2h");
const mainBoard = boards.filter((b) => b.id === "graph-surface").at(-1);
assert.ok(mainBoard.created.some((e) => e.type === "point" && e.args[0] === solve.answer && e.args[1] === solve.target), "answer highlighted");
type([(y(read.readX) + read.yStep * 0.3).toFixed(2)]);
assert.equal(lastFeedback(), "Correct!");
nav("Next").click();

// 5. Explain
pick("explain-h", false);
pick("explain-h", true);
pick("explain-k", true);
nav("Next").click();

// 6. Transfer
assert.ok(hidden("scenario") && $("#flow .flow-intro-math").textContent.startsWith("f(x) = "));
const [first, right, left] = state.flowRun.steps[5].items;
type([y(first.x)]);
type([y(right.x)]);
type([y(left.x)]);
assert.match($$("#flow .flow-prompt").at(-1).textContent, /Why are/);
pick("transfer-why", true);
assert.match($("#flow .flow-done").textContent, /finished every step/);
noErrors("walkthrough");

// ---- every interest and many new scenarios open without errors ----
for (const btn of $$("#interest-picker .interest-buttons button")) { btn.click(); noErrors(`interest ${btn.textContent}`); }
for (let i = 0; i < 20; i++) {
  document.getElementById("new-scenario-btn").click();
  noErrors(`new scenario ${i}`);
  assert.ok(state.flowRun && state.step === 0 && $("#scenario h2"), "fresh worksheet");
}

// ---- a concept without a flow: all-at-once page, no step bar ----
const savedFlow = quadratic.flow;
quadratic.flow = undefined;
$$("#concept-picker button").find((b) => b.textContent === "Linear").click();
$$("#concept-picker button").find((b) => b.textContent === "Quadratic").click();
noErrors("all-at-once");
assert.ok(!state.flowRun && hidden("flow") && hidden("step-sequence"), "no flow: no worksheet, no step bar");
assert.ok(!hidden("table") && !hidden("formula") && !hidden("graph"), "all-at-once page");
const tableRows = $$("#table tbody tr").map((tr) => [...tr.children].map((td) => Number(td.textContent)));
assert.ok(tableRows.length === 2 * state.params.h + 1 && tableRows.every(([x, v]) => v === quadratic.evaluate(state.params, x)), "full table");
assert.ok($("#scenario .scenario-question"), "all-at-once page shows the story's question");
quadratic.flow = savedFlow;
$$("#concept-picker button").find((b) => b.textContent === "Quadratic").click();
assert.ok(state.flowRun && !hidden("step-sequence"), "flow back: step bar back");
noErrors("restore");
origLog("quadratic page test passed");
