/*
  flowView.js — draws the current step of a guided flow (the worksheet).

  GENERIC view: it draws whatever items the flow defines (multiple choice,
  number boxes, the two-box equation, tables) and never checks answers itself.
  When the student answers, asks for a hint, asks for the answer, or skips,
  it calls back to main.js, which asks core/flowEngine.js and then redraws.
  Text goes in with textContent, math through views/mathRender.js.

  Draws into #flow in index.html.
*/

import { steps as sequenceSteps } from "../core/sequence.js";
import {
  getProgress,
  isStepComplete,
  isStepSkipped,
  canMoveOn,
  canRevealAnswer,
  referenceTable,
  visibleItems,
  HINTS_BEFORE_ANSWER,
} from "../core/flowEngine.js";
import { renderMath, renderTextWithMath } from "./mathRender.js";
import { renderMiniGraphs, clearMiniGraphs } from "./graph.js";

// Small graphs to draw once the step is on the page (JSXGraph needs the elements to exist)
let pendingGraphs = [];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function mathText(tag, className, text) {
  const node = el(tag, className);
  renderTextWithMath(node, text);
  return node;
}

function button(label, className, onClick, type = "button") {
  const b = el("button", className, label);
  b.type = type;
  if (onClick) b.addEventListener("click", onClick);
  return b;
}

// The short message under an item. A wrong answer only says "try again";
// help is given when the student asks for it (see helpNode).
function feedbackNode(feedback, wrongText = "Not quite, try again.") {
  const node = el("p", "flow-feedback");
  node.setAttribute("role", "status"); // screen readers announce the result
  if (!feedback) return node;

  node.classList.add(`is-${feedback.kind}`);
  if (feedback.kind === "correct") node.textContent = feedback.text ?? "Correct!";
  if (feedback.kind === "invalid") node.textContent = "Type a number, like 12, -3, 2.5 or 12/7.";
  if (feedback.kind === "wrong") node.textContent = wrongText;
  if (feedback.kind === "revealed") renderTextWithMath(node, `The answer is ${feedback.answerText}. Let's keep going.`);
  return node;
}

// Hints shown so far, then "Need a hint?" (available from the start) or "Show answer"
function helpNode(item, progress, run, handlers) {
  const wrap = el("div", "flow-help");
  progress.hints.forEach((text, i) => {
    wrap.appendChild(mathText("p", "flow-hint", `Hint ${i + 1}: ${text}`));
  });
  if (progress.done) return wrap;

  const available = Math.min(item.hints?.length ?? 0, HINTS_BEFORE_ANSWER);
  if (progress.hints.length < available) {
    wrap.appendChild(button("Need a hint?", "btn-link", () => handlers.onHint(item.id)));
  } else if (canRevealAnswer(run, item.id, item)) {
    wrap.appendChild(button("Show answer", "btn-link", () => handlers.onReveal(item.id)));
  }
  return wrap;
}

function numberInput(label, value) {
  const input = el("input", "flow-input");
  input.type = "text";
  input.inputMode = "decimal"; // number keyboard on phones, but still allows "/"
  input.autocomplete = "off";
  input.setAttribute("aria-label", label);
  if (typeof value === "string") input.value = value;
  return input;
}

function checkButton(disabled) {
  const b = button("Check", "btn btn-small", null, "submit");
  b.disabled = disabled;
  return b;
}

// ---------- item types ----------

