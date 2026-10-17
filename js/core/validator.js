/*
  validator.js — a generic safety check that runs before anything is shown.

  It does NOT know any math rules itself. Each concept knows its own rules
  in its validate(params) method. This file just:
    - calls concept.validate(params)
    - adds a few generic checks that apply to EVERY concept

  Used by main.js: params are only saved to state if they pass validation.
  This matters even more later, when an AI backend may suggest values.
*/

export function validateParams(concept, params) {
  const reasons = [];

  // Generic check: params must be an object
  if (!params || typeof params !== "object") {
    return { valid: false, reasons: ["params is missing or not an object"] };
  }

  // Generic check: every value must be a real number (no NaN, Infinity, or text)
  for (const [key, value] of Object.entries(params)) {
    if (!Number.isFinite(value)) {
      reasons.push(`${key} is not a finite number (got ${value})`);
    }
  }

  // Concept-specific rules (slope range, no negative y, etc.)
  if (reasons.length === 0) {
    reasons.push(...concept.validate(params).reasons);
  }

  return { valid: reasons.length === 0, reasons };
}