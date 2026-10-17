/*
  conceptRegistry.js — the list of all available concepts.

  Each concept is a plug-in module (see concepts/algebra/linearEquation.js for the
  interface every concept must follow). This file is the ONLY place where concepts
  are imported, so adding a new concept (e.g. physics constant velocity) means:
    1. create the module in js/concepts/<subject>/
    2. import it here and add it to the list
  Nothing else in core/ or views/ needs to change.

  Used by main.js to look up a concept by its id.
*/

import linearEquation from "../concepts/algebra/linearEquation.js";

// Every available concept. To add one: import it above, then add it here.
const concepts = [linearEquation];

export function getConcept(id) {
  const concept = concepts.find((c) => c.id === id);
  if (!concept) {
    throw new Error(`Unknown concept "${id}". Is it imported in conceptRegistry.js?`);
  }
  return concept;
}

export function listConcepts() {
  return concepts;
}

export function listConceptsBySubject(subject) {
  return concepts.filter((c) => c.subject === subject);
}