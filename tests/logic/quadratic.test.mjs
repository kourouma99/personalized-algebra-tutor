// Quadratic flow logic (y = a(x - h)^2 + k). Run with `npm test` (or node tests/logic/quadratic.test.mjs).
import assert from "node:assert/strict";
import { RUNS, load } from "../helpers.mjs";

const { default: quad } = await load("js/concepts/algebra/quadratic.js");
const { default: flow, quadraticGraphOptions } = await load("js/flows/quadraticFlow.js");
const engine = await load("js/core/flowEngine.js");
const { getScenario } = await load("js/data/sampleScenarios.js");
const { steps: sequenceSteps } = await load("js/core/sequence.js");
const { zoomedView } = await load("js/core/graphScale.js");

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const interests = ["sports", "music", "gaming", "animals"];
const solveKinds = {};
const positions = [0, 0, 0, 0];
const badWording = /\+ ?-\d|add -|by -\d|- -\d/;

for (let n = 0; n < RUNS; n++) {
  const params = quad.generateParams();
  const { a, h, k } = params;
  const y = (x) => quad.evaluate(params, x);
  const values = quad.storyValues(params);
  const scenario = n % 5 === 0 ? null : getScenario(quad.id, interests[n % 4], values.variant);
  const run = engine.createRun(flow, quad, params, { scenario, values });
  const steps = run.steps;
  const items = Object.fromEntries(steps.flatMap((s) => s.items).map((i) => [i.id, i]));
  const extreme = a < 0 ? "highest" : "lowest";

  ok(steps.map((s) => s.id).join() === sequenceSteps.map((s) => s.id).join(), "step ids match sequence.js");

  // 1. Explore: from the sign of a
  for (const key of ["highest", "lowest", "neither"]) ok(items["explore-predict"].check(key) === (key === extreme), "explore");
  if (!scenario) ok(steps[0].intro.includes(String(k)) && steps[0].intro.includes(String(y(0))), "facts given without a story");

  // 2. Notice: h-1 and h+1 given (a symmetric pair), fill h, 0, 2h; no auto-fill
  const table = steps[1].tables["notice-table"];
  ok(table.given.map((g) => g.x).join() === `${h - 1},${h + 1}` && table.given[0].y === table.given[1].y, "symmetric given pair");
  ok(table.given.every((g) => g.y === y(g.x)), "given rows from evaluate");
  ok(!table.autoFill, "no auto-fill (2h must come from symmetry)");
  const cells = steps[1].items.filter((i) => i.group);
  ok(cells.map((c) => c.x).join() === `${h},0,${2 * h}`, "cells h, 0, 2h");
  for (const c of cells) ok(c.check(String(y(c.x))) && !c.check(String(y(c.x) + 1)), "cell answer");
  ok(cells[2].answer === cells[1].answer, "x = 2h mirrors x = 0");
  ok(/symmetric/.test(cells[2].hints[0]) && /symmetric/.test(cells[0].hints[0]), "hints point out symmetry");
  const vertex = items["notice-vertex"];
  ok(vertex.check([String(h), String(k)]) === true && vertex.check([String(k), String(h)]) === (h === k), "vertex (h, k)");
  ok(vertex.check(["", String(k)]) === null, "blank not counted");
  ok(vertex.prompt.includes(extreme), "asks for highest/lowest");

  // 3. Represent: y = [a](x - [h])^2 + [k], then 4 graphs
  const eq = items["represent-equation"];
  ok(eq.check([String(a), String(h), String(k)]) === true, "equation right");
  ok(eq.check([String(-a), String(h), String(k)]) === false, "wrong sign of a rejected");
  ok(eq.check([String(a), String(-h), String(k)]) === false, "wrong sign of h rejected");
  ok(eq.check([String(a), String(h)]) === null, "missing box not counted");
  const match = items["represent-match"];
  ok(match.options.map((o) => o.text).join() === "Graph A,Graph B,Graph C,Graph D", "letters A-D");
  const byKey = Object.fromEntries(match.options.map((o) => [o.key, o.graph]));
  ok(byKey.correct.a === a && byKey.correct.h === h && byKey.correct.k === k, "correct graph");
  if (byKey["wrong-sign"]) ok(byKey["wrong-sign"].a === -a && byKey["wrong-sign"].h === h, "wrong sign of a");
  if (byKey["wrong-h"]) ok(byKey["wrong-h"].h === -h && byKey["wrong-h"].a === a, "h with the wrong sign");
  if (byKey["no-k"]) ok(byKey["no-k"].k === 0 && byKey["no-k"].h === h, "k ignored");
  ok(match.graphFit.every((g) => g !== byKey["wrong-h"]), "axes not sized to the steep wrong-h curve");
  positions[match.options.findIndex((o) => o.key === "correct")]++;
  // all four curves clearly different
  const at = (g, x) => g.a * (x - g.h) ** 2 + g.k;
  const xs = Array.from({ length: 4 * h + 1 }, (_, i) => i / 2);
  const ys = xs.map((x) => y(x));
  const size = Math.max(1, Math.max(...ys) - Math.min(0, ...ys));
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const gap = Math.max(...xs.map((x) => Math.abs(at(match.options[i].graph, x) - at(match.options[j].graph, x))));
    ok(gap >= 0.08 * size, `graphs ${match.options[i].key} / ${match.options[j].key} differ`);
  }

  // 4. Solve: reverse question with a whole x; then the zoomed graph reading
  const solve = items["solve-question"];
  const kind = steps[3].solveQuestion;
  ok(steps.every((s) => s.logFields.solveQuestion === kind), "solve question type logged");
  ok(Number.isInteger(solve.answer) && y(solve.answer) === solve.target, "answer is a whole x at the target");
  ok(solve.check(String(solve.answer)) && !solve.check(String(solve.answer + 1)), "solve check");
  if (kind === "return") ok(solve.answer === 2 * h && solve.target === y(0), "back at the start: x = 2h");
  else {
    ok(solve.answer > h + 1 && solve.answer < 2 * h, "target: after the turning point, not in the table");
    ok(solve.hints.every((t) => typeof t !== "string" || !badWording.test(t)), "sign-aware solve hints");
  }
  if (h === 2) ok(kind === "return", "h = 2: no whole target besides the start");
  ok(!solve.prompt.includes("{"), `filled prompt: ${solve.prompt}`);
  solveKinds[kind] = (solveKinds[kind] ?? 0) + 1;
  const read = items["solve-read"];
  ok(read.readX >= 0 && read.readX <= 2 * h && ![0, h - 1, h, h + 1, 2 * h].includes(read.readX) && read.readX !== solve.answer, "reading x");
  ok(read.yStep === zoomedView(quad, params).yStep, "reading tolerance from the zoomed graph");
  ok(steps[3].graphHighlight.x === solve.answer && steps[3].graphHighlight.y === solve.target, "answer highlighted");

  // 5. Explain: h and k, using the story's labels
  ok(items["explain-h"].check("correct") && !items["explain-h"].check("k-meaning"), "explain h");
  ok(items["explain-k"].check("correct") && !items["explain-k"].check("h-meaning"), "explain k");
  if (scenario) ok(items["explain-h"].options.some((o) => o.text.includes(scenario.units.x)), "explain uses story units");

  // 6. Transfer: f(0) (or f(1) when h = 2), f(h + 2), f(h - 2), and why they are equal
  const [first, rightItem, leftItem, why] = steps[5].items;
  ok(first.x === (h === 2 ? 1 : 0), "first transfer value");
  ok(rightItem.x === h + 2 && leftItem.x === h - 2 && rightItem.answer === leftItem.answer, "f(h + 2) = f(h - 2)");
  for (const it of [first, rightItem, leftItem]) ok(it.check(String(y(it.x))), `f(${it.x})`);
  ok(why.check("correct") && !why.check("sum"), "why equal");
  ok(steps[5].introMath.startsWith("f(x) = "), "function notation");

  // every item: dev auto-answer is right, two readable sign-aware hints
  run.steps.forEach((step, si) => {
    for (const it of step.items) {
      ok(it.check(engine.autoAnswerFor(it)) === true, `auto-answer ${it.id}`);
      ok(it.hints?.length === 2, `2 hints ${it.id}`);
      engine.requestHint(run, si, it.id);
      engine.requestHint(run, si, it.id);
      for (const t of engine.getProgress(run, it.id).hints) {
        ok(!/undefined|NaN/.test(t) && !badWording.test(t), `hint ${it.id}: ${t}`);
      }
    }
  });

  // the whole worksheet can be finished
  const done = engine.createRun(flow, quad, params, { scenario, values });
  done.steps.forEach((step, si) => {
    const groupCells = step.items.filter((it) => it.group);
    if (groupCells.length) engine.submitGroup(done, si, groupCells.map((it) => [it.id, engine.autoAnswerFor(it)]));
    for (const it of step.items.filter((i) => !i.group)) engine.submitAnswer(done, si, it.id, engine.autoAnswerFor(it));
    ok(engine.isStepComplete(done, si), `step ${step.id} completes`);
  });
}

// The guided stories don't give away "back at the start after 2h"
for (const interest of interests) {
  for (const variant of ["max", "min"]) {
    const sc = getScenario("quadratic", interest, variant);
    ok(sc.guidedStory && !sc.guidedStory.includes("{xEnd}") && sc.story.includes("{xEnd}"), `${interest}/${variant}: guided story hides 2h`);
    ok(sc.reverseQuestion.includes("{target}") && sc.returnQuestion, `${interest}/${variant}: solve questions`);
  }
}

// Graph options are always four clearly different curves, for every allowed (a, h, k)
for (const a of quad.constraints.aValues) for (let h = 2; h <= 5; h++) for (let k = 0; k <= 60; k++) {
  const params = { a, h, k, xMin: 0, xMax: 2 * h };
  if (!quad.validate(params).valid) continue;
  const opts = quadraticGraphOptions(a, h, k, 0, 2 * h);
  ok(opts.length === 4 && opts[0].key === "correct", `options a=${a} h=${h} k=${k}`);
}

console.log("solve question kinds:", solveKinds, "| correct graph position A-D:", positions.join(" / "));
console.log(`All ${checks} quadratic checks passed.`);
