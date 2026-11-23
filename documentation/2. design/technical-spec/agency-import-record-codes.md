# Record codes in an agency file

Design for ISS-140 (TD-5884), for the owner to read before any test is written. Nothing here is built.

A record is named like the thing it holds, and its code is that name in lower case with an underscore for each space: `tender`, `day_worked`, `bid_decision`. A generated workflow reads the record's code, a dot and the action: `tender.add`, `tender.edit`, `tender.delete`. The dot stays, and no record code has one.

## What happens today

| Fact | Where |
|---|---|
| A record declared in the file keeps its code only when it matches `^[A-Z]{1,2}(-[A-Z]+)?-[0-9]{1,6}$` and is unique in the file. Any other code, such as `tender`, is silently replaced by the next `RC-n`, and everything in the file that quotes the old code then points at nothing | `instance_import_codes.go` |
| A form step gets a record the platform derives when the agency is published: the name is the step's title, the code is the next `RC-n` | `step_records.go` |
| A declared record is adopted by a step only when it is in the same workflow and its name equals the step's title | `step_records.go` (`recordOfStep`) |
| The file has no field for a derived record's name or code | `importWorkItem` |
| A record's code cannot change once it exists | the sibling's `record_impl.go` and its blueprint |
| The IAS file has 23 form steps, so 23 derived records (`RC-7` to `RC-29` in QA) next to the 6 declared | the ISS-140 survey |

## 1. The field a form step uses, and the adopt rule

A form step takes one new field, `record_code`: the code of the record its form writes.

| Case | What the import and the publish do |
|---|---|
| The file declares a record with that code | The step adopts it. Its role, form and questions are kept in step with the step's, as for any adopted record today |
| The file declares no record with that code | The platform derives the record with that code. Its name is the code with each underscore turned into a space and the first letter capital: `bid_decision` gives "Bid decision" |
| The step has no `record_code` | The old rule below |

