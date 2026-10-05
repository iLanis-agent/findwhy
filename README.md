# FindWhy

Type a GNU `find` expression and see how it is grouped, what it prints on a demo tree, and why each path was or was not printed.

- `app.html` the tool, `index.html` the landing page, `engine.js` parser + evaluator (no dependencies)
- `test-engine.js` + `oracle.py` compare the engine with real GNU find 4.8.0 on random expressions (`node test-engine.js SEED N`; `tree.json` is the demo tree)

Supports `-name -iname -path -ipath -type -empty -true -false -print -print0 -prune -maxdepth -mindepth`, `!`/`-not`, `-a`, `-o`, parentheses, shell-style quoting.

Tests: 60,000 random expressions (6 seeds). 58,284 identical, 1,569 rejected by both, 147 differ, all containing `-print` or `-prune` among other tests (GNU find reorders such expressions; the app shows documented left-to-right evaluation). 0 differences among 35,582 expressions without them.
Not covered: -exec, -delete, -size, -mtime, -regex, -depth. Output is sorted.
