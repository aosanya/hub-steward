# Write an agency

How to author an agency template like the eight in [demo](../../../demo): what the file holds, what the importer reads, what the console needs to start from it, and what to expect when it does not fit. Everything below comes from the files named beside it. The Siaya lab ([demo/siaya-lab/agency.json](../../../demo/siaya-lab/agency.json)) is the worked example because it is the smallest: three roles, four goals, five workflows.

## The file

A template is one JSON document, posted to `POST /instances/import` by the console's Create Hub page or by hand ([Load the demo agencies](load-demo-agencies.md)). The API decodes it into `importRequest` in `code/wakala-api/internal/api/http/instance_import.go`. These top-level keys are read:

| Key | What it becomes |
|---|---|
| `name`, `agency.name`, `agency.description` | The agency's name (required: an empty name answers 400) and its purpose |
| `_template.archetype` | The agency's kind |
| `roles` | Roles with `name`, `description` and `permissions` |
| `goals`, `objectives` | Goals, and objectives that point at a goal with `goal_id` |
| `workflows`, `work_items`, `workflow_objectives` | Workflows, their steps, and which objectives a workflow serves |
| `role_assignments` | Who is `responsible`, `accountable` or `informed` on a step |
| `values`, `rules`, `value_attachments`, `rule_attachments`, `controls`, `control_attachments` | Rules and values are imported as controls (`instance_import_controls.go`); attachments tie one to a role, goal, objective, workflow or work item |
| `modules` | Which modules to switch on |
| `records`, `risks`, `risk_pathways` | Standing forms for a workflow, and the risk library |

The type has no field for `objective_modules`, `work_plans`, `drafts`, `publications`, `levels` or `departments`. Several templates carry them (Siaya has `objective_modules`; the grid, freight and mobile money templates have `levels` and `departments`), and the import does not use them.

Everything is imported into one open draft described as "Imported from" followed by the agency's name, so nothing is live until it is reviewed and published ([Design an agency](../../1.%20requirements/user-journeys/26-design-an-agency/README.md)).

References between sections use an `id` or a `code` (`G-1`, `O-1`, `R-3`, `W-1`, `WI-1`, `RU-1`); the importer mints new ids and resolves both. A repeated id or code inside a section is refused with 400 (`instance_import_references.go`). A reference that resolves to nothing does not stop the import: that row is skipped and reported in `errors` in the `201` answer, beside the `created` counts. The limits are a 4 MiB body (`maxImportBytes`) and 1000 entities (`throttle.MaxImportEntities`).

## Roles and permissions

A role is a name, a description and a list of permission names. The names come from `code/wakala-api/modules/agency/models/permissions_catalog.json`, which lists 74, for example `chat.post`, `group.join`, `form.send`, `document.search`, `risk.read` and `ai.use`. In Siaya:

| Code | Role | Permissions |
|---|---|---|
| R-1 | Lab manager | `chat.archive`, `group.join`, `mount.list` (held by a person) |
| R-2 | Member | the same three |
| R-3 | Hub Steward | eleven, including `ai.use`, `chat.post`, `document.search`, `form.compose`, `risk.read` |

`ai.use` is what makes a role an AI role: the console treats a role as an agent when it holds that permission (`code/console/src/data/pages/agents.ts`). The importer carries the role's description as written. R-3's description is where Siaya says what the agent does and that it never approves its own drafts.

## Goals, objectives, workflows and steps

Siaya has four goals, each with objectives (O-1 "Turn an access request into a set-up member" under G-1), and five workflows: Access request, Seat booking, Answering in the chat, Network watch and Join a group. Each step (`work_items`) names its `workflow_id`, an `objective_id`, a `title` and a `prompt`. A step may carry a `kind`, one of `fill_form`, `send_form`, `notify`, `yes_no`, `route`, `run_workflow` or `chat` (`workitemstep.go`); the other fields in `importWorkItem` (`role_id`, `form_name`, `questions`, `routes`, `time_limit_minutes`) belong to those kinds. Most Siaya steps have no kind; WI-9, "Join a group", is a `fill_form`. The riders' template uses `notify`, `route`, `send_form` and `yes_no` as well, and the farmers' template is the largest, with 30 workflows and 76 steps.

