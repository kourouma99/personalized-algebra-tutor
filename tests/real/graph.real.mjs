// Runs graph.js against the REAL JSXGraph 1.10.1 inside jsdom
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

import { ROOT as dir, RUNS } from "../helpers.mjs";
const dom = new JSDOM(`<!doctype html><div id="graph-surface" style="width:600px;height:360px"></div>`, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
// jsdom has no layout; give elements a size so JSXGraph can set up
Object.defineProperty(window.HTMLElement.prototype, "clientWidth", { get: () => 600 });
Object.defineProperty(window.HTMLElement.prototype, "clientHeight", { get: () => 360 });
window.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 40, height: 14 });
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
const matrix = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, scale() { return matrix(); }, translate() { return matrix(); }, inverse() { return matrix(); }, multiply() { return matrix(); } });
window.SVGElement.prototype.getScreenCTM = matrix;
window.SVGElement.prototype.getCTM = matrix;
window.SVGElement.prototype.createSVGMatrix = matrix;
window.SVGElement.prototype.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return { x: 0, y: 0 }; } });
window.HTMLElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, right: 600, bottom: 360, width: 600, height: 360, x: 0, y: 0 });
// Load JSXGraph in the SAME JavaScript realm as graph.js (arrays must be real arrays to it)
globalThis.window = window;
globalThis.document = window.document;
for (const k of ["HTMLElement", "SVGElement", "Node", "Element", "getComputedStyle", "matchMedia", "requestAnimationFrame"]) {
  if (!(k in globalThis)) globalThis[k] = typeof window[k] === "function" && k[0] === k[0].toLowerCase() ? window[k].bind(window) : window[k];
}
globalThis.CSS = { escape: (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`), supports: () => true };
// Node's navigator lacks the browser fields JSXGraph reads
for (const [k, v] of Object.entries({ appVersion: "5.0 (Windows)", userAgent: "Mozilla/5.0 (Windows NT 10.0) jsdom", maxTouchPoints: 0 })) {
  try { Object.defineProperty(globalThis.navigator, k, { value: v, configurable: true }); } catch {}
}
const { createRequire } = await import("node:module");
const require = createRequire(import.meta.url);
globalThis.JXG = require(path.join(dir, "node_modules/jsxgraph/distrib/jsxgraphcore.js"));
window.JXG = globalThis.JXG;
assert.ok(window.JXG?.JSXGraph, "real JSXGraph loaded, version " + window.JXG.version);
window.JXG.Options.board.renderer = "svg"; // browsers get SVG; under Node JSXGraph picks canvas

const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push(a.join(" ")); };

const { renderGraph } = await import(pathToFileURL(path.join(dir, "js/views/graph.js")).href);
const { default: linear } = await import(pathToFileURL(path.join(dir, "js/concepts/algebra/linearEquation.js")).href);
const { default: quadratic } = await import(pathToFileURL(path.join(dir, "js/concepts/algebra/quadratic.js")).href);

function check(concept, params) {
  renderGraph({ concept, params, graphInteractive: false }, { x: "Games", y: "Points" });
  const board = Object.values(window.JXG.boards).at(-1);
  const points = board.objectsList.filter((o) => o.elType === "point" && o.visProp.visible !== false); // skip hidden axis helpers
  const texts = board.objectsList.filter((o) => o.elType === "text");
  if (process.env.DEBUG) console.log("points", board.objectsList.filter((o) => o.elType === "point").length, "texts", texts.length, texts.slice(0, 3).map((t) => [t.plaintext, t.htmlStr, typeof t.content]));
  const textOf = (o) => o.plaintext ?? o.htmlStr ?? "";
  const labels = texts.filter((o) => textOf(o).startsWith("("));
  assert.ok(points.length > 0 && labels.length === points.length, "one hidden label per point");
  assert.ok(labels.every((l) => l.visProp.visible === false), "labels hidden at first");
  for (const [i, pt] of points.entries()) {
    assert.equal(pt.visProp.size, 2);
    assert.equal(pt.visProp.highlightfillcolor, "#1e3a8a", "dark hover colour set");
    pt.triggerEventHandlers(["over"], [{}]);
    assert.equal(pt.visProp.size, 5, "bigger on hover");
    assert.equal(labels[i].visProp.visible, true, "label shown on hover");
    const want = `(${Number(pt.X().toFixed(2))}, ${Number(pt.Y().toFixed(2))})`;
    assert.equal(textOf(labels[i]), want, "label text is the point's coordinates");
    pt.triggerEventHandlers(["out"], [{}]);
    assert.equal(pt.visProp.size, 2, "back to normal size");
    assert.equal(labels[i].visProp.visible, false, "label hidden again");
  }
  // labels stay inside the visible box
  const [l, t, r, b] = board.getBoundingBox();
  assert.ok(labels.every((lab) => lab.X() >= l && lab.X() <= r && lab.Y() <= t && lab.Y() >= b), "labels inside the graph");
  return labels.map(textOf);
}

console.log("JSXGraph", window.JXG.version);
console.log("linear labels:", check(linear, { m: 3, b: 12, xMin: 0, xMax: 10 }).join(" "));
const qp = quadratic.generateParams();
console.log("quadratic labels:", check(quadratic, qp).slice(0, 4).join(" "), "...");
// Graph-reading view: highlighted answer at a big x, grid lines at the flow's step
{
  const { readingView } = await import(pathToFileURL(path.join(dir, "js/core/graphScale.js")).href);
  const params = { m: 3, b: 12, xMin: 0, xMax: 10 };
  const highlight = { x: 40, y: 132 };
  renderGraph({ concept: linear, params, graphInteractive: false }, { x: "Games", y: "Points" }, { highlight });
  const board = Object.values(window.JXG.boards).at(-1);
  const view = readingView(linear, params, highlight);
  assert.deepEqual(board.getBoundingBox().map((v) => +v.toFixed(6)), view.box.map((v) => +v.toFixed(6)), "board uses the reading view box");
  const yTicks = board.defaultAxes.y.defaultTicks, xTicks = board.defaultAxes.x.defaultTicks;
  assert.equal(yTicks.visProp.ticksdistance, view.yStep, "y grid step = flow's step");
  assert.equal(xTicks.visProp.ticksdistance, view.xStep, "x grid step");
  assert.equal(yTicks.visProp.majorheight, -1, "ticks drawn as full grid lines");
  assert.equal(yTicks.visProp.insertticks, false, "no automatic extra ticks");
  const hp = board.objectsList.find((o) => o.elType === "point" && o.name === "(40, 132)");
  assert.ok(hp && hp.X() === 40 && hp.Y() === 132 && hp.visProp.size === 6 && hp.label?.visProp.visible !== false, "highlighted point with coordinates");
  const curve = board.objectsList.find((o) => o.elType === "curve");
  assert.ok(Math.max(...curve.dataX) >= 40, "line drawn out to the highlighted point");
  console.log("reading view:", { box: view.box.map((v) => +v.toFixed(1)), xStep: view.xStep, yStep: view.yStep, yTicksFound: yTicks.ticks?.length });
  // and without a highlight: the normal view (no forced grid step)
  renderGraph({ concept: linear, params, graphInteractive: false }, null);
  const plain = Object.values(window.JXG.boards).at(-1);
  assert.ok(plain.getBoundingBox()[2] < 12, "normal view stays at the table's range");
}
// Zoomed-in reading graph: normal range, fine grid at the flow's tolerance step
{
  const { zoomedView } = await import(pathToFileURL(path.join(dir, "js/core/graphScale.js")).href);
  const { renderReadingGraph } = await import(pathToFileURL(path.join(dir, "js/views/graph.js")).href);
  const host = document.createElement("div");
  host.id = "reading-test";
  document.body.appendChild(host);
  const params = { m: 3, b: 12, xMin: 0, xMax: 10 };
  renderReadingGraph("reading-test", linear, params);
  const board = Object.values(window.JXG.boards).find((b) => b.container === "reading-test");
  const view = zoomedView(linear, params);
  assert.ok(board, "reading board created");
  assert.equal(board.defaultAxes.y.defaultTicks.visProp.ticksdistance, view.yStep, "fine y grid = flow's tolerance step");
  assert.equal(board.defaultAxes.x.defaultTicks.visProp.ticksdistance, view.xStep, "fine x grid");
  assert.ok(board.getBoundingBox()[2] < 12, "normal x range only");
  assert.equal(board.objectsList.filter((o) => o.elType === "point" && o.visProp.visible !== false).length, 0, "no answer points");
  console.log("zoomed view:", { box: view.box.map((v) => +v.toFixed(1)), xStep: view.xStep, yStep: view.yStep });
}
assert.deepEqual(errors, [], "no console errors: " + errors.join("\n"));
console.log("real JSXGraph hover + reading-view + zoomed-graph test passed");