// Choice where every option is a small graph (option.graph = params for that line)
function renderGraphChoice(item, progress, run, handlers) {
  const wrap = el("div", "flow-item");
  wrap.appendChild(mathText("p", "flow-prompt", item.prompt));

  const grid = el("div", "flow-graph-choices");
  const ids = [];
  item.options.forEach((option, i) => {
    const card = el("div", "flow-graph-option");
    const pickedWrong = progress.wrongKeys.includes(option.key);
    const disabled = progress.done || pickedWrong;
    if (pickedWrong) card.classList.add("is-wrong");
    if (progress.done && item.check(option.key)) card.classList.add("is-correct");

    const surface = el("div", "flow-mini-graph");
    surface.id = `mini-${item.id}-${i}`;
    surface.setAttribute("aria-hidden", "true"); // the button below names the option
    ids.push(surface.id);

    const pickButton = button(option.text, "flow-choice");
    pickButton.disabled = disabled;
    // Clicking the graph or its button picks it (the button's click bubbles up here)
    card.addEventListener("click", () => {
      if (!disabled) handlers.onAnswer(item.id, option.key);
    });

    card.append(surface, pickButton);
    grid.appendChild(card);
  });
  const paramsList = item.options.map((o) => o.graph);
  pendingGraphs.push({ ids, paramsList, fitList: item.graphFit ?? paramsList });

  wrap.append(grid, feedbackNode(progress.feedback), helpNode(item, progress, run, handlers));
  return wrap;
}

function renderChoice(item, progress, run, handlers) {
  if (item.display === "graphs") return renderGraphChoice(item, progress, run, handlers);
  const wrap = el("div", "flow-item");
  wrap.appendChild(mathText("p", "flow-prompt", item.prompt));

  const choices = el("div", "flow-choices");
  for (const option of item.options) {
    const b = button("", "flow-choice", () => handlers.onAnswer(item.id, option.key));
    renderTextWithMath(b, option.text);
    const pickedWrong = progress.wrongKeys.includes(option.key);
    if (pickedWrong) b.classList.add("is-wrong");
    if (progress.done && item.check(option.key)) b.classList.add("is-correct");
    b.disabled = progress.done || pickedWrong;
    choices.appendChild(b);
  }

  wrap.append(choices, feedbackNode(progress.feedback), helpNode(item, progress, run, handlers));
  return wrap;
}

function renderNumber(item, progress, run, handlers) {
  const form = el("form", "flow-item");
  const row = el("div", "flow-row");
  const input = numberInput("Your answer", progress.lastAnswer);
  input.disabled = progress.done;
  row.append(input, checkButton(progress.done));

  form.addEventListener("submit", (event) => {
    event.preventDefault(); // stops the page from reloading
    handlers.onAnswer(item.id, input.value);
  });
  form.append(
    mathText("p", "flow-prompt", item.prompt),
    row,
    feedbackNode(progress.feedback),
    helpNode(item, progress, run, handlers)
  );
  return form;
}

// "y = [ ]x + [ ]": one input after each part
function renderPair(item, progress, run, handlers) {
  const form = el("form", "flow-item");
  const row = el("div", "flow-row flow-equation");
  const last = Array.isArray(progress.lastAnswer) ? progress.lastAnswer : [];
  const inputs = item.parts.map((part, i) => {
    const label = el("span");
    renderMath(label, part);
    const input = numberInput(i === 0 ? "Number in front of x" : "Number added", last[i] ?? "");
    input.disabled = progress.done;
    row.append(label, input);
    return input;
  });
  row.appendChild(checkButton(progress.done));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    handlers.onAnswer(item.id, inputs.map((input) => input.value));
  });
  form.append(
    mathText("p", "flow-prompt", item.prompt),
    row,
    feedbackNode(progress.feedback),
    helpNode(item, progress, run, handlers)
  );
  return form;
}

