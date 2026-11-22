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
  visibleItems,
  HINTS_BEFORE_ANSWER,
} from "../core/flowEngine.js";
import { renderMath, renderTextWithMath } from "./mathRender.js";

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

// Hints shown so far, then "Need a hint?" or "Show answer" (only after a try)
function helpNode(item, progress, run, handlers) {
  const wrap = el("div", "flow-help");
  progress.hints.forEach((text, i) => {
    wrap.appendChild(mathText("p", "flow-hint", `Hint ${i + 1}: ${text}`));
  });
  if (progress.done || progress.attempts === 0) return wrap;

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

function renderChoice(item, progress, run, handlers) {
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

  const tbody = el("tbody");
  for (const row of table.given) {
    const tr = el("tr");
    tr.append(el("td", "", String(row.x)), el("td", "", String(row.y)));
    tbody.appendChild(tr);
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
    tbody.appendChild(tr);
  }
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

  // Help for the first unfinished cell that has been tried
  const target = items.find((it) => {
    const p = getProgress(run, it.id);
    return !p.done && p.attempts > 0;
  });
  if (target) form.appendChild(helpNode(target, getProgress(run, target.id), run, handlers));
  return form;
}

// ---------- the whole step ----------

export function renderFlow(state, handlers) {
  const container = document.getElementById("flow");
  if (!container) return;
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

  // Put the cursor in the first empty box, unless the student is typing somewhere else
  const active = document.activeElement;
  if (!active || active === document.body || container.contains(active) || !active.isConnected) {
    container.querySelector("input:not([disabled])")?.focus({ preventScroll: true });
  }
}
