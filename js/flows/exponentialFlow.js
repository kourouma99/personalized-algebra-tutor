/*
  exponentialFlow.js — the guided worksheet for the exponential concept (y = a · b^x).

  Same engine and rules as linearFlow.js: every correct answer comes from
  concept.evaluate(params, x) or the params, hints are given on request, steps can
  be skipped, typed answers can be re-answered, and everything is logged.
  The difference is the pedagogy: exponential change is about MULTIPLYING, so the
  hints talk about multiplying and dividing, never adding or subtracting.

    a -> the starting amount (y when x = 0)
    b -> what y is multiplied by each time x goes up by 1 (b > 1 grows, 0 < b < 1 shrinks)

  Steps (same order as core/sequence.js):
    1. Explore   — will y grow, shrink, or stay the same? (from b)
    2. Notice    — x = 1, 2 given; fill in x = 0, 3, 5; then "multiplied by what?" (b)
    3. Represent — type y = [ ]( [ ] )^x, then pick its graph from 4
    4. Solve     — the story's question, at an x not in the table, inside the range
    5. Explain   — what do a and b mean in the story?
    6. Transfer  — function notation: f(2), f(4), f(0)

  context (from main.js): { scenario, values } — see linearFlow.js.
*/

import { parseNumber, numbersMatch, fractionLatex } from "../core/answerCheck.js";
import { shuffle, lower, fill, choiceItem, numberItem, nearestKnown, range, graphReadItem } from "./flowHelpers.js";

const TABLE_XS = [0, 1, 2, 3, 5];
const GIVEN_XS = [1, 2]; // the student finds x = 0 by working backwards: dividing
const TRANSFER_XS = [2, 4, 0];
const READ_XS = [0.5, 1.5, 2.5, 3.5, 4.5]; // graph-reading question, between the table's whole x values

// A straight line, only for drawing the "linear look-alike" wrong graph
const LINE = { evaluate: (p, x) => p.m * x + p.b };

// "the same number" written for display: 0.5 -> "0.5", 1.5 -> "1.5"
const show = (n) => String(Number(n.toFixed(6)));

// b as a fraction for "Exact value: …" (0.5 -> \frac{1}{2}, 1.5 -> \frac{3}{2}); null if whole
function exactFraction(b) {
  if (Number.isInteger(b)) return null;
  for (const d of [2, 3, 4, 5, 8, 10]) {
    if (Number.isInteger(b * d)) return `\\(${fractionLatex(b * d, d)}\\)`;
  }
  return null;
}

/*
  Targeted hints for one missing table cell, multiplicative:
    1. "From x = 1 to x = 0, x goes down by 1. How should y change?"
    2. "Each time x goes up by 1, y is multiplied by the same number (…). Going back
        from x = 1 to x = 0 undoes one step, so divide y = 64 by that number."
  The per-step factor is described, never given, and read from the two given rows.
*/
export function exponentialCellHints(x, givenRows, cells, y) {
  const [first, second] = givenRows;
  const times = (n) => (n === 1 ? "" : ` ${n} times`);
  return [
    ({ solved }) => {
      const { from, steps, dir } = nearestKnown(x, givenRows, cells, y, solved);
      return `From \\(x = ${from.x}\\) to \\(x = ${x}\\), \\(x\\) goes ${dir} by ${steps}. How should \\(y\\) change?`;
    },
    ({ solved }) => {
      const { from, steps, dx } = nearestKnown(x, givenRows, cells, y, solved);
      const pattern =
        `Each time \\(x\\) goes up by 1, \\(y\\) is multiplied by the same number ` +
        `(divide \\(y\\) at \\(x = ${second.x}\\) by \\(y\\) at \\(x = ${first.x}\\) to find it).`;
      if (dx < 0) {
        return `${pattern} Going back from \\(x = ${from.x}\\) to \\(x = ${x}\\) undoes ${steps === 1 ? "one step" : `${steps} steps`}, ` +
          `so divide \\(y = ${from.y}\\) by that number${times(steps)}.`;
      }
      return `${pattern} Start at \\(y = ${from.y}\\) (the value at \\(x = ${from.x}\\)) and multiply by that number${times(steps)}.`;
    },
  ];
}

