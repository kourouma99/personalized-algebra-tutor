# Personalized Algebra Tutor

A research prototype where students learn a math concept through a scenario personalized to their interests (sports, music, gaming, animals, and so on).

- **Code owns the math.** Every number, equation, table, and graph is generated and validated by code, inside instructor-defined constraints.
- **AI owns the wording (later).** A future backend will let an AI write only the scenario text, variable labels, and explanations. For now, the wording comes from hardcoded sample scenarios in `js/data/sampleScenarios.js`.
- **Built to grow beyond algebra.** The core and views are generic. Each concept (like a linear equation) is a plug-in module with a shared interface, so other subjects such as physics can be added later.

The page is plain HTML, CSS, and vanilla JavaScript (ES modules), with no build step. A small Node/Express server (`server/server.js`) serves the page and will hold the AI route later (so the API key never reaches the browser). Its only npm dependency is Express.

- **Guided worksheet (linear and exponential):** instead of showing everything at once, each guided concept walks the student through the six steps one at a time. Each step asks them to *do* something (predict, fill in a table, write or pick the equation, solve, explain, use function notation), with hints on request, Skip for now, and a research log of every answer in `state.responses`. Quadratic still shows the all-at-once page. Add `?dev=1` to the URL for dev mode: every step is clickable and each item has an Auto-answer button.
- **Graphs and number lines:** [JSXGraph](https://jsxgraph.org/) from a CDN (no API key needed). Only `js/views/graph.js` may talk to the graphing library, so it can be swapped (e.g. for Desmos) by changing that one file and the `provider` setting in `js/config.js`. Graphs are drawn from the same computed points as the table, never from an equation.
- **Math notation:** [KaTeX](https://katex.org/) from a CDN. Only `js/views/mathRender.js` calls KaTeX. Other views use its helpers.

## Running it locally

ES modules don't load when you open `index.html` directly (`file://`), so you need a local web server. Either:

**With the Express server** (needs [Node.js](https://nodejs.org/) 18 or newer):

1. `npm install` (once, installs Express)
2. `npm start`
3. Open `http://localhost:3000`. Restart `npm start` after changing `server/server.js`; page files (HTML, CSS, JS) only need a browser refresh.

**Or with Live Server** (page only, no server route):

1. Install the **Live Server** extension in VS Code (by Ritwick Dey).
2. Right-click `index.html` and choose **Open with Live Server** (or click **Go Live** in the status bar).
3. The app opens at `http://127.0.0.1:5500` and reloads whenever you save a file.

## Folder structure

```
personalized-algebra-tutor/
├── index.html                   # page layout: empty containers the views fill in
├── README.md
├── package.json                 # npm start, Express dependency
├── server/
│   └── server.js                # serves the page; placeholder AI route (POST /api/scenario)
├── css/
│   ├── base.css                 # colors, layout, cards, buttons
│   └── components.css           # styles for each view
└── js/
    ├── main.js                  # entry point: wires state, concepts, flows, and views together
    ├── config.js                # graphing provider setting (read only by graph.js)
    ├── state.js                 # generic: { concept, interest, params, step, flowRun, responses }
    ├── core/
    │   ├── conceptRegistry.js   # list of available concepts
    │   ├── validator.js         # runs each concept's own validate()
    │   ├── sequence.js          # steps: Explore → Notice → Represent → Solve → Explain → Transfer
    │   ├── flowEngine.js        # generic worksheet engine: attempts, hints, skips, reveals, log
    │   └── answerCheck.js       # reads typed answers: 12, -3, 1.71, 12/7
    ├── concepts/
    │   └── algebra/             # math only: generateParams, validate, evaluate, formulas
    │       ├── linearEquation.js  # y = mx + b (has a guided flow)
    │       ├── exponential.js     # y = a · b^x (has a guided flow)
    │       └── quadratic.js
    ├── flows/
    │   ├── flowHelpers.js       # shared building blocks: shuffle, item builders, nearest table row
    │   ├── linearFlow.js        # the pedagogy for linear: questions, hints, wrong options
    │   └── exponentialFlow.js   # the same for exponential (hints multiply/divide, never add)
    ├── views/                   # generic renderers, no algebra-specific logic
    │   ├── conceptPicker.js
    │   ├── interestPicker.js
    │   ├── scenario.js
    │   ├── formula.js
    │   ├── table.js
    │   ├── flowView.js          # draws the current worksheet step
    │   ├── graph.js             # graphs, small graphs, number lines; the only file that uses JSXGraph
    │   └── mathRender.js        # the only file that uses KaTeX
    └── data/
        ├── interests.js
        └── sampleScenarios.js   # fake "AI output" per interest: labels, units, story text
```

## How it fits together

```
pick interest ──► concept.generateParams() ──► validator ──► state.params
                                                                  │
            ┌──────────────┬──────────────┬──────────────┬────────┘
            ▼              ▼              ▼              ▼
        scenario        formula         table          graph (+ number line)
            │              │                              │
            └──── mathRender.js (KaTeX) ──┘                 graph.js (JSXGraph)
```

Whenever params change, `main.js` updates `state` and calls every view's render function. All views read the same `state.params`, so the story, formula, table, and graph always agree.

## Adding a new concept

1. Create a module such as `js/concepts/physics/constantVelocity.js` that follows the same interface as `linearEquation.js` (`id`, `subject`, `representations`, `constraints`, `generateParams`, `validate`, `evaluate`, `formulaText`, `formulaLatex`).
2. Import it in `js/core/conceptRegistry.js` and add it to the list.
3. Add scenarios for it in `js/data/sampleScenarios.js` under its `id`.
4. Optional: give it a guided worksheet by writing a flow in `js/flows/` (see `linearFlow.js`) and setting `flow:` on the concept. Without one, the concept uses the all-at-once page.

No changes are needed in `core/` (besides the registry) or `views/`.
