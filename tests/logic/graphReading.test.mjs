// Graph-reading item in Solve (linear + exponential). Run with `npm test`.
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { ROOT as dir, RUNS } from "../helpers.mjs";
const load = (p) => import(pathToFileURL(path.join(dir, p)).href);
const { default: linear } = await load("js/concepts/algebra/linearEquation.js");
const { default: expo } = await load("js/concepts/algebra/exponential.js");
const engine = await load("js/core/flowEngine.js");
const { readingView, zoomedView, niceStep } = await load("js/core/graphScale.js");
const fineRatio = [];
const { getScenario } = await load("js/data/sampleScenarios.js");

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

// niceStep basics
ok(niceStep(10) === 2 && niceStep(100) === 20 && niceStep(8) === 1 && niceStep(4000) === 500, "nice steps");

const stats = {};
for (const concept of [linear, expo]) {
  const tableXs = concept === linear ? [0, 1, 2, 5, 8] : [0, 1, 2, 3, 5];
  for (let n = 0; n < RUNS; n++) {
    const params = concept.generateParams();
    const y = (x) => concept.evaluate(params, x);
    const values = concept.storyValues(params);
    const scenario = getScenario(concept.id, ["sports", "music", "gaming", "animals"][n % 4], values.variant);
    const run = engine.createRun(concept.flow, concept, params, { scenario, values });
    const solve = run.steps[3];
    const [question, read] = solve.items;
    ok(question.id === "solve-question" && read.id === "solve-read", "solve has the reading item second");

    // highlight = the Solve answer's point, on the curve
    const h = solve.graphHighlight;
    ok(h.afterItem === "solve-question" && Math.abs(y(h.x) - h.y) < 1e-9, "highlight is on the curve");
    if (concept === linear && params.m < 0) ok(h.x === question.answer && h.y === question.target, "reverse: point (answer x, target)");
    else ok(h.x === question.qx && h.y === question.answer, "forward: point (qx, answer)");

    // reading x: small, inside the graph, not in the table, not the highlighted x
    ok(read.readX >= params.xMin && read.readX <= params.xMax && !tableXs.includes(read.readX) && read.readX !== h.x, `readX ${read.readX}`);
    if (concept === expo) ok(!Number.isInteger(read.readX), "exponential reads at a half-way x");

    // Wide graph shows the answer; the zoomed-in graph (normal x range, fine grid) is for reading
    const wide = readingView(concept, params, h);
    ok(wide.box[2] >= h.x, "wide graph contains the highlighted answer");
    const view = zoomedView(concept, params);
    ok(read.readingGraph && read.readingGraph.params === params, "item asks for its zoomed-in graph");
    ok(read.yStep === view.yStep, "tolerance uses the zoomed graph's grid step");
    ok(view.box[0] < params.xMin && view.box[0] > params.xMin - 2 && view.box[2] > params.xMax && view.box[2] < params.xMax + 2,
      `zoomed graph covers only the normal x range: ${view.box}`);
    ok(view.yStep <= wide.yStep, "zoomed grid is at least as fine as the wide one");
    ok(read.readX >= view.box[0] && read.readX <= view.box[2], "reading x inside the zoomed graph");
    const height = view.box[1] - view.box[3];
    ok(height / view.yStep >= 6 && height / view.yStep <= 16, `fine grid: ${(height / view.yStep).toFixed(1)} lines`);
    fineRatio.push(wide.yStep / view.yStep);
    const ans = y(read.readX), half = view.yStep / 2;
    ok(read.check(String(ans)) && read.check(String(ans + half * 0.99)) && read.check(String(ans - half * 0.99)), "within half a step accepted");
    ok(read.check(String(ans + half * 1.02)) === false && read.check(String(ans - half * 1.02)) === false, "beyond half a step rejected");
    ok(read.check(engine.autoAnswerFor(read)), "dev auto-answer");
    ok(read.hints.length === 2 && read.hints.every((t) => !/undefined|NaN/.test(t)), "hints");

    // visibility: graph only after the Solve answer when Represent is skipped; highlight then
    engine.skipStep(run, 2);
    ok(!engine.visibleRepresentations(run, 3).includes("graph") && engine.graphHighlightFor(run, 3) === null, "no graph before the answer");
    ok(engine.visibleItems(run, 3).length === 1, "reading item hidden before the answer");
    engine.submitAnswer(run, 3, "solve-question", String(question.answer));
    ok(engine.visibleRepresentations(run, 3).includes("graph"), "graph after the answer");
    ok(!engine.visibleRepresentations(run, 3).includes("formula"), "formula still hidden (Represent skipped)");
    const hl = engine.graphHighlightFor(run, 3);
    ok(hl && hl.x === h.x && hl.y === h.y, "highlight after the answer");
    ok(engine.visibleItems(run, 3).at(-1).id === "solve-read", "reading item appears");
    ok(!engine.isStepComplete(run, 3), "Solve not complete until the reading is done");
    const r = engine.submitAnswer(run, 3, "solve-read", String(ans));
    ok(r.status === "correct" && r.entry.item === "solve-read" && r.entry.step === "solve", "reading logged");
    ok(engine.isStepComplete(run, 3), "complete");

    const k = `${concept.id} step ${view.yStep}`;
    stats[concept.id] = stats[concept.id] ?? { steps: {}, wide: 0 };
    stats[concept.id].steps[view.yStep] = (stats[concept.id].steps[view.yStep] ?? 0) + 1;
    if (wide.xMax > params.xMax) stats[concept.id].wide++;
    void k;
  }
}
for (const [id, s] of Object.entries(stats)) {
  console.log(`${id}: wide graph stretched past the table in ${s.wide}/${RUNS}; zoomed y-grid steps:`, s.steps);
}
const sample = engine.createRun(linear.flow, linear, { m: 3, b: 12, xMin: 0, xMax: 10 }, {}, () => 0.3);
const read = sample.steps[3].items[1];
console.log("sample:", read.prompt, "| answer:", read.answerText, "\n  1:", read.hints[0], "\n  2:", read.hints[1]);
console.log(`\nAll ${checks} graph-reading checks passed.`);
fineRatio.sort((a, b) => a - b);
console.log(`zoomed grid vs wide grid: median ${fineRatio[Math.floor(fineRatio.length / 2)]}x finer, max ${fineRatio.at(-1)}x`);