// A table where some y cells are inputs. One Check button checks every filled cell.
// Hints are for ONE cell at a time: the first unfinished cell the student got wrong.
function renderTable(table, items, run, groupId, handlers) {
  const form = el("form", "flow-item");
  form.appendChild(mathText("p", "flow-prompt", table.prompt));

  const tableEl = el("table", "flow-table");
  const headRow = el("tr");
  for (const v of ["x", "y"]) {
    const th = el("th");
    const symbol = el("span");
    renderMath(symbol, v);
    const name = table.columns[v];
    if (name && name !== v) th.append(document.createTextNode(`${name} (`), symbol, document.createTextNode(")"));
    else th.appendChild(symbol); // no story label: just "x"
    headRow.appendChild(th);
  }
  const thead = el("thead");
  thead.appendChild(headRow);

  // Given rows and blank cells are drawn together, sorted by x (x = 0 comes first)
  const rows = [];
  for (const row of table.given) {
    const tr = el("tr");
    tr.append(el("td", "", String(row.x)), el("td", "", String(row.y)));
    rows.push({ x: row.x, tr });
  }

  const inputs = [];
  const wrongXs = [];
  for (const item of items) {
    const progress = getProgress(run, item.id);
    const tr = el("tr");
    const yCell = el("td");
    if (progress.done) {
      // Typed by the student, or shown by "Show answer" / auto-fill
      if (progress.revealed || progress.autoFilled) renderTextWithMath(yCell, item.answerText);
      else yCell.textContent = progress.lastAnswer;
      yCell.classList.add(progress.revealed ? "is-revealed" : progress.autoFilled ? "is-autofilled" : "is-correct");
    } else {
      const input = numberInput(`y when x = ${item.x}`, progress.lastAnswer);
      const kind = progress.feedback?.kind;
      if (kind === "wrong" || kind === "invalid") {
        input.classList.add("is-wrong");
        wrongXs.push(item.x);
      }
      inputs.push([item.id, input]);
      yCell.appendChild(input);
    }
    tr.append(el("td", "", String(item.x)), yCell);
    rows.push({ x: item.x, tr });
  }
  const tbody = el("tbody");
  rows.sort((a, b) => a.x - b.x).forEach((r) => tbody.appendChild(r.tr));
  tableEl.append(thead, tbody);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const filled = inputs.filter(([, input]) => input.value.trim() !== "");
    if (filled.length) handlers.onAnswers(filled.map(([id, input]) => [id, input.value]));
  });

  const allDone = inputs.length === 0;
  form.append(tableEl, checkButton(allDone));

  // One message for the whole table ("Nice, you've got the pattern!" after auto-fill)
  let message = null;
  if (allDone) message = { kind: "correct", text: run.groupMessages[groupId] ?? "Correct!" };
  else if (wrongXs.length) message = { kind: "wrong" };
  form.appendChild(feedbackNode(message, `Not quite, try again (check x = ${wrongXs.join(", ")}).`));

  // Help for one cell: the first unfinished cell that has been tried, else the first unfinished one
  const open = items.filter((it) => !getProgress(run, it.id).done);
  const target = open.find((it) => getProgress(run, it.id).attempts > 0) ?? open[0];
  if (target) form.appendChild(helpNode(target, getProgress(run, target.id), run, handlers));
  return form;
}

// Read-only copy of an earlier table: what the student found ("?" where they haven't yet)
function renderReferenceTable(run, groupId) {
  const data = referenceTable(run, groupId);
  if (!data) return null;
  const wrap = el("div", "flow-reference");
  wrap.appendChild(el("p", "flow-reference-title", "Your table"));

  const tableEl = el("table", "flow-table");
  const headRow = el("tr");
  for (const v of ["x", "y"]) {
    const th = el("th");
    const symbol = el("span");
    renderMath(symbol, v);
    const name = data.table.columns[v];
    if (name && name !== v) th.append(document.createTextNode(`${name} (`), symbol, document.createTextNode(")"));
    else th.appendChild(symbol);
    headRow.appendChild(th);
  }
  const thead = el("thead");
  thead.appendChild(headRow);
  const tbody = el("tbody");
  for (const row of data.rows) {
    const tr = el("tr");
    tr.append(el("td", "", String(row.x)), el("td", row.y === null ? "is-unknown" : "", row.y === null ? "?" : String(row.y)));
    tbody.appendChild(tr);
  }
  tableEl.append(thead, tbody);
  wrap.appendChild(tableEl);
  return wrap;
}