Rules are text only (RU-1 to RU-14 in Siaya) and are tied to an objective or a role with `rule_attachments`.

## Modules

`modules` lists module codes with `enabled`. The importer switches on a module only if it exists in the live catalog (`modules_catalog.json`), is not locked and is marked enabled; any other entry is skipped without an error. In the catalog `auth` and `actor` are enabled and locked, `comm` is enabled, and `forms`, `taskmanager`, `market`, `riskmanager`, `accounting`, `voting`, `engage`, `agency` and `git` are off until switched on. `digitaltwin`, `catalog`, `custody` and `git` have no mount, so switching them on has nothing to serve in this repository.

Modules also decide which step kinds work: `comm` carries `notify` and `chat`, and `forms` carries `fill_form`, `send_form` and `yes_no` (`step_kinds` in the catalog). Siaya enables only `comm` and `taskmanager` yet has a `fill_form` step, which the catalog ties to `forms`.

## AI roles and what Create Hub needs

The console's Create Hub runs three stages (`code/console/src/entry/hubSetup.ts`): import the template, grant the `hub-steward` service key to the agency's AI role, and create three rooms (Managers', Farmers' and Suppliers'). The second stage looks for a role holding `ai.use`, preferring one named "Hub Steward"; with no role holding it and none named "Hub Steward" it stops with "createNoRole". So a template needs an AI role to get through Create Hub:

| Template | AI roles |
|---|---|
| siaya-lab | Hub Steward |
| boda-boda-riders | Hub Steward (the riders also declare Dispatcher, Assets Keeper and Network Watcher as roles) |
| farmers | Farmers' agent, Suppliers' agent |
| the other five | none |

The three rooms are the same for every template. Giving a template its own rooms is not built.

## Documents

An agency's documents are not part of the template: the importer has no section for them. The Siaya lab's four documents (house rules, Wi-Fi guide, booking rules, opening hours) sit beside its `agency.json` in `en/`, `sw/` and `de/` ([demo/siaya-lab/README.md](../../../demo/siaya-lab/README.md)). The console's Documents page lists what an agency holds through `sources_source_list` and `sources_chunk_list` (`code/console/src/data/pages/documents.ts`), and its upload form takes a title, a language and the text ([Run the agency](../../1.%20requirements/user-journeys/12-run-the-agency/README.md)). Write each document once per language and keep the same facts in every version, so an answer does not depend on the language asked in.

## Add it to the console

1. Put the file in `code/console/public/templates/<id>.json`. The eight copies there are identical to `demo/`.
2. Add a row to `templates` in `code/console/src/entry/templates.ts` with the same `id`, a `nameKey` (a translation key), an icon and the role and goal counts.
3. Set `template` in `code/console/public/config.json` to start Create Hub on it; the repository's file says `siaya-lab`.
4. Open Create Hub, pick the template and watch the three stages. The tests for the entry pages are in `code/console/src/entry/`.

Then run the Review and Test pages on the imported agency before publishing ([Review an agency](../../1.%20requirements/user-journeys/27-review-an-agency/README.md), [Test an agency](../../1.%20requirements/user-journeys/20-test-an-agency/README.md)).

## Limits found while reading

- Only the Siaya import has a recorded result; the other seven are not recorded ([Results](../../4.%20qa/testing/02-results/README.md)).
- Five templates (freight, drone, clinical research, grid, mobile money) declare no AI role and stop at the second Create Hub stage.
- Rooms are fixed, and `objective_modules`, `levels` and `departments` are ignored on import.
- A template that names a module the catalog does not know loads without it and without an error.
- The demo agencies are illustrative: their numbers, hours and rules are not decided rules of any real organization.
