# Menu sections and the modules behind them

Checked 15 November 2026 (issue MUN883).

The app menu draws each section only for an agency that mounts the section's module. This page compares the module code each section names with the real catalog and with what the municipality demo mounts.

Sources compared:

- Menu sections: `code/app/src/menu/sections.ts`
- The real catalog: `models/modules_catalog.json` in mwanachama-backend-agency. Codes: auth, git, taskmanager, agency, actor, comm, custody, forms, digitaltwin, accounting, catalog, voting, engage, market, riskmanager.
- The municipality demo: `demo/municipality.json`. Mounts auth, git, taskmanager, agency, actor, comm, custody, forms, digitaltwin, accounting, catalog, voting, engage and riskmanager. Market is not mounted.

## Section codes against the catalog

| Section | Code in sections.ts | In the catalog | Mounted by the municipality demo | Result |
| --- | --- | --- | --- | --- |
| Residents | actor | yes | yes | matches |
| Properties & Addresses | digitaltwin | yes | yes | matches |
| Issues & Requests | forms | yes | yes | matches |
| Services & Permits | forms | yes | yes | matches |
| Assets & Works | assetmanager | no | no | missing module |
| Council & Decisions | voting | yes | yes | matches |
| Staff & Departments | actor | yes | yes | matches |
| Finance | accounting | yes | yes | matches |
| Settings | none | not applicable | not applicable | not applicable |

The catalog has no assetmanager module. The backend's permissions catalog names assetmanager as a module for `asset.manage`, and the hub serves `assetmanager_*` tools, but the module list has no such code.

Consequence: `sectionsFor` draws Assets & Works only for an agency whose module list contains assetmanager, so with the real catalog it never shows. The four other guessed codes (actor, digitaltwin, voting, accounting) exist in the catalog and the municipality demo mounts them.

## Tools the drawings call against the section's module

The nine drawings are `documentation/2. design/mockups/app/menu-*.html`. Every tool name drawn exists on the hub server. The question here is whether the tools belong to the module the section names.

| Section (module) | Tools drawn | Fit |
| --- | --- | --- |
| Residents, Staff & Departments, Issues & Requests, Services & Permits, Settings | Tools of their own module, or of agency, ai, comm and instance, which are mounted | fits |
| Properties & Addresses (digitaltwin) | `assetmanager_asset_list`, `assetmanager_asset_read`, `assetmanager_location_list`, `assetmanager_location_read`; no digitaltwin tool | does not fit |
| Council & Decisions (voting) | `actor_list_groups`, `actor_list_group_leaders`; no voting tool | does not fit |
| Finance (accounting) | `forms_submission_list`, `market_list_asks`, `market_list_orders`, `market_list_quotes`, `market_mark_paid`; no accounting tool, and market is not mounted by the municipality demo | does not fit |
| Assets & Works (assetmanager) | `assetmanager_asset_list`, `assetmanager_asset_read`, `assetmanager_location_list`, `assetmanager_location_read`, `assetmanager_movement_list`, `taskmanager_repeating_task_list`, `taskmanager_task_list` | module missing |

The hub serves no `digitaltwin_`, `voting_` or `accounting_` tools at all, so those three sections name a module whose tools they never call.

## Open

- Decide the module code for Assets & Works: a catalog module for assetmanager, or a mounted module that exists.
- Decide whether Properties & Addresses, Council & Decisions and Finance keep their module code or are drawn from the tools they use.

The drawings and `sections.ts` are not edited by this check.
