/*
  sampleScenarios.js — fake "AI output", hardcoded for now.

  Later an AI backend will generate this wording. The AI only writes WORDS:
  story text, variable labels, units. It never chooses the numbers.
  The numbers always come from the concept's generateParams() (code).

  That's why the story text uses placeholders like {m} and {b} instead of
  real numbers: views/scenario.js fills them in from state.params.

  Organized by concept id, then interest id, so other concepts can add their
  own scenarios here later (e.g. "constant-velocity").
  Interest ids must match data/interests.js.
*/

// TODO 1: Export an object `sampleScenarios` shaped like this:
//
//   {
//     "linear-equation": {
//       sports: {
//         title: "...",
//         story: "... {b} ... {m} ...",
//         question: "...",
//         labels: { x: "Games played", y: "Total points" },
//         units:  { x: "games", y: "points" },
//       },
//       music: { ... },
//       gaming: { ... },
//       animals: { ... },
//     },
//   }
//
// TODO 2: Write one scenario per interest. For y = mx + b, b is the starting
//   amount and m is the change per unit of x. Example idea for sports:
//   "Your team already has {b} points. Each game you score {m} more points."
//   Wrap math in \( ... \) so views/mathRender.js renders it with KaTeX. In a JS string
//   the backslash is doubled: "After \\(x\\) games you have \\(y\\) points."
//   Remember: m can be negative! Does your story still make sense if m = -4?
//   (If not, that's a great reason for a constraint, or a story that handles losses.)

// TODO 3: Export a function getScenario(conceptId, interestId) that returns
//   the matching scenario, or a clear fallback/error if it doesn't exist.
