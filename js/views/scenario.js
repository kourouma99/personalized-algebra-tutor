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

// TODO 1: Import the sample scenario lookup function from ../data/sampleScenarios.js,
//   and renderTextWithMath from ./mathRender.js.

// TODO 2: Write a helper fillPlaceholders(text, params) that replaces every "{key}"
//   in the text with params[key].
//   Hint: text.replace(/\{(\w+)\}/g, (match, key) => ...)
//   If a key isn't in params, leave the placeholder as-is so you notice the mistake.

// TODO 3: Export a function renderScenario(state) that:
//   a. returns early (or shows a hint like "Pick an interest!") if state.interest or state.params is missing
//   b. looks up the scenario for state.concept.id and state.interest
//   c. finds the #scenario element and clears it
//   d. shows the scenario title (plain text, use textContent)
//   e. fills in the story with fillPlaceholders, then displays it with
//      renderTextWithMath(element, filledStory) so any \( ... \) parts become math
//   f. (optional) shows the question prompt the same way
