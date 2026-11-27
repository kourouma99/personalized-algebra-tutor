/*
  quadraticFlow.js — the guided worksheet for the quadratic concept, y = a(x - h)^2 + k.

  Same engine and rules as linearFlow.js and exponentialFlow.js: every correct answer
  comes from concept.evaluate(params, x) or the params, hints on request, skip,
  re-answering, logging. The pedagogy here is about the turning point (h, k) and
  SYMMETRY: the curve is a mirror image around x = h.

    a -> shape: a < 0 opens down (a highest point), a > 0 opens up (a lowest point);
         one step from the turning point, y changes by a
    h -> the x of the turning point;  k -> its y
  x runs from 0 to 2h, so x = 0 and x = 2h are mirror images (both at the starting height).

  Steps (same order as core/sequence.js):
    1. Explore   — does the curve have a highest point or a lowest point? (from the sign of a)
    2. Notice    — x = h-1 and h+1 given; fill in x = h, 0 and 2h; then "where is the
                   highest/lowest point?" (h, k). Hints point out the symmetry.
    3. Represent — type y = [ ](x - [ ])^2 + [ ], then pick its graph from 4
    4. Solve     — "after the turning point, when is it at [target]?" (a whole x); only when
                   h = 2 (no such target) "when is it back at the start?" (2h). Then the
                   zoomed-in graph-reading question
    5. Explain   — what do h and k mean in the story?
    6. Transfer  — f(x) in vertex form: f(0), f(h + 2), f(h - 2), and why the last two are equal

  The story comes from scenario.guidedStory, which leaves out "back at the start after 2h"
  so the student finds it from symmetry. Without a story (a typed-in interest), the
  starting value and turning point are given as plain math in Explore and Notice.
*/

import { parseNumber, numbersMatch } from "../core/answerCheck.js";
import { lower, fill, choiceItem, numberItem, shuffle, graphReadItem, range } from "./flowHelpers.js";

const TRANSFER_DISTANCE = 2; // f(h + 2) and f(h - 2)

// "Height (feet)" -> "height", so a label fits in a sentence like "the height at the highest point"
function plainName(label) {
  return lower(label.replace(/\s*\(.*?\)\s*/g, " ").trim());
}

// Sign-aware: "goes up by 2" / "goes down by 2"
const change = (n) => (n > 0 ? `goes up by ${n}` : n < 0 ? `goes down by ${-n}` : "stays the same");

/*
  The four graphs for "Which graph matches your equation?":
    correct      y = a(x - h)^2 + k
    wrong-sign   y = -a(x - h)^2 + k   (opens the wrong way)
    wrong-h      y = a(x + h)^2 + k    (shifted the wrong way)
    no-k         y = a(x - h)^2        (k ignored: turning point at height 0)
  A wrong option that repeats a curve, or would look like the correct one (it never
  differs by more than 8% of the graph's height, e.g. no-k when k is tiny), is replaced
  by a shifted turning point: (h + 1, k), then (h - 1, k), then a doubled shape (2a).
  Returns [{ key, graph }] where graph = { a, h, k, xMin, xMax } (quadratic params).
*/
export function quadraticGraphOptions(a, h, k, xMin, xMax) {
  const q = (A, H, K) => ({ a: A, h: H, k: K, xMin, xMax });
  const at = (g, x) => g.a * (x - g.h) ** 2 + g.k;
  const xs = [];
  for (let x = xMin; x <= xMax + 1e-9; x += 0.5) xs.push(x);
  const correctYs = xs.map((x) => at(q(a, h, k), x));
  const size = Math.max(1, Math.max(...correctYs) - Math.min(0, ...correctYs));
  const looksSame = (g1, g2) => Math.max(...xs.map((x) => Math.abs(at(g1, x) - at(g2, x)))) < 0.08 * size;

  const candidates = [
    { key: "correct", graph: q(a, h, k) },
    { key: "wrong-sign", graph: q(-a, h, k) },
    { key: "wrong-h", graph: q(a, -h, k) },
    { key: "no-k", graph: q(a, h, 0) },
  ];
  const replacements = [q(a, h + 1, k), q(a, h - 1, k), q(2 * a, h, k), q(a, h + 2, k), q(-2 * a, h, k)];
  const chosen = [];
  for (const c of candidates) {
    let option = c;
    let r = 0;
    while (chosen.some((o) => looksSame(o.graph, option.graph))) {
      option = { key: `replacement-for-${c.key}`, graph: replacements[r++] };
      if (!option.graph) throw new Error(`no distinct graph for ${c.key} (a=${a}, h=${h}, k=${k})`);
    }
    chosen.push(option);
  }
  return chosen;
}

