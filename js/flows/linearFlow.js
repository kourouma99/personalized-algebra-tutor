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
    3. Represent — type the equation, then pick the matching equation
    4. Solve     — answer the story's question for a new x
    5. Explain   — what do m and b mean in this story?
    6. Transfer  — no story: evaluate f(x) = mx + b, including a fraction

  context (from main.js): { scenario, values }
    scenario -> the story from data/sampleScenarios.js, or null (e.g. a typed-in interest)
    values   -> concept.storyValues(params), used to fill {placeholders}
*/

import { parseNumber, numbersMatch, fractionLatex } from "../core/answerCheck.js";

const TABLE_XS = [0, 1, 2, 5, 8]; // x = 0 and 1 are given, the rest the student fills in
const GIVEN_XS = [0, 1];
const SOLVE_XS = [3, 4, 6, 7, 9, 10]; // not in the table, so the student must use the equation
const TRANSFER_XS = [2, 12];
const TRANSFER_FRACTION = { numerator: 3, denominator: 7 };
const DECIMAL_TOLERANCE = 0.01; // for the transfer step, where decimals like 1.71 are fine

// ---------- small helpers (exported so they can be tested in Node) ----------

// Fisher–Yates shuffle that uses the given random function, returns a new array
export function shuffle(list, rng = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/*
  The four equation options for "Which equation matches this story?":
    correct (y = mx + b), swapped (y = bx + m), wrong sign (y = -mx + b),
    no intercept (y = mx).
  If an option is the same as an earlier one (e.g. b = 0 makes "no intercept"
  equal to "correct"), or has slope 0 (not a real line here), it is replaced
  with y = (m+1)x + b, then (m+2)x + b, … until it is new.
  Returns [{ key, m, b }] in this order; the caller shuffles.
*/
export function equationOptions(m, b) {
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
    while (seen.has(`${option.m}|${option.b}`) || option.m === 0) {
      option = { key: `replacement-for-${candidate.key}`, m: m + shift, b };
      shift += 1;
    }
    seen.add(`${option.m}|${option.b}`);
    options.push(option);
  }
  return options;
}

