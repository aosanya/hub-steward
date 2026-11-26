# Who may answer a question

Built for ISS-277. A question names the role whose holders answer it (`target_role`). The hub and the app decide the same way, so a person the app lets answer is a person the hub accepts.

## The rule

| Case | Result |
|---|---|
| The person holds a seat of the target role in any group, whichever group they work in | May answer |
| The question names the role by its id, its code or its name (`R-1`, `Product owner`), upper or lower case | The same role |
| The person is the owner of the Instance and holds no seat of that role | Refused, like anyone else. The owner has no shortcut |
| The agency has no published version | Refused for everyone |
| The person holds only other roles | Refused. The app reads `Only {role} can answer this question.` and offers no option |

The group a person works in does not matter here, unlike every permission gate: a question is addressed to a role, not to a group, so a seat in any group counts.

## Where it is decided

All paths are under `code/`.

| Part | Where | What it does |
|---|---|---|
| The hub's check | `wakala-api/internal/api/http/question_role_holders.go` (`QuestionRoleHolders`), `caller_roles.go` (`isRoleNamed`) | Reads the seats of the person in every group and compares the target role with each held role's id, code and name |
| What the app reads | `agency_get_my_roles` and `GET /instances/{id}/my-roles`: `roles` (the group worked in, as before) and `seated_roles` (every group) | `seated_roles` changes no permission; `permissions` still follow `roles` |
| The app's check | `app/src/features/backlogs/questions/api.ts` (`standingOf`) | `holds(role)` is true when the role matches the id, code or name of an entry in `roles` or `seated_roles` |

Tests: `question_role_by_name_test.go` and `question_role_holder_test.go` (hub), `api.test.ts` (app).
