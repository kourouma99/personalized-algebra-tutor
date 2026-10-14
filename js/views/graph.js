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

// ---------------------------------------------------------------------------
// YOUR TURN: the TODOs below
// ---------------------------------------------------------------------------

// TODO 1: Import makePoints from ./table.js (or wherever you put it).

// TODO 2: Create variables outside the functions, e.g.
//   let graphBoard = null;
//   let numberLineBoard = null;
//   In JSXGraph, a "board" is the drawing area. Before drawing a new graph in the same
//   div, free the old board with JXG.JSXGraph.freeBoard(graphBoard). Otherwise you'd
//   draw on top of the old one. (This is the simplest approach: rebuild the board on
//   every render, because the bounding box changes with the data anyway.)

// TODO 3: Export a function renderGraph(state, labels) that:
//   a. returns early if state.params is missing, or if window.JXG doesn't exist
//      (that means initGraphing failed, so show a short message in #graph-surface instead)
//   b. gets the points with makePoints(state.concept, state.params)
//   c. computes the visible area from the smallest/largest x and y in `points`,
//      plus a little padding. JSXGraph wants it as [left, top, right, bottom].
//      (Careful: top comes before right, and top is the LARGEST y.)
//   d. frees the old board if there is one (TODO 2)
//   e. creates the board:
//        graphBoard = JXG.JSXGraph.initBoard("graph-surface", {
//          boundingbox: [left, top, right, bottom],
//          axis: true,
//          showCopyright: false,
//          showNavigation: false,
//        });
//   f. draws the line through the points as a curve made of DATA, not an equation:
//        graphBoard.create("curve", [xValues, yValues], { strokeWidth: 2 });
//      where xValues = points.map(p => p.x) and yValues = points.map(p => p.y).
//      Why points and not the formula? Our code computes every number. JSXGraph only draws them.
//      It also keeps graph.js generic: it works for any concept that has evaluate().
//   g. draws each point as a dot that students can't drag:
//        graphBoard.create("point", [p.x, p.y], { fixed: true, name: "", size: 2 });
//   h. adds axis labels from labels.x and labels.y. Simplest way: graphBoard.create("text",
//      [x, y, labels.x]) near the end of each axis. (Or explore the `defaultAxes` option.)

// TODO 4: Export a function renderNumberLine(state, labels) that:
//   a. finds #number-line. If state.concept.representations doesn't include "number-line",
//      set its `hidden` property to true and return. Otherwise set hidden = false.
//   b. gets the values to mark from your code, NOT from an equation. For example, use the
//      same makePoints output (or a list of values the concept provides later).
//   c. frees the old numberLineBoard and creates a new one on "number-line-surface" with
//      axis: false and a small vertical range, e.g. boundingbox: [left, 1, right, -1]
//   d. draws the number line itself as a single horizontal axis:
//        numberLineBoard.create("axis", [[0, 0], [1, 0]]);
//   e. marks each value with a fixed point at (value, 0)
//   (linear-equation doesn't list "number-line" yet. This becomes useful for concepts
//    like inequalities. Write it once the graph works.)

// TODO 5 (stretch): By default, students can drag and zoom the board. Try turning that off
//   with the initBoard options pan: { enabled: false } and zoom: { enabled: false },
//   and decide which is better for learning.

// Docs: https://jsxgraph.org/docs/  (tutorials and examples: https://jsxgraph.org/wiki/)
