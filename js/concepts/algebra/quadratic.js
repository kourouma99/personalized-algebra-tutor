/*
  quadratic.js — concept plug-in: y = a(x − h)² + k (vertex form)
  a < 0: opens down, has a maximum (e.g. a ball's arc)
  a > 0: opens up, has a minimum
  (h, k) is the vertex. x runs from 0 to 2h, so the table is symmetric.
*/

const A_VALUES = [-2, -1, 1, 2];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default {
  id: "quadratic",
  name: "Quadratic",
  subject: "algebra",
  representations: ["formula", "table", "graph", "verbal"],
  constraints: {
    aValues: A_VALUES,
    hRange: [2, 5],
    kRange: [0, 60],
    maxY: 120,
  },

  generateParams() {
    const { aValues, hRange, kRange } = this.constraints;
    const a = aValues[randomInt(0, aValues.length - 1)]; // pick the shape once

    let params;
    do {
      const h = randomInt(hRange[0], hRange[1]);
      const k = randomInt(kRange[0], kRange[1]);
      params = { a, h, k, xMin: 0, xMax: 2 * h };
    } while (!this.validate(params).valid);

    return params;
  },

  validate(params) {
    const { a, h, k, xMin, xMax } = params;
    const { aValues, hRange, kRange, maxY } = this.constraints;
    const reasons = [];

    if (!aValues.includes(a)) reasons.push(`a = ${a} is not allowed`);
    if (!Number.isInteger(h) || h < hRange[0] || h > hRange[1]) reasons.push(`h = ${h} is out of range`);
    if (!Number.isInteger(k) || k < kRange[0] || k > kRange[1]) reasons.push(`k = ${k} is out of range`);
    if (xMin !== 0 || xMax !== 2 * h) reasons.push("x must run from 0 to 2h");

    // The ends of the range are the extreme points besides the vertex
    if (reasons.length === 0) {
      const yEnd = this.evaluate(params, xMin);
      if (yEnd < 0) reasons.push(`y is negative at the ends (${yEnd})`);
      if (yEnd > maxY || k > maxY) reasons.push(`y goes above ${maxY}`);
    }

    return { valid: reasons.length === 0, reasons };
  },

  evaluate(params, x) {
    return params.a * (x - params.h) ** 2 + params.k;
  },

  formulaText(params) {
    const { a, h, k } = params;
    const aPart = a === 1 ? "" : a === -1 ? "-" : String(a);
    const kPart = k === 0 ? "" : ` + ${k}`;
    return `y = ${aPart}(x - ${h})^2${kPart}`;
  },

  formulaLatex(params) {
    const { a, h, k } = params;
    const aPart = a === 1 ? "" : a === -1 ? "-" : String(a);
    const kPart = k === 0 ? "" : ` + ${k}`;
    return `y = ${aPart}(x - ${h})^{2}${kPart}`;
  },

  storyValues(params) {
    return {
      ...params,
      absA: Math.abs(params.a),
      xEnd: params.xMax,
      yStart: this.evaluate(params, params.xMin),
      variant: params.a < 0 ? "max" : "min",
    };
  },
};