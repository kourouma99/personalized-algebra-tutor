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

// TODO 1: Export a function renderTable(state, labels).
//   `labels` comes from the sample scenario, e.g. { x: "Games played", y: "Total points" }.
//   (main.js looks them up and passes them in.)

// TODO 2: Write a helper makePoints(concept, params) that returns an array like
//   [{ x: 0, y: 12 }, { x: 1, y: 15 }, ...] for x from params.xMin to params.xMax.
//   Export it so graph.js can import and reuse it (graph.js draws these same points with JSXGraph).
//   (Later you could move this into js/core/ since it's generic.)

// TODO 3: Find the #table element, clear it, and build a <table>:
//   a. a header row with labels.x and labels.y (with units if you have them)
//   b. one row per point from makePoints
//   Hint: document.createElement("table"), "tr", "th", "td".

// TODO 3b (optional): Show the variable symbols in the header with KaTeX, e.g.
//   "Games played (x)" with x rendered by renderMath from ./mathRender.js.
//   Plain numbers in the cells don't need KaTeX.

// TODO 4 (think about it): With xMin=0, xMax=10 you get 11 rows. Is that too many?
//   You could show every 2nd value, or add an `xStep` to the params.
