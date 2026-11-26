/*
  graph.js — draws graphs and number lines. The ONLY file allowed to talk to
  the graphing library (JSXGraph for now).

  GENERIC view: it gets its points the same way table.js does (by calling
  concept.evaluate for each x), so the graph always matches the table.
  It never knows the formula is y = mx + b. JSXGraph only DRAWS the numbers
  our code computed; it never computes them from an equation.

  Swapping libraries later (e.g. back to Desmos):
    The rest of the app only calls the exported functions below:
      initGraphing(), renderGraph(state, labels, { highlight }), renderNumberLine(state, labels),
      renderMiniGraphs(elementIds, concept, paramsList), renderReadingGraph(elementId, concept, params),
      clearMiniGraphs()
    Keep those names and arguments the same, change what's inside them,
    and update `provider` in js/config.js. No other file needs to change.

  JSXGraph is loaded in index.html with a normal <script> tag, so it's available
  here as the global variable `JXG` (no import needed).

  Reads `provider` from js/config.js. Draws into #graph-surface and
  #number-line-surface in index.html.
*/

import { config } from "../config.js";

// ---------------------------------------------------------------------------
// SETUP: checking that the graphing library is available
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



import { makePoints } from "./table.js"; // the same points the table shows
import { boundingBox, readingView, zoomedView } from "../core/graphScale.js"; // axes numbers, shared with flows

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

// Hover style for table points: JSXGraph's default hover colour is a pale blue that
// is hard to see, so hovered points turn dark, grow, and show their coordinates.
const POINT_SIZE = 2;
const HOVER_SIZE = 5;
const HOVER_COLOR = "#1e3a8a"; // dark blue

// "16.43" instead of "16.428571428571427"; whole numbers stay as they are
function formatCoordinate(v) {
  return String(Number(v.toFixed(2)));
}

/*
  One table point that, on hover, gets darker and bigger and shows "(x, y)".
  The label is a hidden text element next to the point; it is placed on the
  inner side of the point so it doesn't fall off the edge of the graph.
*/
function addHoverPoint(board, p, [left, top, right, bottom]) {
  const point = board.create("point", [p.x, p.y], {
    fixed: true,
    name: "",
    size: POINT_SIZE,
    highlightFillColor: HOVER_COLOR,
    highlightStrokeColor: HOVER_COLOR,
    highlightFillOpacity: 1,
    highlightStrokeOpacity: 1,
  });

  const onRight = p.x > (left + right) / 2;
  const onTop = p.y > (top + bottom) / 2;
  const dx = (right - left) * 0.02 * (onRight ? -1 : 1);
  const dy = (top - bottom) * 0.04 * (onTop ? -1 : 1);
  const label = board.create("text", [p.x + dx, p.y + dy, `(${formatCoordinate(p.x)}, ${formatCoordinate(p.y)})`], {
    visible: false,
    fixed: true,
    highlight: false,
    anchorX: onRight ? "right" : "left",
    anchorY: onTop ? "top" : "bottom",
    fontSize: 14,
    strokeColor: HOVER_COLOR,
    cssStyle: "font-weight: 600; background: rgba(255, 255, 255, 0.85); padding: 1px 4px; border-radius: 4px;",
  });

  point.on("over", () => {
    point.setAttribute({ size: HOVER_SIZE });
    label.setAttribute({ visible: true });
  });
  point.on("out", () => {
    point.setAttribute({ size: POINT_SIZE });
    label.setAttribute({ visible: false });
  });
  return { point, label };
}

// 101 points from xMin to xMax, every y computed by concept.evaluate
function sampleCurve(concept, params, steps = 100) {
  const xs = [];
  const ys = [];
  for (let i = 0; i <= steps; i++) {
    const x = params.xMin + ((params.xMax - params.xMin) * i) / steps;
    xs.push(x);
    ys.push(concept.evaluate(params, x));
  }
  return { xs, ys };
}

// ---------------------------------------------------------------------------
// Small graphs for "Which graph matches?" questions (used by views/flowView.js)
// ---------------------------------------------------------------------------

let miniBoards = [];

// Frees every small graph. Call before the elements they live in are removed.
export function clearMiniGraphs() {
  if (window.JXG) for (const board of miniBoards) JXG.JSXGraph.freeBoard(board);
  miniBoards = [];
}

