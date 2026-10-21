# Phone app tests

The phone app in `code/app`, tested and built on 2026-11-04. Dependencies were already installed in `code/app/node_modules`, so `npm ci` was not run. No server, no key and no network were used.

## What was run

| Step | Command (in `code/app`) | Result |
|---|---|---|
| Test | `npm test` (runs `vitest run`) | Exit 0 |
| Build | `npm run build` (runs `tsc --noEmit && vite build`) | Exit 0; 198 modules transformed; `dist/` written |

Node 22.14.0. The test run took about 36 seconds.

## Counts

| Measure | Count |
|---|---|
| Test files | 124 |
| Test files passed | 124 |
| Tests passed | 1905 |
| Tests failed | 0 |
| Tests skipped | 0 |

There are no failure lines because nothing failed.

The run printed 172 warning lines and no errors:

| Warning | Lines |
|---|---|
| React Router v7 future flag: `v7_startTransition` | 75 |
| React Router v7 future flag: `v7_relativeSplatPath` | 75 |
| "An update to TabBar inside a test was not wrapped in act(...)" | 13 |
| The same for `StartRows` and `FormsPage` | 2 each |

## What this covers of the broader agency scope

The suite answers the API with fakes (`src/journeys/answerWakala.ts` stubs `fetch`), so it checks the app's screens, routes and rules, not a running server.

| Area | Where | Covered |
|---|---|---|
| Sign in and choosing an agency | `src/entry`, `src/journeys/signInRenewal.walk.test.tsx`, `agencyPaths.walk.test.tsx` | Yes |
| Catching up: Inbox and rooms | `src/inbox`, `src/chat`, `src/journeys/catchUp.walk.test.tsx` | Yes |
| Joining a group | `src/groups`, `src/pages/join`, `src/journeys/joinGroup.walk.test.tsx` | Yes |
| Buying inputs, supplying inputs, selling the harvest, running a group order | `src/buy`, `src/supply`, `src/sell`, `src/market`, `src/coordinator`, and the four matching walk tests | Yes |
| Workflows a member starts | `src/started`, `src/pages/started`, `src/journeys/workflowsAndStarted.walk.test.tsx` | Yes |
| Answering a form | `src/forms` (two files) | Unit tests only; no walk test |
| Chat with an agent, including blocks in a thread | `src/chat`, `src/apps` | Yes |
| Sending a report | `src/home/workflowScreens.test.ts`, `src/home/StartRows.test.tsx` mention it as a workflow start | Partly; no walk test for the report journey |

Test fixtures name the farmers' agencies most ("Siaya farmers" 79 times, "Siaya Farmers' Group" 32, "Siaya Farm Stores" 20); the Siaya Community Computer Lab appears 8 times and the Siaya Boda Boda Riders 7. The lab's own steps, a seat request and the member set-up barcode, have no test named for them.

## What this does not cover

- The console (`code/console`) is not part of this run; see [Console tests](console-tests.md).
- The bundled API (`code/wakala-api`) has no test files; see [API server tests](api-tests.md).
- Nothing here ran against a real server, a real model or a real browser. Rendering is checked in jsdom.
- Agencies other than the lab and the farmers appear in no walk test.
- The warnings above are noise from the test setup and router, not failures. They were not fixed.
