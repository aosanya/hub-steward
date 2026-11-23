# Console: designed and generated workflows (ISS-124)

Status, 2026-11-23: mockups drawn, console not built. Every screen below is Proposed: the console shows neither group, no generated workflow and no check at Publish. The console change is a later issue.

Source: IAS owner decisions 15 and 16 (2026-11-22). An agency has two kinds of workflow.

- Designed workflows are written in the agency file and edited in the console as today.
- Generated workflows are made by the platform from the records. Every record has `<record code>.add`, `<record code>.edit` and `<record code>.delete`, one `fill_form` step each with `row_record` and `row_action` (the step fields of [step-rows.md](step-rows.md)). The step is held by the record's adding role. The form is the record's questions, or Why is it removed for Delete. They are always in the agency, are never edited by hand, and a designed workflow may run one through a `run_workflow` step. An agency cannot be published without them.

The example is a lab with two records, Tenders (RC-1) and Projects (RC-2), and three designed workflows: Tender pipeline, Register a project and Close a project. The names are invented and only show the shape.

## The screens

| # | Screen | File | What it shows |
|---|---|---|---|
| 1 | Workflows, Generated | [workflows-generated.html](mockups/console/agency/workflows/workflows-generated.html) | One screen, the Generated sub-menu of Workflows: a table with the workflow and its code, the record, the action, the role that holds it and Read-only, with Open and no Actions menu. |
| 1b | Workflows, Designed | ninth screen of [workflows.html](mockups/console/agency/workflows/workflows.html) | Proposed, after the eight screens of the console as built: the Designed sub-menu with three designed workflows as cards (Edit and Remove stay), where Tender pipeline lists the generated workflows it runs under Runs. |
| 2 | A generated workflow | [workflow-generated.html](mockups/console/agency/workflows/workflow-generated.html) | Two screens, Add a tender and Delete a project. A Workflow card: code, Generated and Read-only, Generated from with a link to the record, Held by, Used by with a link to the designed workflow, and the line Changes when the record changes. Then its one step: Fill a form, the actor, Row record with a link, Row action, the form and its questions. Delete shows the form Why is it removed. No Edit button. |
| 3 | A designed workflow that runs one | third screen of [workflow-canvas.html](mockups/console/agency/workflows/workflow-canvas.html) | Tender pipeline on the canvas. Record the tender and Record the decision are run another workflow steps drawn like the other steps, with a dashed outline, the line Runs: Add a tender, the code and a Generated, read-only mark. Each node opens the generated workflow. |
| 4 | Publish check | [publish-generated.html](mockups/console/agency/publish/publish-generated.html) | A Generated workflows table with one row per record and a cell each for Add, Edit and Delete, and a count, six of six. The passing screen has all cells present. The refused screen has a red line naming the record and the workflow, Record Projects (RC-2) has no generated workflow RC-2.delete, with Open the record, and the same cell marked missing, five of six. Publish stays on and nothing is published. |
| 5 | Record page | [records.html](mockups/console/work/records.html) | The console's Records page (the list, then a record open with its rows and Add a row) with a card, Workflows generated from this record, listing the three workflows: action, role, state and Open. The third screen shows a Replaced Add and a Missing Delete. |

## Wording

- Workflows in the side menu has two sub-menus, Designed and Generated, and no switch. Designed is the existing Workflows page and the one tapping Workflows lands on; the workflow detail pages stay under Designed, and a generated workflow's page stays under Generated. The console menu has neither sub-menu, so both are Proposed.
- Group names are Designed and Generated. The word on a generated row is Read-only.
- A record's page is the Records page of the Generated menu group, which the Lab and Riders menus already have; `menu.js` gained the Records row the console already has. The Records page is not in the Farmers menu, so the farmers' agency would need another home for the card.
- Held by is the record's adding role for all three actions unless the record names another role.

## Not decided, drawn so the owner can look at it

1. A record may have its own Edit and Delete role (default: the adding role). Drawn on Projects: Delete is held by the Programme lead, Add and Edit by the Project officer. Delete a project's page says so.
2. A generated Add can be hidden when a designed workflow replaces it. Drawn on Add a project: Replaced by Register a project, on the list and on the record page. The generated workflow stays in the agency, so the Publish check is still met.
3. How a missing generated workflow is made again. The refused screen links to the record and does not draw a repair button. The platform makes the three with the record, so a missing one means a draft that was imported or edited without them.
4. Whether the Add a row button leaves the record page now that Add is a workflow (decision 15). The mockup keeps the console's button.

## Checks

`check-links.mjs` and `check-pages.mjs` in `mockups/console/` pass for the files touched. `check-menu.mjs` reports `workflows-designed` and `workflows-generated` as missing from `menu.ts` and `i18n.json`, and `children` of `workflows`, because the sub-menus are Proposed; it passes again when the console has them. `check-links.mjs` still reports the `aside.chat` blocks of `function-formula.html`, `chat.html` and `settings/model-edit.html`, which were there before and are static chat blocks by design.
