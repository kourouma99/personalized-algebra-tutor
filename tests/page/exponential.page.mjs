// Exponential guided flow in the real page (jsdom, KaTeX/JSXGraph stubbed). run with `npm test`
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

import { ROOT as dir, RUNS } from "../helpers.mjs";
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
const dom = new JSDOM(html, { url: "http://localhost:3000/", pretendToBeVisual: true });
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
window.Element.prototype.scrollIntoView = () => {};
globalThis.katex = { render: (latex, el) => { el.textContent = latex; } };
const boards = [];
window.JXG = {
  JSXGraph: {
    initBoard: (id, opts) => {
      const board = { id, box: opts.boundingbox, created: [], freed: false,
        create(type, args) { const e = { type, args, on() {}, setAttribute() {} }; this.created.push(e); return e; } };
      boards.push(board);
      return board;
    },
    freeBoard(b) { b.freed = true; },
  },
};
globalThis.JXG = window.JXG;
const origLog = console.log;
console.log = (...a) => { if (a[0] !== "response:") origLog(...a); };

const load = (p) => import(pathToFileURL(path.join(dir, p)).href);
await load("js/main.js");
await new Promise((r) => setTimeout(r, 10));
const { state } = await load("js/state.js");
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const hidden = (id) => document.getElementById(id).hidden;
const nav = (label) => $$("#flow .flow-nav button").find((b) => b.textContent === label);
const help = (label) => $$("#flow .flow-help button").find((b) => b.textContent === label);
const submit = (form) => form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
const lastFeedback = () => $$("#flow .flow-feedback").at(-1).textContent;
const item = (id) => state.flowRun.steps[state.step].items.find((i) => i.id === id);
function type(values) {
  const form = $$("#flow form").at(-1);
  const inputs = [...form.querySelectorAll("input:not([disabled]):not([data-done])")];
  values.forEach((v, i) => { inputs[i].value = v === null ? "" : String(v); });
  submit(form);
}
function pick(id, right) {
  const it = item(id);
  const i = it.options.findIndex((o) => it.check(o.key) === right);
  [...$$("#flow .flow-choices").at(-1).querySelectorAll("button")][i].click();
}

$$("#concept-picker button").find((b) => b.textContent === "Exponential").click();
assert.ok(state.flowRun && !hidden("flow"), "exponential now has a guided flow");
assert.ok(hidden("table") && hidden("formula") && hidden("graph"), "story only at the start");
assert.ok(!$("#flow .btn-dev"), "no dev buttons without ?dev=1");
const { a, b } = state.params;
const y = (x) => state.concept.evaluate(state.params, x);
origLog("params:", state.params, "story:", $("#scenario h2")?.textContent);

// 1. Explore
assert.match($("#flow .flow-prompt").textContent, /increases, .* will…/);
assert.deepEqual($$("#flow .flow-choices button").map((x) => x.textContent).sort(), ["grow", "shrink", "stay the same"]);
pick("explore-predict", true);
nav("Next").click();