/*
  The four graphs for "Which graph matches your equation?":
    correct       y = a · b^x
    swapped       y = b · a^x            (a and b swapped)
    linear        the straight line through the same first two points, (0, a) and (1, ab)
    wrong-base    y = a · (1/b)^x        (grows instead of shrinks, or the other way)
  Each is { key, graph } where graph is params for the exponential concept, or
  { concept: LINE, params } for the straight line. Any duplicate curve (none expected)
  is replaced by y = a · (b + 1)^x.
*/
export function exponentialGraphOptions(a, b, xMin, xMax) {
  const exp = (A, B) => ({ a: A, b: B, xMin, xMax });
  const candidates = [
    { key: "correct", graph: exp(a, b) },
    { key: "swapped", graph: exp(b, a) },
    { key: "linear", graph: { concept: LINE, params: { m: a * (b - 1), b: a, xMin, xMax } } },
    { key: "wrong-base", graph: exp(a, 1 / b) },
  ];
  const valueAt = (g, x) => (g.concept ? g.concept.evaluate(g.params, x) : g.a * g.b ** x);
  const signature = (g) => range(xMin, xMax).map((x) => valueAt(g, x).toFixed(6)).join("|");
  const seen = new Set();
  let shift = 1;
  return candidates.map((c) => {
    let option = c;
    while (seen.has(signature(option.graph))) {
      option = { key: `replacement-for-${c.key}`, graph: exp(a, b + shift) };
      shift += 1;
    }
    seen.add(signature(option.graph));
    return option;
  });
}

