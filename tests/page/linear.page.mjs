// Smoke test of the real page in jsdom. KaTeX and JSXGraph are stubbed.
// Linear walkthrough in the real page (jsdom, KaTeX/JSXGraph stubbed). Run with `npm test`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

import { ROOT as dir, RUNS } from "../helpers.mjs";
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
const dom = new JSDOM(html, { pretendToBeVisual: true });
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
window.Element.prototype.scrollIntoView = () => {};

let boards = 0;
globalThis.katex = { render: (latex, el) => { el.textContent = latex; } };
const allBoards = [];
window.JXG = {
  JSXGraph: {
    initBoard: (id, opts) => {
      boards++;
      const board = {
        id, box: opts.boundingbox, created: [], freed: false,
        create(type, args, attrs = {}) {
          const element = { type, args, attrs: { ...attrs }, handlers: {}, on(ev, fn) { this.handlers[ev] = fn; }, setAttribute(a) { Object.assign(this.attrs, a); } };
          this.created.push(element);
          return element;
        },
      };
      allBoards.push(board);
      return board;
    },
    freeBoard(board) { board.freed = true; },
  },
};
globalThis.JXG = window.JXG;

const origLog = console.log;
console.log = (...a) => { if (a[0] !== "response:") origLog(...a); };

const load = (p) => import(pathToFileURL(path.join(dir, p)).href);
await load("js/main.js");
await new Promise((r) => setTimeout(r, 10));
const { state } = await load("js/state.js");

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const hidden = (id) => document.getElementById(id).hidden;
const feedback = () => $$("#flow .flow-feedback").map((f) => f.textContent).filter(Boolean).join(" | ");
const y = (x) => state.concept.evaluate(state.params, x);
const item = (id) => state.flowRun.steps[state.step].items.find((i) => i.id === id);
const navButton = (label) => $$("#flow .flow-nav button").find((b) => b.textContent === label);
const helpButton = (label) => $$("#flow .flow-help button").find((b) => b.textContent === label);
const submit = (form) => form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
const lastForm = () => $$("#flow form").at(-1);
const barItem = (title) => $$("#step-sequence li").find((li) => li.firstChild.textContent === title);
const logOf = (type) => state.responses.filter((r) => r.type === type);
const canNext = () => navButton("Next") && !navButton("Next").disabled;

function pick(itemId, right) {
  const it = item(itemId);
  const index = it.options.findIndex((o) => it.check(o.key) === right);
  [...$$("#flow .flow-choices").at(-1).querySelectorAll("button")][index].click();
}
function typeAndCheck(values) {
  const form = lastForm();
  const inputs = [...form.querySelectorAll("input:not([disabled])")];
  values.forEach((v, i) => { inputs[i].value = v === null ? "" : String(v); });
  submit(form);
}

// The main walkthrough uses the "both" format; the others are checked near the end
const { default: linearFlow } = await load("js/flows/linearFlow.js");
assert.equal(state.responses[0].type, "start", "start entry logged");
assert.ok(["write", "choose", "both"].includes(state.responses[0].representFormat), "start entry has the format");
linearFlow.settings.representFormat = "both";
document.getElementById("new-scenario-btn").click();
assert.equal(state.flowRun.steps[2].format, "both");

origLog("Opens on:", state.concept.id, state.params);

// ---- Step 1: hint available from the start; wrong answer -> only "try again" ----
assert.equal(state.step, 0);
assert.ok(helpButton("Need a hint?") && !helpButton("Show answer"), "hint button before any try");
assert.ok(navButton("Next").disabled && navButton("Skip for now"), "Next disabled, Skip shown");
assert.ok(!$("#flow .flow-hint"), "no hint text until asked");
helpButton("Need a hint?").click();
assert.match($$("#flow .flow-hint")[0].textContent, /^Hint 1: /);
const firstHint = logOf("hint").at(-1);
assert.ok(firstHint.item === "explore-predict" && firstHint.attempts === 0, "hint before a try is logged (attempts 0)");
pick("explore-predict", false);
assert.equal(feedback(), "Not quite, try again.");
assert.ok(helpButton("Need a hint?") && !helpButton("Show answer"), "second hint offered");
helpButton("Need a hint?").click();
assert.equal($$("#flow .flow-hint").length, 2);
assert.ok(helpButton("Show answer") && !helpButton("Need a hint?"), "Show answer after hint 2");
pick("explore-predict", true);
assert.equal(feedback(), "Correct!");
assert.ok(!helpButton("Show answer") && !navButton("Skip for now"), "no help/skip buttons once done");
navButton("Next").click();

