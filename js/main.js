// import { getConcept } from "./core/conceptRegistry.js";
import { state, setState } from "./state.js";
import { validateParams } from "./core/validator.js";
import { renderSequence, nextStep, previousStep } from "./core/sequence.js";
import {
  createRun,
  submitAnswer,
  submitGroup,
  requestHint,
  revealAnswer,
  skipStep,
  canMoveOn,
  canVisit,
  markVisited,
  stepStatus,
  visibleRepresentations,
} from "./core/flowEngine.js";
import { interests } from "./data/interests.js";
import { getScenario } from "./data/sampleScenarios.js";
import { renderInterestPicker } from "./views/interestPicker.js";
import { renderScenario } from "./views/scenario.js";
import { renderFormula } from "./views/formula.js";
import { renderTable } from "./views/table.js";
import { initGraphing, renderGraph, renderNumberLine, clearMiniGraphs } from "./views/graph.js";

import { renderConceptPicker } from "./views/conceptPicker.js";
import { renderFlow } from "./views/flowView.js";
import { getConcept, listConcepts } from "./core/conceptRegistry.js";


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

// Show or hide a section of index.html
function setVisible(id, visible) {
  const section = document.getElementById(id);
  if (section) section.hidden = !visible;
}

// The heart of "linked updates": every view re-renders from the same state
function refreshAll() {
  renderConceptPicker(listConcepts(), state.concept?.id, onConceptChosen);
  renderInterestPicker(interests, state.interest, onInterestChosen, onCustomInterest);
  const run = state.flowRun;
  renderSequence(
    state,
    run && {
      status: (i) => stepStatus(run, i),
      canVisit: (i) => canVisit(run, i),
      onSelect: goToStep,
    }
  );

  if (state.flowRun) refreshFlow();
  else refreshAllAtOnce();
}

// Concepts without a flow (exponential, quadratic): everything at once, as before
function refreshAllAtOnce() {
  const labels = currentLabels();
  for (const id of ["scenario", "representations", "formula", "table", "graph"]) setVisible(id, true);
  setVisible("flow", false);
  clearMiniGraphs(); // the flow's small graphs, if we just left a guided concept
  renderScenario(state);
  renderFormula(state, labels);
  renderTable(state, labels);
  renderGraph(state, labels);
  renderNumberLine(state, labels);
}

// Concepts with a flow (linear): show only what the current step allows
function refreshFlow() {
  const labels = currentLabels();
  const shown = visibleRepresentations(state.flowRun, state.step);
  const has = (name) => shown.includes(name);

  // Un-hide BEFORE drawing: JSXGraph cannot draw into a hidden element
  setVisible("scenario", has("story"));
  setVisible("formula", has("formula"));
  setVisible("table", false); // the full table would give away the answers
  setVisible("representations", has("formula"));
  setVisible("graph", has("graph"));
  setVisible("number-line", false);
  setVisible("flow", true);

  if (has("story")) renderScenario(state, { showQuestion: false }); // asked later, in Solve
  if (has("formula")) renderFormula(state, labels);
  if (has("graph")) renderGraph(state, labels);
  renderFlow(state, { onAnswer, onAnswers, onHint, onReveal, onSkip, onNext, onBack });
}

// Build a fresh worksheet for the current params (or clear it for concepts without a flow)
function startFlow() {
  const { concept, params, interest } = state;
  if (!concept.flow) {
    setState({ flowRun: null, step: 0 });
    return;
  }
  const values = concept.storyValues ? concept.storyValues(params) : params;
  const scenario = getScenario(concept.id, interest, values.variant);
  setState({ flowRun: createRun(concept.flow, concept, params, { scenario, values }), step: 0 });
}

// Keep every answer, hint request, revealed answer and skip in the log (future research data)
function record(entries) {
  for (const entry of entries) {
    if (!entry) continue;
    state.responses.push(entry);
    console.log("response:", entry);
  }
}

function onAnswer(itemId, answer) {
  record([submitAnswer(state.flowRun, state.step, itemId, answer).entry]);
  refreshAll();
}

// Several answers at once (a table with one Check button)
function onAnswers(pairs) {
  record(submitGroup(state.flowRun, state.step, pairs).entries);
  refreshAll();
}

function onHint(itemId) {
  record([requestHint(state.flowRun, state.step, itemId).entry]);
  refreshAll();
}

function onReveal(itemId) {
  record([revealAnswer(state.flowRun, state.step, itemId).entry]);
  refreshAll();
}

// Jump to a step (Next, Back, or a click in the step bar)
function goToStep(index) {
  const run = state.flowRun;
  if (!run || index < 0 || index >= run.steps.length) return;
  markVisited(run, index);
  setState({ step: index });
  refreshAll();
}

function onNext() {
  if (!canMoveOn(state.flowRun, state.step)) return;
  goToStep(nextStep(state.step));
  document.getElementById("step-sequence")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function onBack() {
  goToStep(previousStep(state.step));
}

// "Skip for now": mark the step and move on (on the last step, just mark it)
function onSkip() {
  record([skipStep(state.flowRun, state.step).entry]);
  if (state.step < state.flowRun.steps.length - 1) onNext();
  else refreshAll();
}

function newScenario() {
  if (!state.concept) return;
  try {
    setState({ params: generateValidParams(state.concept) });
  } catch (err) {
    console.error(err);
    return;
  }
  startFlow(); // a new scenario (or concept, or interest) always starts again at step 1
  refreshAll();
}

function onInterestChosen(interestId) {
  setState({ interest: interestId });
  newScenario();
}

function onConceptChosen(conceptId) {
  setState({ concept: getConcept(conceptId) });
  newScenario();
}

function onCustomInterest(text) {
  setState({ interest: text });
  newScenario();
}

async function init() {
  try {
    await initGraphing();
  } catch (err) {
    console.warn("Graphing unavailable, continuing without graphs:", err.message);
  }

  setState({ concept: getConcept("linear-equation") }); // opens on the guided linear flow

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



  