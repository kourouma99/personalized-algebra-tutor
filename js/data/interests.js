/*
  interests.js — the list of interests a student can pick from.

  Pure data, no logic. Used by:
    - main.js, which passes the list to views/interestPicker.js
    - data/sampleScenarios.js, whose keys must match these ids

  Interests are not tied to any subject, so the same list works for
  algebra, physics, and any future concept.
*/

export const interests = [
  { id: "sports", label: "Sports", emoji: "⚽" },
  { id: "music", label: "Music", emoji: "🎵" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "animals", label: "Animals", emoji: "🐾" },
]