// ---------- the whole step ----------

export function renderFlow(state, handlers) {
  const container = document.getElementById("flow");
  if (!container) return;
  clearMiniGraphs(); // free the old small graphs before their elements are removed
  pendingGraphs = [];
  container.textContent = "";

  const run = state.flowRun;
  const step = run?.steps[state.step];
  if (!step) return;

  const info = sequenceSteps[state.step];
  const heading = el("h2", "", `Step ${state.step + 1} of ${run.steps.length}: ${info?.title ?? step.id}`);
  if (isStepSkipped(run, state.step)) heading.appendChild(el("span", "flow-skipped-tag", "skipped"));
  container.appendChild(heading);
  container.appendChild(mathText("p", "flow-instructions", step.instructions));

  if (step.introMath) {
    const display = el("div", "flow-intro-math");
    renderMath(display, step.introMath, true);
    container.appendChild(display);
  }
  if (step.intro) container.appendChild(mathText("p", "flow-intro", step.intro));
  if (step.referenceTable) {
    const reference = renderReferenceTable(run, step.referenceTable);
    if (reference) container.appendChild(reference);
  }

  // Draw visible items; items sharing a `group` are drawn together once, as a table
  const drawnGroups = new Set();
  const visible = visibleItems(run, state.step);
  for (const item of visible) {
    if (item.group) {
      if (drawnGroups.has(item.group)) continue;
      drawnGroups.add(item.group);
      const groupItems = visible.filter((it) => it.group === item.group);
      container.appendChild(renderTable(step.tables[item.group], groupItems, run, item.group, handlers));
      continue;
    }
    const progress = getProgress(run, item.id);
    if (item.type === "choice") container.appendChild(renderChoice(item, progress, run, handlers));
    if (item.type === "number") container.appendChild(renderNumber(item, progress, run, handlers));
    if (item.type === "pair") container.appendChild(renderPair(item, progress, run, handlers));
  }

  // Back / Skip for now / Next
  const complete = isStepComplete(run, state.step);
  const movable = canMoveOn(run, state.step);
  const isLast = state.step === run.steps.length - 1;
  const nav = el("div", "flow-nav");

  const back = button("Back", "btn btn-secondary", handlers.onBack);
  back.disabled = state.step === 0;
  nav.appendChild(back);

  const right = el("div", "flow-nav-right");
  if (!movable) right.appendChild(button("Skip for now", "btn btn-secondary", handlers.onSkip));
  if (!isLast) {
    const next = button("Next", "btn", handlers.onNext);
    next.disabled = !movable;
    if (!movable) next.title = "Finish this step, or skip it for now";
    right.appendChild(next);
  }
  nav.appendChild(right);
  container.appendChild(nav);

  if (isLast && movable) {
    const skippedNames = run.steps
      .map((s, i) => (isStepSkipped(run, i) ? sequenceSteps[i]?.title ?? s.id : null))
      .filter(Boolean);
    const text = skippedNames.length
      ? `You reached the end! You skipped: ${skippedNames.join(", ")}. Click a step in the bar at the top to go back to it.`
      : complete
        ? "You finished every step! Click New scenario to try another story."
        : "You reached the end! Click New scenario to try another story.";
    container.appendChild(el("p", skippedNames.length ? "flow-done has-skipped" : "flow-done", text));
  }

  // Now that the step is on the page, draw its small graphs (same axes for all of one item)
  for (const { ids, paramsList, fitList } of pendingGraphs) renderMiniGraphs(ids, state.concept, paramsList, fitList);
  pendingGraphs = [];

  // Put the cursor in the first empty box, unless the student is typing somewhere else
  const active = document.activeElement;
  if (!active || active === document.body || container.contains(active) || !active.isConnected) {
    container.querySelector("input:not([disabled])")?.focus({ preventScroll: true });
  }
}
