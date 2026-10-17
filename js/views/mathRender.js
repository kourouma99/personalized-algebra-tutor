/*
  mathRender.js — the ONLY file that talks to KaTeX (the math notation library).

  Every view that shows math notation (formula.js, scenario.js, table.js) calls
  these helpers instead of calling `katex` directly. Like graph.js, this means
  that if you ever swap KaTeX for something else (e.g. MathJax), you only change
  this one file.

  KaTeX is loaded in index.html with a normal <script> tag, so it's available
  here as the global variable `katex` (no import needed).

  Math is written in LaTeX, e.g. "y = 3x + 12" or "\\frac{1}{2}".
  (In a JavaScript string, a backslash must be written twice: "\\frac".)
*/

// TODO 1: render one piece of math
export function renderMath(element, latex, displayMode = false) {
  if (typeof katex === "undefined") {
    element.textContent = latex; // CDN failed: show plain text instead
    return;
  }
  katex.render(latex, element, { displayMode, throwOnError: false });
}

// TODO 2: render a sentence that mixes words and math
export function renderTextWithMath(element, text) {
  element.textContent = ""; // clear old content

  const pieces = text.split(/\\\((.+?)\\\)/);
  pieces.forEach((piece, i) => {
    if (i % 2 === 0) {
      // even index: plain text (safe text node, never innerHTML)
      element.appendChild(document.createTextNode(piece));
    } else {
      // odd index: math
      const span = document.createElement("span");
      renderMath(span, piece);
      element.appendChild(span);
    }
  });
}