/*
  linearEquation.js — the first concept plug-in: y = mx + b.

  This is the ONLY place that knows algebra. Everything algebra-specific
  (slope, intercept, how to compute y, how to write the formula) lives here.
  The core (js/core/) and views (js/views/) call these methods without knowing
  what's inside, which is why a physics concept can be added later without
  touching them.

  Registered in core/conceptRegistry.js. Used by main.js and the views.

  ---------------------------------------------------------------------------
  THE CONCEPT INTERFACE (every concept module must export an object like this)
  ---------------------------------------------------------------------------

  export default {
    // A unique id, used by conceptRegistry.getConcept(id).
    id: "linear-equation",

    // Which subject it belongs to (for grouping later).
    subject: "algebra",

    // Which views can display this concept. Views can check this list
    // before rendering (e.g. a concept without "graph" gets no graph).
    representations: ["formula", "table", "graph", "verbal"],

    // Instructor-defined rules that keep the math intact.
    // generateParams() must only produce values inside these limits,
    // and validate() must reject anything outside them.
    constraints: {
      mustBeLinear: true,
      slopeRange: [-10, 10],     // m must be between -10 and 10
      interceptRange: [0, 50],   // b must be between 0 and 50
    },

    // Creates random numbers that obey the constraints.
    // Returns e.g. { m: 3, b: 12, xMin: 0, xMax: 10 }
    generateParams() {},

    // Checks params against the constraints.
    // Returns { valid: true, reasons: [] }
    //      or { valid: false, reasons: ["slope 15 is outside [-10, 10]"] }
    validate(params) {},

    // Computes the output for one input.
    // evaluate({ m: 3, b: 12 }, 2) returns 18
    evaluate(params, x) {},

    // Builds a readable PLAIN-TEXT formula string (for screen readers, logs,
    // and later for describing the math to the AI).
    // formulaText({ m: 3, b: 12 }) returns "y = 3x + 12"
    formulaText(params) {},

    // Builds the same formula in LaTeX, so views/mathRender.js can display it with KaTeX.
    // formulaLatex({ m: 3, b: 12 }) returns "y = 3x + 12"
    // For this concept the text looks identical, but other concepts need LaTeX-only
    // features, e.g. a fraction slope: "y = \\frac{1}{2}x + 3", or "v_0" for a subscript.
    formulaLatex(params) {},
  };
*/

// The real module. Fill in the four methods by following the TODOs.
export default {
  id: "linear-equation",
  subject: "algebra",
  representations: ["formula", "table", "graph", "verbal"],
  constraints: {
    mustBeLinear: true,
    slopeRange: [-10, 10],
    interceptRange: [0, 50],
  },

  generateParams() {
    // TODO 1: Write a small helper (outside this object) randomInt(min, max)
    //   that returns a whole number between min and max, inclusive
    //   (hint: Math.random() and Math.floor()).
    // TODO 2: Pick m from this.constraints.slopeRange.
    //   Consider avoiding m = 0 (a flat line is a boring scenario); pick again if it happens.
    // TODO 3: Pick b from this.constraints.interceptRange.
    // TODO 4: Choose an x range for the table and graph, e.g. xMin = 0, xMax = 10.
    // TODO 5: Return { m, b, xMin, xMax }.
  },

  validate(params) {
    // TODO 1: Create an empty `reasons` array.
    // TODO 2: Check m is a whole number inside slopeRange; if not, push a helpful message.
    // TODO 3: Check b is a whole number inside interceptRange; same idea.
    // TODO 4: Check xMin < xMax.
    // TODO 5 (think about it): mustBeLinear is automatically true for y = mx + b.
    //   Can you think of a scenario-specific rule to add? For example,
    //   "y should never be negative" if y represents a count of things.
    // TODO 6: Return { valid: reasons.length === 0, reasons }.
  },

  evaluate(params, x) {
    // TODO: Return y using y = m * x + b.
  },

  formulaText(params) {
    // TODO 1: Build a string like "y = 3x + 12".
    // TODO 2: Handle the tricky cases so it reads like a textbook:
    //   m = 1  -> "y = x + 12"   (not "1x")
    //   m = -1 -> "y = -x + 12"
    //   b = 0  -> "y = 3x"       (not "+ 0")
    //   (b can't be negative with the current constraints, but what would you do if it could?)
  },

  formulaLatex(params) {
    // TODO 1: For now you can simply return this.formulaText(params). For whole-number
    //   slopes the plain text is already valid LaTeX.
    // TODO 2 (later): If you ever allow fractional slopes, build "\\frac{p}{q}x" here
    //   instead of a decimal like "0.5x".
  },
};
