# Personalized Algebra Tutor: Progress Report

**Milestone 1 complete** (tagged `milestone-1` in the repository)

## Research goal

Students learn the same algebraic concept through a scenario personalized to their interests, while instructor-defined mathematical and pedagogical constraints keep the underlying concept intact.

**Research question:** Can generative AI dynamically create multiple pedagogically constrained representations of the same algebraic concept and help students move between them?

## What Milestone 1 does

A working browser prototype for **linear equations (y = mx + b)**:

- **Interest picker:** the student chooses Sports, Music, Gaming, or Animals.
- **Personalized story:** a scenario matching the interest, with the generated numbers filled in. Each interest has two story variants, one for increasing relationships (positive slope) and one for decreasing relationships (negative slope), so the story always makes sense.
- **Four linked representations**, all computed from the same numbers:
  - verbal (the story and a prediction question)
  - formula (typeset with KaTeX)
  - table of values
  - graph (JSXGraph)
- **New scenario button:** generates new valid numbers; every representation updates together.
- **Explore/lock graph toggle:** students can choose to pan and zoom the graph or keep it fixed.
- **Learning step bar:** Explore → Notice → Represent → Solve → Explain → Transfer (placeholder for now).

## Key design decisions

**Code controls the math; the AI will only control the words.** All numbers, equations, tables, and graphs are generated and validated by code. Stories use placeholders (e.g. `{b}`, `{absM}`) that code fills in. Today the wording comes from hand-written sample scenarios; later an AI backend will produce it, but it will never choose the numbers.

**Instructor constraints are enforced in code.** For linear equations: slope between −10 and 10 (never 0), intercept between 0 and 50, and y never negative over the displayed range, since y usually represents a count or amount. Parameters are validated twice: by the concept's own rules and by a generic validator that will also screen AI-suggested values later.

**Linked representations by design.** A single shared state holds the current numbers, and every view re-renders from it. The story, formula, table, and graph therefore cannot disagree.

**Tables use a step of 1** so students can see that y changes by exactly the slope in every row, supporting the "Notice" step.

**Extensible to other concepts and subjects.** Each concept is a plug-in module with a common interface (`generateParams`, `validate`, `evaluate`, `formulaText`, `formulaLatex`). Adding a new concept, including physics later, means adding one module; the views and core logic stay unchanged.

**Safe and robust.**
- Story text is inserted as plain text, never as HTML, so future AI-generated text cannot inject code (XSS protection).
- If the graphing or math library fails to load, the rest of the page still works (graceful degradation).
- Only one file talks to each third-party library (adapter pattern), so JSXGraph can be swapped for Desmos later by changing one file.

## Tech stack

Plain HTML, CSS, and JavaScript (ES modules), no build tools. KaTeX for math notation, JSXGraph for graphs, both loaded from a CDN.

**To run:** open the folder in VS Code and use the Live Server extension on `index.html`.

## Current limitations

- Scenarios are hand-written samples; no AI generation yet.
- Only one concept (linear equations).
- The learning steps are displayed but not yet interactive.
- The prediction question is shown but student answers are not yet collected or checked.

## Proposed next steps

1. **Make the learning steps interactive:** collect and check the student's prediction (Solve), prompt for the meaning of slope and intercept (Explain), and add a transfer task.
2. **Add more college algebra concepts**, informed by the Blackboard College Algebra course content.
3. **Build the AI backend:** a small server that generates scenario wording under the constraints, with validation of everything the AI returns. This requires choosing an AI provider and an API key.
4. **Evaluate scenario fidelity:** generate many scenarios and measure how often they violate a constraint, and how.
