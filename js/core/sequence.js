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

/*
  nav (optional, given by main.js when a guided flow is running):
    status(i)   -> "done" | "skipped" | null, shown as a marker on the step
    canVisit(i) -> true if the student may jump to step i
    onSelect(i) -> called when the student clicks step i
  Without nav, the bar is just a display, as before.
*/
export function renderSequence(state, nav) {
  const container = document.getElementById("step-sequence");
  if (!container) return;
  container.textContent = "";

  const list = document.createElement("ol");
  list.className = "step-list";

  steps.forEach((step, i) => {
    const item = document.createElement("li");
    const status = nav?.status(i) ?? null;
    const clickable = Boolean(nav?.canVisit(i)) && i !== state.step;

    // A button when the student can jump there, plain text otherwise
    const label = document.createElement(clickable ? "button" : "span");
    label.textContent = step.title;
    if (clickable) {
      label.type = "button";
      label.className = "step-link";
      label.addEventListener("click", () => nav.onSelect(i));
    }
    item.appendChild(label);
    item.title = step.description; // shows on hover

    if (status) {
      item.classList.add(`is-${status}`);
      const marker = document.createElement("span");
      marker.className = "step-marker";
      marker.textContent = status === "done" ? " ✓" : " (skipped)";
      if (status === "done") marker.setAttribute("aria-label", "done");
      item.appendChild(marker);
    }
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