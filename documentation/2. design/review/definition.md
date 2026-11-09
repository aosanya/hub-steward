# Definition

Status
- Premise (d) is not carried out for the market: orders pin a version number, but it is always the built-in version 1 because no mount calls `UseWorkflows`; asks, yeses and quotes pin nothing (see engine.md, 2026-11-08). Open, board row HS549.
- Premise (g), rollback: moving the production channel back to a version that has a role does not restore the role's kind or seats (`definition_role_kinds.go` `SetPublicationChannel` has no sync; actor `definition-roles.md` 'Not done here'). Turned into Q130.
- The agency's content languages and each person's studio language sit in two side tables (`mwanachama-wakala-api/internal/languages/store.go`), outside the draft, so Publish does not freeze them and a rollback does not restore them; no field of the agency blueprint holds a text in another language. Turned into Q123.
- Three callers each pick "the working draft" by a different rule and nothing keeps it to one: the console takes the last open draft of an unpaged list ordered by `created_at` (`submission/code/console/src/data/draft.ts` `workingDraftOf`, `pages/workflowDesign.ts` `workingDraft`), approvals take the newest (`mwanachama-wakala-api/internal/agencies/working_draft.go`, `approvals_apply.go` `workingDraftID`), and the import takes the oldest (`instance_import.go` `importDraft`, `open[0]`). Each is look-up-then-create, and the draft table has only a plain index on `status` (`agency.blueprint.json` draft indexes), so two first edits after a publish in the same moment make two open drafts, edits land in different ones, and a publish of one leaves the other's changes unpublished and absent from "What is not published". Open; engineering: one open draft enforced by the store (a partial unique index on open, undeleted rows, or create-or-join in one transaction) and one picker. Not a question: it changes nothing a person chooses.
- A draft is never deleted and counts for ever against `MaxDraftsPerAgency = 40`, open or archived (`mwanachama-backend-agency/limits.go` `checkDraftRoom`, AG54; no delete operation in `agency.operations.json`; the console never archives, only the e2e seed does). With one standing draft the cap is not met, but every fork from a tag (a rollback followed by an edit, a scenario rerun pass) spends one slot that is never returned, and each draft holds a full copy of the definition rows, so the cap also bounds storage. Open; to watch, no build needed until a flow forks per change.
- A published version never closes its draft, and the app's `live-records` routes read the rows of the latest production version's draft, so edits made after Publish reach the app before they are published (`record_rows.go` `liveDraftOf`, `publication_impl.go` `PublishAgency`). Turned into Q98.

