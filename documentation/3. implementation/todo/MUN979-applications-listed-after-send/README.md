# MUN979 applications.spec: the form is still listed after Back to forms

Test: `code/console/e2e/menu-live/applications.spec.ts`, "a person posts a form and answers it from Home, Services & Permits, Applications". Failed in 2 of 5 runs of MUN973 at the last assertion.

## Cause

Not a leftover form and not a missing refetch.

- Leftovers ruled out: every `04-applications Street permit application` form in the QA database is closed (25 in agycdf89a40, 6 in agycd39e5a9); the waiting list only lists open forms.
- Refetch ruled out: `FormsPage` loads the waiting list again every time it mounts.
- The waiting list keeps a form the person has answered and draws it with a `Sent` chip (`waiting_impl.go` sets `answered`, `FormsPage.tsx` draws the chip). After Back to forms the form is correctly still listed.
- The old assertion, `getByText(formTitle)` with `toHaveCount(0)`, passed only while the list still showed `Loading forms` and no row was drawn. The kept screenshot `07-waiting-after-send.png` of a passing run shows exactly that card. When the list loaded before the first poll (runs 3 and 4) the row was there and the assertion failed.

## Change

The assertion now waits for `Loading forms` to be gone and then expects the form's row to be listed with its `Sent` chip. Only `applications.spec.ts` changed; the app is as designed.

## Result

Five runs alone in a row, each under the run lock: 5 of 5 passed (2.2 to 2.7 s).

## Commit

`applications.spec.ts` is untracked in git (written by another session), so the change is not committed; this README is the only committed file.
