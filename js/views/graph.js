/*
  graph.js — draws graphs and number lines. The ONLY file allowed to talk to
  the graphing library (JSXGraph for now).

  GENERIC view: it gets its points the same way table.js does (by calling
  concept.evaluate for each x), so the graph always matches the table.
  It never knows the formula is y = mx + b. JSXGraph only DRAWS the numbers
  our code computed; it never computes them from an equation.

  Swapping libraries later (e.g. back to Desmos):
    The rest of the app only calls the three exported functions below:
      initGraphing(), renderGraph(state, labels), renderNumberLine(state, labels)
    Keep those names and arguments the same, change what's inside them,
    and update `provider` in js/config.js. No other file needs to change.

  JSXGraph is loaded in index.html with a normal <script> tag, so it's available
  here as the global variable `JXG` (no import needed).

  Reads `provider` from js/config.js. Draws into #graph-surface and
  #number-line-surface in index.html.
*/

import { config } from "../config.js";

// ---------------------------------------------------------------------------
// SETUP (already written): checking that the graphing library is available
// ---------------------------------------------------------------------------

// Checks that the library chosen in config.js has loaded.
// main.js must call this ONCE, with `await`, before the first renderGraph().
// If it fails (e.g. offline, CDN blocked), main.js should catch the error and keep
// the rest of the app working without a graph.
// It is `async` so a future library that must be loaded on demand (like Desmos,
// which needs an API key in its script URL) can keep the same function signature.
export async function initGraphing() {
  if (config.graphing.provider === "jsxgraph") {
    if (!window.JXG) {
      throw new Error("JSXGraph did not load. Check the JSXGraph <script> tag in index.html.");
    }
  } else {
    throw new Error(`Unknown graphing provider "${config.graphing.provider}" in js/config.js.`);
  }
}



import { makePoints } from "./table.js"; // put this next to the config import

let graphBoard = null;
let numberLineBoard = null;

function boardOptionsFor(interactive) {
  return {
    axis: true,
    showCopyright: false,
    showNavigation: interactive,                         // zoom +/- buttons
    pan: { enabled: interactive, needShift: false },     // drag without holding Shift
    zoom: { enabled: interactive, wheel: true, needShift: false },
  };
}

// Visible area around the data, with 10% padding: [left, top, right, bottom]
function boundingBox(xs, ys) {
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(0, ...ys), yMax = Math.max(...ys); // always show y = 0
  const padX = (xMax - xMin) * 0.1 || 1;
  const padY = (yMax - yMin) * 0.1 || 1;
  return [xMin - padX, yMax + padY, xMax + padX, yMin - padY];
}

export function renderGraph(state, labels) {
  const surface = document.getElementById("graph-surface");
  if (!surface || !state.concept || !state.params) return;

  if (!window.JXG) {
    surface.textContent = "Graph unavailable (the graphing library didn't load).";
    return;
  }

  const points = makePoints(state.concept, state.params);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [left, top, right, bottom] = boundingBox(xs, ys);

  if (graphBoard) JXG.JSXGraph.freeBoard(graphBoard); // clear the old graph
  graphBoard = JXG.JSXGraph.initBoard("graph-surface", {
    ...boardOptionsFor(state.graphInteractive),
    boundingbox: [left, top, right, bottom],
  });

  // The line, drawn from OUR computed points, not from an equation
  graphBoard.create("curve", [xs, ys], { strokeWidth: 2 });

  for (const p of points) {
    graphBoard.create("point", [p.x, p.y], { fixed: true, name: "", size: 2 });
  }

  if (labels) {
    graphBoard.create("text", [right, bottom, labels.x], { anchorX: "right", anchorY: "bottom", fixed: true });
    graphBoard.create("text", [left, top, labels.y], { anchorX: "left", anchorY: "top", fixed: true });
  }
}

export function renderNumberLine(state, labels) {
  const section = document.getElementById("number-line");
  if (!section) return;

  const wanted = state.concept?.representations.includes("number-line");
  section.hidden = !wanted;
  if (!wanted || !state.params || !window.JXG) return;

  // Placeholder: marks the y-values. Concepts like inequalities will supply their own values later.
  const values = makePoints(state.concept, state.params).map((p) => p.y);
  const [left, , right] = boundingBox(values, [0]);

  if (numberLineBoard) JXG.JSXGraph.freeBoard(numberLineBoard);
  numberLineBoard = JXG.JSXGraph.initBoard("number-line-surface", {
    ...boardOptionsFor(false),
    axis: false,
    boundingbox: [left, 1, right, -1],
  });

  numberLineBoard.create("axis", [[0, 0], [1, 0]]);
  for (const v of values) {
    numberLineBoard.create("point", [v, 0], { fixed: true, name: "", size: 2 });
  }
}