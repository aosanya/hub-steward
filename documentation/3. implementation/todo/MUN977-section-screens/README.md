# MUN977: section-screens opened the wrong screen after a Home click

## Cause

`openSection` in `code/console/e2e/menu-live/section-screens.spec.ts` found the Home row of a section as the title at `titles.indexOf("Backlogs") + 1 + position`. The test hub (`own14`) has no Backlogs row, so `indexOf` returned -1 and the base was 0. The Home `.ttl` list on that hub, read live and stable at 0, 3 and 8 seconds (so not a timing race), was:

`You have 6 things to do`, `Files`, `Residents`, `Issues & Requests`, `Services & Permits`, `Staff & Departments`, `Settings`, `New form` ...

The sections shown are Residents, Issues, Services, Staff and Settings. Position 0 therefore clicked "You have 6 things to do" (`/notifications#needs-you`), 1 clicked Files (`/files`), 2 clicked Residents, 3 Issues and 4 Services, which are the one-section-behind addresses in the five MUN973 runs. Finance is not shown on this hub, so its position was -1 and the title was undefined (the `replace` TypeError in "Back from a section returns to Home").

The app's Home is correct; the fault was in the spec.

## Change

- `openSection` takes the Settings row as the anchor (every hub shows it last and it is never renamed) and counts back over the shown sections. It throws when the section is not shown.
- "Back from a section returns to Home" opens the first shown section instead of Finance.

## Proof

The spec alone, twice in a row: 11 passed, 4 skipped (Properties, Assets, Council and Finance: modules not mounted on this hub), 0 failed.

Commit `ce0dd8a2` on `dev`. It carries the whole uncommitted rewrite of the spec that was already in the tree, because the spec cannot pass without it.
