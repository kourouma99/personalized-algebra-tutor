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

// TODO 1: Export a function renderMath(element, latex, displayMode = false) that:
//   a. calls katex.render(latex, element, { displayMode, throwOnError: false })
//      - displayMode: true  -> big, centered (for the main formula)
//      - displayMode: false -> inline, sized like the surrounding text
//      - throwOnError: false -> bad LaTeX shows in red instead of crashing the page
//   b. if `katex` doesn't exist (CDN failed to load), falls back to element.textContent = latex

// TODO 2: Export a function renderTextWithMath(element, text) for sentences that MIX
//   words and math, like a story: "You score \\(4\\) points per game."
//   a. clear the element
//   b. split the text into pieces of plain text and math. Math is between "\\(" and "\\)".
//      Hint: text.split(/\\\((.+?)\\\)/) gives [text, math, text, math, ...].
//      Pieces at odd indexes (1, 3, 5...) are math.
//   c. for plain text pieces, append a text node (document.createTextNode(piece)).
//      Never use innerHTML for story text. Later it will come from an AI, and
//      textContent/text nodes keep it from injecting HTML.
//   d. for math pieces, create a <span>, call renderMath(span, piece), and append it

// TODO 3 (optional): Export a function mathToString(latex) that returns
//   katex.renderToString(latex, { throwOnError: false }), useful for table cells.
