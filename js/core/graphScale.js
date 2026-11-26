/*
  graphScale.js — the numbers behind a graph's axes: the visible area and the grid
  spacing. No drawing and no graphing library here (only views/graph.js draws), so
  flows can use the SAME numbers, e.g. to accept a graph reading within half a grid step.
*/

// Visible area around the data, with 10% padding: [left, top, right, bottom].
// Always shows y = 0.
export function boundingBox(xs, ys) {
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(0, ...ys), yMax = Math.max(...ys);
  const padX = (xMax - xMin) * 0.1 || 1;
  const padY = (yMax - yMin) * 0.1 || 1;
  return [xMin - padX, yMax + padY, xMax + padX, yMin - padY];
}

// A "nice" grid step (1, 2 or 5 times a power of 10) giving about `lines` grid lines over `span`
export function niceStep(span, lines = 8) {
  const raw = Math.abs(span) / lines || 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) {
    if (m * power >= raw - 1e-12) return m * power;
  }
  return 10 * power;
}

/*
  The view for a graph-reading question: the usual x range, stretched to include a
  highlighted point (e.g. the Solve answer at x = 40), with grid steps for both axes.
  Returns { box, xStep, yStep, xMax } where xMax is how far the line should be drawn.
*/
export function readingView(concept, params, highlight = null) {
  const xMax = Math.max(params.xMax, highlight ? Math.ceil(highlight.x) : params.xMax);
  const xs = [];
  for (let x = params.xMin; x <= xMax; x++) xs.push(x);
  const ys = xs.map((x) => concept.evaluate(params, x));
  if (highlight) {
    xs.push(highlight.x);
    ys.push(highlight.y);
  }
  const box = boundingBox(xs, ys);
  return {
    box,
    xStep: niceStep(box[2] - box[0], 10),
    yStep: niceStep(box[1] - box[3], 8),
    xMax,
  };
}
