// Linear flow logic. Run with `npm test` (or node tests/logic/linear.test.mjs).
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { ROOT as dir, RUNS } from "../helpers.mjs";
const load = (p) => import(pathToFileURL(path.join(dir, p)).href);

const { default: linear } = await load("js/concepts/algebra/linearEquation.js");
const { default: flow, equationOptions, looksLikeLine, REPRESENT_FORMATS } = await load("js/flows/linearFlow.js");
const engine = await load("js/core/flowEngine.js");
const { getScenario } = await load("js/data/sampleScenarios.js");
const { steps: sequenceSteps } = await load("js/core/sequence.js");

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };

// ---- 1. equation distractors ----
const key = (o) => `${o.m}|${o.b}`;
for (let m = -10; m <= 10; m++) {
  if (m === 0) continue;
  for (let b = -10; b <= 50; b++) {
    const opts = equationOptions(m, b);
    ok(opts.length === 4, "4 options");
    ok(new Set(opts.map(key)).size === 4, `unique options for m=${m}, b=${b}`);
    ok(opts.every((o) => o.m !== 0), `no zero slope for m=${m}, b=${b}`);
    ok(opts[0].key === "correct" && opts[0].m === m && opts[0].b === b, "correct option first");
  }
}
// graph version: same rules plus "never looks like the correct line", for every valid (m, b)
let graphReplacements = 0;
for (let m = -10; m <= 10; m++) {
  for (let b = 0; b <= 50; b++) {
    if (!m || !linear.validate({ m, b, xMin: 0, xMax: 10 }).valid) continue;
    const tooClose = looksLikeLine(m, b, 0, 10);
    const opts = equationOptions(m, b, tooClose);
    ok(opts.length === 4 && new Set(opts.map(key)).size === 4 && opts.every((o) => o.m !== 0), `graph options valid m=${m} b=${b}`);
    ok(opts[0].key === "correct" && opts.slice(1).every((o) => !tooClose(o)), `no look-alike m=${m} b=${b}`);
    // only look-alikes changed compared with the text rule
    const plain = equationOptions(m, b);
    if (plain.some((o, i) => key(o) !== key(opts[i]))) graphReplacements++;
  }
}
console.log("graph option sets changed by the look-alike rule:", graphReplacements);
console.log("m=10, b=1 graphs:", equationOptions(10, 1, looksLikeLine(10, 1, 0, 10)).map((o) => `${o.key}: y=${o.m}x+${o.b}`).join(" | "));
console.log("b=0, m=3:", equationOptions(3, 0).map((o) => `${o.key}: y=${o.m}x+${o.b}`).join(" | "));
console.log("m=b=4:   ", equationOptions(4, 4).map((o) => `${o.key}: y=${o.m}x+${o.b}`).join(" | "));

