# Who can be handed a task, and how that person is told

A task is handed to a person with `POST /taskmanager/tasks/{id}/assign-holder`
(tool `taskmanager_task_assign_holder`), or named on create and update through
`assigned_to`, or on a repeating task through `assignee_kind` and `assignee_id`.
The taskmanager module accepts any actor id. The hub decides who is allowed, in
`code/wakala-api/internal/api/http/taskmanager_assignee.go` and `staff.go`.

## The rule

An assignee must be one of:

| Holder | How the hub recognises it |
|---|---|
| The agency's owner | role `owner` in the agency |
| An agent of the agency | role `agent` in the agency |
| A holder of a staff seat | a live seat, in any group, in a role kind whose `staff` flag is on and which is not retired |

Anyone else is refused with 422 `an assignee must be an owner or an agent of this
agency`. Being a member, being registered in a group, or being only an actor does
not count. The rule stops a task being handed to a stranger by a wrong id.

## A person with no login

A person who is only an actor, with no agency membership and no sign-in, can be
handed a task once she holds a seat in a staff role. The staff flag is a role
setting (`agency_create_role` and `agency_update_role` take `staff`); a role with no
permissions and the flag on gives the seat and nothing else. The seat does not need
a login to count for this rule.

## How she is told

Handing a task to an actor raises the notice `task_assigned` for that actor on its
own (`internal/agencies/case_notices.go`). Nothing has to be raised by hand.

A caller cannot raise an event of its own choosing. `POST /comm/notifications` and
`comm_notification_raise` accept only the events the hub lists in `raisableEvent`
in `internal/agencies/registry.go`; any other event is 403 `the host does not let a
caller raise that event`, and an event nobody declared is refused the same way.

A notice is stored for the actor whether or not she can sign in. She reads it
through `GET /comm/notifications` only as a member of the agency; for a person with
no membership the call answers 404 `agencies: instance not found`, and the stored
notice is the record that she was told.

## Tests

`code/wakala-api/internal/api/http/pool_person_task_test.go` holds three tests: a
seatless actor in a team group is refused, a holder of a staff seat with no
membership is handed the task and gets one `task_assigned` notice, and an event the
hub does not list is refused when raised by hand.
