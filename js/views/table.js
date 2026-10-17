/*
  table.js — shows a table of input/output values.

  GENERIC view: it loops over x values and asks the concept for each y
  by calling concept.evaluate(params, x). It never does y = mx + b itself.
  The column headers come from the sample scenario labels (e.g. "Games played"),
  so the table is personalized too.

  graph.js uses the SAME x values and the SAME evaluate(), so the table and
  graph always agree. Consider sharing a helper for making the points (see TODO 2).

  Draws into #table in index.html.
*/

import { renderMath } from "./mathRender.js";

// Shared with graph.js so the table and graph always use the same points
export function makePoints(concept, params, step = 1) {
  const points = [];
  for (let x = params.xMin; x <= params.xMax; x += step) {
    points.push({ x, y: concept.evaluate(params, x) });
  }
  return points;
}

export function renderTable(state, labels) {
  const container = document.getElementById("table");
  if (!container) return;
  container.textContent = "";

  if (!state.concept || !state.params) return;
  if (!state.concept.representations.includes("table")) return;

  const heading = document.createElement("h2");
  heading.textContent = "Table";

  const table = document.createElement("table");

  // Header row: "Games played (x)" with x rendered by KaTeX
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const v of ["x", "y"]) {
    const th = document.createElement("th");
    const name = labels?.[v] ?? v; // use the label if there is one
    const symbol = document.createElement("span");
    renderMath(symbol, v);
    th.append(document.createTextNode(`${name} (`), symbol, document.createTextNode(")"));
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);

  // One row per point
  const tbody = document.createElement("tbody");
  for (const { x, y } of makePoints(state.concept, state.params)) {
    const row = document.createElement("tr");
    const tdX = document.createElement("td");
    const tdY = document.createElement("td");
    tdX.textContent = x;
    tdY.textContent = y;
    row.append(tdX, tdY);
    tbody.appendChild(row);
  }

  table.append(thead, tbody);
  container.append(heading, table);
}