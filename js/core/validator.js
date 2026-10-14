/*
  validator.js — a generic safety check that runs before anything is shown.

  It does NOT know any math rules itself. Each concept knows its own rules
  in its validate(params) method. This file just:
    - calls concept.validate(params)
    - adds a few generic checks that apply to EVERY concept

  Used by main.js: params are only saved to state if they pass validation.
  This matters even more later, when an AI backend may suggest values.
*/

// TODO 1: Export a function validateParams(concept, params) that returns
//   { valid: boolean, reasons: string[] }.

// TODO 2: Inside it, add generic checks first, pushing a message into `reasons` for each failure:
//   a. params exists and is an object
//   b. every value in params is a finite number (hint: Object.values + Number.isFinite)

// TODO 3: Then call concept.validate(params) and merge its reasons into yours.

// TODO 4: Return { valid: reasons.length === 0, reasons }.
