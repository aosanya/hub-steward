# MUN958 Overdue issue by back-dating

## Request

A live test cannot post an issue that is already overdue, because the file operation always sets `created_at` to now and the Overdue list only shows issues older than the answer clock.

## Choice

Option a: a test helper, `backdateRaisedItem(id, days)` in `code/console/e2e/menu-live/helpers/live.ts`, that back-dates one `03-overdue` issue in the QA database. Commit c3689361. The harness page describes it under "An overdue issue" in [menu-live-harness](../../../4.%20qa/testing/menu-live-harness.md).

## Test enabled

The test 'an issue past its answer clock is listed under Overdue with its days late' in `code/console/e2e/menu-live/overdue.spec.ts`. Commit fd2559a8.

## Result

Run of overdue.spec.ts alone on 2026-11-16 against 8183 and 5181 after MUN970: one test passed, one stayed fixme (the Home route, another issue), and the late-issue test failed before it reached the app. `backdateRaisedItem` threw `expected one raised item table in /tmp/hubsteward-qa/hub.db`, because the QA database now holds one raised item table per agency (three: agycdf89a40_8bec8757_8306fa954ea8, agycd39e5a9_8bec8757_8306fa954ea8, agycd39e5a9_a8038884_8306fa954ea8, each with a `_test` twin that the helper already skips). The helper assumes a single agency.

Not done: the Overdue screen was not reached, so what the page shows with a 15 days late row is still unrecorded and no PNG was saved for it. The fix is inside `helpers/live.ts`: look the id up in each raised item table and update the one that holds it. That file was out of this run's scope, so the issue goes back to to-do tagged Blocked.
