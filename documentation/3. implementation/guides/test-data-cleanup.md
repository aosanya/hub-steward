# The test-data cleanup

The one-off, re-runnable command that makes the rows and people of an Instance that existed before tags reachable once tags decide the rows (ISS-175). The decisions are D27, D32, D35, D42 and D52, and the owner's answer D79 settles its shape: the tag is `test-data`, there is one group, `Test data`, and everyone is seated in it. Paths are under `code/wakala-api`.

## What it does

| Step | Result | If it ran before |
|---|---|---|
| The tag | The tag named `test-data` is made in the Instance | The tag with that name is used |
| The group | One group named `Test data` is made in the actor directory of the Instance and given the tag `test-data` | The group with that name is used, and giving it the tag again changes nothing |
| The seats | Every person of the Instance (its members, and every actor of the directory that is not deleted) is seated in the group with the roles they already hold in other groups | A seat the person already holds there is left alone and not counted |
| The rows | Every current row that carries no tag gets the tag `test-data`, through the sibling call that adds a tag to a row | The rows now carry a tag, so none is tagged again |

A row that already carries any tag is left as it is: the cleanup only adds, since no tag is ever taken off a row (D27). A retired row, a returned row and a row a correction replaced are history, so they are not tagged. Every publication of the agency is covered, so a row kept in an older publication is tagged too.

## Each person keeps their own role

A person's own roles are the role kinds of their active seats in the other groups of the Instance. The cleanup grants the same role kinds in `Test data` and copies the approval limit of the seat. When a person holds one role kind in several groups with different limits, the larger limit is copied, and a seat with no limit stays with no limit.

A person who holds no seat anywhere gets no seat, since there is no role to keep. The one exception is the owner of the Instance: an owner with no seat is seated as Administrator with an approval limit of 0, as the first group of a new Instance does ([the first group](../../2.%20design/technical-spec/assumed-group-session.md), section 8). An Instance created before D70 has no first group, so this is how its owner gets one.

Because only seats in the assumed group give roles (D33, D42), a person who assumes `Test data` acts with the roles above and reaches every row that carries `test-data`.

## The route

`POST /instances/{instanceID}/test-data-cleanup`, in `internal/api/http/test_data_cleanup.go`, with no body. Who may call it is the guard of the tag routes that the owner alone passes (`tagsAsAdministrator`): 403 for a seated agent, 404 for anyone else. A refused call changes nothing.

It answers 200 with:

| Field | Meaning |
|---|---|
| `tag_id`, `tag_name` | The tag of the cleanup |
| `group_id`, `group_name` | The group of the cleanup |
| `seats_granted` | The seats made by this call. A second run reports 0 |
| `rows_tagged` | The rows tagged by this call for each record, by the record's key, with a record that needed none at 0. A second run reports 0 for every record |

The group is made and seated in `internal/agencies/test_data_group.go` (`EnsureTestDataGroup`). The rows are tagged in the route's file.

## Running it

The tests are `internal/api/http/test_data_cleanup_test.go` and run on the memory backend. The QA and demo databases are shared and live, so the cleanup is run on one of them only by the owner of that Instance, after a backup of the database, and the report is kept in the log of the issue.