// ---- 2. every answer comes from evaluate, for many random scenarios ----
const interests = ["sports", "music", "gaming", "animals"];
const solveXs = new Map();
const correctPositions = [0, 0, 0, 0];
const solveKinds = {};
const randomFormats = {};
for (let run = 0; run < RUNS; run++) {
  const params = linear.generateParams();
  const values = linear.storyValues(params);
  const scenario = run % 5 === 0 ? null : getScenario(linear.id, interests[run % 4], values.variant);
  const asked = ["write", "choose", "both", "random"][run % 4];
  const steps = flow.buildSteps(linear, params, { scenario, values, settings: { representFormat: asked } });
  const format = steps[2].format;
  ok(asked === "random" ? REPRESENT_FORMATS.includes(format) : format === asked, `format ${asked} -> ${format}`);
  if (asked === "random") randomFormats[format] = (randomFormats[format] ?? 0) + 1;
  ok(steps.every((s) => s.logFields.representFormat === format), "format in logFields of every step");
  // Never the same move twice in one scenario
  const moves = steps.flatMap((s) => s.items).map((i) => i.move).filter(Boolean);
  ok(new Set(moves).size === moves.length, `no repeated move: ${moves}`);
  const expectedMoves = { write: "story-to-equation", choose: "story-to-equation", both: "story-to-equation,equation-to-graph" }[format];
  ok(moves.join() === expectedMoves, `moves for ${format}: ${moves}`);
  const y = (x) => linear.evaluate(params, x);

  ok(steps.map((s) => s.id).join() === sequenceSteps.map((s) => s.id).join(), "step ids match sequence.js");
  const items = Object.fromEntries(steps.flatMap((s) => s.items).map((i) => [i.id, i]));

  // Explore: only the right direction passes
  const dir = params.m > 0 ? "up" : "down";
  for (const k of ["up", "down", "same"]) ok(items["explore-predict"].check(k) === (k === dir), "predict");

  // Notice: table cells and slope
  for (const x of [0, 5, 8]) {
    ok(items[`notice-y-at-${x}`].check(String(y(x))) === true, "table right");
    ok(items[`notice-y-at-${x}`].check(String(y(x) + 1)) === false, "table wrong");
  }
  ok(steps[1].tables["notice-table"].given.every((g) => g.y === y(g.x)), "given rows from evaluate");
  ok(items["notice-slope"].check(String(params.m)) === true, "slope right");
  ok(items["notice-slope"].check(String(Math.abs(params.m))) === (params.m > 0), "slope sign matters");

  // Represent items per format
  const ids = steps[2].items.map((i) => i.id).join();
  ok(ids === { write: "represent-equation", choose: "represent-choose", both: "represent-equation,represent-match" }[format], `items ${ids}`);
  if (format === "write" || format === "both") {
    ok(items["represent-equation"].check([String(params.m), String(params.b)]) === true, "pair right");
    ok(items["represent-equation"].check([String(params.b), String(params.m)]) === (params.m === params.b), "pair swapped");
    ok(items["represent-equation"].check(["", String(params.b)]) === null, "pair blank not counted");
  }
  if (format === "write") ok(steps[2].revealAfter["represent-equation"].join() === "formula,graph", "write reveals both");
  if (format === "choose") {
    const choose = items["represent-choose"];
    const keys = new Set(equationOptions(params.m, params.b).map((o) => o.key));
    ok(choose.options.length === 4 && choose.options.every((o) => keys.has(o.key) && o.text.startsWith("\\(y = ")), "choose: 4 equations");
    ok(new Set(choose.options.map((o) => o.text)).size === 4, "choose: 4 different equations");
    ok(choose.check("correct") && !choose.check("swapped") && choose.answerText === `\\(${linear.formulaLatex(params)}\\)`, "choose check");
    ok(steps[2].revealAfter["represent-choose"].join() === "formula,graph", "choose reveals both");
  }
  if (format === "both") {
  const match = items["represent-match"];
  ok(match.options.length === 4 && match.check("correct") && !match.check("swapped"), "match");
  // Graph matching: 4 graphs from equationOptions, named A-D in display order, nothing else as text
  ok(match.display === "graphs" && match.prompt === "Which graph matches your equation?", "graph item");
  ok(match.options.map((o) => o.text).join() === "Graph A,Graph B,Graph C,Graph D", "letters in order");
  const expected = new Map(equationOptions(params.m, params.b, looksLikeLine(params.m, params.b, params.xMin, params.xMax)).map((o) => [o.key, o]));
  ok(match.options.every((o) => {
    const e = expected.get(o.key);
    return e && o.graph.m === e.m && o.graph.b === e.b && o.graph.xMin === params.xMin && o.graph.xMax === params.xMax;
  }), "graph params match the distractor rule");
  ok(new Set(match.options.map((o) => `${o.graph.m}|${o.graph.b}`)).size === 4, "4 different lines");
  const correctOpt = match.options.find((o) => o.key === "correct");
  ok(match.answerText === correctOpt.text, "answer text is the correct letter");
  correctPositions[match.options.indexOf(correctOpt)]++;
  const rev = steps[2].revealAfter;
  ok(rev["represent-equation"].join() === "formula" && rev["represent-match"].join() === "graph", "reveal order");
  }

  // Solve: rising -> forward question at a big x; falling -> reverse question (solve for x)
  const solve = items["solve-question"];
  ok(steps.every((st) => st.logFields.solveQuestion === (params.m > 0 ? "forward" : "reverse")), "solve type logged");
  ok(!solve.prompt.includes("{"), `no unfilled placeholder: ${solve.prompt}`);
  if (params.m > 0) {
    ok(solve.qx >= 20 && solve.qx <= 60, "rising: big x");
    ok(solve.check(String(y(solve.qx))) === true && solve.check(String(y(solve.qx) + 1)) === false, "forward answer");
    solveKinds["up big"] = (solveKinds["up big"] ?? 0) + 1;
  } else {
    const x = solve.answer, T = solve.target;
    ok(Number.isInteger(x) && x >= 0 && y(x) === T && T >= 0, `reverse: whole x with y(x) = target (${x}, ${T})`);
    ok(![0, 1, 2, 5, 8].includes(x), "reverse answer not in the table");
    ok(solve.check(String(x)) === true && solve.check(String(x + 1)) === false, "reverse answer is x");
    const expectKind = params.b % Math.abs(params.m) === 0 ? "zero" : Math.floor(params.b / Math.abs(params.m)) > params.xMax ? "past-graph" : "small";
    ok(solve.reverseKind === expectKind, `reverse kind ${solve.reverseKind} (m=${params.m}, b=${params.b})`);
    if (expectKind === "zero") ok(T === 0 && x === params.b / Math.abs(params.m), "y = 0 target");
    ok(solve.hints.every((h) => typeof h !== "string" || !/\+ ?-|add -|by -\d/.test(h)), "sign-aware reverse hints");
    if (scenario) ok(/After how many/.test(solve.prompt), `story reverse question: ${solve.prompt}`);
    solveKinds[`down ${solve.reverseKind}`] = (solveKinds[`down ${solve.reverseKind}`] ?? 0) + 1;
  }
  solveXs.set(solve.qx, (solveXs.get(solve.qx) ?? 0) + 1);

  // Explain
  ok(items["explain-m"].check("correct") && !items["explain-m"].check("start"), "explain m");
  ok(items["explain-b"].check("correct") && !items["explain-b"].check("slope"), "explain b");

  // Transfer: whole numbers, fraction, decimal within 0.01
  ok(items["transfer-f-2"].check(String(y(2))) && items["transfer-f-12"].check(String(y(12))), "f(2), f(12)");
  const exact = y(3 / 7);
  const frac = `${3 * params.m + 7 * params.b}/7`;
  const f = items["transfer-f-fraction"];
  ok(f.check(frac) === true, `fraction ${frac}`);
  ok(f.check(exact.toFixed(2)) === true, `decimal ${exact.toFixed(2)}`);
  ok(f.check((exact + 0.02).toFixed(2)) === false, "decimal 0.02 off rejected");
  ok(f.check("abc") === null, "unreadable not counted");
}
console.log("correct graph position A-D:", correctPositions.join(" / "));
console.log('formats picked by "random":', randomFormats);
assert.throws(() => flow.buildSteps(linear, { m: 3, b: 12, xMin: 0, xMax: 10 }, { settings: { representFormat: "draw" } }), /Unknown representFormat/);
ok(flow.settings.representFormat === "random", "default setting is random");
console.log("solve x kinds:", solveKinds);
console.log("solve x range:", Math.min(...solveXs.keys()), "-", Math.max(...solveXs.keys()));