// "Games played" -> "games played", so labels fit inside a sentence
function lower(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// Replace {key} with values[key] (same rule as views/scenario.js)
function fill(text, values) {
  return text.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
}

function numberCheck(answer, tolerance) {
  return (raw) => {
    const value = parseNumber(raw);
    return value === null ? null : numbersMatch(value, answer, tolerance);
  };
}

function choiceItem({ id, prompt, options, correctKey, hints, rng }) {
  const correct = options.find((o) => o.key === correctKey);
  return {
    id,
    type: "choice",
    prompt,
    options: shuffle(options, rng),
    check: (key) => key === correctKey,
    answerText: correct.text,
    hints,
  };
}

function numberItem({ id, prompt, answer, hints, answerText, tolerance, ...rest }) {
  return {
    id,
    type: "number",
    prompt,
    check: numberCheck(answer, tolerance),
    answerText: answerText ?? `\\(${answer}\\)`,
    hints,
    ...rest,
  };
}

// The known row closest to x (ties go to the smaller x). Rows are { x, y }.
export function nearestRow(rows, x) {
  let best = null;
  for (const row of rows) {
    if (row.x === x) continue;
    const distance = Math.abs(row.x - x);
    if (!best || distance < Math.abs(best.x - x) || (distance === Math.abs(best.x - x) && row.x < best.x)) {
      best = row;
    }
  }
  return best;
}

/*
  Targeted hints for one missing table cell, computed from the rows the student
  can already see (the given rows plus cells already solved):
    1. "From x = 5 to x = 8, x goes up by 3. How much should y go up?"
    2. the same jump, spelled out with the change per step from x = 0 to x = 1
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
  return [
    ({ solved }) => {
      const { from, steps, dir } = jump(solved);
      return `From \\(x = ${from.x}\\) to \\(x = ${x}\\), \\(x\\) goes ${dir} by ${steps}. How much should \\(y\\) change?`;
    },
    ({ solved }) => {
      const { from, steps, dir } = jump(solved);
      const action = dir === "up" ? "add it to" : "take it away from";
      return `Each time \\(x\\) goes up by 1, \\(y\\) changes by the same amount (look from \\(x = ${first.x}\\) to \\(x = ${second.x}\\)). ` +
        `Multiply that change by ${steps}, then ${action} \\(y = ${from.y}\\), the value at \\(x = ${from.x}\\).`;
    },
  ];
}

// ---------- the flow ----------

export default {
  id: "linear-guided",

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
    const solveChoices = SOLVE_XS.filter((x) => x >= params.xMin && x <= params.xMax);
    const qx = solveChoices.length ? solveChoices[Math.floor(rng() * solveChoices.length)] : params.xMax;

    // "(-4) \cdot 7" or "4 \cdot 7", for hints that spell out a calculation
    const times = (k, x) => `${k < 0 ? `(${k})` : k} \\cdot ${x}`;

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
            `Each time ${X} goes up by 1, ${Y} changes by ${Math.abs(m)}. In the story, is that amount added or taken away?`,
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
          // First two missing cells right on the first try -> fill in the rest
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
            `Compare the rows for \\(x = 0\\) and \\(x = 1\\) in your table.`,
            `Subtract: \\(${y(1)} - ${y(0)}\\). If \\(y\\) goes down, the change is negative (like \\(-3\\)).`,
          ],
        }),
      ],
    };

    // ---- 3. Represent ----
    const eqOptions = equationOptions(m, b).map((o) => ({
      key: o.key,
      text: `\\(${latex({ m: o.m, b: o.b })}\\)`,
    }));
    const represent = {
      id: "represent",
      instructions: "Turn the pattern into an equation.",
      show: ["story"],
      revealAfter: { "represent-equation": ["formula", "graph"] },
      items: [
        {
          id: "represent-equation",
          type: "pair",
          prompt: "Write the equation for this story.",
          parts: ["y =", "x +"], // the view puts an input after each part
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
        },
        choiceItem({
          id: "represent-match",
          prompt: "Which equation matches this story?",
          options: eqOptions,
          correctKey: "correct",
          hints: [
            "Test an option: put in \\(x = 0\\) and \\(x = 1\\). Does it give the same \\(y\\) as your table?",
            `The right equation gives \\(y = ${y(0)}\\) when \\(x = 0\\), and \\(y = ${y(1)}\\) when \\(x = 1\\).`,
          ],
          rng,
        }),
      ],
    };

    // ---- 4. Solve ----
    const question = scenario?.question
      ? fill(scenario.question, { ...(context.values ?? params), qx })
      : `What is \\(y\\) when \\(x = ${qx}\\)?`;
    const solve = {
      id: "solve",
      instructions: "Use your equation to answer the story's question.",
      show: ["story", "formula", "graph"],
      items: [
        numberItem({
          id: "solve-question",
          prompt: question,
          answer: y(qx),
          qx,
          hints: [
            `Put \\(x = ${qx}\\) into your equation and calculate \\(y\\).`,
            `Calculate \\(${times(m, qx)} + ${b}\\).`,
          ],
        }),
      ],
    };

    // ---- 5. Explain ----
    const explain = {
      id: "explain",
      instructions: "Explain what the numbers in the equation mean in the story.",
      show: ["story", "formula", "graph"],
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
            `In your table, each time \\(x\\) went up by 1, \\(y\\) changed by ${m}. Which option says that?`,
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
              `Calculate \\(${times(m, x)} + ${b}\\).`,
            ],
          })
        ),
        numberItem({
          id: "transfer-f-fraction",
          prompt: `\\(f\\left(\\frac{${numerator}}{${denominator}}\\right) = ?\\)`,
          answer: y(numerator / denominator),
          answerText: `\\(${fractionLatex(m * numerator + b * denominator, denominator)}\\) (about ${y(numerator / denominator).toFixed(2)})`,
          tolerance: DECIMAL_TOLERANCE,
          hints: [
            `Multiply ${m} by \\(\\frac{${numerator}}{${denominator}}\\), then add ${b}. A fraction answer like 12/7 is fine.`,
            `\\(${times(m, `\\frac{${numerator}}{${denominator}}`)} = \\frac{${m * numerator}}{${denominator}}\\) and ` +
              `\\(${b} = \\frac{${b * denominator}}{${denominator}}\\). Add the two tops and keep ${denominator} on the bottom.`,
          ],
        }),
      ],
    };

    return [explore, notice, represent, solve, explain, transfer];
  },
};
