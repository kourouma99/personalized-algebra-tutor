# Tests

```
npm install         # once: installs Express and the test tools (jsdom, JSXGraph, KaTeX)
npm test            # fast suite, about 20 seconds
npm run test:real   # optional: the page with the real JSXGraph and KaTeX, about 25 seconds
```

`npm test` exits with an error if anything fails, and prints the end of the failing test's output.
Every test file runs in its own Node process (`tests/run.mjs`), several at a time.

## What `npm test` runs

| File | What it checks |
|---|---|
| `logic/linear.test.mjs` | Linear flow: every answer comes from `evaluate()`; table, slope, the three Represent formats (write / choose / both) and their wrong options; Solve (big x for rising lines, reverse "when will it reach …?" for falling lines); Explain; Transfer with fractions; hints (two per item, sign-aware wording, never "add −N"); engine rules: hints on request, Show answer only after both hints, skip, auto-fill, re-answering, logging |
| `logic/exponential.test.mjs` | Exponential flow: the same rules; the multiplier question; hints only multiply/divide; the four graph options (correct, a/b swapped, straight-line look-alike, 1/b) |
| `logic/quadratic.test.mjs` | Quadratic flow: the symmetric table (x = h-1 and h+1 given; h, 0 and 2h to find), the turning point, the three-box equation, four clearly different graphs (correct, a with the wrong sign, h with the wrong sign, k ignored) for every allowed (a, h, k), the reverse Solve question (back at the start, or a target that gives a whole x), Transfer and why f(h + 2) = f(h - 2), hints, and that every step can be finished |
| `logic/graphReading.test.mjs` | The Solve graph-reading item (linear + exponential): highlighted answer point, the zoomed-in graph's grid step = the tolerance (half a step), when the graph and the item appear |
| `page/linear.page.mjs` | The real page in jsdom (KaTeX and JSXGraph replaced by small stand-ins): a full linear walkthrough by clicking and typing |
| `page/exponential.page.mjs` | The same for exponential |
| `page/quadratic.page.mjs` | A full quadratic walkthrough (guided story, symmetric table, three-box equation, four graphs, Solve and the zoomed graph, Transfer), every interest and many new scenarios, and the all-at-once page with no step bar for a concept without a flow; fails on **any** page error |
| `page/devMode.page.mjs on` | With `?dev=1`: every step is clickable, and Auto-answer completes every step of every guided concept (linear, exponential, quadratic) |
| `page/devMode.page.mjs off` | Without `?dev=1`: no dev buttons, normal step bar |

## What `npm run test:real` runs

| File | What it checks |
|---|---|
| `real/graph.real.mjs` | `graph.js` with the real JSXGraph 1.10.1: hover points, the wide view with the highlighted answer, the zoomed-in reading graph's grid step |
| `real/page.real.mjs` | The whole page with the real JSXGraph and KaTeX 0.16.11, every concept, no errors; also the all-at-once page for a concept without a flow |
| `real/page.real.mjs ?dev=1` | Also leaves each guided flow from every step (answered or not) to Quadratic |

These versions are pinned in `package.json` to match the CDN links in `index.html`. If you update a library there, update it in `package.json` too.

## Counts (random runs)

Most checks use randomly generated scenarios, so each run tries different numbers.

| Setting | Default | Meaning |
|---|---|---|
| `TEST_RUNS` | 400 | random scenarios per logic test (linear and exponential tests also try every valid parameter combination where that is small) |
| `PAGE_RUNS` | 2 | how many times each random page walkthrough repeats |
| dev mode | 3 | rounds of Auto-answer per guided concept |

With the defaults, one `npm test` run does about 42,000 linear, 52,000 exponential, 47,000 quadratic and 20,000 graph-reading checks. For a deeper check before an important change (about 30 seconds):

```
TEST_RUNS=3000 PAGE_RUNS=20 npm test
```

On Windows PowerShell: `$env:TEST_RUNS=3000; $env:PAGE_RUNS=20; npm test`