// ---- 3. personalized wording, one example ----
{
  const params = { m: 3, b: 12, xMin: 0, xMax: 10 };
  const values = linear.storyValues(params);
  const steps = flow.buildSteps(linear, params, { scenario: getScenario(linear.id, "sports", values.variant), values, settings: { representFormat: "both" } }, () => 0.5);
  const items = Object.fromEntries(steps.flatMap((s) => s.items).map((i) => [i.id, i]));
  console.log("predict:", items["explore-predict"].prompt);
  console.log("solve:  ", items["solve-question"].prompt, "->", items["solve-question"].answerText);
  console.log("explain m options:", items["explain-m"].options.map((o) => o.text));
  console.log("represent options:", items["represent-match"].options.map((o) => `${o.key}=${o.text}`).join(", "));
  console.log("transfer:", steps[5].introMath, "| f(3/7) answer:", items["transfer-f-fraction"].answerText);
  const neg = { m: -4, b: 5, xMin: 0, xMax: 10 };
  const negItems = flow.buildSteps(linear, neg, {}).flatMap((s) => s.items);
  console.log("m=-4,b=5 f(3/7):", negItems.find((i) => i.id === "transfer-f-fraction").answerText);
}

// ---- 4. engine: attempts, reveal, visibility, log ----
{
  const params = { m: 3, b: 12, xMin: 0, xMax: 10 };
  const run = engine.createRun(flow, linear, params, { settings: { representFormat: "both" } });

  // invalid input is not counted
  let r = engine.submitAnswer(run, 1, "notice-y-at-0", "hello");
  ok(r.status === "invalid" && r.entry === null && engine.getProgress(run, "notice-y-at-0").attempts === 0, "invalid");

  // visible: only the table group until it is done
  ok(engine.visibleItems(run, 1).map((i) => i.id).join() === "notice-y-at-0,notice-y-at-5,notice-y-at-8", "table first");
  ok(!engine.isStepComplete(run, 1), "notice incomplete");

  // No hint before trying, no automatic reveal: 5 wrong answers still not done
  ok(engine.requestHint(run, 1, "notice-y-at-0").entry !== null, "hint allowed (engine doesn't require a try)");
  run.progress["notice-y-at-0"].hints = []; // reset for the real sequence below
  for (let i = 0; i < 5; i++) {
    r = engine.submitAnswer(run, 1, "notice-y-at-0", String(100 + i));
    ok(r.status === "wrong" && r.entry.type === "answer" && r.entry.correct === false, "wrong");
  }
  ok(!engine.isItemDone(run, "notice-y-at-0"), "no automatic reveal after many wrong tries");
  ok(engine.getProgress(run, "notice-y-at-0").feedback.kind === "wrong" && !engine.getProgress(run, "notice-y-at-0").feedback.hint, "wrong feedback has no hint");

  // Show answer only after both hints
  ok(engine.revealAnswer(run, 1, "notice-y-at-0").entry === null, "no reveal before hints");
  r = engine.requestHint(run, 1, "notice-y-at-0");
  ok(r.entry.type === "hint" && r.entry.hint === 1 && r.entry.item === "notice-y-at-0", "hint 1 logged");
  const h1 = engine.getProgress(run, "notice-y-at-0").hints[0];
  ok(h1 === "From \\(x = 1\\) to \\(x = 0\\), \\(x\\) goes down by 1. How should \\(y\\) change?", `backwards hint 1: ${h1}`);
  ok(engine.revealAnswer(run, 1, "notice-y-at-0").entry === null, "no reveal after 1 hint");
  r = engine.requestHint(run, 1, "notice-y-at-0");
  ok(r.entry.hint === 2, "hint 2 logged");
  const h0b = engine.getProgress(run, "notice-y-at-0").hints[1];
  ok(h0b.includes("\\(y\\) goes up by the same amount (look from \\(x = 1\\) to \\(x = 2\\))") &&
    h0b.includes("undoes one step, so \\(y\\) goes down") && h0b.includes("Start at \\(y = 15\\)") && h0b.includes("subtract that amount from it"),
    `backwards hint 2 (m > 0): ${h0b}`);
  ok(engine.requestHint(run, 1, "notice-y-at-0").entry === null, "no hint 3");
  r = engine.revealAnswer(run, 1, "notice-y-at-0");
  ok(r.entry.type === "reveal" && r.entry.hintsUsed === 2 && engine.getProgress(run, "notice-y-at-0").revealed, "reveal logged");
  ok(engine.submitAnswer(run, 1, "notice-y-at-0", "12").status === "ignored", "done items ignore answers");

  // Targeted hint for x = 8: nearest known row depends on what is solved
  engine.submitAnswer(run, 1, "notice-y-at-8", "1");
  engine.requestHint(run, 1, "notice-y-at-8");
  const h8a = engine.getProgress(run, "notice-y-at-8").hints[0];
  ok(h8a.includes("From \\(x = 2\\) to \\(x = 8\\)") && h8a.includes("by 6"), `x=8 before x=5 solved: ${h8a}`);
  // No auto-fill here: x = 0 was revealed, not right on the first try
  const g = engine.submitGroup(run, 1, [["notice-y-at-5", "27"]]);
  ok(g.entries.length === 1 && !engine.isItemDone(run, "notice-y-at-8"), "no auto-fill after a reveal");
  engine.requestHint(run, 1, "notice-y-at-8");
  const h8b = engine.getProgress(run, "notice-y-at-8").hints[1];
  ok(h8b.includes("times 3") && h8b.includes("Start at \\(y = 27\\) (the value at \\(x = 5\\))") && h8b.includes("add that amount times 3 to it") && !h8b.includes("Going back"),
    `x=8 hint 2 after x=5 solved: ${h8b}`);
  // Falling line, backwards: y goes UP when going back to x = 0
  {
    const neg = engine.createRun(flow, linear, { m: -4, b: 50, xMin: 0, xMax: 10 }, {});
    engine.requestHint(neg, 1, "notice-y-at-0");
    engine.requestHint(neg, 1, "notice-y-at-0");
    const [n1, n2] = engine.getProgress(neg, "notice-y-at-0").hints;
    ok(n1.includes("goes down by 1"), `neg hint 1: ${n1}`);
    ok(n2.includes("\\(y\\) goes down by the same amount") && n2.includes("so \\(y\\) goes up") && n2.includes("Start at \\(y = 46\\)") && n2.includes("add that amount to it"),
      `backwards hint 2 (m < 0): ${n2}`);
    console.log("backwards hints (m=-4, b=50):\n  1:", n1, "\n  2:", n2);
  }
  engine.submitAnswer(run, 1, "notice-y-at-8", "36");
  ok(engine.visibleItems(run, 1).at(-1).id === "notice-slope", "slope question appears after table");
  engine.submitAnswer(run, 1, "notice-slope", "3");
  ok(engine.isStepComplete(run, 1), "notice complete");

  // represent: formula + graph only after the equation is typed correctly
  ok(engine.visibleRepresentations(run, 2).join() === "story", "story only before equation");
  ok(engine.visibleItems(run, 2).length === 1, "match hidden before equation");
  r = engine.submitAnswer(run, 2, "represent-equation", ["3", "12"]);
  ok(r.status === "correct", "equation right");
  ok(engine.visibleRepresentations(run, 2).sort().join() === "formula,story", "formula revealed, big graph still hidden");

  // choice: wrong picks are remembered and logged by key
  r = engine.submitAnswer(run, 2, "represent-match", "swapped");
  ok(r.entry.answer === "swapped" && engine.getProgress(run, "represent-match").wrongKeys.includes("swapped"), "pick recorded");

  // Skip: allowed to move on, marked until finished
  ok(!engine.canMoveOn(run, 2), "can't move on from unfinished step");
  r = engine.skipStep(run, 2);
  ok(r.entry.type === "skip" && r.entry.step === "represent" && r.entry.unfinished.join() === "represent-match", "skip logged");
  ok(engine.canMoveOn(run, 2) && engine.stepStatus(run, 2) === "skipped", "skipped step can be left");
  ok(engine.stepStatus(run, 1) === "done" && engine.stepStatus(run, 3) === null, "statuses");
  engine.markVisited(run, 4);
  ok(engine.canVisit(run, 2) && engine.canVisit(run, 4) && !engine.canVisit(run, 5), "visit up to furthest");
  ok(!engine.visibleRepresentations(run, 2).includes("graph"), "big graph hidden after a wrong pick");
  engine.submitAnswer(run, 2, "represent-match", "correct");
  ok(engine.visibleRepresentations(run, 2).includes("graph"), "big graph after the right pick");
  ok(engine.stepStatus(run, 2) === "done", "finished skipped step shows done");
  ok(engine.skipStep(run, 2).entry === null, "can't skip a finished step");
}

