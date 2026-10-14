/*
  sequence.js — the learning steps a student goes through for any concept:
    Explore → Notice → Represent → Solve → Explain → Transfer

  The steps are GENERIC, so they work for algebra, physics, or anything else.
  For the first milestone this is only a PLACEHOLDER: show the step names and
  highlight the current one. Real step behavior comes later.

  Reads state.step (from state.js). Rendered by main.js into #step-sequence in index.html.
*/

// TODO 1: Export a `steps` array with the six step names, in order.
//   (Later each step could be an object like { id, title, description }.)

// TODO 2: Export a function renderSequence(state) that:
//   a. finds the #step-sequence element
//   b. clears it
//   c. creates one element per step (e.g. an <ol> with <li> items)
//   d. adds a CSS class (e.g. "is-current") to the step whose index equals state.step

// TODO 3 (later, not this milestone): Export nextStep(step) / previousStep(step)
//   that return the new index, staying within 0 and steps.length - 1.
