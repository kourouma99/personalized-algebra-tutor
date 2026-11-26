/*
  flowHelpers.js — small building blocks shared by every flow (linearFlow.js,
  exponentialFlow.js, ...). No math about any one concept lives here, and no DOM,
  so everything can be tested in Node.
*/

import { parseNumber, numbersMatch } from "../core/answerCheck.js";
import { zoomedView } from "../core/graphScale.js";

// Fisher–Yates shuffle that uses the given random function, returns a new array
export function shuffle(list, rng = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// "Games played" -> "games played", so labels fit inside a sentence
export function lower(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// Replace {key} with values[key] (same rule as views/scenario.js)
export function fill(text, values) {
  return text.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
}

// check() for a number box: null if unreadable (not counted), else right/wrong
export function numberCheck(answer, tolerance) {
  return (raw) => {
    const value = parseNumber(raw);
    return value === null ? null : numbersMatch(value, answer, tolerance);
  };
}

// Multiple choice, options shuffled once (so Back/Next keep the same order)
export function choiceItem({ id, prompt, options, correctKey, hints, rng }) {
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

// A number box. `answer` is kept so later steps can show it (e.g. the reference table).
export function numberItem({ id, prompt, answer, hints, answerText, tolerance, ...rest }) {
  return {
    id,
    type: "number",
    prompt,
    answer,
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
  For a table hint: the row the student can already see that is closest to x
  (the given rows plus cells already solved), and how far away it is.
  cells: [{ x, id }] for the table's blank cells; solved(id) says if one is done.
*/
export function nearestKnown(x, givenRows, cells, y, solved) {
  const known = [
    ...givenRows,
    ...cells.filter((c) => c.x !== x && solved(c.id)).map((c) => ({ x: c.x, y: y(c.x) })),
  ];
  const from = nearestRow(known, x);
  const dx = x - from.x;
  return { from, dx, steps: Math.abs(dx), dir: dx > 0 ? "up" : "down" };
}

const short = (v) => String(Number(v.toFixed(2))); // 16.428571 -> "16.43", 20 -> "20"

/*
  "Read the graph" question, asked in Solve right after the equation answer. The big
  graph shows that answer's point highlighted (step.graphHighlight). The question has its
  own zoomed-in graph (item.readingGraph, drawn by views/graph.js renderReadingGraph):
  the concept's normal x range with a fine grid. The student reads y at readX, a small x
  inside it; any answer within half of THAT graph's y-grid step is accepted.
*/
export function graphReadItem({ concept, params, readX }) {
  const { yStep } = zoomedView(concept, params);
  const answer = concept.evaluate(params, readX);
  const half = yStep / 2;
  const lo = Math.floor(answer / yStep + 1e-9) * yStep;
  const onLine = Math.abs(answer - lo) < 1e-9;
  return numberItem({
    id: "solve-read",
    prompt: `The purple point on the big graph is your answer. Now use the zoomed-in graph below: about how much is \\(y\\) when \\(x = ${short(readX)}\\)?`,
    readingGraph: { params }, // the view draws the zoomed-in graph above the answer box
    answer,
    tolerance: half + 1e-9,
    answerText: `about \\(${short(answer)}\\) (anything from ${short(answer - half)} to ${short(answer + half)} is fine)`,
    autoAnswer: short(answer), // dev mode only
    readX,
    yStep,
    hints: [
      `Find \\(x = ${short(readX)}\\) on the bottom axis, go straight up to the line, then across to the \\(y\\)-axis.`,
      `The grid lines on the \\(y\\)-axis are ${short(yStep)} apart. At \\(x = ${short(readX)}\\) the line is ` +
        (onLine ? `right on the grid line \\(y = ${short(lo)}\\).` : `between \\(y = ${short(lo)}\\) and \\(y = ${short(lo + yStep)}\\).`),
    ],
  });
}

// Whole numbers from lo to hi, both included
export function range(lo, hi) {
  return Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);
}