// ---- 5. auto-fill on a perfect start ----
for (const [label, answers, expectFill] of [
  ["0 and 5 right first try, 8 blank", [["notice-y-at-0", "12"], ["notice-y-at-5", "27"]], true],
  ["all three right", [["notice-y-at-0", "12"], ["notice-y-at-5", "27"], ["notice-y-at-8", "36"]], false],
  ["8 typed wrong (not auto-filled)", [["notice-y-at-0", "12"], ["notice-y-at-5", "27"], ["notice-y-at-8", "1"]], false],
  ["only 0 right", [["notice-y-at-0", "12"]], false],
]) {
  const run = engine.createRun(flow, linear, { m: 3, b: 12, xMin: 0, xMax: 10 }, {});
  const { entries } = engine.submitGroup(run, 1, answers);
  const filled = entries.some((e) => e.type === "autofill");
  ok(filled === expectFill, `autofill: ${label}`);
  if (expectFill) {
    ok(engine.getProgress(run, "notice-y-at-8").autoFilled && engine.isItemDone(run, "notice-y-at-8"), "8 filled");
    ok(run.groupMessages["notice-table"] === "Nice, you've got the pattern!", "pattern message");
    ok(entries.at(-1).items.join() === "notice-y-at-8", "autofill logged");
  }
}
{
  // a wrong first try on x = 0 means no auto-fill later, even when fixed
  const run = engine.createRun(flow, linear, { m: 3, b: 12, xMin: 0, xMax: 10 }, {});
  engine.submitGroup(run, 1, [["notice-y-at-0", "1"]]);
  const { entries } = engine.submitGroup(run, 1, [["notice-y-at-0", "12"], ["notice-y-at-5", "27"]]);
  ok(!entries.some((e) => e.type === "autofill"), "no autofill after a wrong first try");
}

