# MUN967: signIn timeout in the live menu suite

MUN967 named a flaky `signIn` in `code/console/e2e/menu-live/helpers/live.ts`. The cause is in the log of MUN967: the text "Notifications" that `signIn` waited for is visible for only 85 to 260 ms after the page loads, because the tab then shows the needs-you number beside the label and an exact text match stops matching. The fix is MUN972, commit `858eacc6` on `dev`: `signIn` waits for the link named "Notifications" inside the navigation named "Main", waits for the app's fetches to be quiet, and only then checks for Agree.

The issue was split in two pieces. MUN972 made the change. MUN973 ran the whole live suite five times in a row, alone, to see whether a timeout at `signIn` still happens.

## Five runs (MUN973, 2026-11-16)

Command, from `code/console`: `E2E_BASE_URL=http://127.0.0.1:5181 npx playwright test e2e/menu-live`, one run after the other, with no other `playwright test` running before each run. 37 tests per run.

| Run | Passed | Failed | Skipped | Time | Timeout at signIn |
|---|---|---|---|---|---|
| 1 | 18 | 13 | 6 | 6.9 min | none |
| 2 | 18 | 13 | 6 | 4.9 min | none |
| 3 | 17 | 14 | 6 | 5.1 min | none |
| 4 | 17 | 14 | 6 | 5.1 min | none |
| 5 | 14 | 11 | 5 | 4.4 min | none |

No run failed at the "Agree", "Start" or "Notifications" wait. The done-when of MUN973 holds. The suite itself is not green, and the failures below are not about sign-in.

During runs 3 to 5 the agents of MUN958 and MUN974 edited `overdue.spec.ts`, `live.ts`, `mounts.spec.ts` and `throwawayAgency.ts` in the same tree, so the spec set changed between run 4 and run 5. `applications.spec.ts` and `section-screens.spec.ts` carried uncommitted changes from another session and ran as they were.

## Failures that are not signIn

| Test | Runs | Error | Where it goes |
|---|---|---|---|
| `mounts.spec.ts` assetmanager mount, Assets & Works submenus, unmount every module | 1 to 4 | `agency_create_draft: limit exceeded: an agency may hold at most 40 drafts` | MUN964, known, not filed again |
| `mounts.spec.ts` actor-only Home | 5 | `no agency named 05-mounts-2` | MUN974 landing in the shared tree, MUN964's family, not filed |
| `overdue.spec.ts` an issue past its answer clock is listed | 5 | `backdateRaisedItem: expected one raised item table in /tmp/hubsteward-qa/hub.db` | MUN958's work in progress, not filed |
| `section-screens.spec.ts` nine tests | 1 to 5 | `toHaveURL` timeout, page one section behind, on /notifications or /files; `Back from a section returns to Home` throws `Cannot read properties of undefined (reading 'replace')` | filed as MUN977 |
| `overdue.spec.ts` does not list an issue raised just now | 1 to 4 | `forms_catalog_raised_item_raise: agencies: instance not found` | filed as MUN978 |
| `applications.spec.ts` posts a form and answers it | 3, 4 | form still listed after Back to forms (`toHaveCount(0)`, received 1) | filed as MUN979 |

The screenshots of every failing test and the full logs are kept in the scratchpad folder `mun973` (`run1.log` to `run5.log`, `run1-results` to `run5-results`).

## Commit

The signIn change: `858eacc6` (MUN972), documented in `../MUN972-signin-waits-by-role/README.md`.
