# A step sets a choice on its subject record (ISS-67, decision Q-30)

Status, 2026-11-26: designed, not built. The build needs a new field on the step in the agency sibling `mwanachama-backend-agency`, so it waits for a sibling release (section 6). Nothing in the hub changes before that release.

## The problem in plain words

A workflow can be started on a row of a record, its subject (`Workflow.SubjectRecord`, ISS-135). Each step of the run carries that row. A step only records its own answers, and a choice on the subject row (an order's Status, say) is changed only by a person who may edit that record. The person who decides is often a viewer of the record, so after a Yes the row still shows the old value. The owner decided (Q-30, 2026-11-26): the step sets it, with no extra action by the person, so the choice always matches where the row is.

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
| `when` | A `RouteRule`: a question of this step, an operator and a value. It is read as a route reads it (`ruleHolds`), so a yes_no question, a choice and a number all work and an answer is compared without case |
| `field` | The prompt of a single-choice question of the workflow's subject record |
| `to` | One option of that question |

An item whose `when` does not hold sets nothing and leaves the choice as it is. Items are applied in order, and a later item for the same field wins. A step with no item behaves as today.

Why on the step and not a step of its own: the owner's answer is that the step sets it, so one step both records the decision and moves the row. A separate setting step after a route would leave the choice unset when a person stops between the two, and would put a box on the canvas that no person acts on.

## 2. The check at design time

The sibling's step shape check and the publish scan refuse, each with one plain sentence:

- the step's workflow has no subject record;
- `when.question` is not a question of this step;
- `field` is not a single-choice question of the subject record;
- `to` is not one of its options.

An agency file that carries `sets_subject` on a step that takes no form is refused on import.

## 3. What a send does

In `submitStepAnswers`, after the step's own row is written and before the next step is read:

1. For each item whose `when` holds on the answers just given, the subject row is replaced by a row that copies every answer of the current subject row with `field` changed to `to`. It is the write an Edit makes (a replacing row, `writeRow` with `Replaces`), so history keeps the earlier value and the row keeps its order id.
2. The row to replace is the current row of the subject. A run keeps the id of the row it started on, and an earlier step may already have replaced it, so the current row is found by following `Replaces` from the run's subject row.
3. The caller is not asked for an edit right on the subject record. The step is the agency's own declaration, so the write is the agency's, not the person's. The row is stamped with the first role of the published version that adds to the subject record, as the platform owner's writes are, and `AddedBy` is the caller, so the history shows who sent the step.
4. The two writes are one send. A failure of the second returns the error, the answer is refused as a whole, and the send key of the step makes a retry write only what is missing.

The result of the send carries `subject_row_id`, the id of the replacing row, so the app can show the new value without a second read.

## 4. Where it applies

Every form step of a workflow with a subject, the first step included (the row is the one the run was started on, `subjectRowForStart`). A step of a generated row workflow takes none: it already writes a row.

## 5. Tests, in order

| Test | Fails today because |
|---|---|
| A Yes sets the subject's choice and a No leaves it | No step sets anything |
| The sender holds only a view of the subject record and the choice still changes | The row is edited only by a person who may edit |
| A later step finds the row a first step replaced and replaces that one | The run's row id is the first row |
| Two items for one field apply in order | |
| The send is refused as a whole when the subject row cannot be replaced | |
| Import and publish refuse the four wrong shapes of section 2 | The field is unknown |

## 6. What it needs from the sibling

The hub reads steps from `mwanachama-backend-agency`, whose `WorkItem` has no such field, and the hub copies none of the backend. So the work is: the field `SetsSubject []StepSetting` on `WorkItem` and `DocumentWorkItem` with its blueprint column, the shape check and scan of section 2, the copy, hash and remap of a step, and a tagged release; then the hub bumps `go.mod`, reads the field in `submitStepAnswers` and in the import, and the agency file may use it. An agency uses it by adding `sets_subject` to a step and republishing.