// ---- 6. every item has 2 hints, all render to text for random scenarios ----
for (let n = 0; n < Math.min(RUNS, 200); n++) {
  const params = linear.generateParams();
  const values = linear.storyValues(params);
  const run = engine.createRun(flow, linear, params, { scenario: getScenario(linear.id, interests[n % 4], values.variant), values });
  run.steps.forEach((step, si) => {
    for (const item of step.items) {
      ok(item.hints?.length === 2, `2 hints for ${item.id}`);
      engine.submitAnswer(run, si, item.id, item.type === "pair" ? ["999", "999"] : item.type === "choice" ? "nope" : "999");
      engine.requestHint(run, si, item.id);
      engine.requestHint(run, si, item.id);
      const texts = engine.getProgress(run, item.id).hints;
      ok(texts.length === 2 && texts.every((t) => typeof t === "string" && t.length > 10 && !t.includes("undefined") && !t.includes("NaN")), `hint text ${item.id}: ${texts}`);
    }
  });
}

// ---- 7. Solve/Explain hide formula + graph until Represent is complete ----
for (const format of ["write", "choose", "both"]) {
  const params = { m: -4, b: 50, xMin: 0, xMax: 10 };
  const run = engine.createRun(flow, linear, params, { settings: { representFormat: format } });
  const reps = (i) => engine.visibleRepresentations(run, i).sort().join();
  ok(reps(3) === "story" && reps(4) === "story", `${format}: not started -> story only`);
  engine.skipStep(run, 2);
  ok(reps(3) === "story" && reps(4) === "story", `${format}: skipped -> story only`);
  const items = run.steps[2].items;
  // finish all but the last item: still hidden
  for (const it of items.slice(0, -1)) {
    engine.submitAnswer(run, 2, it.id, it.type === "pair" ? ["-4", "50"] : "correct");
  }
  ok(reps(3) === "story", `${format}: unfinished -> story only`);
  // reveal the last one (after both hints): now shown
  const last = items.at(-1);
  engine.requestHint(run, 2, last.id);
  engine.requestHint(run, 2, last.id);
  engine.revealAnswer(run, 2, last.id);
  ok(reps(3) === "formula,graph,story" && reps(4) === "formula,graph,story", `${format}: revealed -> formula and graph`);
  ok(run.steps[3].referenceTable === "notice-table" && run.steps[4].referenceTable === "notice-table", "reference table on Solve/Explain");
}
{
  // reference table: given rows + what the student found, ? for the rest
  const run = engine.createRun(flow, linear, { m: 3, b: 12, xMin: 0, xMax: 10 }, {});
  engine.submitAnswer(run, 1, "notice-y-at-0", "12");
  engine.submitAnswer(run, 1, "notice-y-at-5", "99");
  const ref = engine.referenceTable(run, "notice-table");
  ok(JSON.stringify(ref.rows.map((r) => [r.x, r.y])) === JSON.stringify([[0, 12], [1, 15], [2, 18], [5, null], [8, null]]), "reference rows");
  ok(engine.requestHint(run, 3, "solve-question").entry.type === "hint", "hint allowed before any attempt");
}