export default {
  id: "quadratic-guided",

  buildSteps(concept, params, context = {}, rng = Math.random) {
    const { a, h, k } = params;
    const y = (x) => concept.evaluate(params, x);
    const latex = (p) => concept.formulaLatex(p);
    const pick = (list) => list[Math.floor(rng() * list.length)];

    const scenario = context.scenario ?? null;
    const labels = scenario?.labels ?? { x: "x", y: "y" };
    const units = scenario?.units ?? { x: "steps", y: "units" };
    const X = lower(labels.x);
    const Y = lower(labels.y);
    const Yname = scenario ? plainName(labels.y) : "value of \\(y\\)";
    const named = (label, v) => (scenario ? `${label} (\\(${v}\\))` : `\\(${v}\\)`);
    const opensDown = a < 0;
    const extreme = opensDown ? "highest" : "lowest";
    const yStart = y(0);
    const end = 2 * h;
    // Without a story, the facts a story would give, as plain math
    const facts = scenario
      ? undefined
      : `\\(y\\) starts at ${yStart} when \\(x = 0\\), and reaches its ${extreme} value, ${k}, when \\(x = ${h}\\).`;

    // ---- 1. Explore ----
    const explore = {
      id: "explore",
      instructions: "Read the story. Before doing any math, make a prediction.",
      show: ["story"],
      intro: facts,
      items: [
        choiceItem({
          id: "explore-predict",
          prompt: `As ${named(X, "x")} increases, does ${scenario ? `the ${Yname} (\\(y\\))` : "\\(y\\)"} have a highest point or a lowest point?`,
          options: [
            { key: "highest", text: "a highest point: it goes up, then comes back down" },
            { key: "lowest", text: "a lowest point: it goes down, then comes back up" },
            { key: "neither", text: "neither: it keeps going the same way" },
          ],
          correctKey: extreme,
          hints: [
            "Read the story again: does it go up first, or down first? Does it come back?",
            `In the story it ${opensDown ? "goes up, then comes back down" : "goes down, then comes back up"}, so it turns around at a ${extreme} point.`,
          ],
          rng,
        }),
      ],
    };

    // ---- 2. Notice ----
    const givenXs = [h - 1, h + 1]; // a symmetric pair around the turning point
    const givenRows = givenXs.map((x) => ({ x, y: y(x) }));
    const cellHints = {
      [h]: [
        `The rows \\(x = ${h - 1}\\) and \\(x = ${h + 1}\\) have the same \\(y\\). The curve is symmetric, so its ${extreme} point is exactly halfway between them.`,
        scenario
          ? `The story gives the ${extreme} point: how high it gets, and after how many ${units.x}.`
          : `The ${extreme} value is given above the table.`,
      ],
      0: [
        "Read the start of the story: what is \\(y\\) when \\(x = 0\\), before anything has happened?",
        scenario ? "It is the first number in the story: where it starts." : "The starting value is given above the table.",
      ],
      [end]: [
        `The curve is symmetric around \\(x = ${h}\\). How far is \\(x = ${end}\\) from \\(x = ${h}\\)? Which row is the same distance away on the other side?`,
        `\\(x = ${end}\\) is ${h} to the right of \\(x = ${h}\\), and \\(x = 0\\) is ${h} to the left. So they have the same \\(y\\).`,
      ],
    };
    const notice = {
      id: "notice",
      instructions: "Use the story to fill in the table. Look for a pattern.",
      show: ["story"],
      intro: facts,
      tables: {
        "notice-table": {
          prompt: "Fill in the missing values of \\(y\\).",
          columns: { x: labels.x, y: labels.y },
          given: givenRows,
          // no auto-fill: finding x = 2h from symmetry is the point of this table
        },
      },
      items: [
        ...[h, 0, end].map((x) =>
          numberItem({
            id: `notice-y-at-${x === h ? "h" : x === 0 ? "0" : "2h"}`,
            prompt: `\\(y\\) when \\(x = ${x}\\)`,
            answer: y(x),
            group: "notice-table",
            x,
            hints: cellHints[x],
          })
        ),
        {
          id: "notice-vertex",
          type: "pair",
          prompt: `Where is the ${extreme} point? Write it as \\((x, y)\\).`,
          parts: ["\\Big(", ","],
          after: "\\Big)",
          autoAnswer: [String(h), String(k)], // dev mode only
          check: (raw) => {
            const [vx, vy] = (raw ?? []).map(parseNumber);
            if (vx == null || vy == null) return null;
            return numbersMatch(vx, h) && numbersMatch(vy, k);
          },
          answerText: `\\((${h}, ${k})\\)`,
          hints: [
            `Look at your table: where does \\(y\\) stop ${opensDown ? "going up" : "going down"} and turn around?`,
            `The rows \\(x = ${h - 1}\\) and \\(x = ${h + 1}\\) have the same \\(y\\), so the turning point is halfway between them. Its \\(y\\) is in your table.`,
          ],
        },
      ],
    };

    // ---- 3. Represent: write the equation, then pick its graph ----
    const graphOptions = shuffle(quadraticGraphOptions(a, h, k, params.xMin, params.xMax), rng).map((o, i) => ({
      key: o.key,
      text: `Graph ${"ABCD"[i]}`,
      graph: o.graph,
    }));
    const boxHelp = {
      a: `The first number says how much \\(y\\) changes one step away from the ${extreme} point, and its sign says which way (use 1 or -1 for a plain bracket).`,
      h: `The number after \\(x -\\) is the \\(x\\) of the ${extreme} point.`,
      k: `The number added at the end is the ${extreme} value of \\(y\\).`,
    };
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
          parts: ["y =", "\\big(x -", "\\big)^{2} +"],
          autoAnswer: [String(a), String(h), String(k)], // dev mode only
          check: (raw) => {
            const values = (raw ?? []).map(parseNumber);
            if (values.length < 3 || values.some((v) => v == null)) return null;
            return numbersMatch(values[0], a) && numbersMatch(values[1], h) && numbersMatch(values[2], k);
          },
          answerText: `\\(${latex(params)}\\)`,
          hints: [
            // Nudge: only about the boxes that are wrong in the last attempt
            ({ answer }) => {
              const [va, vh, vk] = (answer ?? []).map(parseNumber);
              const wrong = [];
              if (va == null || !numbersMatch(va, a)) wrong.push(boxHelp.a);
              if (vh == null || !numbersMatch(vh, h)) wrong.push(boxHelp.h);
              if (vk == null || !numbersMatch(vk, k)) wrong.push(boxHelp.k);
              return (wrong.length ? wrong : Object.values(boxHelp)).join(" ");
            },
            `The ${extreme} point is \\((${h}, ${k})\\): those go in the second and third boxes. ` +
              `For the first box, compare \\(y\\) at \\(x = ${h}\\) and \\(x = ${h + 1}\\): how much does it change, and does it go up or down?`,
          ],
        },
        {
          id: "represent-match",
          move: "equation-to-graph",
          type: "choice",
          display: "graphs",
          prompt: "Which graph matches your equation?",
          options: graphOptions,
          // The "shifted the wrong way" curve can be very steep here; it just runs off the edge
          graphFit: graphOptions.filter((o) => o.key !== "wrong-h").map((o) => o.graph),
          check: (key) => key === "correct",
          answerText: graphOptions.find((o) => o.key === "correct").text,
          hints: [
            `Your curve has a ${extreme} point. Which graphs turn around ${opensDown ? "at the top" : "at the bottom"}?`,
            `Your curve turns around at \\((${h}, ${k})\\) and starts at \\((0, ${yStart})\\).`,
          ],
        },
      ],
    };

    // ---- 4. Solve: a reverse question (solve for x), then read the graph ----
    // "After the turning point, when is it at T?" with x = h + d for a whole d from 2 to
    // h - 1 (h + 1 is already in the table). That needs h >= 3; when h = 2 there is no
    // such d, so ask "when is it back at the start?" (x = 2h) instead.
    const targetDs = range(2, h - 1);
    const solveQuestion = targetDs.length ? "target" : "return";
    const values = { ...(context.values ?? params) };
    let solveItem;
    if (solveQuestion === "return") {
      solveItem = numberItem({
        id: "solve-question",
        prompt: scenario?.returnQuestion
          ? fill(scenario.returnQuestion, values)
          : `When is \\(y\\) back at its starting value, ${yStart}? (What is \\(x\\)?)`,
        answer: end,
        target: yStart,
        hints: [
          `The curve is symmetric around the ${extreme} point at \\(x = ${h}\\).`,
          `It starts at \\(x = 0\\), which is ${h} before the ${extreme} point. It is back at the same height the same distance after it: \\(x = ${h} + ${h}\\).`,
        ],
      });
    } else {
      const d = pick(targetDs);
      const T = y(h + d);
      const gap = Math.abs(T - k);
      solveItem = numberItem({
        id: "solve-question",
        prompt: scenario?.reverseQuestion
          ? fill(scenario.reverseQuestion, { ...values, target: T })
          : `After the ${extreme} point, for what \\(x\\) is \\(y = ${T}\\)?`,
        answer: h + d,
        target: T,
        hints: [
          `Put \\(y = ${T}\\) into your equation: \\(${latex(params).replace(/^y/, String(T))}\\). Then solve for \\(x\\).`,
          `${T} is ${gap} ${opensDown ? "below" : "above"} the ${extreme} value ${k}, so \\(${Math.abs(a)}(x - ${h})^2 = ${gap}\\). ` +
            `That gives \\((x - ${h})^2 = ${gap / Math.abs(a)}\\), and after the ${extreme} point \\(x - ${h}\\) is positive.`,
        ],
      });
    }
    const highlight = { x: solveItem.answer, y: solveItem.target };
    const tableXs = [0, h - 1, h, h + 1, end];
    const wholeReads = range(params.xMin, params.xMax).filter((x) => !tableXs.includes(x) && x !== highlight.x);
    const halfReads = range(params.xMin, params.xMax - 1).map((x) => x + 0.5);
    const readX = pick(wholeReads.length ? wholeReads : halfReads);
    const solve = {
      id: "solve",
      instructions: "Use your equation to work out when the story reaches a height. Then read the graph.",
      show: ["story", "formula", "graph"],
      requires: { formula: "represent", graph: "represent" },
      revealAfter: { "solve-question": ["graph"] },
      graphHighlight: { afterItem: "solve-question", ...highlight },
      referenceTable: "notice-table",
      solveQuestion,
      items: [solveItem, graphReadItem({ concept, params, readX })],
    };

    // ---- 5. Explain ----
    const steps = units.x;
    const explain = {
      id: "explain",
      instructions: "Explain what the numbers in the equation mean in the story.",
      show: ["story", "formula", "graph"],
      requires: { formula: "represent", graph: "represent" },
      referenceTable: "notice-table",
      items: [
        choiceItem({
          id: "explain-h",
          prompt: `What does \\(h = ${h}\\) mean in this story?`,
          options: [
            { key: "correct", text: `the number of ${steps} until the ${extreme} point` },
            { key: "k-meaning", text: `the ${Yname} at the ${extreme} point` },
            { key: "start", text: `the starting ${Yname}` },
            { key: "total", text: `the number of ${steps} until it is back at the start` },
          ],
          correctKey: "correct",
          hints: [
            "In \\(y = a(x - h)^2 + k\\), \\(h\\) is the \\(x\\) of the turning point.",
            `The ${extreme} point is \\((${h}, ${k})\\). \\(x\\) counts ${steps}, so \\(h\\) is how many ${steps} it takes to get there.`,
          ],
          rng,
        }),
        choiceItem({
          id: "explain-k",
          prompt: `What does \\(k = ${k}\\) mean in this story?`,
          options: [
            { key: "correct", text: `the ${Yname} at the ${extreme} point` },
            { key: "h-meaning", text: `the number of ${steps} until the ${extreme} point` },
            { key: "start", text: `the starting ${Yname}` },
            { key: "step", text: `how much the ${Yname} changes each step` },
          ],
          correctKey: "correct",
          hints: [
            "Put \\(x = h\\) into the equation: \\((h - h)^2 = 0\\), so what is left?",
            `At the ${extreme} point, \\(y = ${k}\\). That is the ${extreme} ${Yname}.`,
          ],
          rng,
        }),
      ],
    };

    // ---- 6. Transfer ----
    const right = h + TRANSFER_DISTANCE;
    const left = h - TRANSFER_DISTANCE;
    const firstX = left === 0 ? 1 : 0; // when h = 2, f(h - 2) is f(0) already, so start with f(1)
    const valueHints = (x) => {
      const dx = x - h;
      const sq = dx * dx;
      return [
        `Replace \\(x\\) with ${x}. Work out \\((${x} - ${h})^2\\) first.`,
        `\\(${x} - ${h} = ${dx}\\), and squared that is ${sq}. Times ${Math.abs(a)} is ${Math.abs(a) * sq}. ` +
          `Start at ${k} and ${opensDown ? "subtract" : "add"} it.`,
      ];
    };
    const transfer = {
      id: "transfer",
      instructions: "No story this time. The same rule is written in function notation.",
      show: [],
      introMath: latex(params).replace(/^y/, "f(x)"),
      intro: `\\(f(${right})\\) means: the output when the input \\(x\\) is ${right}.`,
      items: [
        ...[
          [`transfer-f-${firstX === 0 ? "0" : "1"}`, firstX],
          ["transfer-f-right", right],
          ["transfer-f-left", left],
        ].map(([id, x]) =>
          numberItem({ id, prompt: `\\(f(${x}) = ?\\)`, answer: y(x), x, hints: valueHints(x) })
        ),
        choiceItem({
          id: "transfer-why",
          prompt: `Why are \\(f(${right})\\) and \\(f(${left})\\) equal?`,
          options: [
            {
              key: "correct",
              text: `${right} and ${left} are both ${TRANSFER_DISTANCE} away from \\(x = ${h}\\), so \\((x - ${h})^2\\) is ${TRANSFER_DISTANCE ** 2} for both: the curve is symmetric around its ${extreme} point`,
            },
            { key: "constant", text: "\\(f\\) gives the same answer for every \\(x\\)" },
            { key: "sum", text: `${right} and ${left} add up to ${right + left}` },
            { key: "k-added", text: "\\(k\\) is added to both" },
          ],
          correctKey: "correct",
          hints: [
            `Work out \\(x - ${h}\\) for both. What happens when you square them?`,
            `\\(${right} - ${h} = ${TRANSFER_DISTANCE}\\) and \\(${left} - ${h} = ${-TRANSFER_DISTANCE}\\). Squared, both give ${TRANSFER_DISTANCE ** 2}.`,
          ],
          rng,
        }),
      ],
    };

    return [explore, notice, represent, solve, explain, transfer].map((step) => ({
      ...step,
      logFields: { representFormat: "both", solveQuestion },
    }));
  },
};
