/*
  sequence.js — the learning steps a student goes through for any concept:
    Explore → Notice → Represent → Solve → Explain → Transfer

  The steps are GENERIC, so they work for algebra, physics, or anything else.
  For the first milestone this is only a PLACEHOLDER: show the step names and
  highlight the current one. Real step behavior comes later.

  Reads state.step (from state.js). Rendered by main.js into #step-sequence in index.html.
*/

// The six learning steps, in order. Generic: they work for any concept.
export const steps = [
  { id: "explore", title: "Explore", description: "Read the story and get curious." },
  { id: "notice", title: "Notice", description: "Spot patterns in the numbers." },
  { id: "represent", title: "Represent", description: "Connect the story, table, graph, and formula." },
  { id: "solve", title: "Solve", description: "Use the model to answer the question." },
  { id: "explain", title: "Explain", description: "Say what the slope and intercept mean." },
  { id: "transfer", title: "Transfer", description: "Apply the idea to a new situation." },
];

export function renderSequence(state) {
  const container = document.getElementById("step-sequence");
  if (!container) return;
  container.textContent = "";

  const list = document.createElement("ol");
  list.className = "step-list";

  steps.forEach((step, i) => {
    const item = document.createElement("li");
    item.textContent = step.title;
    item.title = step.description; // shows on hover

    if (i === state.step) {
      item.classList.add("is-current");
      item.setAttribute("aria-current", "step"); // screen readers: "current step"
    }
    list.appendChild(item);
  });

  container.appendChild(list);
}

// Ready for later: move between steps without going out of range
export function nextStep(step) {
  return Math.min(step + 1, steps.length - 1);
}

export function previousStep(step) {
  return Math.max(step - 1, 0);
}