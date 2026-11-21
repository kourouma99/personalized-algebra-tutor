/*
  flowView.js — draws the current step of a guided flow (the worksheet).

  GENERIC view: it draws whatever items the flow defines (multiple choice,
  number boxes, the two-box equation, tables) and never checks answers itself.
  When the student answers, it calls back to main.js, which asks
  core/flowEngine.js to check and then redraws. Text goes in with textContent,
  math through views/mathRender.js.

  Draws into #flow in index.html.
*/

import { steps as sequenceSteps } from "../core/sequence.js";
import { getProgress, isStepComplete, visibleItems } from "../core/flowEngine.js";
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

// The message under an item, based on what the engine stored
function feedbackNode(feedback) {
  const node = el("p", "flow-feedback");
  node.setAttribute("role", "status"); // screen readers announce the result
  if (!feedback) return node;

  node.classList.add(`is-${feedback.kind}`);
  if (feedback.kind === "correct") node.textContent = "Correct!";
  if (feedback.kind === "invalid") node.textContent = "Type a number, like 12, -3, 2.5 or 12/7.";
  if (feedback.kind === "wrong") renderTextWithMath(node, `Not quite, try again. ${feedback.hint ?? ""}`);
  if (feedback.kind === "revealed") renderTextWithMath(node, `The answer is ${feedback.answerText}. Let's keep going.`);
  return node;
}

function numberInput(label, progress) {
  const input = el("input", "flow-input");
  input.type = "text";
  input.inputMode = "decimal"; // number keyboard on phones, but still allows "/"
  input.autocomplete = "off";
  input.setAttribute("aria-label", label);
  if (progress?.lastAnswer !== null && typeof progress?.lastAnswer === "string") input.value = progress.lastAnswer;
  return input;
}

function checkButton(disabled) {
  const button = el("button", "btn btn-small", "Check");
  button.type = "submit";
  button.disabled = disabled;
  return button;
}

// ---------- item types ----------

function renderChoice(item, progress, onAnswer) {
  const wrap = el("div", "flow-item");
  wrap.appendChild(mathText("p", "flow-prompt", item.prompt));

  const buttons = el("div", "flow-choices");
  for (const option of item.options) {
    const button = el("button", "flow-choice");
    button.type = "button";
    renderTextWithMath(button, option.text);

    const pickedWrong = progress.wrongKeys.includes(option.key);
    const isAnswer = progress.done && item.check(option.key);
    if (pickedWrong) button.classList.add("is-wrong");
    if (isAnswer) button.classList.add("is-correct");
    button.disabled = progress.done || pickedWrong;
    button.addEventListener("click", () => onAnswer(item.id, option.key));
    buttons.appendChild(button);
  }

  wrap.append(buttons, feedbackNode(progress.feedback));
  return wrap;
}

function renderNumber(item, progress, onAnswer) {
  const form = el("form", "flow-item");
  const prompt = mathText("p", "flow-prompt", item.prompt);
  const row = el("div", "flow-row");
  const input = numberInput("Your answer", progress);
  input.disabled = progress.done;
  row.append(input, checkButton(progress.done));

  form.addEventListener("submit", (event) => {
    event.preventDefault(); // stops the page from reloading
    onAnswer(item.id, input.value);
  });
  form.append(prompt, row, feedbackNode(progress.feedback));
  return form;
}

// "y = [ ]x + [ ]": one input after each part
function renderPair(item, progress, onAnswer) {
  const form = el("form", "flow-item");
  const row = el("div", "flow-row flow-equation");
  const last = Array.isArray(progress.lastAnswer) ? progress.lastAnswer : [];
  const inputs = item.parts.map((part, i) => {
    const label = el("span");
    renderMath(label, part);
    const input = numberInput(i === 0 ? "Number in front of x" : "Number added", null);
    input.value = last[i] ?? "";
    input.disabled = progress.done;
    row.append(label, input);
    return input;
  });
  row.appendChild(checkButton(progress.done));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onAnswer(item.id, inputs.map((input) => input.value));
  });
  form.append(mathText("p", "flow-prompt", item.prompt), row, feedbackNode(progress.feedback));
  return form;
}

// A table where some y cells are inputs. One Check button checks every filled cell.
function renderTable(table, items, run, onAnswers) {
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
  let latestFeedback = null;
  for (const item of items) {
    const progress = getProgress(run, item.id);
    const tr = el("tr");
    const yCell = el("td");
    if (progress.done) {
      // Correct: show what they typed. Revealed: show the right answer.
      if (progress.revealed) renderTextWithMath(yCell, item.answerText);
      else yCell.textContent = progress.lastAnswer;
      yCell.classList.add(progress.revealed ? "is-revealed" : "is-correct");
    } else {
      const input = numberInput(`y when x = ${item.x}`, progress);
      if (progress.feedback?.kind === "wrong" || progress.feedback?.kind === "invalid") input.classList.add("is-wrong");
      inputs.push([item.id, input]);
      yCell.appendChild(input);
    }
    if (progress.feedback && progress.feedback.kind !== "correct") latestFeedback = progress.feedback;
    tr.append(el("td", "", String(item.x)), yCell);
    tbody.appendChild(tr);
  }
  tableEl.append(thead, tbody);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const filled = inputs.filter(([, input]) => input.value.trim() !== "");
    onAnswers(filled.map(([id, input]) => [id, input.value]));
  });

  const allDone = inputs.length === 0;
  form.append(tableEl, checkButton(allDone));
  // One message for the whole table: the hint, or the answer that was revealed
  form.appendChild(feedbackNode(allDone && !latestFeedback ? { kind: "correct" } : latestFeedback));
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
  container.appendChild(el("h2", "", `Step ${state.step + 1} of ${run.steps.length}: ${info?.title ?? step.id}`));
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
      container.appendChild(renderTable(step.tables[item.group], groupItems, run, handlers.onAnswers));
      continue;
    }
    const progress = getProgress(run, item.id);
    if (item.type === "choice") container.appendChild(renderChoice(item, progress, handlers.onAnswer));
    if (item.type === "number") container.appendChild(renderNumber(item, progress, handlers.onAnswer));
    if (item.type === "pair") container.appendChild(renderPair(item, progress, handlers.onAnswer));
  }

  // Back / Next
  const complete = isStepComplete(run, state.step);
  const isLast = state.step === run.steps.length - 1;
  const nav = el("div", "flow-nav");

  const back = el("button", "btn btn-secondary", "Back");
  back.type = "button";
  back.disabled = state.step === 0;
  back.addEventListener("click", handlers.onBack);
  nav.appendChild(back);

  if (isLast && complete) {
    nav.appendChild(el("p", "flow-done", "You finished every step! Click New scenario to try another story."));
  } else if (!isLast) {
    const next = el("button", "btn", "Next");
    next.type = "button";
    next.disabled = !complete;
    if (!complete) next.title = "Finish this step first";
    next.addEventListener("click", handlers.onNext);
    nav.appendChild(next);
  }
  container.appendChild(nav);

  // Put the cursor in the first empty box, unless the student is typing somewhere else
  const active = document.activeElement;
  if (!active || active === document.body || container.contains(active) || !active.isConnected) {
    container.querySelector("input:not([disabled])")?.focus({ preventScroll: true });
  }
}
