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

// TODO 1: Import the linear-equation concept:
//   import linearEquation from "../concepts/algebra/linearEquation.js";

// TODO 2: Create an array `concepts` containing every imported concept.

// TODO 3: Export a function getConcept(id) that returns the concept whose `id` matches,
//   or throws a clear error if none is found (hint: Array.find).

// TODO 4: Export a function listConcepts() that returns the whole array
//   (useful later for a concept picker).

// TODO 5 (optional): Export listConceptsBySubject(subject) using Array.filter.
