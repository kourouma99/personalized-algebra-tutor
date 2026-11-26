/*
  linearFlow.js — the guided worksheet for the linear concept (y = mx + b).

  This file holds the PEDAGOGY: what to ask in each step, the hints, and the
  wrong options. The math stays in concepts/algebra/linearEquation.js:
  every correct answer comes from concept.evaluate(params, x) or the params,
  never from a hardcoded number. The generic engine (core/flowEngine.js)
  tracks attempts, and views/flowView.js draws the steps.

  Steps (same order as core/sequence.js):
    1. Explore   — read the story, predict: does y go up, down or stay the same?
    2. Notice    — fill in a table, then find the change per step (m)
    3. Represent — one of three formats (settings.representFormat, default "random"):
                   write the equation, choose it from 4, or write it then pick its graph
    4. Solve     — answer the story's question for a new x
    5. Explain   — what do m and b mean in this story?
    6. Transfer  — no story: evaluate f(x) = mx + b, including a fraction

  context (from main.js): { scenario, values }
    scenario -> the story from data/sampleScenarios.js, or null (e.g. a typed-in interest)
    values   -> concept.storyValues(params), used to fill {placeholders}
*/

import { parseNumber, numbersMatch, fractionLatex } from "../core/answerCheck.js";
import { shuffle, lower, fill, choiceItem, numberItem, nearestRow } from "./flowHelpers.js";

export { shuffle, nearestRow }; // re-exported: older tests import them from here

// x = 1 and 2 are given; the student fills in 0, 5 and 8. Finding y at x = 0 means
// working BACKWARDS one step, which is how they discover the starting amount b.
const TABLE_XS = [0, 1, 2, 5, 8];
const GIVEN_XS = [1, 2];
// Solve uses a BIG x, far past the table and the graph, so the student must use the equation
const SOLVE_RANGE = [20, 60];
const SMALL_SOLVE_XS = [3, 4, 6, 7, 9, 10]; // last resort, not in the table
const TRANSFER_XS = [2, 12];
const TRANSFER_FRACTION = { numerator: 3, denominator: 7 };
const DECIMAL_TOLERANCE = 0.01; // for the transfer step, where decimals like 1.71 are fine

// Question formats for the Represent step (the setting can also be "random")
export const REPRESENT_FORMATS = ["write", "choose", "both"];

// ---------- linear helpers (exported so they can be tested in Node) ----------

/*
  The four equation options for "Which equation matches this story?":
    correct (y = mx + b), swapped (y = bx + m), wrong sign (y = -mx + b),
    no intercept (y = mx).
  If an option is the same as an earlier one (e.g. b = 0 makes "no intercept"
  equal to "correct"), or has slope 0 (not a real line here), it is replaced
  with y = (m+1)x + b, then (m+2)x + b, … until it is new.
  Returns [{ key, m, b }] in this order; the caller shuffles.

  isTooClose (optional): an extra rule for when options are shown as GRAPHS.
  A wrong option it rejects (e.g. y = 10x next to y = 10x + 1, which look like the
  same line) is replaced the same way as a duplicate.
*/
export function equationOptions(m, b, isTooClose = () => false) {
  const candidates = [
    { key: "correct", m, b },
    { key: "swapped", m: b, b: m },
    { key: "wrong-sign", m: -m, b },
    { key: "no-intercept", m, b: 0 },
  ];
  const seen = new Set();
  const options = [];
  let shift = 1;
  for (const candidate of candidates) {
    let option = candidate;
    const rejected = (o) => seen.has(`${o.m}|${o.b}`) || o.m === 0 || (options.length > 0 && isTooClose(o));
    while (rejected(option)) {
      option = { key: `replacement-for-${candidate.key}`, m: m + shift, b };
      shift += 1;
    }
    seen.add(`${option.m}|${option.b}`);
    options.push(option);
  }
  return options;
}

/*
  For graph options: true if a line would look like the correct line y = mx + b.
  Lines are compared at both ends of the x range; they must differ there by at
  least 8% of the graph's height. That height is estimated as the starting value
  plus the rise twice (the wrong-sign line goes the other way from the same start).
*/
export function looksLikeLine(m, b, xMin, xMax, minGap = 0.08) {
  const size = 2 * Math.abs(m) * (xMax - xMin) + Math.abs(b);
  return (o) => {
    const gap = Math.max(...[xMin, xMax].map((x) => Math.abs(o.m * x + o.b - (m * x + b))));
    return gap < minGap * size;
  };
}

