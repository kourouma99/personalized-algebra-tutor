export function renderConceptPicker(concepts, selectedId, onChoose) {
  const container = document.getElementById("concept-picker");
  if (!container) return;
  container.textContent = "";

  const heading = document.createElement("h2");
  heading.textContent = "What do you want to learn?";
  container.appendChild(heading);

  const buttons = document.createElement("div");
  buttons.className = "interest-buttons"; // reuse the same pill style

  for (const concept of concepts) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = concept.name;

    const isSelected = concept.id === selectedId;
    if (isSelected) button.classList.add("is-selected");
    button.setAttribute("aria-pressed", String(isSelected));

    button.addEventListener("click", () => onChoose(concept.id));
    buttons.appendChild(button);
  }

  container.appendChild(buttons);
}