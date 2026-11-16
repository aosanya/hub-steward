# MUN958 Overdue issue by back-dating

## Request

A live test cannot post an issue that is already overdue, because the file operation always sets `created_at` to now and the Overdue list only shows issues older than the answer clock.

## Choice

Option a: a test helper, `backdateRaisedItem(id, days)` in `code/console/e2e/menu-live/helpers/live.ts`, that back-dates one `03-overdue` issue in the QA database. Commit c3689361. The harness page describes it under "An overdue issue" in [menu-live-harness](../../../4.%20qa/testing/menu-live-harness.md).

## Test enabled

The test 'an issue past its answer clock is listed under Overdue with its days late' in `code/console/e2e/menu-live/overdue.spec.ts`. Commit fd2559a8.

## Result

First run on 2026-11-16 failed before it reached the app: `backdateRaisedItem` threw `expected one raised item table`, because the QA database holds one raised item table per agency (three: agycdf89a40_8bec8757_8306fa954ea8, agycd39e5a9_8bec8757_8306fa954ea8, agycd39e5a9_a8038884_8306fa954ea8, each with a `_test` twin the helper skips).

Fixed in MUN976, commit 7004b8d0: the helper lists every raised item table, counts the `03-overdue` rows with the id in each and updates only when exactly one table holds it. The id shape, whole days of at least 1 and title prefix guards are kept.

Rerun of overdue.spec.ts alone on 2026-11-16 against 8183 and 5181: two passed, one stayed fixme (the Home route, another issue). The late-issue test passes: the Overdue screen lists `03-overdue late pothole report` with `15 days late`. Screenshot: [03-overdue-with-the-late-issue.png](../../../4.%20qa/testing/03-screenshots/menu-live/03-overdue/03-overdue-with-the-late-issue.png).