// ---- Step 2: x = 1, 2 given; x = 0, 5, 8 blank; perfect start auto-fills x = 8 ----
assert.equal(state.step, 1);
const noticeRows = $$("#flow .flow-table tbody tr");
assert.deepEqual(noticeRows.map((tr) => tr.children[0].textContent), ["0", "1", "2", "5", "8"], "rows sorted by x");
assert.deepEqual(noticeRows.map((tr) => (tr.querySelector("input") ? "blank" : tr.children[1].textContent)),
  ["blank", String(y(1)), String(y(2)), "blank", "blank"], "x = 1 and 2 given, x = 0, 5, 8 blank");
helpButton("Need a hint?").click();
origLog("x = 0 hint 1:", $$("#flow .flow-hint")[0].textContent);
assert.match($$("#flow .flow-hint")[0].textContent, /From x = 1 to x = 0, x goes down by 1\. How should y change\?/);
typeAndCheck([y(0), y(5), null]);
assert.match(feedback(), /Nice, you've got the pattern!/);
assert.ok($("#flow .flow-table td.is-autofilled").textContent.includes(String(y(8))), "x=8 auto-filled");
assert.equal(logOf("autofill").length, 1);
typeAndCheck([state.params.m]);
assert.equal(barItem("Explore").classList.contains("is-done"), true, "done marker in bar");
navButton("Next").click();

// ---- Step 3: skip, then come back through the step bar ----
assert.equal(state.step, 2);
navButton("Skip for now").click();
assert.equal(state.step, 3, "skip moves on");
assert.ok(barItem("Represent").classList.contains("is-skipped"), "skipped marker");
assert.match(barItem("Represent").textContent, /skipped/);
assert.equal(logOf("skip").length, 1);
// Represent skipped -> Solve shows the story and the student's table, not the formula/graph
assert.ok(hidden("formula") && hidden("graph") && !hidden("scenario"), "Solve hides formula and graph after a skip");
assert.equal($("#flow .flow-reference-title").textContent, "Your table");
const refCells = $$("#flow .flow-reference tbody tr").map((tr) => tr.textContent);
assert.equal(refCells.length, 5, "reference table has the 5 Notice rows");
assert.ok(refCells.includes(`8${y(8)}`), "reference table shows the auto-filled row");
const refYs = $$("#flow .flow-reference tbody tr").map((tr) => tr.children[1].textContent);
assert.deepEqual(refYs, [0, 1, 2, 5, 8].map((x) => String(y(x))), "reference y column = the 5 Notice values only");
navButton("Skip for now").click(); // skip Solve too, to look at Explain
assert.equal(state.step, 4);
assert.ok(hidden("formula") && hidden("graph") && $("#flow .flow-reference"), "Explain hides formula and graph too");
barItem("Represent").querySelector("button").click();
assert.equal(state.step, 2, "step bar returns to the skipped step");
assert.match($("#flow h2").textContent, /skipped/);
assert.ok(!navButton("Next").disabled, "can still move on from a skipped step");
typeAndCheck([state.params.m, state.params.b]);
assert.ok(!hidden("formula") && hidden("graph"), "formula after equation, big graph still hidden");
assert.equal($$("#flow .flow-prompt").at(-1).textContent, "Which graph matches your equation?");

// Four small graphs, same axes, only a line each, nothing that names the equation
const live = () => allBoards.filter((b) => b.id.startsWith("mini-") && !b.freed);
assert.equal(live().length, 4, "4 small graphs");
assert.ok(live().every((b) => JSON.stringify(b.box) === JSON.stringify(live()[0].box)), "same axes on all four");
assert.ok(live().every((b) => b.created.length === 1 && b.created[0].type === "curve"), "only a curve, no labels/points");
const cards = () => $$("#flow .flow-graph-option");
assert.deepEqual(cards().map((c) => c.querySelector("button").textContent), ["Graph A", "Graph B", "Graph C", "Graph D"]);
assert.ok(!$$("#flow .flow-graph-option").some((c) => /y =|\\cdot|x \+/.test(c.textContent)), "no equation text on cards");

// Each small graph's line is the option's equation, computed by evaluate
const match = item("represent-match");
live().forEach((b, i) => {
  const [xs, ys] = b.created[0].args;
  const o = match.options[i].graph;
  assert.ok(xs.every((x, k) => Math.abs(ys[k] - (o.m * x + o.b)) < 1e-9), `graph ${i} is y = ${o.m}x + ${o.b}`);
});
const box = live()[0].box;
const fitYs = live().filter((b, i) => match.options[i].key !== "swapped").flatMap((b) => b.created[0].args[1]);
assert.ok(box[1] >= Math.max(...fitYs) && box[3] <= Math.min(0, ...fitYs), "shared box fits every line except swapped");
// The correct line must use a good part of the height (not squashed flat)
const correctYs = live()[match.options.findIndex((o) => o.key === "correct")].created[0].args[1];
const share = (Math.max(...correctYs) - Math.min(...correctYs)) / (box[1] - box[3]);
assert.ok(share >= 0.1, `correct line spans ${(share * 100).toFixed(0)}% of the height`);
origLog("graph options:", match.options.map((o) => `${o.text}=${o.key} (y=${o.graph.m}x+${o.graph.b})`).join(", "), "| box", box.map((v) => +v.toFixed(1)));

// Wrong pick: click the GRAPH area, logged by key, card disabled, big graph still hidden
const wrongIndex = match.options.findIndex((o) => o.key !== "correct");
cards()[wrongIndex].querySelector(".flow-mini-graph").click();
assert.equal($$("#flow .flow-feedback").at(-1).textContent, "Not quite, try again.");
assert.ok(cards()[wrongIndex].classList.contains("is-wrong") && cards()[wrongIndex].querySelector("button").disabled);
assert.ok(hidden("graph"), "big graph hidden after wrong pick");
const lastPick = state.responses.filter((r) => r.item === "represent-match").at(-1);
assert.equal(lastPick.answer, match.options[wrongIndex].key, "wrong key logged");
cards()[wrongIndex].click(); // clicking a wrong card again does nothing
assert.equal(state.responses.filter((r) => r.item === "represent-match").length, 1, "no double log");
assert.equal(live().length, 4, "old small graphs freed on redraw");

// Right pick via its button -> big graph appears
const rightIndex = match.options.findIndex((o) => o.key === "correct");
cards()[rightIndex].querySelector("button").click();
assert.ok(!hidden("graph") && cards()[rightIndex].classList.contains("is-correct"), "big graph after right pick");
assert.equal(state.responses.filter((r) => r.item === "represent-match").at(-1).answer, "correct");
assert.ok(barItem("Represent").classList.contains("is-done"), "finished skipped step now done");
navButton("Next").click();

// ---- Step 4: wrong -> hint 1 -> hint 2 -> Show answer ----
assert.equal(state.step, 3);
assert.ok(!hidden("formula") && !hidden("graph"), "Represent complete -> Solve shows formula and graph");
const solve = item("solve-question");
typeAndCheck([solve.answer + 100]);
typeAndCheck([solve.answer + 101]);
typeAndCheck([solve.answer + 102]);
assert.equal(feedback(), "Not quite, try again.", "no automatic reveal after 3 tries");
assert.ok(!$("#flow .flow-input").disabled, "still open after 3 tries");
helpButton("Need a hint?").click();
helpButton("Need a hint?").click();
origLog("solve hints:", $$("#flow .flow-hint").map((h) => h.textContent));
helpButton("Show answer").click();
assert.match(feedback(), new RegExp(`The answer is .*${solve.answer}`));
assert.ok($("#flow .flow-input").disabled, "revealed answer: input locked");
assert.equal(logOf("reveal").length, 1);
assert.equal(logOf("hint").filter((h) => h.item === "solve-question").length, 2);

// Graph-reading item: highlighted answer point drawn, reading within half a grid step
const read = item("solve-read");
assert.ok(read, "reading item appears after the Solve answer");
assert.ok(state.flowRun.steps[3].items.some((it) => !state.flowRun.progress[it.id]?.done), "Solve not complete until the graph is read");
const mainBoard = allBoards.filter((b) => b.id === "graph-surface").at(-1);
const hl = state.flowRun.steps[3].graphHighlight;
const hlPoint = mainBoard.created.find((e) => e.type === "point" && e.attrs.size === 6);
assert.ok(hlPoint && hlPoint.args[0] === hl.x && hlPoint.args[1] === hl.y, "answer point highlighted on the graph");
assert.match(hlPoint.attrs.name, /^\(.*\)$/, "highlight shows its coordinates");
// the reading question has its own zoomed-in graph: normal x range, fine grid, line only
const readBoard = allBoards.filter((b) => b.id === "reading-solve-read" && !b.freed).at(-1);
assert.ok(readBoard && document.getElementById("reading-solve-read"), "zoomed-in graph inside the question");
assert.ok(readBoard.box[0] < 0 && readBoard.box[2] < 12, `zoomed x range ${readBoard.box}`);
assert.ok(readBoard.created.length === 1 && readBoard.created[0].type === "curve", "zoomed graph: just the line");
const zoomTop = readBoard.box[1] - readBoard.box[3];
assert.ok(zoomTop / read.yStep >= 6, "fine grid steps for the tolerance");
const readAns = state.concept.evaluate(state.params, read.readX);
typeAndCheck([readAns + read.yStep]); // a full grid step off: wrong
assert.match($$("#flow .flow-feedback").at(-1).textContent, /Not quite/);
typeAndCheck([(readAns + read.yStep * 0.4).toFixed(2)]); // within half a step: right
assert.equal($$("#flow .flow-feedback").at(-1).textContent, "Correct!");
origLog("reading:", $$("#flow .flow-prompt").at(-1).textContent, "| y-step", read.yStep, "| box", mainBoard.box.map((v) => +v.toFixed(1)));
navButton("Next").click();

// ---- Step 5: skip Explain (formula and graph shown now that Represent is done) ----
assert.equal(state.step, 4);
assert.ok(!hidden("formula") && !hidden("graph"), "Explain now shows formula and graph");
navButton("Skip for now").click();

// ---- Step 6: Transfer, finish with Explain still skipped ----
assert.equal(state.step, 5);
assert.ok(!navButton("Next"), "no Next on the last step");
typeAndCheck([y(2)]);
// f(2) stays open after the correct answer; the cursor moves on to f(12)
const f2Input = $$("#flow form")[0].querySelector("input");
assert.ok(!f2Input.disabled && !$$("#flow form")[0].querySelector("button").disabled, "f(2) still editable after correct");
typeAndCheck([y(12)]);
assert.equal(document.activeElement, $$("#flow form").at(-1).querySelector("input"), "cursor in the next open box (f(3/7))");

// f(3/7): a decimal first -> "Correct! Exact value: …", then the fraction -> "Also correct!"
const fracText = `${3 * state.params.m + 7 * state.params.b}/7`;
const decimal = y(3 / 7).toFixed(2);
const exactNeeded = !Number.isInteger(y(3 / 7));
typeAndCheck([decimal]);
const fracFeedback = () => $$("#flow .flow-feedback").at(-1).textContent;
if (exactNeeded) assert.match(fracFeedback(), /^Correct! Exact value: .*frac/, "exact value shown after a decimal");
origLog("after decimal:", fracFeedback());
const fracForm = $$("#flow form").at(-1);
fracForm.querySelector("input").value = fracText;
submit(fracForm);
assert.equal(fracFeedback(), "Also correct!", "equivalent fraction accepted again");
const re = state.responses.filter((r) => r.item === "transfer-f-fraction").at(-1);
assert.ok(re.reanswer === true && re.correct === true && re.answer === fracText, "re-answer logged");
// a wrong re-answer keeps the item done
fracForm.isConnected || 0;
$$("#flow form").at(-1).querySelector("input").value = "999";
submit($$("#flow form").at(-1));
assert.match(fracFeedback(), /isn't equal.*earlier answer was right/);
assert.ok(state.flowRun.progress["transfer-f-fraction"].done, "still done");
assert.match($("#flow .flow-done").textContent, /You skipped: Explain/);
origLog("end message:", $("#flow .flow-done").textContent);

// Table: one wrong cell -> targeted hint mentions that cell
document.getElementById("new-scenario-btn").click();
assert.equal(state.step, 0, "New scenario resets to step 1");
assert.ok(!$("#step-sequence .step-link"), "fresh run: no steps to jump to");
pick("explore-predict", true);
navButton("Next").click();
typeAndCheck([y(0), y(5) + 1, y(8)]);
assert.match(feedback(), /check x = 5/);
assert.ok(!$("#flow .flow-table td.is-autofilled"), "no auto-fill when x = 5 was wrong");
helpButton("Need a hint?").click();
const tableHint = $$("#flow .flow-hint")[0].textContent;
origLog("table hint:", tableHint);
assert.match(tableHint, /From x = 2 to x = 5/);

// ---- Other Represent formats in the page ----
function toRepresent(format) {
  linearFlow.settings.representFormat = format;
  document.getElementById("new-scenario-btn").click();
  navButton("Skip for now").click();
  navButton("Skip for now").click();
  assert.equal(state.step, 2);
  assert.equal(state.flowRun.steps[2].format, format);
}

toRepresent("write");
assert.equal($$("#flow .flow-item").length, 1, "write: one item");
assert.ok(!$("#flow .flow-graph-option") && $("#flow .flow-equation"), "write: equation boxes, no graphs");
assert.ok(hidden("formula") && hidden("graph"));
typeAndCheck([state.params.m, state.params.b]);
assert.ok(!hidden("formula") && !hidden("graph"), "write: formula and graph after the equation");
assert.ok(canNext(), "write: step done");
assert.equal(state.responses.at(-1).representFormat, "write", "format on answer entries");

toRepresent("choose");
assert.ok(!$("#flow .flow-equation") && !$("#flow .flow-graph-option"), "choose: no typing, no graphs");
assert.equal($("#flow .flow-prompt").textContent, "Which equation matches this story?");
const chooseButtons = $$("#flow .flow-choices button").map((b) => b.textContent);
assert.equal(chooseButtons.length, 4);
assert.ok(chooseButtons.includes(state.concept.formulaLatex(state.params)), "choose: correct equation offered");
pick("represent-choose", false);
assert.ok(hidden("formula") && hidden("graph"), "choose: still hidden after a wrong pick");
assert.ok(state.responses.at(-1).representFormat === "choose" && state.responses.at(-1).correct === false);
pick("represent-choose", true);
assert.ok(!hidden("formula") && !hidden("graph"), "choose: formula and graph after the right pick");

// "random": each scenario picks one, logged in its start entry
linearFlow.settings.representFormat = "random";
const picked = {};
for (let i = 0; i < 60; i++) {
  document.getElementById("new-scenario-btn").click();
  const start = state.responses.at(-1);
  assert.equal(start.type, "start");
  assert.equal(start.representFormat, state.flowRun.steps[2].format);
  picked[start.representFormat] = (picked[start.representFormat] ?? 0) + 1;
}
assert.equal(Object.keys(picked).length, 3, "random picks all three formats");
origLog("random formats over 60 scenarios:", picked);
assert.ok(state.responses.every((r) => r.representFormat), "every log entry has the format");

// ---- Log ----
const types = [...new Set(state.responses.map((r) => r.type))].sort().join();
assert.equal(types, "answer,autofill,hint,reveal,skip,start");
origLog(`responses: ${state.responses.length} (${types})`);

// ---- Other concepts unchanged ----
$$("#concept-picker button").find((b) => b.textContent === "Quadratic").click();
assert.ok(hidden("flow") && !hidden("table") && !$("#step-sequence button"), "quadratic: all at once, plain step bar");
assert.equal(live().length, 0, "small graphs freed when leaving the flow");
$$("#concept-picker button").find((b) => b.textContent === "Linear").click();
assert.ok(!hidden("flow") && state.step === 0);

origLog("\nDOM smoke test passed.");
