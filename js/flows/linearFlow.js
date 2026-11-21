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

function choiceItem({ id, prompt, options, correctKey, hint, rng }) {
  const correct = options.find((o) => o.key === correctKey);
  return {
    id,
    type: "choice",
    prompt,
    options: shuffle(options, rng),
    check: (key) => key === correctKey,
    answerText: correct.text,
    hint,
  };
}

function numberItem({ id, prompt, answer, hint, answerText, tolerance, ...rest }) {
  return {
    id,
    type: "number",
    prompt,
    check: numberCheck(answer, tolerance),
    answerText: answerText ?? `\\(${answer}\\)`,
    hint,
    ...rest,
  };
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
          hint: `Read the story again: each time \\(x\\) goes up by 1, does the amount get bigger or smaller?`,
          rng,
        }),
      ],
    };

    // ---- 2. Notice ----
    const notice = {
      id: "notice",
      instructions: "Use the story to fill in the table. Look for a pattern.",
      show: ["story"],
      tables: {
        "notice-table": {
          prompt: "Fill in the missing values of \\(y\\).",
          columns: { x: labels.x, y: labels.y },
          given: GIVEN_XS.map((x) => ({ x, y: y(x) })),
        },
      },
      items: [
        ...TABLE_XS.filter((x) => !GIVEN_XS.includes(x)).map((x) =>
          numberItem({
            id: `notice-y-at-${x}`,
            prompt: `\\(y\\) when \\(x = ${x}\\)`,
            answer: y(x),
            group: "notice-table",
            x,
            hint: `Compare the rows for \\(x = 0\\) and \\(x = 1\\). Each time \\(x\\) goes up by 1, \\(y\\) changes by that same amount.`,
          })
        ),
        numberItem({
          id: "notice-slope",
          prompt: `How much does \\(y\\) change when \\(x\\) goes up by 1?`,
          answer: m,
          hint: `Subtract: \\(y\\) at \\(x = 1\\) minus \\(y\\) at \\(x = 0\\). If \\(y\\) goes down, the change is negative (like \\(-3\\)).`,
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
          hint: (raw) => {
            const [slope, intercept] = (raw ?? []).map(parseNumber);
            const slopeOk = slope !== null && numbersMatch(slope, m);
            const interceptOk = intercept !== null && numbersMatch(intercept, b);
            if (!slopeOk && interceptOk) return "The number in front of \\(x\\) is the change per step you found in Notice.";
            if (slopeOk && !interceptOk) return "The number you add is the starting amount: the value of \\(y\\) when \\(x = 0\\).";
            return "The number in front of \\(x\\) is the change per step. The number you add is \\(y\\) when \\(x = 0\\).";
          },
        },
        choiceItem({
          id: "represent-match",
          prompt: "Which equation matches this story?",
          options: eqOptions,
          correctKey: "correct",
          hint: "Test an option: put in \\(x = 0\\) and \\(x = 1\\). Does it give the same \\(y\\) as your table?",
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
          hint: `Put \\(x = ${qx}\\) into the equation and calculate \\(y\\).`,
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
          hint: `\\(m\\) is multiplied by \\(x\\), so it matters more each time \\(x\\) goes up.`,
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
          hint: `Put \\(x = 0\\) into the equation. What is left?`,
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
            hint: `Replace \\(x\\) with ${x} in the rule, then calculate.`,
          })
        ),
        numberItem({
          id: "transfer-f-fraction",
          prompt: `\\(f\\left(\\frac{${numerator}}{${denominator}}\\right) = ?\\)`,
          answer: y(numerator / denominator),
          answerText: `\\(${fractionLatex(m * numerator + b * denominator, denominator)}\\) (about ${y(numerator / denominator).toFixed(2)})`,
          tolerance: DECIMAL_TOLERANCE,
          hint: `Multiply ${m} by \\(\\frac{${numerator}}{${denominator}}\\), then add ${b}. A fraction answer like 12/7 is fine.`,
        }),
      ],
    };

    return [explore, notice, represent, solve, explain, transfer];
  },
};