- The agency publication holds the whole definition as one JSON document, but the document has no sections for a step's kind, form, notify target, attachment or router rules, for records, or for scenarios (`mwanachama-backend-agency/models/agencydocument.go` lists agency, roles, goals, objectives, workflows, work items, assignments, values, rules, attachments, modules, objective modules, event flow steps). Open.
- The change hash leaves out what the document carries: a role's permissions and staff are in the document (`document.go` line 43) but not in `contentHashFor` (`publication_impl.go`), so a draft that only changes permissions is refused as "no changes". Open; build work.
- The hash includes row ids, which a fork mints fresh, so a fork republished unchanged still publishes. Open; harmless.
- `PublishAgency` reads every earlier publication in full, document included, to find the highest version, the taken tags and a matching hash (`publication_impl.go` `list[publication]`). Cost grows with versions times document size. Open (performance.md).
- Production reads the definition in one place only, `mwanachama-wakala-api/internal/api/http/module_switch.go`, which keeps just the set of modules for 30 seconds in the process. Nothing else reads the document; a run reads no definition. Closed on 2026-10-29, decision 96: the Publish page says "live within 30 seconds".
- A run keeps no version: the task manager's `workflow_run` has no version or publication column. Decision 91 says it should; decision 95 adds the version each run carries. Open as a build gap (HS300).
- `SetPublicationChannel` (go-back) looks at no run. Closed on 2026-10-29, decision 95: no run is touched, orders finish on their version.
- No scenario object exists in the agency blueprint; "a workflow cannot be removed while a scenario mirrors it" has nothing to check. The issue scan (`issue_impl.go`) checks structure, roles, permissions, work items, event flow steps and attachments only. Open.
- Whether a scenario runs against the draft: `test-run.html` proposes a test copy of the draft; the agency keeps a whole table set per agency, so a copy of the market's records is a new table set or a column on every row; not decided. Closed on 2026-10-29, decision 101 (no clock) for the clock part only; the data part is open.
- The member app must read only a published version; drafts are rows with `draft_id` in the same tables as the published rows' source, so any list that forgets the draft filter shows draft content. Open; check on build.
- Where scenario passes live: decision 82 d sends a scenario back to Not run yet when a rule or workflow it shows changes, so a pass must be stored against the draft and compared when the Publish page is drawn; `PublishAgency` cannot run scenarios itself (test-runs.md). The new objects (step fields, records, scenarios) must go into `buildDocument`, `contentHashFor` and the issue scan together, or a draft that changes only them is refused as "no changes" (see the hash bullet above). Open; build work.
- The pin and its cost: see performance.md entry 21. A published document is immutable, so it can be cached by version with no expiry. Open; engineering.
- The change hash leaves out scenarios altogether: `contentHashFor` (`publication_impl.go` lines 55 to 205) hashes goals, objectives, workflows, steps, records, event flow steps, roles, modules, measures, assignments, values and rules, and nothing from `scenario`, `scenario_actor` or `scenario_input`, although `buildDocument` carries them (`scenario_travel_impl.go` `scenarioDocuments`). A draft whose only edit is a new or changed scenario is refused as "no changes" (`ErrNoChangesDetected`), against the premise that tests are part of the definition. Build finding; open.
- Every scenario copied into a new draft, from a tag or from another draft, starts as Not run yet (`scenario_travel_impl.go` lines 27 and 111), so the publish gate (`scenario_sendback_impl.go` `checkScenarios`) forces a full rerun of every scenario before any publish, even for a typo. Turned into Q101.
- Publish builds the document with two queries per scenario (`scenarioDocuments` calls `storedActors` and `storedInputs` inside the loop), inside the publish transaction. Open (performance.md entry 25).
- Who is told for an event (18 rules, six audiences) is stored live in `agency_notification_rules` (`mwanachama-wakala-api/internal/notifyrules/store.go`), outside the draft and the published document, so a run pinned to a version cannot pin it and the Publish page cannot list a change to it. Turned into Q104.