The adopt rule is: **a step with a `record_code` finds its record by that code, in its own workflow, and never by name.** The old rule (same workflow, name equals the step's title) applies only to a step with no `record_code`.

The import checks these before it creates anything, and refuses with 400 naming the step:

| Check | Refused when |
|---|---|
| Format | The code does not fit the format in section 3 |
| Kind of step | The step is not a form step with a role and questions, or it also has a `row_record` |
| Workflow | The declared record with that code belongs to another workflow |
| One record per step | Two steps name the same code (section 5) |

The import creates a derived record at once, after the declared records and before the home, so that the home's `ref` and `page_of`, a workflow's `subject_record` and a record's stand-ins can name it. The scan that checks those references counts a step's `record_code` as a record the file holds. The publish then finds the record by code and creates nothing.

The 23 form steps of the IAS file, each with the code it would name (the name follows from the code):

| Step | Workflow | `record_code` | Step | Workflow | `record_code` |
|---|---|---|---|---|---|
| WI-4 | W-1 | `bid_decision` | WI-22 | W-3 | `deliverable_acceptance` |
| WI-40 | W-1 | `technical_proposal` | WI-25 | W-3 | `project_closure` |
| WI-41 | W-1 | `tender_submission_approval` | WI-29 | W-4 | `overdue_invoice_chase` |
| WI-42 | W-1 | `tender_handover` | WI-31 | W-5 | `corrective_action` |
| WI-17 | W-2 | `expert_mobilisation` | WI-32 | W-5 | `rate_card_review` |
| WI-19 | W-3 | `inception_report_approval` | WI-34 | W-6 | `audit_file` |
| WI-21 | W-3 | `deliverable_review` | WI-35 | W-6 | `donor_rules_map` |
| WI-37 | W-6 | `registration_renewal` | WI-38 | W-6 | `reference_sheet` |
| WI-39 | W-6 | `research_output` | WI-44 | W-7 | `project_proposal_approval` |
| WI-46 | W-7 | `project_task_plan` | WI-47 | W-7 | `project_budget` |
| WI-48 | W-7 | `progress_report` | WI-49 | W-7 | `invoice` |
| WI-50 | W-7 | `donor_report` | | | |

The six declared records take `tender`, `client`, `donor`, `project`, `consultant` and `day_worked`. No two of the 29 codes are the same, and none is the code of a workflow.

## 2. A file without the field

| File | Result |
|---|---|
| A step with no `record_code` | The derive path is unchanged: name is the step's title, code is the next `RC-n`, adopted by workflow and name |
| A declared record with an `RC-n` code | Kept as today |
| A declared record with no code | Gets the next `RC-n` as today |
| Any file the repo holds today | Imports as before: 661 agency files were checked (the IAS, law firm, MAIIC, municipality, demo and console templates, and the mined templates under `developer/documentation/4. qa/agencies`); 13 declare records, every record code is `RC-n`, none repeats, none is empty |

## 3. The code format

| Rule | Value |
|---|---|
| Allowed | Lower-case letters, digits and single underscores, starting with a letter: `^[a-z][a-z0-9]*(_[a-z0-9]+)*$` |
| Also accepted | The `RC-n` form, `^[A-Z]{1,2}(-[A-Z]+)?-[0-9]{1,6}$`, unchanged |
| Not allowed | A dot, a hyphen, a space, a capital letter. A capital is refused, never lowered for the person |
| Longest | 48 characters. The longest proposed code is 26; a generated step adds up to nine (`.delete.1`) |
| Unique | In the whole file. A repeated record code is refused, where today the second is silently replaced |

An invalid record code is refused with 400 before anything is created, naming the record and the code, for example: `record "Tender": the code "Tender" is not valid; use lower-case letters, digits and single underscores (tender, day_worked), at most 48 characters, or the RC-n form`.

The refusal is for records only. Other parts keep today's rule, because files hold codes the pattern rejects: the Hungarian municipality file has 265 steps coded like `WI-35-1` and two objectives coded `O-54-1`, which the import replaces silently and must keep replacing. Refusing those would refuse the file.

Is the refusal safe for the files that exist? Yes: no file in the repo carries a record code the old pattern rejects (section 2). It is a change for a file written later with a record code such as `Tender`, which used to import with a code the person did not choose and now says so. An Instance already imported is not touched; the import runs only when an Instance is made.

## 4. A derived record's code across publishes

| Record | Code stays because |
|---|---|
| A step with `record_code` | The record is found by its code, so retitling the step or the record changes nothing. The step's `record_code` is set once and is not changed after the agency is published, as a record's own code is not |
| A step without it | The record is found by workflow and step title. Retitling the step in a draft derives a second record with the next `RC-n` and leaves the first with its rows. This is today's behaviour and is left as it is; naming every form step ends it |

A code cannot change on an Instance that has published versions and rows. The IAS file with the new codes goes into a fresh QA Instance, after a backup of the old one, as on 2026-11-20 and 2026-11-22.

## 5. Two steps that share a record

Today they do not. Two steps with the same title in one workflow get two records, `Check` and `Check (2)`, so that neither overwrites the other's questions, and the publish keeps a record's role, form and questions equal to its step's. This design keeps that: **one form step, one record.** Two steps naming the same `record_code` are refused with 400 naming both steps. A record belongs to one workflow, so steps of two workflows could never share one in any case. Whether two steps of one workflow should write one register is an open point.

## 6. What changes

| Where | File | Change |
|---|---|---|
| Hub, wakala-api | `internal/api/http/instance_import_codes.go` | Record format as in section 3; keep a valid record code; refuse an invalid or repeated one |
| Hub, wakala-api | `internal/api/http/instance_import.go` | `importWorkItem` gets `record_code` |
| Hub, wakala-api | `internal/api/http/instance_import_references.go` | The checks of section 1 and the record code check; a step's `record_code` counts as a record the file holds |
| Hub, wakala-api | `internal/api/http/instance_import_steps.go` | The step carries `record_code`; derived records are created after `applyRecords` |
| Hub, wakala-api | `internal/api/http/step_records.go` | Find by code when the step has one; create with the kept code; name from the code |
| Hub, wakala-api | `internal/api/http/record_rows.go` | `recordKeptByStep` finds the step by code as well as by name |
| Hub, wakala-api | `step_runs.go`, `declaration_register.go` | No change: both go through `recordOfStep` |
| Hub, wakala-api | new tests beside `instance_import_record_settings_test.go` | One red test for each refusal in sections 1 and 3, one for the adopt rule, one for an old file |
| Hub, documentation | this page, the technical spec index, `3. implementation/guides/write-an-agency.md` | The field and the format, when built |
| Sibling `mwanachama-backend-agency` | `models/workitem.go`, `models/agencydocument.go`, `document.go`, `workitem_impl.go`, `agency.blueprint.json`, `agency.operations.json` | **Must change.** A work item gets `record_code`, kept through a draft's fork and a publication, and not changed by an update once published. Without it the step cannot remember the name between the import and the publish. The hub then takes the new tag in `go.mod` |
| IAS repo, not the hub | `agency/ias.json`, `agency/ias.en.json`, `agency/tests/go/ias_import_test.go` | The six records take the codes of section 1, the 23 steps take theirs, the home refs are rewritten, and the test's `RC-1` to `RC-6` expectations become the new codes |
| Console, app | none | The console reads the action after the last dot, so `tender.add` works |

## Open points

| Point | Why it is not decided here |
|---|---|
| Hyphens in the names | The rule leaves a hyphen: "go/no-go", "hand-over" and "close-out" would give codes with a hyphen. This page uses reworded codes (`bid_decision`, `tender_handover`, `project_closure`); the owner picks the wording |
| Singular names for the six declared records | Their names are plural today (Tenders, Days worked) and the rule's examples are singular. Whether a screen shows the record's name as a list title was not checked |
| Two steps of one workflow writing one register | Needs a look at how a sent row is tied to its step, which the code read for this page does not settle |
| Generated workflow names for a derived record | They read the form's name, as the record has no item name, so they stay "Add a go or no-go". Whether they should read the record's name is for the owner |
| A code with no dash in the sibling's `identity_owner.go` | It finds the kind of a part from the text before the first dash, so `tender` resolves to nothing. No caller resolves a record this way today; it must be checked before one does |
