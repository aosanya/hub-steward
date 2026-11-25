# The phone app reads answers by field key and names a record by its key

ISS-228 (decisions D38, D58, D61, D62). The hub side is in [Hub on the sibling v0.3.1](sibling-v0-2-0.md) section 2.1 and 2.3 and [Record permissions](record-permissions.md) sections 7 and 8.

| Built | Planned |
|---|---|
| Sections 1 to 4 | Nothing |

## 1. Inventory before the change

What the hub returns now: a live record carries `code` (readable, renamable) and `key` (a UUID, or `RC-n` for an old record) and each of its `questions` carries a hidden `key`, a readable `code` and its `prompt`. A row's `answers` are saved under the question's key. A step, a workflow's subject and a home entry name a record by its key.

What the app did, all of it from `code/app/src`:

| Where | What it does that the hub no longer answers |
|---|---|
| `app/menu/declaredRecord.ts` | Finds a record in `agency_list_live_records` by `code`, reads each row's `answers` as `prompt -> text`, sends `record_code` as the code |
| `app/menu/liveRecordRows.ts` | The registers of Businesses, Informal traders and Maintenance records are named by the handles `RC-1`, `RC-2` and `RC-3`, found by name, and then named by the record's `code`; every row is read with `answers[prompt]` |
| `app/menu/RecordRowForm.tsx` | Adds and edits a row with `record_code` the code and `answers` by prompt |
| `app/menu/referenceChoices.ts` | The business and trader pickers read `answers[prompt]` of the rows of the register named by its code |
| `app/menu/sections/assets/maintenanceRecords.ts` | Reads the maintenance rows by prompt |
| `app/menu/registerDetails.ts`, `sections/settings/registerRecords.ts` | Name a register's settings by the resolved record code |
| `app/home/useHomeRecord.ts`, `homeRecordRoute.ts`, `homeDeclaration.ts` | A home entry's `target.ref` and a page's `page_of` are the record's key now; the app looks the record up by code |
| `app/home/HomeRecordRows.tsx`, `HomeRecordTable.tsx`, `HomeRowPage.tsx`, `HomeRowActs.tsx`, `HomeRowWorkflows.tsx`, `homeWorkflows.ts` | Match a step's `record_code` and a workflow's `subject_record` (both the record's key) with the record's `code` |
| `app/home/HomeRowFacts.tsx`, `HomeRecordTable.tsx` | Read a row's answer with `row.answers[question.prompt]` |
| `features/steps/rowStep.ts`, `StepPage.tsx` | Load the row of an edit or delete step with the step's `record_code` and read its answers by prompt |
| `features/market/payments/api.ts` | The group order payments record: finds the record by its code, sends the code, reads and writes `answers` by prompt |
| `app/home/agencyHome_contract_adapters.tsx`, `journeys/walk18.test-support.ts` | The tests' own hub: records by code, rows by prompt |

Not the app's to change:

| Where | Why |
|---|---|
| A form step's own questions, a step's `earlier` list and the stamps (`Approved by`, `Approved at`, the over-limit pair, the `Changed: ` lines) | The hub keeps them under their prompt (sibling-v0-2-0.md section 2.1) |

## 2. What the app does now

One module, `code/app/src/shared/wakala/liveRecords.ts`, holds every read of the live records. A record is found by its `key`; every request sends the key as `record_code`; a row's answers are read through the record's questions (field key to prompt), and an add or edit sends the answers under the field keys. The prompts shown come from the record's questions. Nothing falls back to the code.

| Where | Change |
|---|---|
| `app/menu/liveRecordRows.ts` | The three registers are still found by name (`RC-1` Businesses, `RC-2` Informal traders, `RC-3` Maintenance records), then used by key. `saveRegisterRow` and `loadRegisterRows` replace `resolveRecordCode` |
| `app/menu/declaredRecord.ts` | `DeclaredRecord` carries `key`, not `code` |
| `app/home/*` | A home entry's `ref`, a page's `page_of` and a step's `record_code` and `subject_record` are matched with the record's key; the route segment is the key |
| `features/market/payments/api.ts` | The payments record is named by key and its two questions by their field keys |

## 3. Tests

`app/menu/recordKeys.test.tsx` and `app/home/homeRecordKeys.test.tsx` use a record whose code differs from a UUID key. The fake hub is `shared/wakala/liveRecords.test-support.ts`; the register tests use `app/menu/registerHub.test-support.ts`.

## 4. The prompt beside each answer

Closed by ISS-249 (D38, D58). `agency_list_declarations` (each `declared` row) and `agency_list_my_sent_steps` (each item) keep `answers`, the stored values under their field keys, and add `fields`: a list of `{key, prompt, value}`, one per answer.

The prompt is the one the live record's question has now, so a renamed question shows its new prompt on the answers already given. The list follows the record's question order; an answer whose key is no question of the record (the reason of a deleted row) comes last with the key as its prompt.

The app reads `fields` in `app/menu/sections/council/declarationsData.ts` and shows the prompt; with no `fields` it falls back to the `answers` keys. Tests: `declaration_register_test.go`, `caller_sent_steps_test.go`, `declarationsData.test.ts`.
