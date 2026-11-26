# Rules view walk

Walk of the Rules, Decisions and Questions views of a backlog (issue ISS-246, todo TD-6569), run on 2026-11-25.

## What this walk is

This is not a browser walk. No browser tool was available to the walking agent, and the app on `localhost:5191` needs a signed-in session: the hub on `localhost:8092` answers `401` to an unsigned call. The session belongs to the owner's own browser, and no token or cookie was used or read. So the steps were walked as component tests against the real hub reply shapes, which were read through the hub's own read tools.

| What | How |
| --- | --- |
| Real reply shapes | `taskmanager_backlog_rules_list`, `taskmanager_backlog_questions_list`, `taskmanager_rule_list`, `taskmanager_rule_read`, `taskmanager_rule_file_list`, `taskmanager_rule_issue_list` on the agency of the walk, backlog `decisions-and-rules` |
| App behaviour | `npx vitest run src/features/backlogs/rulebook src/features/backlogs/board/viewSwitch.test.tsx` (17 files, 222 tests, all passed) and `src/features/backlogs/book src/features/backlogs/walks` (17 files, 159 tests passed, 14 todo) |

Because no step was walked in a browser, TD-6569 stays open.

## Live data the steps were checked against

| Item | Value read from the hub |
| --- | --- |
| Backlog `decisions-and-rules` | 32 issues |
| Rules that bear on it (default statuses) | 15 rules: R-1 to R-13, R-16 and R-30, all In force |
| Questions that bear on it (default status Open) | none |
| R-30 | "Update the translation files with every wording change so they stay in sync", In force, tags `app` and `languages`; the body names `Approval: D-32` as plain text |
| R-30 file links | two: `code/console/src/i18nFiles.test.ts` and `documentation/3. implementation/guides/languages.md`, both repo `hub-steward`, neither flagged missing |
| R-30 linked issues | none |
| D-32 | Decided, tags `app` and `languages`, decided by the owner on 2026-11-25 |
| Words "translation" in the text of the 15 rules | only R-30 carries it |

## Steps

| # | Step | Expected | Seen | Pass / fail |
| --- | --- | --- | --- | --- |
| 1 | Open the board of the backlog | The switch shows five choices: List, Board, Rules, Decisions, Questions | Not walked in a browser. Component test `ViewSwitch` offers exactly those five, in that order, when the viewer holds `rule.read`, and List and Board only without it. | Not walked; component test passes |
| 2 | Open Rules | One table, header row Code, Title, Status, Tags, one row per rule, no cards or row buttons between rows | Not walked in a browser. Component tests "is one table", "orders the columns", "draws no card, no list row and no row button" pass. A visual check for gaps between rows was not possible in a test renderer. | Not walked; no gaps not confirmed visually |
| 3 | Rules list on live data | 15 rules, In force and Proposed chips on, a search box | Not walked in a browser. Component tests for the chips and the search box pass; the live list holds 15 rules, all In force. | Not walked; component test passes |
| 4 | Type `translation` in the search | Only R-30 stays; the count reads 1 rule | Not walked in a browser. Search is client side over code, title, body and tags (`search.ts`); of the 15 live rules only R-30 contains the word, so the narrowed list is R-30 alone. | Not walked; result derived from live data and the search code |
| 5 | Open R-30, Details | A Details section with status In force and tags app and languages | Not walked in a browser. Component test "shows its title, code and kind, status, tags and body" passes. | Not walked; component test passes |
| 6 | Open R-30, Why shows approval D-32 as a row | A Why section with a row for D-32 | Fails against live data in the code read. The Why row comes from an issue linked to the rule with the relation `decided_in`. R-30 has no linked issue, so the app shows the Why section with the body text, where `Approval: D-32` is plain text and not a row that opens D-32. | Fail (found by reading live data against the code) |
| 7 | Open R-30, its two file links | Two file links under References, repo `hub-steward`, none marked missing | Not walked in a browser. Component tests for the closed References card, for a file with its repo and main, and for opening a file in the Files folder named like its repo pass. The folder named `hub-steward` was not checked in the live app. | Not walked; component test passes |
| 8 | Decisions list | The decisions that bear on the backlog under Decided and Proposed, one table | Not walked in a browser. The test for the `decision` kind asks for Decided and Proposed and marks Decisions pressed. The live read of `taskmanager_rule_list` for decisions returned D-1 to D-32 with gaps; the backlog-scoped list was not read. | Not walked; component test passes |
| 9 | Questions list | No open question bears on the backlog, so the list says nothing bears on it | Not walked in a browser. Live read returned no items; the test "says what is empty for the kind" passes. | Not walked; component test passes |
| 10 | Back from a record keeps the search and status chips | Returning from R-30 shows the list with `translation` in the search box and the same chips | Not walked in a browser. Component tests check that the search text and the statuses are written into the address and passed as the way back from a record (`backTo`). The return itself in a real browser history was not checked. | Not walked; component test passes |
| 11 | The Book button | A Book button opens the book of rules | Not found. The route `/a/:agencyId/backlogs/book` and its page exist and their tests pass, but no screen in the app links to it: `bookPath` is not used outside the book folder. So there is no button to press. | Fail (no entry point), or not yet built |

## What remains

1. Walk steps 1 to 5 and 7 to 10 in the owner's signed-in browser at `localhost:5191`, and check the gaps between rows in step 2 by eye.
2. Decide step 6: either link the approval named in the body to its decision, or record the approval with the issue relation `decided_in` for R-30, so the Why row shows D-32.
3. Decide step 11: add the Book button where the owner wants it, or take the step out of the walk.

TD-6569 is left open.
