# MUN974: the mounts journey runs on a fresh throwaway agency

Split from MUN964 on 2026-11-16.

## What changed

- `code/console/e2e/menu-live/helpers/throwawayAgency.ts` exports `mountsAgencyName`, `05-mounts-2`.
- `code/console/e2e/menu-live/mounts.spec.ts` hands that name to `prepareThrowawayAgency`; the spec names no agency itself. `05-mounts` stays only as the screenshot folder.
- The QA person `own14` creates `05-mounts-2` through the helper's existing creation path the first time the journey runs, then publishes a first version with one goal and one objective.

## Why 05-mounts was left

`05-mounts` holds 40 drafts (14 open, 26 archived), which is the hub's limit per agency, so `agency_create_draft` is refused there. 13 of its 14 open drafts were forked before assetmanager was in the catalog and do not offer it. A new agency starts with a free draft budget and a first publication that offers assetmanager.

## Result

Commit d8797816. Run on 8183 and 5181 with `--grep "assetmanager|Assets & Works"`: 2 passed (5.3 s).

- mounting assetmanager adds Assets & Works: `04-assetmanager-mounted.png`
- Assets & Works opens and lists its submenus: `05-assets-and-works.png`

Both are in `documentation/4. qa/testing/03-screenshots/menu-live/05-mounts/`. `shootLive` clears the folder at the start of a run and numbers by count, so a two-test run writes 01 and 02; the files were renamed to 04 and 05 and the six others restored from HEAD. A full run of the spec writes all eight in order.

## Draft cost

After the run, `05-mounts-2` holds 1 draft (1 open, 0 archived) and 2 publications. The two tests reused the one open draft and forked nothing, so a run costs no drafts while the mounts already match; a fork costs one draft and is archived again only when the helper made it for a read.

## Left standing

The hub has no delete-agency, so `05-mounts-2` stays, as `05-mounts` does. Zöldhalom was not touched; every call ran as `own14`. The eight-test double run is MUN975.