// ---- 8. sign-aware hint wording, for every valid (m, b) ----
const badWording = /\+ ?-\d|\+ ?\(-|add -|by -\d|\(-\d|changes? by -?\d|- -\d|Multiply -\d|multiply -\d/;
let hintCount = 0;
for (let m = -10; m <= 10; m++) {
  for (let b = 0; b <= 50; b += 7) {
    const params = { m, b, xMin: 0, xMax: 10 };
    if (!m || !linear.validate(params).valid) continue;
    for (const format of ["write", "choose", "both"]) {
      const values = linear.storyValues(params);
      const scenario = getScenario(linear.id, "gaming", values.variant);
      const run = engine.createRun(flow, linear, params, { scenario, values, settings: { representFormat: format } });
      run.steps.forEach((step, si) => {
        for (const item of step.items) {
          engine.requestHint(run, si, item.id);
          engine.requestHint(run, si, item.id);
          for (const text of engine.getProgress(run, item.id).hints) {
            hintCount++;
            ok(!badWording.test(text), `no "add -N" wording (m=${m}): ${text}`);
            // y-change phrases follow the sign of m
            // Going BACKWARDS flips the direction ("undoes one step, so y goes up"), so
            // that one sentence is removed before checking the per-step direction.
            const forward = text.replace(/Going back[^.]*\./g, "");
            if (m < 0) ok(!/\\\(y\\\) (goes|went) up|y goes up by|health left goes up/.test(forward), `m<0 says down: ${text}`);
            if (m > 0) ok(!/\\\(y\\\) (goes|went) down|y goes down by/.test(forward), `m>0 says up: ${text}`);
            const back = text.match(/Going back[^.]*\./)?.[0];
            if (back) ok(back.includes(m < 0 ? "goes up" : "goes down"), `backwards flips the direction (m=${m}): ${back}`);
          }
        }
      });
    }
  }
}
console.log("hint texts checked for sign-aware wording:", hintCount);

// ---- 9. answering again after a correct answer ----
{
  const params = { m: 3, b: 12, xMin: 0, xMax: 10 }; // f(3/7) = 93/7 ≈ 13.29
  const run = engine.createRun(flow, linear, params, { settings: { representFormat: "both" } });
  const T = 5;
  let r = engine.submitAnswer(run, T, "transfer-f-fraction", "13.29");
  const p = engine.getProgress(run, "transfer-f-fraction");
  ok(r.status === "correct" && p.feedback.exactText === "\\(\\frac{93}{7}\\)", `decimal accepted -> exact value: ${p.feedback.exactText}`);
  r = engine.submitAnswer(run, T, "transfer-f-fraction", "93/7");
  ok(r.status === "correct-again" && p.feedback.again && !p.feedback.exactText, "fraction after decimal: also correct, no exact line");
  ok(r.entry.type === "answer" && r.entry.reanswer === true && r.entry.correct === true && r.entry.answer === "93/7", "re-answer logged");
  r = engine.submitAnswer(run, T, "transfer-f-fraction", "13.286");
  ok(r.status === "correct-again" && p.feedback.exactText === "\\(\\frac{93}{7}\\)", "another decimal: exact value again");
  r = engine.submitAnswer(run, T, "transfer-f-fraction", "14");
  ok(r.status === "wrong-again" && r.entry.correct === false && r.entry.reanswer && p.done, "wrong re-answer logged, still done");
  r = engine.submitAnswer(run, T, "transfer-f-fraction", "abc");
  ok(r.status === "invalid" && r.entry === null && p.done, "unreadable re-answer not counted");
  ok(p.attempts === 1 && p.reanswers === 3, "first-try attempts unchanged by re-answers");

  // whole-number answers: no exact line, even for a decimal like 18.0
  r = engine.submitAnswer(run, T, "transfer-f-2", "18.0");
  ok(r.status === "correct" && !engine.getProgress(run, "transfer-f-2").feedback.exactText, "whole answer: no exact line");
  // fraction typed first: no exact line
  const run2 = engine.createRun(flow, linear, params, {});
  engine.submitAnswer(run2, T, "transfer-f-fraction", "93/7");
  ok(!engine.getProgress(run2, "transfer-f-fraction").feedback.exactText, "fraction typed: no exact line");

  // pair: equivalent form accepted again
  engine.submitAnswer(run, 2, "represent-equation", ["3", "12"]);
  r = engine.submitAnswer(run, 2, "represent-equation", ["3.0", "24/2"]);
  ok(r.status === "correct-again", "pair re-answer");

  // locked: revealed items, table cells, multiple choice
  engine.requestHint(run, 3, "solve-question"); engine.requestHint(run, 3, "solve-question");
  engine.revealAnswer(run, 3, "solve-question");
  ok(engine.submitAnswer(run, 3, "solve-question", "1").status === "ignored", "revealed: locked");
  engine.submitAnswer(run, 1, "notice-y-at-0", "12");
  ok(engine.submitAnswer(run, 1, "notice-y-at-0", "12.0").status === "ignored", "table cell: locked");
  engine.submitAnswer(run, 0, "explore-predict", "up");
  ok(engine.submitAnswer(run, 0, "explore-predict", "up").status === "ignored", "choice: locked");
}

console.log(`\nAll ${checks} checks passed.`);
