# QA harness

Dev-only. Nothing here ships to the browser.

Setup once: `npm install` then `npx playwright install chromium`.

The fonts come from the `@fontsource` packages and are served locally, so measurements use the real typefaces without network access.

| Script | What it does |
|---|---|
| `node qa/shots.mjs --label=new` | Screenshots: 2 languages x 2 themes x 2 viewports x 8 states = 64 PNGs in `qa/out/<label>/`. Add `--compare` to build side-by-side grids against `qa/baseline/shots/` |
| `node qa/measure.mjs --label=new [--assert]` | Pill, row and search-field metrics into `qa/out/<label>/metrics.json`. `--assert` checks the targets and exits non-zero on a miss. Options: `--dpr=1,2,3`, `--density=cozy,compact`, `--viewport=mobile|all` |
| `node qa/behavior.mjs [--mode=both] [--only=text]` | Keyboard and flow tests in Arabic and English, over http and optionally `file://` |
| `node qa/perf.mjs [--fixture=big-1500] [--enforce]` | Typing, scrolling and sheet timings at 4x CPU slowdown on a generated fixture |
| `node tools/bench.js [--enforce]` | Search index and query timings on the real data and two generated fixtures |
| `node tools/lint.js` | No comments, no `console.log` outside `F.perf`, no `debugger` |

`qa/baseline/` holds the 5.0.1 numbers (`metrics.json`, `bench.txt`, `perf.txt`). The 64 baseline PNGs are not committed; `qa/baseline/shots/` is ignored by git.

Generated fixtures: `node tools/fixtures/make-big.js` writes `big-500.json` and `big-1500.json` from a fixed seed. They are ignored by git.