// 2. Notice: rows 0..5 sorted, x = 1, 2 given
const rows = $$("#flow .flow-table tbody tr");
assert.deepEqual(rows.map((r) => r.children[0].textContent), ["0", "1", "2", "3", "5"]);
assert.deepEqual(rows.map((r) => (r.querySelector("input") ? "blank" : r.children[1].textContent)), ["blank", String(y(1)), String(y(2)), "blank", "blank"]);
help("Need a hint?").click();
help("Need a hint?").click();
origLog("x = 0 hints:", $$("#flow .flow-hint").map((h) => h.textContent));
assert.match($$("#flow .flow-hint")[1].textContent, /divide y = \d+ by that number/);
type([y(0), y(3), null]);
assert.match($$("#flow form")[0].querySelector(".flow-feedback").textContent, /Nice, you've got the pattern!/);
assert.equal($$("#flow form").length, 2, "factor question appears");
type([b === 0.5 ? "0.5" : String(b)]);
if (!Number.isInteger(b)) assert.match(lastFeedback(), /Exact value: .*frac/);
nav("Next").click();

// 3. Represent: y = [ ]( [ ] )^x, then graphs
const eqRow = $("#flow .flow-equation").textContent;
assert.ok(eqRow.includes("y =") && eqRow.includes("\\Big(") && eqRow.includes("\\Big)^{x}"), `equation layout: ${eqRow}`);
type([b, a]);
assert.match(lastFeedback(), /Not quite/);
help("Need a hint?").click();
origLog("equation hint 1:", $$("#flow .flow-hint").at(-1).textContent);
type([a, b]);
assert.ok(!hidden("formula") && hidden("graph"), "formula after equation, graph still hidden");

const live = () => boards.filter((x) => x.id.startsWith("mini-") && !x.freed);
assert.equal(live().length, 4, "4 small graphs");
assert.ok(live().every((x) => JSON.stringify(x.box) === JSON.stringify(live()[0].box)), "same axes");
assert.ok(live().every((x) => x.created.length === 1 && x.created[0].type === "curve"), "only a curve each");
const match = item("represent-match");
live().forEach((board, i) => {
  const [xs, ys] = board.created[0].args;
  const o = match.options[i];
  const expected = o.key === "linear" ? (x) => o.graph.params.m * x + o.graph.params.b : (x) => o.graph.a * o.graph.b ** x;
  assert.ok(xs.every((x, k) => Math.abs(ys[k] - expected(x)) < 1e-6), `graph ${o.text} (${o.key}) drawn right`);
});
const lineBoard = live()[match.options.findIndex((o) => o.key === "linear")];
const [lx, ly] = lineBoard.created[0].args;
const slope = (ly[1] - ly[0]) / (lx[1] - lx[0]);
assert.ok(ly.every((v, k) => Math.abs(v - (ly[0] + slope * (lx[k] - lx[0]))) < 1e-6), "linear look-alike is straight");
origLog("graph options:", match.options.map((o) => `${o.text}=${o.key}`).join(", "), "| box:", live()[0].box.map((v) => +v.toFixed(1)));
const cards = () => $$("#flow .flow-graph-option");
cards()[match.options.findIndex((o) => o.key === "linear")].click();
assert.ok(hidden("graph"), "still hidden after wrong pick");
assert.equal(state.responses.at(-1).answer, "linear", "wrong pick logged by key");
cards()[match.options.findIndex((o) => o.key === "correct")].click();
assert.ok(!hidden("graph"), "graph after right pick");
nav("Next").click();

// 4. Solve: x = 4 (the only x in 0..5 not in the table), reference table shown
assert.equal(item("solve-question").qx, 4);
assert.ok(!hidden("formula") && $("#flow .flow-reference"), "formula (represent done) and Your table");
const prompt = $$("#flow .flow-prompt").at(-1).textContent;
assert.ok(/ 4 /.test(prompt) && !prompt.includes("{"), `question uses x = 4: ${prompt}`);
type([y(4)]);
assert.equal($$("#flow .flow-feedback")[0].textContent, "Correct!");
// graph-reading item at a half-way x, answer point (4, y(4)) highlighted
const read = item("solve-read");
assert.ok(read && !Number.isInteger(read.readX), `reading at x = ${read?.readX}`);
assert.ok(nav("Next").disabled, "Next waits for the reading");
const main = boards.filter((x) => x.id === "graph-surface").at(-1);
const hp = main.created.find((e) => e.type === "point" && e.args[0] === 4 && e.args[1] === y(4));
assert.ok(hp, "answer point highlighted");
const zoom = boards.filter((x) => x.id === "reading-solve-read" && !x.freed).at(-1);
assert.ok(zoom && zoom.box[2] < 6 && zoom.created.length === 1, `zoomed-in reading graph over 0..5: ${zoom?.box}`);
type([(y(read.readX) - read.yStep * 0.3).toFixed(2)]);
assert.equal(lastFeedback(), "Correct!");
origLog("exp reading:", $$("#flow .flow-prompt").at(-1).textContent, "answer", y(read.readX).toFixed(2), "step", read.yStep);
nav("Next").click();

// 5. Explain
pick("explain-a", false);
assert.match(lastFeedback(), /Not quite/);
pick("explain-a", true);
pick("explain-b", true);
nav("Next").click();

// 6. Transfer
assert.ok(hidden("scenario") && $("#flow .flow-intro-math").textContent.startsWith("f(x) = "));
type([y(2)]);
type([y(4)]);
type([a]);
assert.match($("#flow .flow-done").textContent, /finished every step/);
const log = state.responses.filter((r) => r.representFormat === "both" && r.type === "answer");
assert.ok(log.length >= 10, "answers logged");
origLog("exponential page test passed");
