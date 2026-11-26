# A step sets a choice on its subject record (ISS-67, decision Q-30)

Status, 2026-11-26: built. The agency sibling `mwanachama-backend-agency` v0.4.5 declares and checks the field (its page `workflow-records.md`, section "A form step sets a choice on its subject record"); the hub writes the change when the step is sent (`step_subject_settings.go`) and reads the field in its import (`instance_import_subject_settings.go`).

## The problem in plain words

A workflow can be started on a row of a record, its subject (`Workflow.SubjectRecord`, ISS-135). Each step of the run carries that row. A step used to record only its own answers, and a choice on the subject row (an order's Status, say) changed only when a person who may edit that record changed it. The person who decides is often only a viewer of the record, so after a Yes the row still showed the old value. The owner decided (Q-30, 2026-11-26): the step sets it, with no extra action by the person, so the choice always matches where the row is.

## 1. What an agency author writes

A form step lists `sets_subject`: each item says when to set which choice to which option.

```json
"sets_subject": [
  { "when": { "question": "Accepted", "operator": "is", "value": "Yes" },
    "field": "Status", "to": "Accepted" }
]
```

| Part | Meaning |
|---|---|
| `when` | A route rule: a question of this step, an operator and a value. It is read as a route reads it (`ruleHolds`), so a yes_no question, a choice and a number all work and an answer is compared without case |
| `field` | The prompt of a single-choice question of the workflow's subject record |
| `to` | One option of that question |

An item whose `when` does not hold sets nothing and leaves the choice as it is. Items are applied in order, and a later item for the same field wins. A step with no item behaves as before.

Why on the step and not a step of its own: the owner's answer is that the step sets it, so one step both records the decision and moves the row. A separate setting step after a route would leave the choice unset when a person stops between the two, and would put a box on the canvas that no person acts on.

## 2. The checks

| Where | What is refused |
|---|---|
| The sibling, at step create and update | A step that is not fill_form, that no role acts on or that writes a row; a rule with no question, an unknown operator or no value; a question the step's form does not ask; a workflow with no subject record; a field the subject record does not ask or that is not a choice; an option the choice does not offer |
| The sibling's Issue scan | An error for a step whose setting no longer fits, such as an option taken off the record after the step was written |
| The hub import (`checkSubjectSettings`, 400 before anything is created) | A step whose workflow names no subject record; a field the subject record (a record of the file, or a record a step of the file derives by `record_code`) does not ask, that is not a choice, or an option it does not offer |

The hub import creates the steps before it gives the workflows their subject records, so it sets `sets_subject` on each step in a pass after the subjects (`applyStepSubjectSettings`).

## 3. What a send does

In `submitStepAnswers`:

1. Before anything is written, `plannedSubjectChange` keeps the items whose `when` holds on the answers just given. With none, or when every such item already reads its option, nothing more happens.
2. The subject row is the row the run was started on (`subjectRowForStart` on a first step, `subjectRowOf` of the run on a later one). An earlier step may already have replaced it, so `latestRowOf` follows `Replaces` across every published version to the current row. A retired row refuses the whole send with 409 (`errSubjectRowGone`) and nothing is written; the step stays waiting.
3. After the step's own row is written, `applySubjectChange` writes a row that replaces the current subject row: every answer copied, the named fields set to their options, the place references kept. It is the write an Edit makes (`writeRow` with `Replaces`), so history keeps the earlier value and the row keeps its order id.
4. The sender needs no edit right on the subject record: the step is the agency's own declaration. The replacing row takes the role of the row it replaces, and `AddedBy` is the sender, so the history shows who sent the step.
5. The reply carries `subject_row_id`, the id of the replacing row, only when a row was replaced.

The two writes are not one transaction. A failure of the second after the first is written returns the error, and the step's row stays sent.

## 4. Where it applies

Every form step of a workflow with a subject, the first step included. A step of a generated row workflow takes none: it already writes a row.

## 5. Tests

| Where | Test |
|---|---|
| Sibling `subject_setting_test.go` | Read back; every refusal of section 2, naming the part; update keeps and clears; fork, publication, restore and import carry it and a change is publishable; an import with an option not offered is refused; the scan reports an option that left the record |
| Hub `step_subject_settings_test.go` | A first step with a rule that holds replaces the subject row with the option and the reply names it; a later step whose sender may not edit the record replaces the row the first step wrote; a rule that does not hold writes nothing; a send on a retired subject row is 409 and the step stays waiting; import keeps the field; import refuses an option the record does not offer |
