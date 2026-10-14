/*
  formula.js — shows the concept's formula, e.g. y = 3x + 12, rendered with KaTeX.

  GENERIC view: it never builds the formula itself. It asks the concept
  by calling concept.formulaLatex(params), then hands the LaTeX to
  views/mathRender.js to display. That's why it will also work
  for a physics formula like d = 5t + 20 later.

  It does NOT call KaTeX directly. Only mathRender.js does.

  Draws into #formula in index.html.
*/

// TODO 1: Import renderMath from ./mathRender.js.

// TODO 2: Export a function renderFormula(state).

// TODO 3: Return early if state.params is missing.

// TODO 4 (optional, generic check): If the concept's `representations` array
//   doesn't include "formula", clear the container and return.

// TODO 5: Find the #formula element, clear it, and add:
//   a. a heading, e.g. "Formula"
//   b. an empty element (e.g. a <div>) for the math
//   c. call renderMath(thatElement, state.concept.formulaLatex(state.params), true)
//      (true = display mode: big and centered)
//   d. set thatElement's aria-label to state.concept.formulaText(state.params)
//      so screen readers read a clean "y = 3x + 12"

// TODO 6 (stretch): Also show what the variables mean, using the labels from the
//   sample scenario (e.g. "x = games played, y = total points"). Render the
//   variable names with renderMath too, so they look the same as in the formula.
