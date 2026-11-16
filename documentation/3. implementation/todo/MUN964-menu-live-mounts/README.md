# MUN964: the mounts journey on the live QA hub

Split into MUN974 (a fresh throwaway agency) and MUN975 (two full runs in a row and the draft budget) on 2026-11-16.

## Result

`code/console/e2e/menu-live/mounts.spec.ts` passes all 8 tests, twice in a row, on 8183 and 5181 (8 passed, 0 failed, 7.4 s and 8.2 s), whole file each time. The journey runs as the QA person `own14` on the throwaway agency `05-mounts-2`.

No code changed for MUN975: `mountOnly` in `code/console/e2e/menu-live/helpers/throwawayAgency.ts` already returns without a draft when the mounted optional modules match, tries the open drafts, and forks only when none can publish.

## What a run costs

| Moment | Drafts | Open | Archived | Publications |
|---|---|---|---|---|
| before run 1 | 1 | 1 | 0 | 2 |
| after run 1 | 3 | 3 | 0 | 8 |
| after run 2 | 4 | 4 | 0 | 13 |

A run costs 1 to 2 drafts and 5 to 6 publications. The hub allows 40 drafts per agency (open and archived together), so 36 are left; when `05-mounts-2` reaches the cap the next agency is created by the same helper path under a new name.

## Screenshots

The whole-file run clears `documentation/4. qa/testing/03-screenshots/menu-live/05-mounts/` and writes `01` to `08` in order, so only whole-file runs keep all eight PNGs. They are committed.

## Left standing

The hub has no delete-agency, so `05-mounts` (at the cap, unused) and `05-mounts-2` stay. Zöldhalom was not touched.