export default {
  id: "exponential-guided",

  buildSteps(concept, params, context = {}, rng = Math.random) {
    const { a, b } = params;
    const y = (x) => concept.evaluate(params, x);
    const latex = (p) => concept.formulaLatex(p);
    const grows = b > 1;

    const scenario = context.scenario ?? null;
    const labels = scenario?.labels ?? { x: "x", y: "y" };
    const units = scenario?.units ?? { x: "steps", y: "units" };
    const X = lower(labels.x);
    const Y = lower(labels.y);
    const named = (label, v) => (scenario ? `${label} (\\(${v}\\))` : `\\(${v}\\)`);
    const bText = show(b);
    const bExact = exactFraction(b);
    const power = (x) => `\\(${a} \\cdot ${bText}^{${x}}\\)`;

    // ---- 1. Explore ----
    const explore = {
      id: "explore",
      instructions: "Read the story. Before doing any math, make a prediction.",
      show: ["story"],
      items: [
        choiceItem({
          id: "explore-predict",
          prompt: `As ${named(X, "x")} increases, ${named(Y, "y")} will…`,
          options: [
            { key: "grow", text: "grow" },
            { key: "shrink", text: "shrink" },
            { key: "same", text: "stay the same" },
          ],
          correctKey: grows ? "grow" : "shrink",
          hints: [
            "Read the story again: each time \\(x\\) goes up by 1, what is the amount multiplied by?",
            `In the story, each time ${X} goes up by 1, ${Y} is multiplied by ${bText}. ` +
              `Multiplying by a number ${grows ? "bigger" : "smaller"} than 1 makes it ${grows ? "bigger" : "smaller"}.`,
          ],
          rng,
        }),
      ],
    };

    // ---- 2. Notice ----
    const givenRows = GIVEN_XS.map((x) => ({ x, y: y(x) }));
    const cells = TABLE_XS.filter((x) => !GIVEN_XS.includes(x)).map((x) => ({ x, id: `notice-y-at-${x}` }));
    const [g1, g2] = givenRows;
    const notice = {
      id: "notice",
      instructions: "Use the story to fill in the table. Look for a pattern.",
      show: ["story"],
      tables: {
        "notice-table": {
          prompt: "Fill in the missing values of \\(y\\).",
          columns: { x: labels.x, y: labels.y },
          given: givenRows,
          // First two missing cells (x = 0 and x = 3) right on the first try -> fill in x = 5
          autoFill: { after: 2, message: "Nice, you've got the pattern!" },
        },
      },
      items: [
        ...cells.map(({ x, id }) =>
          numberItem({
            id,
            prompt: `\\(y\\) when \\(x = ${x}\\)`,
            answer: y(x),
            group: "notice-table",
            x,
            hints: exponentialCellHints(x, givenRows, cells, y),
          })
        ),
        numberItem({
          id: "notice-factor",
          prompt: "Each time \\(x\\) goes up by 1, \\(y\\) is multiplied by what number?",
          answer: b,
          exactText: bExact ?? undefined,
          hints: [
            `Compare two rows next to each other, like \\(x = ${g1.x}\\) and \\(x = ${g2.x}\\). How many times bigger (or smaller) is \\(y\\)?`,
            `Divide: \\(${g2.y} \\div ${g1.y}\\). ` +
              (grows
                ? "\\(y\\) gets bigger, so the number is more than 1."
                : "\\(y\\) gets smaller, so the number is between 0 and 1 (a fraction like 1/2 is fine)."),
          ],
        }),
      ],
    };

    // ---- 3. Represent: write the equation, then pick its graph ----
    const graphOptions = shuffle(exponentialGraphOptions(a, b, params.xMin, params.xMax), rng).map((o, i) => ({
      key: o.key,
      text: `Graph ${"ABCD"[i]}`,
      graph: o.graph,
    }));
    const fitKeys = ["correct", "linear"]; // the others run off the edge, which is easy to tell apart
    const represent = {
      id: "represent",
      instructions: "Turn the pattern into an equation, then find its graph.",
      show: ["story"],
      format: "both",
      revealAfter: { "represent-equation": ["formula"], "represent-match": ["graph"] },
      items: [
        {
          id: "represent-equation",
          move: "story-to-equation",
          type: "pair",
          prompt: "Write the equation for this story.",
          parts: ["y =", "\\Big("],
          after: "\\Big)^{x}",
          autoAnswer: [String(a), bText], // dev mode only
          check: (raw) => {
            const [start, factor] = (raw ?? []).map(parseNumber);
            if (start == null || factor == null) return null;
            return numbersMatch(start, a) && numbersMatch(factor, b);
          },
          answerText: `\\(${latex(params)}\\)`,
          hints: [
            ({ answer }) => {
              const [start, factor] = (answer ?? []).map(parseNumber);
              const startOk = start != null && numbersMatch(start, a);
              const factorOk = factor != null && numbersMatch(factor, b);
              if (startOk && !factorOk) return "Your first box is right. The number in the brackets is what \\(y\\) is multiplied by each step.";
              if (!startOk && factorOk) return "Your second box is right. The first number is the starting amount: \\(y\\) when \\(x = 0\\).";
              return "The first number is the starting amount. The number in the brackets is what \\(y\\) is multiplied by each step.";
            },
            `The starting amount is \\(y\\) when \\(x = 0\\), which is ${y(0)}. ` +
              "The number in the brackets is the one you found in Notice.",
          ],
        },
        {
          id: "represent-match",
          move: "equation-to-graph",
          type: "choice",
          display: "graphs",
          prompt: "Which graph matches your equation?",
          options: graphOptions,
          graphFit: graphOptions.filter((o) => fitKeys.includes(o.key)).map((o) => o.graph),
          check: (key) => key === "correct",
          answerText: graphOptions.find((o) => o.key === "correct").text,
          hints: [
            `Look where each graph crosses the \\(y\\)-axis (at \\(x = 0\\)). Your equation gives \\(y = ${y(0)}\\) there.`,
            `Your graph is a curve, not a straight line. It goes through \\((1, ${y(1)})\\) and \\((2, ${y(2)})\\), ` +
              (grows ? "and climbs faster and faster." : "and drops more and more slowly."),
          ],
        },
      ],
    };

    // ---- 4. Solve: an x not in the table, inside the concept's range ----
    const solveChoices = range(params.xMin, params.xMax).filter((x) => !TABLE_XS.includes(x));
    const qx = solveChoices.length ? solveChoices[Math.floor(rng() * solveChoices.length)] : params.xMax;
    const question = scenario?.question
      ? fill(scenario.question, { ...(context.values ?? params), qx })
      : `What is \\(y\\) when \\(x = ${qx}\\)?`;
    // Then read the graph at a half-way x (0.5, 1.5, …): every whole x from 0 to 5 is
    // already in the table or is the Solve x, and a half-way value can't be copied
    const highlight = { x: qx, y: y(qx) };
    const readChoices = READ_XS.filter((x) => x >= params.xMin && x <= params.xMax);
    const readX = readChoices[Math.floor(rng() * readChoices.length)];
    const solve = {
      id: "solve",
      instructions: "Use your equation to answer the story's question. Then read the graph.",
      show: ["story", "formula", "graph"],
      requires: { formula: "represent", graph: "represent" },
      revealAfter: { "solve-question": ["graph"] },
      graphHighlight: { afterItem: "solve-question", ...highlight },
      referenceTable: "notice-table",
      items: [
        numberItem({
          id: "solve-question",
          prompt: question,
          answer: y(qx),
          qx,
          hints: [
            `Put \\(x = ${qx}\\) into your equation and calculate \\(y\\).`,
            `Start at ${a} and multiply by ${bText}, ${qx} times: ${power(qx)}.`,
          ],
        }),
        graphReadItem({ concept, params, readX }),
      ],
    };

    // ---- 5. Explain ----
    const explain = {
      id: "explain",
      instructions: "Explain what the numbers in the equation mean in the story.",
      show: ["story", "formula", "graph"],
      requires: { formula: "represent", graph: "represent" },
      referenceTable: "notice-table",
      items: [
        choiceItem({
          id: "explain-a",
          prompt: `What does \\(a = ${a}\\) mean in this story?`,
          options: [
            { key: "correct", text: `the starting amount of ${Y}, when ${X} is 0` },
            { key: "factor", text: `the number ${Y} is multiplied by each time ${X} goes up by 1` },
            { key: "adds", text: `how much ${Y} goes up each time ${X} goes up by 1` },
            { key: "end", text: `the ${Y} after ${params.xMax} ${units.x}` },
          ],
          correctKey: "correct",
          hints: [
            "Put \\(x = 0\\) into the equation. Any number to the power 0 is 1, so what is left?",
            `When \\(x = 0\\), \\(y = ${a} \\cdot ${bText}^{0} = ${a}\\). That is the amount before anything has happened.`,
          ],
          rng,
        }),
        choiceItem({
          id: "explain-b",
          prompt: `What does \\(b = ${bText}\\) mean in this story?`,
          options: [
            { key: "correct", text: `the number ${Y} is multiplied by each time ${X} goes up by 1` },
            { key: "start", text: `the starting amount of ${Y}` },
            { key: "adds", text: `how much ${Y} goes up or down each time ${X} goes up by 1` },
            { key: "end", text: `the ${Y} at the end` },
          ],
          correctKey: "correct",
          hints: [
            "\\(b\\) is the base: it is multiplied in once more each time \\(x\\) goes up by 1.",
            `In your table, each time \\(x\\) went up by 1, \\(y\\) was multiplied by ${bText}. Which option says that?`,
          ],
          rng,
        }),
      ],
    };

    // ---- 6. Transfer ----
    const transfer = {
      id: "transfer",
      instructions: "No story this time. The same rule is written in function notation.",
      show: [],
      introMath: latex(params).replace(/^y/, "f(x)"),
      intro: "\\(f(2)\\) means: the output when the input \\(x\\) is 2.",
      items: TRANSFER_XS.map((x) =>
        numberItem({
          id: `transfer-f-${x}`,
          prompt: `\\(f(${x}) = ?\\)`,
          answer: y(x),
          hints: [
            `Replace \\(x\\) with ${x} in the rule, then calculate.`,
            x === 0
              ? `Any number to the power 0 is 1, so \\(f(0) = ${a} \\cdot 1\\).`
              : `Start at ${a} and multiply by ${bText}, ${x} ${x === 1 ? "time" : "times"}: ${power(x)}.`,
          ],
        })
      ),
    };

    // Every log entry records the Represent format (always "both" here), like linear
    return [explore, notice, represent, solve, explain, transfer].map((step) => ({
      ...step,
      logFields: { representFormat: "both" },
    }));
  },
};
