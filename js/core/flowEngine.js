/*
  flowEngine.js — runs a guided "worksheet" flow, step by step.

  GENERIC: it knows nothing about algebra. A flow (e.g. js/flows/linearFlow.js)
  describes the steps and items; this file keeps track of attempts, hints,
  skipped steps, decides what is visible, and checks answers by calling each
  item's own check(). No DOM here (views/flowView.js draws it), so it can be
  tested in Node.

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
      requires: { formula: "represent" }, // hide one until that step is complete
      referenceTable: "notice-table",  // optional: read-only copy of an earlier step's table
      intro: "…", introMath: "…",      // optional text / display math above the items
      tables: { groupId: { …, autoFill } }, // optional: items with that `group` form a table
      items: [ … ],
    }

  and each item:

    {
      id: "notice-slope",              // unique within the flow, used in the log
      type: "choice" | "number" | "pair",
      prompt: "…",                     // text, math inside \( … \)
      options: [{ key, text }],        // choice items only
      check(answer),                   // true, false, or null (= unreadable, not counted)
      answerText: "…",                 // shown when the student asks for the answer
      answer: 16.43, exactText: "…",   // number items: the value, and its exact form if not whole
      hints: [nudge, specific],        // each a string or (ctx) => string, see requestHint
      group: "notice-table",           // optional, see `tables`
    }

  Table auto-fill (optional): tables[group].autoFill = { after: 2, message: "…" }
  means: if the first `after` cells are all correct on the first try, fill in
  the cells the student left blank and show the message.

  How help works: a wrong answer only says "try again". The student can ask
  for hint 1, then hint 2, and only after both can they ask to see the answer.

  rng() returns a number in [0, 1), like Math.random. Building the steps ONCE
  per scenario keeps shuffled options in the same order on Back and Next.
*/

export const HINTS_BEFORE_ANSWER = 2;

export function createRun(flow, concept, params, context = {}, rng = Math.random) {
  return {
    steps: flow.buildSteps(concept, params, context, rng),
    progress: {},     // itemId -> see getProgress
    skipped: [],      // step indexes the student skipped (and hasn't finished yet)
    furthest: 0,      // the furthest step reached, so the step bar knows what can be visited
    groupMessages: {}, // group -> message, e.g. after auto-fill
  };
}