- AGD-009 (decision 106) is in the agency module: `workflow_objective` (unique on workflow and objective, indexes draft, workflow, objective) and step-scoped `role_assignment` (unique on step, role, label) are draft objects and ride into the published document (`document.go` lines 100 and 132); the scan raises an error for a workflow with no objective (`issue_impl.go` `checkWorkflowObjectives`), and it lists every workflow, objective and link of the draft on each Publish. Document size now grows with workflows times objectives and steps times labels, small next to questions and scenarios. Mismatch with the labels: see Q110 (open). The old objective-scoped RACI rows (AG100) still block publish in databases written before AGD-009 (open on the agency board).
- A published version is never removed: `mwanachama-backend-agency/agency.operations.json` has publication tools to list, get and set the channel only, and `publication_impl.go` has no delete or prune. Each row keeps its whole document and the code sets no size limit on it, so rows pile up by one full definition per Publish, and once runs pin a version (premise d) a removal rule would also have to know which versions a run still uses. Open (engineering finding read from code, not measured; the retention rule waits on where the pin is kept). Evidence: `publication_impl.go`, `document.go`, performance.md entries 1 and 4.
- The REST import the studio posts (`mwanachama-wakala-api/internal/api/http/instance_import.go` `importRequest`, lines 170-190) has no section for scenarios, although the published document carries them (`mwanachama-backend-agency/models/agencydocument.go` line 22 `Scenarios`; `document.go` lines 243 and 520 build and apply them, and the module's own `ImportDocument` applies them). A document exported from a published version and posted back keeps its workflows and loses every test scenario and block; the decoder is lenient, so the answer is 201 with no per-entry error, and `entityCount` (`instance_import_limits.go`) counts no scenario or block, so the 1000-entity cap and the 4 MiB body cap (commit 5da089d) do not see them either. Under the premise (tests are part of the definition) a copy of an agency would silently arrive untested, and Publish waits on every scenario passing. Open; engineering: add the section, or call the module's `ImportDocument`, and count blocks in the cap. Not a question.

Log
- A measure's reading has no producer and a stored one would churn the definition: `current` on the agency `measure` is never written by agency or wakala-api (`mwanachama-backend-agency/agency.blueprint.json` line 542, `agency.operations.json` set_measure), the studio draws "Counted from the farmers in Users" with nothing behind it (agency-add-objective.html), and `contentHashFor` (`publication_impl.go` line 188) and `buildDocument` carry `current`, so a stored count would mark the draft changed on every update. Turned into Q149. Read from code, not measured.

## 2026-10-29 15:00 UTC

First definition trace: publication_impl.go, document.go, agencydocument.go, module_switch.go, the task manager blueprint. Opened the gaps above; Q80 and Q81 added.

## 2026-10-29 20:40 UTC

Added the stored-pass and pin-cache notes to the premise; no new owner question.

## 2026-10-30 06:35 UTC

Traced Manage payments read to the draft rows. Opened one gap; Q98.

## 2026-10-30 10:35 UTC

Read the publish path again with the new scenario objects in mind: hash, document, gate. Three entries; one turned into Q101.

## 2026-10-30 18:35 UTC

Traced notifyrules end to end against the premise. One gap; Q104.

## 2026-10-31 11:00 UTC

Traced AGD-009 end to end: blueprint, create and delete paths, scan, document. Both link tables have the unique index and the draft index that their queries use; no new index is needed. Duplicate check is count-then-insert inside a transaction, backed by the unique index (AG98 asks for row locks, a build item).

## 2026-10-31 12:35 UTC

Traced who creates and picks drafts (console, approvals apply, import) against the 40-draft cap and the draft blueprint. Two gaps opened, both engineering, no question.

## 2026-11-02 22:35 UTC

Traced publication retention in the agency module: no delete or prune, no document size cap. One bullet added; no question, because the rule depends on the run pin.

## 2026-11-03 04:40 UTC
Traced the languages store, its routes and the translation route against the premise. One gap opened, turned into Q123.

## 2026-11-03 22:40 UTC
Read the import caps and duplicate-key check (wakala-api 5da089d) against the published document's sections. One gap opened (scenarios are not imported nor counted); no question, build work only.

- Premise (a), the agency's name and purpose are not draft objects: `UpdateAgency` rewrites the one agency row with no draft id, the document and the change hash read that live row for every draft, a rename changes every open draft's hash, and restoring or forking from a version does not restore the name (`agency_impl.go`, `document.go` lines 30 and 290, `publication_impl.go` lines 275 to 281). Turned into Q150.

## 2026-11-04 12:35 UTC

Rollback (premise g) read for roles: the channel move does not sync role kinds. One gap opened, turned into Q130.


## 2026-11-07 06:45 UTC
Traced the studio Objectives and Add objective pages against the agency measure object, set and list tools, the document build and the change hash. One gap opened (measure reading), turned into Q149.

## 2026-11-07 08:40 UTC
Traced the studio Profile page rename against UpdateAgency, the approval apply, the document build and the change hash. One gap opened (name outside the draft), turned into Q150. Also noted: PublishAgency loads every earlier publication row, document included, to compare hashes (`publication_impl.go` line 411), already covered by the retention entry in performance.md.

## 2026-11-08 UTC (market orders, quotes, asks)
Premise (d) checked against the market: the pin exists on the order and group order rows and is read by the gate, but the published source is not wired, so the pin is not a published version of the agency definition.
