// Exponential flow logic. Run with `npm test` (or node tests/logic/exponential.test.mjs).
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { ROOT as dir, RUNS } from "../helpers.mjs";
const load = (p) => import(pathToFileURL(path.join(dir, p)).href);
const { default: expo } = await load("js/concepts/algebra/exponential.js");
const { default: flow, exponentialGraphOptions } = await load("js/flows/exponentialFlow.js");
const engine = await load("js/core/flowEngine.js");
const { getScenario } = await load("js/data/sampleScenarios.js");
const { steps: sequenceSteps } = await load("js/core/sequence.js");

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const interests = ["sports", "music", "gaming", "animals"];
const positions = [0, 0, 0, 0];
const factors = {};
const allHints = [];

for (let n = 0; n < RUNS; n++) {
  const params = expo.generateParams();
  const { a, b } = params;
  const y = (x) => expo.evaluate(params, x);
  const values = expo.storyValues(params);
  const scenario = n % 5 === 0 ? null : getScenario(expo.id, interests[n % 4], values.variant);
  const run = engine.createRun(flow, expo, params, { scenario, values });
  const steps = run.steps;
  const items = Object.fromEntries(steps.flatMap((s) => s.items).map((i) => [i.id, i]));
  factors[b] = (factors[b] ?? 0) + 1;

  ok(steps.map((s) => s.id).join() === sequenceSteps.map((s) => s.id).join(), "step ids match sequence.js");
  ok(steps.every((s) => s.logFields.representFormat === "both"), "format logged");

  // Explore
  const dir = b > 1 ? "grow" : "shrink";
  for (const k of ["grow", "shrink", "same"]) ok(items["explore-predict"].check(k) === (k === dir), "predict from b");

  // Notice: x = 1, 2 given (from evaluate), x = 0, 3, 5 to fill
  const table = steps[1].tables["notice-table"];
  ok(table.given.map((g) => g.x).join() === "1,2" && table.given.every((g) => g.y === y(g.x)), "given rows");
  ok(steps[1].items.filter((i) => i.group).map((i) => i.x).join() === "0,3,5", "cells 0, 3, 5");
  for (const x of [0, 3, 5]) {
    ok(items[`notice-y-at-${x}`].check(String(y(x))) === true, "cell right");
    ok(items[`notice-y-at-${x}`].check(String(y(x) + 1)) === false, "cell wrong");
  }
  ok(table.autoFill.after === 2, "auto-fill after x = 0 and 3");
  const factor = items["notice-factor"];
  ok(factor.check(String(b)) === true && factor.check(String(b + 1)) === false, "factor = b");
  if (b === 0.5) ok(factor.check("1/2") && factor.check(".5"), "1/2 accepted");
  if (b === 1.5) ok(factor.check("3/2"), "3/2 accepted");
  ok(Number.isInteger(b) ? !factor.exactText : Boolean(factor.exactText), "exact fraction for non-whole b");
  ok(factor.check(String(b - (b > 1 ? 1 : 0.25))) === false, "additive answer (y2 - y1 style) rejected");

  // Represent: y = [a]( [b] )^x
  const eq = items["represent-equation"];
  ok(eq.check([String(a), String(b)]) === true, "equation right");
  ok(eq.check([String(b), String(a)]) === false, "swapped rejected");
  ok(eq.check(["", String(b)]) === null, "blank not counted");
  if (b === 0.5) ok(eq.check([String(a), "1/2"]) === true, "fraction base accepted");
  ok(eq.parts.join() === "y =,\\Big(" && eq.after === "\\Big)^{x}", "box layout y = [ ]( [ ] )^x");

  const match = items["represent-match"];
  ok(match.display === "graphs" && match.options.map((o) => o.text).join() === "Graph A,Graph B,Graph C,Graph D", "4 graphs A-D");
  const keys = match.options.map((o) => o.key).sort().join();
  ok(keys === "correct,linear,swapped,wrong-base", `the four kinds: ${keys}`);
  const byKey = Object.fromEntries(match.options.map((o) => [o.key, o.graph]));
  ok(byKey.correct.a === a && byKey.correct.b === b, "correct graph");
  ok(byKey.swapped.a === b && byKey.swapped.b === a, "swapped graph");
  ok(Math.abs(byKey["wrong-base"].b - 1 / b) < 1e-12 && byKey["wrong-base"].a === a, "1/b graph");
  const line = byKey.linear;
  ok(line.concept.evaluate(line.params, 0) === y(0) && Math.abs(line.concept.evaluate(line.params, 1) - y(1)) < 1e-9, "line through the first two points");
  ok(Math.abs(line.concept.evaluate(line.params, 3) - y(3)) > 1e-6, "line differs later");
  positions[match.options.findIndex((o) => o.key === "correct")]++;
  ok(match.answerText === match.options.find((o) => o.key === "correct").text, "answer text is the letter");
  ok(match.graphFit.length === 2, "axes fit to the correct curve and the line");
  ok(steps[2].revealAfter["represent-match"].join() === "graph", "big graph only after the right pick");

  // Solve: not in table, inside 0..5
  const solve = items["solve-question"];
  ok(![0, 1, 2, 3, 5].includes(solve.qx) && solve.qx >= params.xMin && solve.qx <= params.xMax, "qx");
  ok(solve.check(String(y(solve.qx))) && !solve.check(String(y(solve.qx) + 1)), "solve");
  ok(!solve.prompt.includes("{"), `filled question: ${solve.prompt}`);
  ok(steps[3].requires.formula === "represent" && steps[3].referenceTable === "notice-table", "solve hides formula until represent done");

  // Explain
  ok(items["explain-a"].check("correct") && !items["explain-a"].check("factor"), "explain a");
  ok(items["explain-b"].check("correct") && !items["explain-b"].check("adds"), "explain b");
  if (scenario) ok(items["explain-b"].options.some((o) => o.text.includes(scenario.labels.y.toLowerCase())), "explain uses story labels");

  // Transfer: f(2), f(4), f(0)
  ok(steps[5].items.map((i) => i.id).join() === "transfer-f-2,transfer-f-4,transfer-f-0", "transfer items");
  for (const x of [2, 4, 0]) ok(items[`transfer-f-${x}`].check(String(y(x))), `f(${x})`);
  ok(items["transfer-f-0"].answer === a, "f(0) = a");
  ok(steps[5].introMath.startsWith("f(x) = "), "function notation");

  // Dev auto-answers are all correct
  for (const it of Object.values(items)) ok(it.check(engine.autoAnswerFor(it)) === true, `auto-answer ${it.id}`);

  // Hints: 2 per item, readable, multiplicative only
  run.steps.forEach((step, si) => {
    for (const it of step.items) {
      ok(it.hints?.length === 2, `2 hints ${it.id}`);
      engine.requestHint(run, si, it.id);
      engine.requestHint(run, si, it.id);
      for (const t of engine.getProgress(run, it.id).hints) {
        allHints.push({ t, b, id: it.id });
        ok(typeof t === "string" && t.length > 10 && !/undefined|NaN/.test(t), `hint text ${it.id}: ${t}`);
      }
    }
  });
}

