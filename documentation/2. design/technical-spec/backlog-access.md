# Backlog access

Design for ISS-208, on owner decision D74 of ISS-174 (with D40 and D42, see [record permissions](record-permissions.md)). A backlog lists the groups that may see it and the groups that may move its issues. Those levels (Can see, Can move and Can edit above them) use no roles and no seats. The check is made for the group the person logged in as ([the assumed group of a login session](assumed-group-session.md)).

The page is new, not a section of [Tag management](tag-management.md): that page is about tags, and backlog access has its own data, its own check and its own tests.

## 1. What is decided

| Rule | From |
|---|---|
| A backlog lists the groups that may see it, the groups that may move its issues and the groups that may edit it. Each is a group, never a role and never a seat | D74 |
| The check is made for the group the person logged in as, and for no other group they belong to | D40, D42, D74 |
| A person who has assumed no group reaches no backlog | D32, D74 |
| A disabled group gives none, because the assumed group of a disabled group reads as none | D54, D74 |
| The Product owner group has Can edit on every backlog, and the owner of the Instance has it everywhere | the sibling |

## 2. Where a backlog access level is read today

Inventory made for TD-6182, before any change. Paths under `code/wakala-api/internal/` unless the row says the sibling, `mwanachama-backend-taskmanager` v0.2.0, which is read and never edited.

### The data

| What | Where | Notes |
|---|---|---|
| The grants | the sibling's setting `backlog_access` (`backlog_access.go`, `storedGrants`, `changeGrants`), each grant a backlog, a group and a level (`models/backlog_access.go`) | Already keyed by group. It needs no new field |
| The Product owner group | the sibling's setting `backlog_owner_group` (`SetBacklogOwnerGroup`) | Has Can edit on every backlog |
| The tools and routes that write it | `taskmanager_backlog_access_give`, `_list`, `_take`, `taskmanager_backlog_set_owner_group` and the routes `PUT` and `DELETE` `.../backlogs/{backlog}/access/{group}` and `GET .../backlogs/{backlog}/access` | Mounted from the sibling's `routes` package by `api/http/taskmanager_routes.go` |

### The readers of a level

| Reader | Where | What it asks |
|---|---|---|
| The one resolver of a level | sibling `backlogVisibility` in `backlog_access.go` | Takes the groups the hub's `Groups` function returns for the caller and finds the highest level in each backlog. The owner of the Instance, an empty grant list with no owner group, and a blank caller see everything |
| The groups of a caller | `agencies/registry.go`, `buildTaskManager`: `UseGroups(r.groupsIn(id))`, answered by `groupsOf` in `agencies/groups.go` | Today the groups of every active assignment of the person, which is not the assumed group |
| The step board and the backlog list | sibling `ListBacklogsFor`, `ListBacklogsMatching`, `backlog_access_list.go`, `backlog_access_reads.go` | `Sees` |
| Moving an issue and writing one | sibling `requireMoveAccess` (`backlog_access.go`), `backlog_access_writes.go`, `backlog_access_writes_more.go`, `backlog_step_wip.go` | `Moves` on the backlog of the issue and on the target |
| Editing a backlog, its steps and its access | sibling `backlog_access_edit.go` | `Edits` |
| The smart backlog, the sprint count and next-ready | sibling `countSmartIssues`, `backlog_smart.go`, `task_next_ready.go`, `pending_todos.go`, `task_caps.go`, `task_release.go` | The same visibility, taken for the requester |
| The role that giving access also gave | sibling `backlog_roles.go` (`syncGroupRole`, `markRoles`), answered by `agencies/backlog_roles.go` through `UseRoleSync` | `GiveBacklogAccess` and `TakeBacklogAccess` gave or took the role Backlog member, Backlog worker or Backlog manager (`agency_group_roles`), and the access list flagged `no_role` and `role_too_small` |

### The gate in front of the board

| Reader | Where | What it asks |
|---|---|---|
| The permission gate | `api/http/group_role_access.go`: `taskPermissioned`, `residentPermissioned`, `taskToolRefusal` and `guardTaskToolPermissions`, mounted by `instanceTaskManagerMount` in `taskmanager_routes.go` | A resident needs `task.read` (and `task.edit` to write) from the roles of the seats in the assumed group. Before ISS-188 the role given by backlog access was how a Can see group passed it |

## 3. The tests ISS-188 skipped

Five tests carry `t.Skip` naming ISS-188. They built access through the role that giving a level used to give.

| Test | File | What it proved |
|---|---|---|
| `TestJourney07_GroupRolesWalkedThroughTheRoutes` | `api/http/group_roles_journey_test.go` | The walk: levels per backlog, Can see and Can move, the highest level across a person's groups, a read-only role |
| `TestGroupRoles_GivingAccessAlsoGivesTheMatchingRoleAndTakingItAwayTakesTheRoleAway` | `api/http/group_role_task_test.go` | Can see lists, Can move creates, taking the access takes it away |
| `TestGroupRoles_AReadOnlyRoleWithCanMoveCanOnlyLook` | `api/http/group_role_task_test.go` | The `role_too_small` warning |
| `TestGroupRoles_TheHighestLevelAcrossAPersonsGroupsWins` | `api/http/group_role_task_test.go` | Two groups, Can see and Can move, the higher wins |
| `TestGroupRoles_ACanMoveGroupWithAReadOnlyRoleIsBlamedOnTheRoleNotTheLevel` | `api/http/group_role_task_test.go` | The refusal names the role |
