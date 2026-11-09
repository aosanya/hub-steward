# Router

Status

- Route reads "Do you want to join this order? is Yes" from a form answer: the forms `answer` object holds `value_bool` and `option_ids` per question, so the read is possible, but no module evaluates a Match-all rule and picks a next step (open; `mwanachama-backend-forms/forms.blueprint.json`).
- Nothing in the agency module executes declared steps; decision 72 names this as a platform gap (open).

- When a Route step runs and which answer of a farmer counts when answers can change until the form closes: nothing built, nothing decided. Turned into Q94.
- The only read a Route could use is `mwanachama-backend-forms/public_impl.go` `ListAllAnswers`: no limit, no paging, one extra question lookup per distinct question, sorted in Go; at 300 farmers by 10 questions about 3,000 rows in one response (read from code, not measured). Open; build work (read one question's answers of a form, paged, with an index led by form_id).

Log

## 2026-10-29 14:05 UTC

First run. Read the workflow and test pages, the agency, catalog and forms blueprints and operations, wakala-api's market tools and tests, and the studio and member routes. The market module repo is not checked out, so its side is unread.

## 2026-10-30 00:30 UTC

Traced a Route's read of answers to the forms module. Q94 added.
