/*
  flowEngine.js — runs a guided "worksheet" flow, step by step.

  GENERIC: it knows nothing about algebra. A flow (e.g. js/flows/linearFlow.js)
  describes the steps and items; this file keeps track of attempts, decides
  what is visible, and checks answers by calling each item's own check().
  No DOM here (views/flowView.js draws it), so it can be tested in Node.

  ---------------------------------------------------------------------------
  WHAT A FLOW PROVIDES
  ---------------------------------------------------------------------------
  flow.buildSteps(concept, params, context, rng) returns an array of steps,
  one per entry in core/sequence.js (same order). Each step looks like:

    {
      id: "notice",                    // matches the id in sequence.js
      instructions: "…",               // short line under the step name
      show: ["story"],                 // representations visible during this step
      revealAfter: { itemId: ["formula", "graph"] }, // extra ones once an item is done
      intro: "…", introMath: "…",      // optional text / display math above the items
      tables: { groupId: { … } },      // optional: items with that `group` form a table
      items: [ … ],
    }

  and each item:

    {
      id: "notice-slope",              // unique within the flow, used in the log
      type: "choice" | "number" | "pair",
      prompt: "…",                     // text, math inside \( … \)
      options: [{ key, text }],        // choice items only
      check(answer),                   // true, false, or null (= unreadable, not counted)
      answerText: "…",                 // shown after too many wrong attempts
      hint: "…" or (answer) => "…",    // shown after a wrong attempt
      group: "notice-table",           // optional, see `tables`
    }

  `context.rng` style: rng() returns a number in [0, 1), like Math.random.
  Building the steps ONCE per scenario keeps shuffled options in the same
  order when the student goes Back and Next.
*/

export const MAX_ATTEMPTS = 3;

export function createRun(flow, concept, params, context = {}, rng = Math.random) {
  return {
    steps: flow.buildSteps(concept, params, context, rng),
    progress: {}, // itemId -> { attempts, done, revealed, wrongKeys, lastAnswer, feedback }
  };
}

export function getProgress(run, itemId) {
  if (!run.progress[itemId]) {
    run.progress[itemId] = {
      attempts: 0,
      done: false,
      revealed: false,
      wrongKeys: [],
      lastAnswer: null,
      feedback: null,
    };
  }
  return run.progress[itemId];
}

export function isItemDone(run, itemId) {
  return Boolean(run.progress[itemId]?.done);
}

export function isStepComplete(run, stepIndex) {
  const step = run.steps[stepIndex];
  return Boolean(step) && step.items.every((item) => isItemDone(run, item.id));
}

// Items are revealed one "unit" at a time: a unit is a single item, or all items
// that share a `group` (e.g. the cells of one table). Everything up to and
// including the first unfinished unit is visible.
export function visibleItems(run, stepIndex) {
  const items = run.steps[stepIndex]?.items ?? [];
  const visible = [];
  let i = 0;
  while (i < items.length) {
    const group = items[i].group;
    let unit = [items[i]];
    if (group) unit = items.filter((it, j) => j >= i && it.group === group);
    visible.push(...unit);
    if (!unit.every((it) => isItemDone(run, it.id))) break;
    i += unit.length;
  }
  return visible;
}

// Which representations ("story", "formula", "graph"...) the page should show now.
export function visibleRepresentations(run, stepIndex) {
  const step = run.steps[stepIndex];
  if (!step) return [];
  const shown = new Set(step.show ?? []);
  for (const [itemId, extra] of Object.entries(step.revealAfter ?? {})) {
    if (isItemDone(run, itemId)) extra.forEach((r) => shown.add(r));
  }
  return [...shown];
}

export function findItem(run, stepIndex, itemId) {
  return run.steps[stepIndex]?.items.find((it) => it.id === itemId) ?? null;
}

/*
  Checks one answer and updates that item's progress.
  Returns { status, entry }:
    status: "correct" | "wrong" | "revealed" (wrong too many times) |
            "invalid" (unreadable, not counted) | "ignored" (item already done)
    entry:  a log record for state.responses, or null if nothing was counted
*/
export function submitAnswer(run, stepIndex, itemId, answer, maxAttempts = MAX_ATTEMPTS) {
  const step = run.steps[stepIndex];
  const item = findItem(run, stepIndex, itemId);
  if (!item) throw new Error(`No item "${itemId}" in step ${stepIndex}`);

  const progress = getProgress(run, itemId);
  if (progress.done) return { status: "ignored", entry: null };

  const result = item.check(answer);
  progress.lastAnswer = answer;
  if (result === null) {
    progress.feedback = { kind: "invalid" };
    return { status: "invalid", entry: null };
  }

  progress.attempts += 1;
  let status;
  if (result) {
    status = "correct";
    progress.done = true;
    progress.feedback = { kind: "correct" };
  } else if (progress.attempts >= maxAttempts) {
    status = "revealed";
    progress.done = true;
    progress.revealed = true;
    progress.feedback = { kind: "revealed", answerText: item.answerText };
  } else {
    status = "wrong";
    const hint = typeof item.hint === "function" ? item.hint(answer) : item.hint;
    progress.feedback = { kind: "wrong", hint };
  }
  if (!result && item.type === "choice") progress.wrongKeys.push(answer);

  const entry = {
    step: step.id,
    item: itemId,
    answer,
    correct: Boolean(result),
    attempts: progress.attempts,
    revealed: progress.revealed,
    time: new Date().toISOString(),
  };
  return { status, entry };
}
