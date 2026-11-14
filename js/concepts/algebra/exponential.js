/*
  exponential.js — concept plug-in: y = a · b^x
  a = starting amount, b = growth/decay factor (b > 1 grows, 0 < b < 1 decays).
  Same interface as linearEquation.js, so no view or core file needs to change.
*/

const GROWTH_FACTORS = [1.5, 2, 3];
const DECAY_FACTORS = [0.5];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(list) {
  return list[randomInt(0, list.length - 1)];
}

export default {
  id: "exponential",
  name: "Exponential",
  subject: "algebra",
  representations: ["formula", "table", "graph", "verbal"],
  constraints: {
    mustBeExponential: true,
    factors: [...GROWTH_FACTORS, ...DECAY_FACTORS],
    startMultiple: 32,       // a is a multiple of 32, so every table value up to x = 5 is a whole number
    startRange: [32, 320],
    maxY: 10000,             // keeps numbers readable
  },

  generateParams() {
    const { startMultiple, startRange } = this.constraints;
    const xMin = 0, xMax = 5; // exponentials grow fast, so we use a shorter range than linear

    // Choose b once, so retries don't tilt the 50/50 growth/decay split
    const b = Math.random() < 0.5 ? pick(GROWTH_FACTORS) : pick(DECAY_FACTORS);

    let params;
    do {
      const a = startMultiple * randomInt(startRange[0] / startMultiple, startRange[1] / startMultiple);
      params = { a, b, xMin, xMax };
    } while (!this.validate(params).valid);

    return params;
  },

  validate(params) {
    const { a, b, xMin, xMax } = params;
    const { factors, startMultiple, startRange, maxY } = this.constraints;
    const reasons = [];

    if (!Number.isInteger(a) || a < startRange[0] || a > startRange[1] || a % startMultiple !== 0) {
      reasons.push(`starting amount ${a} is not allowed`);
    }
    if (!factors.includes(b)) {
      reasons.push(`factor ${b} is not one of ${factors.join(", ")}`);
    }
    if (!(xMin < xMax)) {
      reasons.push(`xMin (${xMin}) must be less than xMax (${xMax})`);
    }
    // Every table value must be a whole number and not too large
    if (reasons.length === 0) {
      for (let x = xMin; x <= xMax; x++) {
        const y = this.evaluate(params, x);
        if (!Number.isInteger(y)) { reasons.push(`y is not a whole number at x = ${x}`); break; }
        if (y > maxY) { reasons.push(`y = ${y} at x = ${x} is above ${maxY}`); break; }
      }
    }

    return { valid: reasons.length === 0, reasons };
  },

  evaluate(params, x) {
    return params.a * Math.pow(params.b, x);
  },

  formulaText(params) {
    return `y = ${params.a}(${params.b})^x`;
  },

  formulaLatex(params) {
    return `y = ${params.a}(${params.b})^{x}`;
  },

  storyValues(params) {
    return {
      ...params,
      variant: params.b > 1 ? "increase" : "decrease",
    };
  },
};
