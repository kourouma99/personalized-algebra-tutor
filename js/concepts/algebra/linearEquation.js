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
function randomInt(min, max){
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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
    const [mMin, mMax] = this.constraints.slopeRange;
    const [bMin, bMax] = this.constraints.interceptRange;
    const xMin = 0;
    const xMax = 10;

    let params;
    do {
      let m;
      do {
        m = randomInt(mMin, mMax);
      } while (m === 0); // no flat lines

      const b = randomInt(bMin, bMax);
      params = { m, b, xMin, xMax };
    } while (!this.validate(params).valid); // retry until it passes every rule

    return params;
  },

  validate(params) {
    const { m, b, xMin, xMax } = params;
    const [mMin, mMax] = this.constraints.slopeRange;
    const [bMin, bMax] = this.constraints.interceptRange;
    const reasons = [];

    if (!Number.isInteger(m) || m < mMin || m > mMax) {
      reasons.push(`slope ${m} is outside [${mMin}, ${mMax}]`);
    }
    if (!Number.isInteger(b) || b < bMin || b > bMax) {
      reasons.push(`intercept ${b} is outside [${bMin}, ${bMax}]`);
    }
    if (!(xMin < xMax)) {
      reasons.push(`xMin (${xMin}) must be less than xMax (${xMax})`);
    }
    // Scenario rule: y is usually a count or amount, so it shouldn't go negative.
    // For a line, the lowest y is always at one of the two ends.
    const yAtStart = this.evaluate(params, xMin);
    const yAtEnd = this.evaluate(params, xMax);
    if (Math.min(yAtStart, yAtEnd) < 0) {
      reasons.push(`y goes negative on [${xMin}, ${xMax}]`);
    }

    return { valid: reasons.length === 0, reasons };
  },

  evaluate(params, x) {
    return params.m * x + params.b;
  },

  formulaText(params) {
    const { m, b } = params;

    let mPart;
    if (m === 1) mPart = "x";
    else if (m === -1) mPart = "-x";
    else mPart = `${m}x`;

    let bPart = "";
    if (b > 0) bPart = ` + ${b}`;
    else if (b < 0) bPart = ` - ${Math.abs(b)}`; // "y = 3x - 5", not "+ -5"

    return `y = ${mPart}${bPart}`;
  },

  formulaLatex(params) {
    return this.formulaText(params);
  },
};
