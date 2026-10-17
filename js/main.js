/*
  main.js — the entry point. index.html loads this file as an ES module.

  It is the "conductor": it connects everything but contains no math and no HTML building.
    - Gets concepts from core/conceptRegistry.js
    - Stores the current situation in state.js
    - Checks params with core/validator.js
    - Calls each view in views/ to draw the page

  The key idea ("linked updates"):
    something changes -> update state -> call refreshAll() -> every view re-renders
  Because every view reads from the SAME state.params, the formula, table,
  and graph can never disagree with each other.
*/

// TODO 1: Import what you need. For example:
//   import { getConcept } from "./core/conceptRegistry.js";
//   import { state, setState } from "./state.js";
//   import { validateParams } from "./core/validator.js";
//   import { interests } from "./data/interests.js";
//   import { renderInterestPicker } from "./views/interestPicker.js";
//   ...and the render functions from scenario.js, formula.js, table.js, and sequence.js,
//   plus initGraphing, renderGraph, and renderNumberLine from graph.js.
//   main.js never imports config.js or uses JSXGraph or KaTeX directly. Those belong to graph.js and mathRender.js.

// TODO 2: Write a function generateValidParams(concept) that:
//   a. calls concept.generateParams()
//   b. passes the result to validateParams(concept, params)
//   c. if not valid, tries again (use a max number of attempts so it can't loop forever)
//   d. returns the valid params (or throws an error with the reasons if it never succeeds)

// TODO 3: Write a function refreshAll() that calls every view's render function,
//   passing it the current state (and the concept, if the view needs it).
//   Order: scenario, formula, table, graph, number line, step sequence.
//   renderGraph and renderNumberLine need the scenario's labels too (look them up once here).
//   Do NOT do any math here; the views ask the concept for numbers.

// TODO 4: Write a function newScenario() that:
//   a. gets the current concept from state
//   b. generates valid params (TODO 2)
//   c. saves them with setState({ params })
//   d. calls refreshAll()

// TODO 5: Write a function onInterestChosen(interestId) that:
//   a. saves the interest with setState({ interest: interestId })
//   b. calls newScenario()

// TODO 6: Start the app (an async init() function you call at the bottom of this file):
//   a. load the graphing library: `await initGraphing()` inside a try/catch.
//      If it fails (e.g. the JSXGraph CDN didn't load), console.warn the error and keep going:
//      the story, formula, and table should still work without a graph.
//   b. choose the starting concept, e.g. getConcept("linear-equation"), and store it in state
//   c. render the interest picker, giving it the interests list and onInterestChosen as a callback
//   d. find the "New scenario" button (id="new-scenario-btn") and add a click listener that calls newScenario
//   e. optionally pick a default interest so the page isn't empty at first

console.log("main.js loaded. Start with the TODOs!");


