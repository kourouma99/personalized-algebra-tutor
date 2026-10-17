/*
  scenario.js — shows the personalized story text.

  GENERIC view. The wording comes from data/sampleScenarios.js (fake "AI output"),
  looked up by concept id + interest id. The numbers come from state.params.
  The story text contains placeholders like {m} and {b}, and this view
  replaces them with the real numbers, so the story always matches the math.
  Math inside the story is wrapped in \( ... \) and rendered with KaTeX
  through views/mathRender.js (never by calling KaTeX directly).

  Later, the AI backend will produce the wording instead of sampleScenarios.js,
  but this view will work the same way.

  Draws into #scenario in index.html.
*/

import { getScenario } from "../data/sampleScenarios.js";
import { renderTextWithMath } from "./mathRender.js";

// Replace every {key} with params[key]; leave unknown keys visible so mistakes show
export function fillPlaceholders(text, params) {
  return text.replace(/\{(\w+)\}/g, (match, key) =>
    key in params ? String(params[key]) : match
  );
}

export function renderScenario(state) {
  const container = document.getElementById("scenario");
  if (!container) return;
  container.textContent = "";

  if (!state.interest || !state.params) {
    container.textContent = "Pick an interest to start!";
    return;
  }

  // Ask the concept for story values (e.g. absM) and which variant fits
  const values = state.concept.storyValues
    ? state.concept.storyValues(state.params)
    : state.params;

  const scenario = getScenario(state.concept.id, state.interest, values.variant);
  if (!scenario) {
    container.textContent = "No scenario found for this interest yet.";
    return;
  }

  const title = document.createElement("h2");
  title.textContent = scenario.title;

  const story = document.createElement("p");
  renderTextWithMath(story, fillPlaceholders(scenario.story, values));

  container.append(title, story);

  if (scenario.question) {
    const question = document.createElement("p");
    question.className = "scenario-question";
    renderTextWithMath(question, fillPlaceholders(scenario.question, values));
    container.appendChild(question);
  }
}