/*
  Draws one small graph per entry, all with the SAME axes so they can be compared.
  elementIds[i] is the id of an empty element already on the page; paramsList[i]
  are the concept params for that graph (or { concept, params } for another curve). Only a line and the axes are drawn:
  no labels, no points, nothing that names the equation.
  fitList (optional): the params the shared axes are sized to. Lines outside
  that area are simply cut off at the edge. Defaults to all of paramsList.
  Returns the shared bounding box [left, top, right, bottom] (handy for tests).
*/
export function renderMiniGraphs(elementIds, concept, paramsList, fitList = paramsList) {
  // An entry can also be { concept, params } to draw a different kind of curve
  // (e.g. a straight-line look-alike among exponential options)
  const sample = (entry) =>
    entry && entry.concept && entry.params ? sampleCurve(entry.concept, entry.params) : sampleCurve(concept, entry);
  const curves = paramsList.map(sample);
  const fit = fitList.map(sample);
  const box = boundingBox(fit.flatMap((c) => c.xs), fit.flatMap((c) => c.ys));

  elementIds.forEach((id, i) => {
    const element = document.getElementById(id);
    if (!element) return;
    if (!window.JXG) {
      element.textContent = "Graph unavailable.";
      return;
    }
    const board = JXG.JSXGraph.initBoard(id, { ...boardOptionsFor(false), boundingbox: box });
    board.create("curve", [curves[i].xs, curves[i].ys], { strokeWidth: 2, highlight: false });
    miniBoards.push(board);
  });
  return box;
}

const HIGHLIGHT_COLOR = "#7048e8"; // purple: the student's answer, unlike the orange table dots

// Axis ticks that run across the whole graph (grid lines) at a fixed step
function gridTicks(step) {
  return { ticks: { ticksDistance: step, insertTicks: false, minorTicks: 0, majorHeight: -1, strokeOpacity: 0.25 } };
}

/*
  The zoomed-in graph for the graph-reading question (drawn inside the question by
  views/flowView.js): just the line over the concept's normal x range, on the fine
  grid of core/graphScale.js zoomedView — the same yStep the flow uses for tolerance.
  No points or labels that would give the answer away. Freed by clearMiniGraphs().
  Returns the view ({ box, xStep, yStep }) for tests.
*/
export function renderReadingGraph(elementId, concept, params) {
  const view = zoomedView(concept, params);
  const element = document.getElementById(elementId);
  if (!element) return view;
  if (!window.JXG) {
    element.textContent = "Graph unavailable.";
    return view;
  }
  const board = JXG.JSXGraph.initBoard(elementId, {
    ...boardOptionsFor(false),
    boundingbox: view.box,
    defaultAxes: { x: gridTicks(view.xStep), y: gridTicks(view.yStep) },
  });
  const curve = sampleCurve(concept, params, 200);
  board.create("curve", [curve.xs, curve.ys], { strokeWidth: 2, highlight: false });
  miniBoards.push(board);
  return view;
}

/*
  options.highlight = { x, y }: mark that point (e.g. the Solve answer) in purple with its
  coordinates, and switch to the wide view from core/graphScale.js readingView: the x
  range is stretched to include the point, with grid lines. (The reading question itself
  uses its own zoomed-in graph, renderReadingGraph.)
*/
export function renderGraph(state, labels, options = {}) {
  const surface = document.getElementById("graph-surface");
  if (!surface || !state.concept || !state.params) return;

  if (!window.JXG) {
    surface.textContent = "Graph unavailable (the graphing library didn't load).";
    return;
  }

  const { highlight = null } = options;
  const points = makePoints(state.concept, state.params);
  const view = highlight ? readingView(state.concept, state.params, highlight) : null;
  const [left, top, right, bottom] = view ? view.box : boundingBox(points.map((p) => p.x), points.map((p) => p.y));

  if (graphBoard) JXG.JSXGraph.freeBoard(graphBoard); // clear the old graph
  graphBoard = JXG.JSXGraph.initBoard("graph-surface", {
    ...boardOptionsFor(state.graphInteractive),
    boundingbox: [left, top, right, bottom],
    ...(view && { defaultAxes: { x: gridTicks(view.xStep), y: gridTicks(view.yStep) } }),
  });

  // Smooth line: sample many x values between the table points. Still computed by
  // OUR evaluate(), not by JSXGraph from an equation. Drawn further out when a
  // highlighted point lies past the table (e.g. x = 40).
  const curveParams = view ? { ...state.params, xMax: view.xMax } : state.params;
  const curve = sampleCurve(state.concept, curveParams, view ? 400 : 100);
  graphBoard.create("curve", [curve.xs, curve.ys], { strokeWidth: 2 });

  for (const p of points) addHoverPoint(graphBoard, p, [left, top, right, bottom]);

  if (highlight) {
    const onRight = highlight.x > (left + right) / 2;
    graphBoard.create("point", [highlight.x, highlight.y], {
      fixed: true,
      size: 6,
      fillColor: HIGHLIGHT_COLOR,
      strokeColor: HIGHLIGHT_COLOR,
      highlight: false,
      name: `(${formatCoordinate(highlight.x)}, ${formatCoordinate(highlight.y)})`,
      withLabel: true,
      label: {
        fontSize: 14,
        strokeColor: HIGHLIGHT_COLOR,
        anchorX: onRight ? "right" : "left",
        offset: [onRight ? -10 : 10, 12],
        cssStyle: "font-weight: 700; background: rgba(255, 255, 255, 0.85); padding: 1px 4px; border-radius: 4px;",
      },
    });
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