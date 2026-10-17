/*
  interestPicker.js — shows one button per interest so the student can choose.

  GENERIC view: it doesn't know anything about math. It receives:
    - the list of interests (from data/interests.js, passed in by main.js)
    - the currently selected interest id (from state)
    - a callback function to call when the student clicks one
  It does NOT change state itself. It tells main.js "this was clicked"
  through the callback, and main.js decides what happens next.

  Draws into #interest-picker in index.html.
*/

export function renderInterestPicker(interests, selectedId, onChoose) {
  const container = document.getElementById("interest-picker");
  if (!container) return;
  container.textContent = ""; // same as innerHTML = "", but consistent with our safe-text habit

  const heading = document.createElement("h2");
  heading.textContent = "What are you into?";
  container.appendChild(heading);

  const buttons = document.createElement("div");
  buttons.className = "interest-buttons";

  for (const interest of interests) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${interest.emoji} ${interest.label}`;

    const isSelected = interest.id === selectedId;
    if (isSelected) button.classList.add("is-selected");
    button.setAttribute("aria-pressed", String(isSelected)); // screen readers announce "selected"

    button.addEventListener("click", () => onChoose(interest.id));
    buttons.appendChild(button);
  }

  container.appendChild(buttons);
}