// Never adding/subtracting in hints (x "goes up by 1" is about x, which is fine)
const additive = /\badd|subtract|plus|minus|\+|y\\?\)? (goes|went) (up|down) by|\by\b[^.]*\bchanges by\b/i;
for (const { t, id } of allHints) ok(!additive.test(t), `multiplicative wording only (${id}): ${t}`);
console.log(`hint texts checked: ${allHints.length}`);
console.log("factors:", factors, "| correct graph position A-D:", positions.join(" / "));

// Backwards / forwards table hints, and auto-fill
{
  const params = { a: 64, b: 2, xMin: 0, xMax: 5 };
  const run = engine.createRun(flow, expo, params, {});
  engine.requestHint(run, 1, "notice-y-at-0");
  engine.requestHint(run, 1, "notice-y-at-0");
  const [h1, h2] = engine.getProgress(run, "notice-y-at-0").hints;
  ok(h1 === "From \\(x = 1\\) to \\(x = 0\\), \\(x\\) goes down by 1. How should \\(y\\) change?", h1);
  ok(h2.includes("multiplied by the same number") && h2.includes("undoes one step") && h2.includes("divide \\(y = 128\\) by that number."), h2);
  engine.requestHint(run, 1, "notice-y-at-5");
  engine.requestHint(run, 1, "notice-y-at-5");
  const h5 = engine.getProgress(run, "notice-y-at-5").hints[1];
  ok(h5.includes("Start at \\(y = 256\\)") && h5.includes("multiply by that number 3 times"), h5);
  console.log("backwards hint 2:", h2, "\nforward hint 2:", h5);

  const { entries } = engine.submitGroup(run, 1, [["notice-y-at-0", "64"], ["notice-y-at-3", "512"]]);
  ok(entries.some((e) => e.type === "autofill") && engine.getProgress(run, "notice-y-at-5").autoFilled, "auto-fill x = 5");
  // b = 0.5 decimal -> exact value
  const half = engine.createRun(flow, expo, { a: 64, b: 0.5, xMin: 0, xMax: 5 }, {});
  engine.submitAnswer(half, 1, "notice-factor", "0.5");
  ok(engine.getProgress(half, "notice-factor").feedback.exactText === "\\(\\frac{1}{2}\\)", "exact value 1/2");
  ok(engine.submitAnswer(half, 1, "notice-factor", "1/2").status === "correct-again", "re-answer as fraction");
}

// Graph options never repeat a curve, for every allowed (a, b)
for (const b of expo.constraints.factors) {
  for (let a = 32; a <= 320; a += 32) {
    const opts = exponentialGraphOptions(a, b, 0, 5);
    ok(opts.length === 4 && opts[0].key === "correct", "4 options");
  }
}
console.log(`\nAll ${checks} exponential checks passed.`);
