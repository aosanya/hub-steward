# MUN952 Menu live 1: Home rows follow the modules an agency has mounted

## Request

One live journey spec, `home-rows.spec.ts`, journey `01-home-rows`: against the QA hub the owner of an agency signs in, Home lists a row for each module the agency has mounted, the state is set by posting to the hub, and a screenshot is taken at each step.

## What changed

`code/console/e2e/menu-live/home-rows.spec.ts` is rewritten; before, it only read the mounts.

- It uses a throwaway agency, "01-home-rows agency", picked by name through `prepareThrowawayAgency`, because the owner `own14` holds several agencies.
- A local `mountExactly` posts a mount only when the optional modules differ from the wanted ones. The hub caps an agency at 40 drafts, open or archived, and `mountOnly` forks a draft on every call, and there is no delete tool.
- Five tests, in this order: none, actor, Settings, forms, digitaltwin.
- `afterAll` runs `cleanup(journey)` and `mountExactly([])`. The journey makes no prefixed records. The agency stays, because the hub has no delete-agency tool.

## What the hub showed

The actor module is always mounted, and `mounts.spec.ts` proves it cannot be switched off. So "no module mounted" means no optional module: Home draws Residents, Staff & Departments and Settings.

The state where Home draws nothing at all cannot be reached through the hub, and it is not faked. In that state Settings is absent, because `sectionsFor` in `code/app/src/menu/sections.ts` draws Settings only beside a module-backed section.

## Proof

Run against API 8183 and the phone app on 5181, 4 of 5 pass: no optional module, actor, Settings last and beside another section, and forms.

The digitaltwin test fails because the running QA hub still has the old catalog (commit 8478cb43, MUN971, not rebuilt): after the mount, `agency_list_mounts` returns auth, actor, comm. It needs one rerun after the hub is restarted, which will add `05-digitaltwin-mounted.png`.

The screenshots are in [the 01-home-rows folder](../../../4.%20qa/testing/03-screenshots/menu-live/01-home-rows/): `01-no-optional-module`, `02-actor-mounted`, `03-settings-beside-sections` and `04-forms-mounted`.

## More

The helper is described in [the menu live harness page](../../../4.%20qa/testing/menu-live-harness.md).

`mountOnly` in `helpers/throwawayAgency.ts` forks a draft even when nothing changes, so `05-mounts` will reach the 40 draft cap too.
