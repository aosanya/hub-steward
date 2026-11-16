# MUN972 MUN967 piece 1: signIn waits for the Notifications link by role in the Main navigation

## Request

`signIn` in `code/console/e2e/menu-live/helpers/live.ts` timed out after 30 s when the browser was busy, for example two live suites on one hub.

## Cause

`signIn` waited for the exact text "Notifications". After the page loads, the Notifications tab reads exactly that for only 85 to 260 ms; then the tab shows the needs-you number beside the label (`code/app/src/ui/TabBar.tsx` puts the badge inside the tab) and the exact match never holds again. Under load the window passes before the wait looks. The saved cookie jar of `own14` and the consent screen were ruled out (MUN967 Log, entries 762f97ec and 9a35479d).

## What changed

Only `signIn` in `helpers/live.ts`:

- it waits for the Main navigation's Notifications link, `getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Notifications/ })`, whose name survives the badge, or for the Agree button;
- it waits for the app's fetches to be quiet;
- only then does it check for Agree, click it, wait for the link and wait for quiet again, so a consent redirect that arrives after the tab bar is drawn is not missed;
- no fixed wait and no repeated sign-in are used.

No spec and no other helper changed.

## Proof

Run alone on the QA hub (API 8183, phone app 5181), one run each, no retries:

| Spec | Passed | Failed | Skipped |
|---|---|---|---|
| `e2e/menu-live/smoke-live.spec.ts` | 1 | 0 | 0 |
| `e2e/menu-live/home-rows.spec.ts` | 5 | 0 | 0 |

No signIn timeout. Five clean full-suite runs are MUN973.

## Commit

`858eacc6` on `dev`: menu-live signIn waits for the Notifications link by role in the Main navigation.
