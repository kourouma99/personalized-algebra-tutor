/*
  formula.js — shows the concept's formula, e.g. y = 3x + 12, rendered with KaTeX.

  GENERIC view: it never builds the formula itself. It asks the concept
  by calling concept.formulaLatex(params), then hands the LaTeX to
  views/mathRender.js to display. That's why it will also work
  for a physics formula like d = 5t + 20 later.

  It does NOT call KaTeX directly. Only mathRender.js does.

  Draws into #formula in index.html.
*/

import { renderMath } from "./mathRender.js";

export function renderFormula(state, labels) {
  const container = document.getElementById("formula");
  if (!container) return;
  container.textContent = ""; // clear old content

  if (!state.concept || !state.params) return;
  if (!state.concept.representations.includes("formula")) return;

  const heading = document.createElement("h2");
  heading.textContent = "Formula";

  const mathEl = document.createElement("div");
  renderMath(mathEl, state.concept.formulaLatex(state.params), true);
  mathEl.setAttribute("aria-label", state.concept.formulaText(state.params));

  container.append(heading, mathEl);

  // Stretch: explain the variables, e.g. "x = games played"
  if (labels) {
    for (const [variable, meaning] of Object.entries(labels)) {
      const line = document.createElement("p");
      const v = document.createElement("span");
      renderMath(v, variable);
      line.append(v, document.createTextNode(` = ${meaning}`));
      container.appendChild(line);
    }
  }
}