export function getProgress(run, itemId) {
  if (!run.progress[itemId]) {
    run.progress[itemId] = {
      attempts: 0,
      done: false,
      revealed: false,   // the student asked to see the answer
      autoFilled: false, // filled in by a table's autoFill
      wrongKeys: [],     // choice items: options already tried
      lastAnswer: null,
      feedback: null,    // { kind: "correct" | "wrong" | "invalid" | "revealed", answerText? }
      hints: [],         // hint texts shown so far, in order
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

export function isStepSkipped(run, stepIndex) {
  return run.skipped.includes(stepIndex) && !isStepComplete(run, stepIndex);
}

// The student may leave a step forward once it is finished, or if they skipped it
export function canMoveOn(run, stepIndex) {
  return isStepComplete(run, stepIndex) || run.skipped.includes(stepIndex);
}

// For the step bar: "done", "skipped", or null (not finished / not visited)
export function stepStatus(run, stepIndex) {
  if (isStepComplete(run, stepIndex)) return "done";
  if (isStepSkipped(run, stepIndex)) return "skipped";
  return null;
}

export function canVisit(run, stepIndex) {
  return stepIndex >= 0 && stepIndex <= run.furthest && stepIndex < run.steps.length;
}

export function markVisited(run, stepIndex) {
  run.furthest = Math.max(run.furthest, stepIndex);
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
  // step.requires = { formula: "represent" }: shown only once that step is complete
  // (every item answered or revealed). Skipping it does not count.
  for (const [name, stepId] of Object.entries(step.requires ?? {})) {
    const index = run.steps.findIndex((s) => s.id === stepId);
    if (index !== -1 && !isStepComplete(run, index)) shown.delete(name);
  }
  return [...shown];
}

// For step.referenceTable: the rows of a table from an earlier step, as the student
// knows them. Returns { table, rows: [{ x, y, given }] } with y = null if not found yet.
export function referenceTable(run, groupId) {
  const owner = run.steps.find((s) => s.tables?.[groupId]);
  if (!owner) return null;
  const table = owner.tables[groupId];
  const rows = [
    ...table.given.map((r) => ({ x: r.x, y: r.y, given: true })),
    ...owner.items
      .filter((it) => it.group === groupId)
      .map((it) => {
        const p = getProgress(run, it.id);
        return { x: it.x, y: p.done ? it.answer : null, given: false };
      }),
  ].sort((a, b) => a.x - b.x);
  return { table, rows };
}

export function findItem(run, stepIndex, itemId) {
  return run.steps[stepIndex]?.items.find((it) => it.id === itemId) ?? null;
}

// step.logFields (optional, from the flow) are added to every entry, e.g. { representFormat: "both" }
function logEntry(run, stepIndex, fields) {
  const step = run.steps[stepIndex];
  return { step: step.id, ...step.logFields, ...fields, time: new Date().toISOString() };
}

// A "start" log entry for a new run (extra: e.g. concept, interest, params)
export function startEntry(run, extra = {}) {
  return { type: "start", ...run.steps[0]?.logFields, ...extra, time: new Date().toISOString() };
}

/*
  Checks one answer and updates that item's progress.
  Returns { status, entry }:
    status: "correct" | "wrong" | "invalid" (unreadable, not counted) |
            "correct-again" | "wrong-again" (another answer after a correct one) |
            "ignored" (done and can't be answered again, see canAnswerAgain)
    entry:  a log record for state.responses, or null if nothing was counted
*/
export function submitAnswer(run, stepIndex, itemId, answer) {
  const item = findItem(run, stepIndex, itemId);
  if (!item) throw new Error(`No item "${itemId}" in step ${stepIndex}`);

  const progress = getProgress(run, itemId);
  if (progress.done) return answerAgain(run, stepIndex, item, progress, answer);

  const result = item.check(answer);
  progress.lastAnswer = answer;
  if (result === null) {
    progress.feedback = { kind: "invalid" };
    return { status: "invalid", entry: null };
  }

  progress.attempts += 1;
  if (result) {
    progress.done = true;
    progress.feedback = { kind: "correct", exactText: exactTextFor(item, answer) };
  } else {
    progress.feedback = { kind: "wrong" };
    if (item.type === "choice") progress.wrongKeys.push(answer);
  }

  const entry = logEntry(run, stepIndex, {
    type: "answer",
    item: itemId,
    answer,
    correct: Boolean(result),
    attempts: progress.attempts,
    hintsUsed: progress.hints.length,
  });
  return { status: result ? "correct" : "wrong", entry };
}

// Typed boxes (number, pair) stay open after a correct answer so the student can try
// another equivalent form (e.g. 115/7 after 16.43). Not for multiple choice, table cells,
// or anything whose answer was revealed with "Show answer".
export function canAnswerAgain(item, progress) {
  return progress.done && !progress.revealed && !progress.autoFilled && !item.group && item.type !== "choice";
}

// A decimal accepted for a non-whole answer: also show the exact value, if the flow gave one
function exactTextFor(item, answer) {
  const typedDecimal = typeof answer === "string" && !answer.includes("/");
  const nonWhole = typeof item.answer === "number" && !Number.isInteger(item.answer);
  return typedDecimal && nonWhole ? item.exactText ?? null : null;
}

// Another answer on an item that is already correct. Checked the same way and logged,
// but it never "un-finishes" the item.
function answerAgain(run, stepIndex, item, progress, answer) {
  if (!canAnswerAgain(item, progress)) return { status: "ignored", entry: null };

  const result = item.check(answer);
  progress.lastAnswer = answer;
  if (result === null) {
    progress.feedback = { kind: "invalid" };
    return { status: "invalid", entry: null };
  }
  progress.reanswers = (progress.reanswers ?? 0) + 1;
  progress.feedback = result
    ? { kind: "correct", again: true, exactText: exactTextFor(item, answer) }
    : { kind: "wrong-again" };

  const entry = logEntry(run, stepIndex, {
    type: "answer",
    item: item.id,
    answer,
    correct: Boolean(result),
    reanswer: true, // the item was already correct
    attempts: progress.attempts,
    hintsUsed: progress.hints.length,
  });
  return { status: result ? "correct-again" : "wrong-again", entry };
}

/*
  Checks several cells of one table at once (one Check button).
  Then applies the table's autoFill rule, if it has one.
  Returns { entries } (log records, in order).
*/
export function submitGroup(run, stepIndex, answers) {
  const entries = [];
  for (const [itemId, answer] of answers) {
    const { entry } = submitAnswer(run, stepIndex, itemId, answer);
    if (entry) entries.push(entry);
  }

  const group = findItem(run, stepIndex, answers[0]?.[0])?.group;
  const rule = group && run.steps[stepIndex].tables?.[group]?.autoFill;
  if (rule) {
    const cells = run.steps[stepIndex].items.filter((it) => it.group === group);
    const firstCells = cells.slice(0, rule.after);
    const rest = cells.slice(rule.after).filter((it) => {
      const p = getProgress(run, it.id);
      return !p.done && p.attempts === 0; // only cells the student hasn't tried
    });
    const perfectStart = firstCells.every((it) => {
      const p = getProgress(run, it.id);
      return p.done && !p.revealed && p.attempts === 1;
    });
    if (perfectStart && rest.length > 0) {
      for (const it of rest) {
        const p = getProgress(run, it.id);
        p.done = true;
        p.autoFilled = true;
        p.feedback = { kind: "correct" };
      }
      run.groupMessages[group] = rule.message;
      entries.push(logEntry(run, stepIndex, { type: "autofill", items: rest.map((it) => it.id) }));
    }
  }
  return { entries };
}

/*
  Shows the next hint for an item (up to HINTS_BEFORE_ANSWER).
  A hint may be a function; it gets { answer, solved } where solved(itemId)
  says whether another item is already done (e.g. which table rows are known).
  The text is computed NOW and kept, so it doesn't change on Back/Next.
*/
export function requestHint(run, stepIndex, itemId) {
  const item = findItem(run, stepIndex, itemId);
  const progress = getProgress(run, itemId);
  const hints = item?.hints ?? [];
  if (!item || progress.done || progress.hints.length >= Math.min(hints.length, HINTS_BEFORE_ANSWER)) {
    return { entry: null };
  }

  const next = hints[progress.hints.length];
  const ctx = { answer: progress.lastAnswer, solved: (id) => isItemDone(run, id) };
  progress.hints.push(typeof next === "function" ? next(ctx) : next);

  return {
    entry: logEntry(run, stepIndex, {
      type: "hint",
      item: itemId,
      hint: progress.hints.length,
      attempts: progress.attempts,
    }),
  };
}

// The "Show answer" button appears only after every hint has been seen
export function canRevealAnswer(run, itemId, item) {
  const progress = getProgress(run, itemId);
  const available = Math.min(item?.hints?.length ?? 0, HINTS_BEFORE_ANSWER);
  return !progress.done && progress.hints.length >= available;
}

export function revealAnswer(run, stepIndex, itemId) {
  const item = findItem(run, stepIndex, itemId);
  if (!item || !canRevealAnswer(run, itemId, item)) return { entry: null };

  const progress = getProgress(run, itemId);
  progress.done = true;
  progress.revealed = true;
  progress.feedback = { kind: "revealed", answerText: item.answerText };
  return {
    entry: logEntry(run, stepIndex, {
      type: "reveal",
      item: itemId,
      attempts: progress.attempts,
      hintsUsed: progress.hints.length,
    }),
  };
}

// "Skip for now": remember the step so the step bar can mark it
export function skipStep(run, stepIndex) {
  if (isStepComplete(run, stepIndex)) return { entry: null };
  if (!run.skipped.includes(stepIndex)) run.skipped.push(stepIndex);
  const open = run.steps[stepIndex].items.filter((it) => !isItemDone(run, it.id)).map((it) => it.id);
  return { entry: logEntry(run, stepIndex, { type: "skip", unfinished: open }) };
}
