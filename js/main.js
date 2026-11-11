import { getConcept } from "./core/conceptRegistry.js";
import { state, setState } from "./state.js";
import { validateParams } from "./core/validator.js";
import { renderSequence } from "./core/sequence.js";
import { interests } from "./data/interests.js";
import { getScenario } from "./data/sampleScenarios.js";
import { renderInterestPicker } from "./views/interestPicker.js";
import { renderScenario } from "./views/scenario.js";
import { renderFormula } from "./views/formula.js";
import { renderTable } from "./views/table.js";
import { initGraphing, renderGraph, renderNumberLine } from "./views/graph.js";

const MAX_ATTEMPTS = 100;

// Keep generating until the params pass every check (with a safety limit)
function generateValidParams(concept) {
  let lastReasons = [];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const params = concept.generateParams();
    const result = validateParams(concept, params);
    if (result.valid) return params;
    lastReasons = result.reasons;
  }
  throw new Error(`Could not generate valid params: ${lastReasons.join("; ")}`);
}

// Labels like { x: "Games played", y: "Total points" } for the current story
function currentLabels() {
  const { concept, interest, params } = state;
  if (!concept || !interest || !params) return undefined;
  const values = concept.storyValues ? concept.storyValues(params) : params;
  return getScenario(concept.id, interest, values.variant)?.labels;
}

// The heart of "linked updates": every view re-renders from the same state
function refreshAll() {
  const labels = currentLabels();
  renderInterestPicker(interests, state.interest, onInterestChosen);
  renderScenario(state);
  renderFormula(state, labels);
  renderTable(state, labels);
  renderGraph(state, labels);
  renderNumberLine(state, labels);
  renderSequence(state);
}

function newScenario() {
  if (!state.concept) return;
  try {
    setState({ params: generateValidParams(state.concept) });
  } catch (err) {
    console.error(err);
    return;
  }
  refreshAll();
}

function onInterestChosen(interestId) {
  setState({ interest: interestId });
  newScenario();
}

async function init() {
  try {
    await initGraphing();
  } catch (err) {
    console.warn("Graphing unavailable, continuing without graphs:", err.message);
  }

  setState({ concept: getConcept("linear-equation") });
  document.getElementById("new-scenario-btn")?.addEventListener("click", newScenario);
  
  const graphBtn = document.getElementById("graph-mode-btn");
  graphBtn?.addEventListener("click", () => {
    setState({ graphInteractive: !state.graphInteractive });
    graphBtn.textContent = state.graphInteractive ? "Lock the graph" : "Explore the graph";
    renderGraph(state, currentLabels());
  });
  
  onInterestChosen(interests[0].id); // start with the first interest so the page isn't empty
}

init();



  