# Console tests

Run on 2026-11-04 in `code/console`, with the dependencies already installed (no `npm ci` was needed). Each command was run once.

| Command | Result |
|---|---|
| `npm test` (`vitest run`) | 251 test files passed, 3640 tests passed, 0 failed. Vitest reported no skipped tests. Between 35 and 55 seconds across runs. |
| `npm run build` (`tsc --noEmit && vite build`) | Passed. The type check is clean and 497 modules were built. Vite warns that the main script is 614 kB, over its 500 kB limit; it does not fail the build. |

No test failed, so there are no failure lines to quote. Both runs print React Router future-flag warnings on stderr; they do not affect the result.

## What the tests cover

The tests run in jsdom against fakes, with no network and no API server.

| Area | Test files | What they hold |
|---|---|---|
| `src/pages` | 120 | Console pages: review, test, publish, usage, work, spec |
| `src/data` | 76 | Page data, chat pages, permissions, workflows and the hub kind |
| `src/shell` | 31 | Menu, tabs, first paint and the shell around every page |
| `src/ui` | 10 | The shared components |
| `src/entry` | 5 | Sign-in, creating a hub, importing an agency file |
| `src/journeys` | 4 | Walks named for adding a model, changing a rule, and seeing where the tokens go |
| `src/wakala` | 3 | The REST client and its configuration |
| `src` root | 2 | Session handling, and the interface-language files |

## What they do not cover

- The browser end-to-end specs in `e2e` (`group-order`, `review-an-agency`, `test-an-agency`) are Playwright specs and were not run here: `npm test` does not include them.
- No test talks to the API server. The server's side of any journey is untested by this suite.
- Only the three walks named above run a journey from start to end. The other console journeys are covered page by page, or by the e2e specs, not by a walk in this suite.
- The phone app (`code/app`) has its own suite, which is not part of this result.
- The suite does not exercise the lab's own flow: no test books a seat, or approves a Wi-Fi request. Nothing in this suite is written per demo agency; which tests touch the other seven agencies' templates was not checked.
