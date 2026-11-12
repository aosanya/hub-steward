# Test before a publish

A designer runs the tests of a draft and reads what each step did to the data. Publish warns about any scenario that has not passed and never blocks. The test copy behaves like a live run: the same endpoints, the same checks, the same records.

## What the designer does

| Step | The designer | What she sees |
|---|---|---|
| 1 | Opens Test | One card for each scenario with its last result, and Run all scenarios. |
| 2 | Runs a scenario | Each step in order, played one at a time. A step that waits for a person is played by the Test agent. |
| 3 | Reads a step | Under each played step: the endpoint it called, what was sent, what the module answered word for word, the new lines it wrote to the trail and the rows it wrote. |
| 4 | Reads a failure | What the step expected, what it found, and the endpoint's own refusal, word for word. |
| 5 | Reads the data trail after the run | A Data trail tab on the finished run: every line the run wrote, in order, from every module it touched, each with the step that caused it, and the rows each module's test copy holds at the end. It stays until the run is removed. |
| 6 | Opens Publish | A warning lists each scenario that has not passed on this draft, with its last result and a link to its run. Publish is never blocked, as Review never blocks it, and no sign-off is recorded. |

Editing the draft clears the pass of every scenario the edit touches. No sign-off is recorded.

## A step on the run page

Each step of the run is one card, titled with the step and who did it. Its rows, top to bottom: Played by (a Test agent step), Did, Recorded (or Expected and Found on a failed step), then for each call the step made Endpoint, Sent and Answered, one Trail line for each line the call wrote (its endpoint and its text), and Rows written. A call the module refused shows Refused with, the module's own sentence, in place of Answered, and writes nothing. A step that made no call, such as Send staying locked below the minimum, shows no endpoint rows. The card's right end carries the rule chips and the step's tokens. The design is drawn in `studio/agency/test-run.html` and `test-failure.html`; the Data trail tab is `test-run.html` screen 6.

The module's reply and the lines it wrote are the module's own words: the market's trail line is the actor and what was done (for example "Farmer 1 joined"), and a forms or comm line is the reply itself. The drawn replies are example data in the shape of each module's records.

## A step and its endpoint

Steps are clear by kind, and each kind uses its own module's endpoint in a live run: a filled form goes to the forms module, a sent form or a notification to comm, the market's own moves to the market. The test calls those same endpoints in a copy of each module.

| Group order step | Kind | Module the test calls |
|---|---|---|
| Start the group order | Fill a form | market: `market_start_group_order` |
| Invite the farmers | Send a form | forms and comm |
| Say yes or no to the invitation | Say yes or no | forms, then the market's join |
| Sort the answers by yes and no | Route | forms |
| Fill in the order | Fill a form | market: `market_join_group_order` |
| Send the order to the supplier | Notify | market: `market_send_group_order`, then comm |
| Confirm the order | Say yes or no | market: `market_promise_group_order` |
| Thank the group, Thank the farmer | Notify | comm |

The endpoint belongs to the test block, not to the workflow: the workflow stays what people do. The scenario suggests it from the step's kind and the actor's role, and the Blocks tab lets the designer change it. A step that names an endpoint its role may not use fails with that sentence before any model call. No step is skipped.

## The trail

Two views of the same lines. Under each step, the lines that step wrote. After the run, the Data trail tab shows all of them as one list, oldest first, each naming its step, its module and its endpoint, so the designer can follow one order from Start to the supplier's answer and compare it with what a live run would hold.

After every step that called an endpoint the test reads the order's trail (`market_group_order_trail`, `market_order_trail` for orders) and shows the new lines under the step, oldest first, as the coordinator would see them. The judge reads the same lines plus the stored rows.

## Settled: the forms and comm endpoints

The test copies of forms and comm are the live managers scoped to the run (`ForRun`), and `FormsModule` and `CommModule` in `internal/testruns` play a call through the same declared operations a live run uses, with the role's own permissions. An endpoint the role may not use is refused with the module's own sentence. The names are the published tool names.

| Step kind | Module | Endpoint | Operation |
|---|---|---|---|
| Fill a form | forms | `forms_answer_submit` | `forms.answer.submit` |
| Send a form | forms | `forms_form_publish` | `forms.form.publish` |
| Say yes or no | forms | `forms_answer_submit` | `forms.answer.submit` |
| Route | forms | `forms_answer_list` | `forms.answer.list` |
| Notify | comm | `comm_chat_message_post` | `comm.chat_message.post` |

Comm has no operation that raises a notification; notifications are raised inside the modules that own the record, so a notify step posts its message to the thread.
