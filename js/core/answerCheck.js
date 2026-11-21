/*
  answerCheck.js — turns what a student typed into a number, and compares numbers.

  GENERIC: knows nothing about any concept. Flows (js/flows/) use these helpers
  inside their check() functions. No DOM here, so it can be tested in Node.

  Accepted input: whole numbers ("12", "-3"), decimals ("1.71", ".5"),
  and fractions ("12/7", "-12/7", "12 / 7"). Spaces and a leading "+" are ignored.
*/

// Returns the number, or null if the text isn't a number we understand.
export function parseNumber(text) {
  if (typeof text !== "string") return null;
  const s = text.replace(/\s+/g, "").replace(/^\+/, "").replace(/−/g, "-"); // "−" = typographic minus

  const decimal = /^-?(\d+\.?\d*|\.\d+)$/;
  if (decimal.test(s)) return Number(s);

  const fraction = /^(-?\d+)\/(-?\d+)$/.exec(s);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    return Number(fraction[1]) / denominator;
  }

  return null;
}

// True if two numbers are equal within a tolerance (default: practically exact).
export function numbersMatch(a, b, tolerance = 1e-9) {
  return Math.abs(a - b) <= tolerance;
}

// Greatest common divisor, used to simplify fractions for display.
export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

// Simplest LaTeX for numerator/denominator: "\frac{12}{7}", "-\frac{3}{7}" or "4".
export function fractionLatex(numerator, denominator) {
  const sign = numerator * denominator < 0 ? "-" : "";
  const divisor = gcd(numerator, denominator) || 1;
  const n = Math.abs(numerator) / divisor;
  const d = Math.abs(denominator) / divisor;
  return d === 1 ? `${sign}${n}` : `${sign}\\frac{${n}}{${d}}`;
}
