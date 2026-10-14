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

// TODO 1: Export a function renderInterestPicker(interests, selectedId, onChoose).

// TODO 2: Find the #interest-picker element and clear it (element.innerHTML = "").

// TODO 3: Add a heading, e.g. "What are you into?".

// TODO 4: For each interest, create a <button>:
//   a. set its text (e.g. emoji + label from the interest object)
//   b. if interest.id === selectedId, add a CSS class like "is-selected"
//   c. add a click listener that calls onChoose(interest.id)
//   d. append it to the container

// TODO 5 (think about it): When the student clicks, the selected style should update.
//   Easiest approach: have main.js call renderInterestPicker again after the choice.
