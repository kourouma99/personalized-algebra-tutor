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

export function renderInterestPicker(interests, selectedId, onChoose, onCustom) {
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



  // Free-text interest: later, the AI writes a story for whatever the student types
  const form = document.createElement("form");
  form.className = "custom-interest";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Or type your own interest (e.g. cooking)";
  input.maxLength = 40;

  input.setAttribute("aria-label", "Your own interest"); // Invisible on screen

    // Keep the typed interest in the box after the page redraws
  const isCustom = selectedId && !interests.some((i) => i.id === selectedId);
  if (isCustom) input.value = selectedId;


  const go = document.createElement("button");
  go.type = "submit";
  go.textContent = "Go";

  form.append(input, go);
  form.addEventListener("submit", (event) => {
    event.preventDefault(); // stops the page from reloading
    const text = input.value.trim();
    if (text && onCustom) onCustom(text);
  });
  container.appendChild(form);
}