/*
  The x for the Solve question. Story amounts can't go negative (validate() has the
  same rule), so a falling line limits how far out we can go:
    1. a random whole x in SOLVE_RANGE (20–60) where y is still >= 0
    2. else a random x past the graph (xMax + 1 up to the last x with y >= 0)
    3. else (y reaches 0 by xMax) one of the small x values not in the table
  Returns { x, kind: "big" | "past-graph" | "small" } so tests can count each case.
*/
export function chooseSolveX(params, y, rng = Math.random) {
  const pick = (list) => list[Math.floor(rng() * list.length)];
  const range = (lo, hi) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);

  const big = range(...SOLVE_RANGE).filter((x) => y(x) >= 0);
  if (big.length) return { x: pick(big), kind: "big" };

  const past = range(params.xMax + 1, SOLVE_RANGE[0] - 1).filter((x) => y(x) >= 0);
  if (past.length) return { x: pick(past), kind: "past-graph" };

  const small = SMALL_SOLVE_XS.filter((x) => x >= params.xMin && x <= params.xMax);
  return { x: small.length ? pick(small) : params.xMax, kind: "small" };
}

const pickSolveX = (params, y, rng) => chooseSolveX(params, y, rng).x;

/*
  Falling lines: the target y for "when will y reach …?", chosen so the answer x is a
  whole number where y is still >= 0 (the story's valid range):
    1. y = 0, if b is divisible by |m| (x = b / |m|, the moment it runs out)
    2. else y at a random whole x past the graph (xMax + 1 up to the last x with y >= 0)
    3. else y at one of the small x values not in the table
  Returns { x, target, kind: "zero" | "past-graph" | "small" }.
*/
export function chooseReverseTarget(params, y, rng = Math.random) {
  const { m, b } = params;
  const pick = (list) => list[Math.floor(rng() * list.length)];
  const lastX = Math.floor(b / Math.abs(m)); // y(lastX) >= 0 > y(lastX + 1)

  if (b % Math.abs(m) === 0) return { x: lastX, target: 0, kind: "zero" };

  const past = [];
  for (let x = params.xMax + 1; x <= lastX; x++) past.push(x);
  if (past.length) {
    const x = pick(past);
    return { x, target: y(x), kind: "past-graph" };
  }
  const small = SMALL_SOLVE_XS.filter((x) => x <= lastX && x >= params.xMin);
  const x = small.length ? pick(small) : params.xMax;
  return { x, target: y(x), kind: "small" };
}

// Sign-aware wording for a change: "goes up by 4", "goes down by 4", "stays the same".
// Hints never say "add -4".
export function change(n, tense = "present") {
  const [up, down, same] = tense === "past" ? ["went up", "went down", "stayed the same"] : ["goes up", "goes down", "stays the same"];
  if (n > 0) return `${up} by ${n}`;
  if (n < 0) return `${down} by ${-n}`;
  return same;
}

/*
  Targeted hints for one missing table cell, computed from the rows the student
  can already see (the given rows plus cells already solved):
    1. "From x = 5 to x = 8, x goes up by 3. How should y change?"
       "From x = 1 to x = 0, x goes down by 1. How should y change?" (backwards)
    2. the same jump spelled out, sign-aware: which way y moves per step (read from
       the two given rows), and whether to add or subtract from the known value
*/
export function tableCellHints(x, givenRows, cells, y) {
  const knownRows = (solved) => [
    ...givenRows,
    ...cells.filter((c) => c.x !== x && solved(c.id)).map((c) => ({ x: c.x, y: y(c.x) })),
  ];
  const jump = (solved) => {
    const from = nearestRow(knownRows(solved), x);
    const dx = x - from.x;
    return { from, dx, steps: Math.abs(dx), dir: dx > 0 ? "up" : "down" };
  };
  const [first, second] = givenRows;
  // Direction per step, read from the two given rows (data, not a hardcoded slope)
  const perStep = (second.y - first.y) / (second.x - first.x);
  const yDir = perStep > 0 ? "up" : "down";
  return [
    ({ solved }) => {
      const { from, steps, dir } = jump(solved);
      return `From \\(x = ${from.x}\\) to \\(x = ${x}\\), \\(x\\) goes ${dir} by ${steps}. How should \\(y\\) change?`;
    },
    ({ solved }) => {
      const { from, steps, dx } = jump(solved);
      // y moves up if the per-step direction and the x direction agree, down otherwise
      const total = perStep * dx;
      const yMoves = total > 0 ? "up" : "down";
      const action = total > 0 ? "add" : "subtract";
      const pattern =
        `Each time \\(x\\) goes up by 1, \\(y\\) goes ${yDir} by the same amount ` +
        `(look from \\(x = ${first.x}\\) to \\(x = ${second.x}\\)).`;
      // Going backwards undoes steps, so y moves the opposite way of the pattern
      const backwards = dx < 0
        ? ` Going back from \\(x = ${from.x}\\) to \\(x = ${x}\\) undoes ${steps === 1 ? "one step" : `${steps} steps`}, so \\(y\\) goes ${yMoves}.`
        : "";
      const amount = steps === 1 ? "that amount" : `that amount times ${steps}`;
      const verb = action === "add" ? `add ${amount} to` : `subtract ${amount} from`;
      return `${pattern}${backwards} Start at \\(y = ${from.y}\\) (the value at \\(x = ${from.x}\\)) and ${verb} it.`;
    },
  ];
}

// ---------- the flow ----------

export default {
  id: "linear-guided",

  // Change these to configure the flow. main.js can also pass context.settings to override.
  settings: {
    // "write" | "choose" | "both", or "random" = one of those, picked once per scenario
    representFormat: "random",
  },

  buildSteps(concept, params, context = {}, rng = Math.random) {
    const { m, b } = params;
    const y = (x) => concept.evaluate(params, x);
    const latex = (p) => concept.formulaLatex(p);

    const scenario = context.scenario ?? null;
    const labels = scenario?.labels ?? { x: "x", y: "y" };
    const units = scenario?.units ?? { x: "steps", y: "units" };
    const X = lower(labels.x);
    const Y = lower(labels.y);
    // "games played (x)" with a story, just "x" without one (e.g. a typed-in interest)
    const named = (label, v) => (scenario ? `${label} (\\(${v}\\))` : `\\(${v}\\)`);

    // The x for the Solve question is chosen by code, inside the concept's range
    const qx = pickSolveX(params, y, rng);

    // Hint 2 for "find y at x": start at b, then go up/down |m| for each of the x steps.
    // e.g. "Start at 50. For each of the 7 steps, y goes down by 4: 50 − 4 · 7."
    const stepsHint = (x) =>
      `Start at ${b} (the value when \\(x = 0\\)). For each of the ${x} steps, \\(y\\) ${change(m)}: ` +
      `\\(${b} ${m < 0 ? "-" : "+"} ${Math.abs(m)} \\cdot ${x}\\).`;

    // ---- 1. Explore ----
    const direction = m > 0 ? "up" : m < 0 ? "down" : "same";
    const explore = {
      id: "explore",
      instructions: "Read the story. Before doing any math, make a prediction.",
      show: ["story"],
      items: [
        choiceItem({
          id: "explore-predict",
          prompt: `As ${named(X, "x")} increases, ${named(Y, "y")} will…`,
          options: [
            { key: "up", text: "go up" },
            { key: "down", text: "go down" },
            { key: "same", text: "stay the same" },
          ],
          correctKey: direction,
          hints: [
            `Read the story again: each time \\(x\\) goes up by 1, does the amount get bigger or smaller?`,
            `In the story, each time ${X} goes up by 1, ${Y} ${change(m)}.`,
          ],
          rng,
        }),
      ],
    };

    // ---- 2. Notice ----
    const givenRows = GIVEN_XS.map((x) => ({ x, y: y(x) }));
    const cells = TABLE_XS.filter((x) => !GIVEN_XS.includes(x)).map((x) => ({ x, id: `notice-y-at-${x}` }));
    const notice = {
      id: "notice",
      instructions: "Use the story to fill in the table. Look for a pattern.",
      show: ["story"],
      tables: {
        "notice-table": {
          prompt: "Fill in the missing values of \\(y\\).",
          columns: { x: labels.x, y: labels.y },
          given: givenRows,
          // First two missing cells (x = 0 and x = 5) right on the first try -> fill in x = 8
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
            hints: tableCellHints(x, givenRows, cells, y),
          })
        ),
        numberItem({
          id: "notice-slope",
          prompt: `How much does \\(y\\) change when \\(x\\) goes up by 1?`,
          answer: m,
          hints: [
            `Compare two rows next to each other in your table, like \\(x = ${GIVEN_XS[0]}\\) and \\(x = ${GIVEN_XS[1]}\\).`,
            `From \\(x = ${GIVEN_XS[0]}\\) to \\(x = ${GIVEN_XS[1]}\\), \\(y\\) goes from ${y(GIVEN_XS[0])} to ${y(GIVEN_XS[1])}. ` +
              `Subtract: \\(${y(GIVEN_XS[1])} - ${y(GIVEN_XS[0])}\\). ` +
              (m < 0 ? "Since \\(y\\) goes down, the answer is a negative number." : "Since \\(y\\) goes up, the answer is a positive number."),
          ],
        }),
      ],
    };

    // ---- 3. Represent ----
    // The format is picked ONCE per scenario (see REPRESENT_FORMATS at the top):
    //   write  -> type the equation                       (story -> equation)
    //   choose -> pick the equation from 4                (story -> equation)
    //   both   -> type the equation, then pick its graph  (story -> equation, equation -> graph)
    // Each item has a `move`, and no move is asked twice in one scenario.
    const setting = context.settings?.representFormat ?? this.settings.representFormat;
    if (setting !== "random" && !REPRESENT_FORMATS.includes(setting)) {
      throw new Error(`Unknown representFormat "${setting}". Use "random" or one of: ${REPRESENT_FORMATS.join(", ")}`);
    }
    const format = setting === "random" ? REPRESENT_FORMATS[Math.floor(rng() * REPRESENT_FORMATS.length)] : setting;

    const writeItem = () => ({
          id: "represent-equation",
          move: "story-to-equation",
          type: "pair",
          prompt: "Write the equation for this story.",
          parts: ["y =", "x +"], // the view puts an input after each part
          autoAnswer: [String(m), String(b)], // dev mode only
          check: (raw) => {
            const [slope, intercept] = (raw ?? []).map(parseNumber);
            if (slope === null || intercept === null || slope === undefined || intercept === undefined) return null;
            return numbersMatch(slope, m) && numbersMatch(intercept, b);
          },
          answerText: `\\(${latex(params)}\\)`,
          hints: [
            // Nudge: points at whichever box is wrong in the last attempt
            ({ answer }) => {
              const [slope, intercept] = (answer ?? []).map(parseNumber);
              const slopeOk = slope != null && numbersMatch(slope, m);
              const interceptOk = intercept != null && numbersMatch(intercept, b);
              if (!slopeOk && interceptOk) return "Your second box is right. The number in front of \\(x\\) is the change per step.";
              if (slopeOk && !interceptOk) return "Your first box is right. The number you add is the starting amount.";
              return "The number in front of \\(x\\) is the change per step. The number you add is the starting amount.";
            },
            `The change per step is what you found in Notice. The starting amount is \\(y\\) when \\(x = 0\\), which is ${y(0)}.`,
          ],
    });

    // Story -> equation, multiple choice: correct, swapped, wrong sign, no intercept
    const chooseItem = () => ({
      ...choiceItem({
        id: "represent-choose",
        prompt: "Which equation matches this story?",
        options: equationOptions(m, b).map((o) => ({ key: o.key, text: `\\(${latex({ m: o.m, b: o.b })}\\)` })),
        correctKey: "correct",
        hints: [
          "Test an option: put in \\(x = 0\\) and \\(x = 1\\). Does it give the same \\(y\\) as your table?",
          `The right equation gives \\(y = ${y(0)}\\) when \\(x = 0\\), and \\(y = ${y(1)}\\) when \\(x = 1\\).`,
        ],
        rng,
      }),
      move: "story-to-equation",
    });

    // Equation -> graph: the same four kinds of lines, drawn as small graphs.
    // Shuffled first, THEN named A–D, so the letter never hints at the answer.
    // Extra rule for graphs: no wrong line that looks just like the right one.
    const graphItem = () => {
      const tooClose = looksLikeLine(m, b, params.xMin, params.xMax);
      const graphOptions = shuffle(equationOptions(m, b, tooClose), rng).map((o, i) => ({
        key: o.key,
        text: `Graph ${"ABCD"[i]}`,
        graph: { m: o.m, b: o.b, xMin: params.xMin, xMax: params.xMax }, // drawn by views/graph.js
      }));
      return {
        id: "represent-match",
        move: "equation-to-graph",
        type: "choice",
        display: "graphs", // the view draws each option's `graph` instead of text
        prompt: "Which graph matches your equation?",
        options: graphOptions,
        // Size the shared axes to every line except "swapped" (y = bx + m). Its slope is b,
        // often 30+, which would squash the other three into flat look-alikes. When it is
        // steep it just runs off the top edge, which is still easy to tell apart.
        graphFit: graphOptions.filter((o) => o.key !== "swapped").map((o) => o.graph),
        check: (key) => key === "correct",
        answerText: graphOptions.find((o) => o.key === "correct").text,
        hints: [
          `Look where each line crosses the \\(y\\)-axis (at \\(x = 0\\)). Your equation gives \\(y = ${y(0)}\\) there.`,
          `Your line goes through \\((0, ${y(0)})\\) and \\((${params.xMax}, ${y(params.xMax)})\\). ` +
            `It goes ${m > 0 ? "up" : "down"} from left to right.`,
        ],
      };
    };

    // Only the chosen format is built (functions), so unused items don't use up random numbers
    const representByFormat = {
      write: () => ({
        instructions: "Turn the pattern into an equation.",
        items: [writeItem()],
        revealAfter: { "represent-equation": ["formula", "graph"] },
      }),
      choose: () => ({
        instructions: "Find the equation that matches the story.",
        items: [chooseItem()],
        revealAfter: { "represent-choose": ["formula", "graph"] },
      }),
      both: () => ({
        instructions: "Turn the pattern into an equation, then find its graph.",
        items: [writeItem(), graphItem()],
        // The formula appears once the equation is typed; the big graph only after the right pick
        revealAfter: { "represent-equation": ["formula"], "represent-match": ["graph"] },
      }),
    };
    const represent = { id: "represent", show: ["story"], format, ...representByFormat[format]() };

    // ---- 4. Solve ----
    // Rising lines: "what is y after a big x?" (forward). Falling lines: "when will y
    // reach this target?" (reverse, solving for x), because a falling amount runs out
    // long before a big x. The type is logged with every entry (solveQuestion).
    const values = { ...(context.values ?? params) };
    let solveQuestion, solveItem;
    if (m < 0) {
      const reverse = chooseReverseTarget(params, y, rng);
      const T = reverse.target;
      const stillToGo = b - T; // how far y has to come down, always > 0
      solveQuestion = "reverse";
      solveItem = numberItem({
        id: "solve-question",
        prompt: scenario?.reverseQuestion
          ? fill(scenario.reverseQuestion, { ...values, target: T })
          : scenario
            ? `After how many ${units.x} will ${Y} be ${T}?`
            : `For what \\(x\\) is \\(y = ${T}\\)?`,
        answer: reverse.x,
        qx: reverse.x, // the answer is an x here
        target: T,
        reverseKind: reverse.kind,
        hints: [
          `Put \\(y = ${T}\\) into your equation: \\(${latex(params).replace(/^y/, String(T))}\\). Then solve for \\(x\\).`,
          `Start at ${b}. Each time \\(x\\) goes up by 1, \\(y\\) goes down by ${Math.abs(m)}. ` +
            `To get down to ${T}, \\(y\\) has to go down by ${stillToGo} in total: \\(${stillToGo} \\div ${Math.abs(m)}\\).`,
        ],
      });
    } else {
      solveQuestion = "forward";
      solveItem = numberItem({
        id: "solve-question",
        prompt: scenario?.question ? fill(scenario.question, { ...values, qx }) : `What is \\(y\\) when \\(x = ${qx}\\)?`,
        answer: y(qx),
        qx,
        hints: [
          `Put \\(x = ${qx}\\) into your equation and calculate \\(y\\).`,
          stepsHint(qx),
        ],
      });
    }
    const solve = {
      id: "solve",
      instructions: m < 0
        ? "Use your equation to work out when the story reaches a value."
        : "Use your equation to answer the story's question.",
      show: ["story", "formula", "graph"],
      // Formula and graph give away Represent, so they wait until Represent is complete
      // (answered or revealed). Until then: the story and the student's own table.
      requires: { formula: "represent", graph: "represent" },
      referenceTable: "notice-table",
      solveQuestion,
      items: [solveItem],
    };

    // ---- 5. Explain ----
    const explain = {
      id: "explain",
      instructions: "Explain what the numbers in the equation mean in the story.",
      show: ["story", "formula", "graph"],
      // Formula and graph give away Represent, so they wait until Represent is complete
      // (answered or revealed). Until then: the story and the student's own table.
      requires: { formula: "represent", graph: "represent" },
      referenceTable: "notice-table",
      items: [
        choiceItem({
          id: "explain-m",
          prompt: `What does \\(m = ${m}\\) mean in this story?`,
          options: [
            { key: "correct", text: `the change in ${Y} each time ${X} goes up by 1` },
            { key: "start", text: `the starting amount of ${Y}` },
            { key: "value-after-8", text: `the ${Y} after 8 ${units.x}` },
            { key: "number-of-steps", text: `the number of ${units.x}` },
          ],
          correctKey: "correct",
          hints: [
            `\\(m\\) is multiplied by \\(x\\), so it counts again each time \\(x\\) goes up.`,
            `In your table, each time \\(x\\) went up by 1, \\(y\\) ${change(m, "past")}. Which option says that?`,
          ],
          rng,
        }),
        choiceItem({
          id: "explain-b",
          prompt: `What does \\(b = ${b}\\) mean in this story?`,
          options: [
            { key: "correct", text: `the starting amount of ${Y}, when ${X} is 0` },
            { key: "change", text: `the change in ${Y} per step` },
            { key: "final", text: `the ${Y} at the end` },
            { key: "slope", text: "the slope of the line" },
          ],
          correctKey: "correct",
          hints: [
            `Put \\(x = 0\\) into the equation. What is left?`,
            `When \\(x = 0\\), \\(y = ${b}\\). That is the amount before anything has happened.`,
          ],
          rng,
        }),
      ],
    };

    // ---- 6. Transfer ----
    const { numerator, denominator } = TRANSFER_FRACTION;
    const fx = latex(params).replace(/^y/, "f(x)");
    const transfer = {
      id: "transfer",
      instructions: "No story this time. The same rule is written in function notation.",
      show: [],
      introMath: fx,
      intro: "\\(f(2)\\) means: the output when the input \\(x\\) is 2. You can type fractions like 12/7 or decimals like 1.71.",
      items: [
        ...TRANSFER_XS.map((x) =>
          numberItem({
            id: `transfer-f-${x}`,
            prompt: `\\(f(${x}) = ?\\)`,
            answer: y(x),
            tolerance: DECIMAL_TOLERANCE,
            hints: [
              `Replace \\(x\\) with ${x} in the rule, then calculate.`,
              stepsHint(x),
            ],
          })
        ),
        numberItem({
          id: "transfer-f-fraction",
          prompt: `\\(f\\left(\\frac{${numerator}}{${denominator}}\\right) = ?\\)`,
          answer: y(numerator / denominator),
          answerText: `\\(${fractionLatex(m * numerator + b * denominator, denominator)}\\) (about ${y(numerator / denominator).toFixed(2)})`,
          // Shown as "Exact value: …" when a decimal like 16.43 is accepted
          exactText: `\\(${fractionLatex(m * numerator + b * denominator, denominator)}\\)`,
          autoAnswer: `${m * numerator + b * denominator}/${denominator}`, // dev mode only
          tolerance: DECIMAL_TOLERANCE,
          hints: [
            `\\(y\\) ${change(m)} for each whole step of \\(x\\). Work out how much it goes ${m > 0 ? "up" : "down"} ` +
              `for \\(\\frac{${numerator}}{${denominator}}\\) of a step, then ${m > 0 ? "add it to" : "subtract it from"} ${b}. ` +
              `A fraction answer like 12/7 is fine.`,
            `From \\(x = 0\\) to \\(x = \\frac{${numerator}}{${denominator}}\\), \\(y\\) goes ${m > 0 ? "up" : "down"} by ` +
              `\\(${Math.abs(m)} \\cdot \\frac{${numerator}}{${denominator}} = \\frac{${Math.abs(m) * numerator}}{${denominator}}\\). ` +
              `Start from \\(${b} = \\frac{${b * denominator}}{${denominator}}\\) and ${m > 0 ? "add" : "subtract"}; keep ${denominator} on the bottom.`,
          ],
        }),
      ],
    };

    // Every log entry from this scenario records which Represent format was used
    return [explore, notice, represent, solve, explain, transfer].map((step) => ({
      ...step,
      logFields: { representFormat: format, solveQuestion },
    }));
  },
};
