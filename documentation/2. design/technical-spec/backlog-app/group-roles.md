# Group roles: how a member gets to the Backlogs

Written for the owner. A design only; nothing here is built. It answers SW45:
a hub member sees nothing in the Backlogs until the member's group is given a
role, and the group's access to each backlog (Can see, Can move, D54, D69) then
decides which backlogs they see.

## The moment this is for

Amina is an ordinary member of the Support group. She opens the app. Today the
Backlogs option on Home is not there for her. After this design: it is still not there
until you give the Support group a role. Once you do, it opens with "No backlogs
shared with you yet". Once you give Support Can see on the Software backlog, she
sees that backlog, read only.

## 1. What exists today

| Piece | Works today | Where |
|---|---|---|
| A person's standing in an agency | owner, agent (a person or AI seated in the agency) or resident (an ordinary member) | `internal/agencies/member.go` |
| An agent holds one agency role | the owner links an agent to an agency role; the role's permissions are then enforced on every task route and tool | `agency_role_link.go`, `agent_permissions.go` |
| A resident holds a role in a group | the owner gives a person a seat in a group, of a kind tied to an agency role; only the owner can; a resident cannot give one | actor `role_assignment.create`, `misuse_roleassignment_test.go` |
| The roles a caller holds | `agency_get_my_roles` counts both the linked role and the seats, and now returns their permission codes | `caller_roles.go` (`e7e7b04`) |
| Task routes admit | only the owner and agents; a resident gets "not found" before any permission is looked at | `membership.go` (`IsMember`), `taskmanager_routes.go` |

What is missing:

- A resident with a seat holds the role on paper, but the task routes still turn them away.
- A seat belongs to one person in one group. There is no "this group holds this role", so giving a role to forty people means forty seats.
- Nothing in the app or Chat gives a role to a group. Only the owner can seat one person at a time.
- The role permissions (`task.read`, `task.edit`, `backlog.manage`) are enforced for agents only.

## 2. The roles the Backlogs need

The smallest set. Roles are made of the three permissions added in `c80433b` and `d96ca8d`.

| Role | Permissions | Who |
|---|---|---|
| Product owner (exists) | `task.read`, `task.edit`, `backlog.manage` | the owner group |
| Backlog worker (new) | `task.read`, `task.edit` | groups that move and edit issues |
| Backlog member (new) | `task.read` | groups that only look |

Proposal for `agency/agency.json`, not applied: add the two roles with those
permissions and no others. The Triager keeps what it has.

Every role that opens the Backlogs also holds `mount.list`, so the app can read which modules the agency has and show the Backlogs button; without it a Backlog worker can move issues but sees no button (SW111). The three Backlog roles also hold `ai.chat` (the owner decided on 2026-11-10 that they may ask the assistant): the assistant's chat call and the choice of model, nothing else. They do not hold `ai.use`, which also lets a holder record usage, list the accounts and their limits, and make a role an AI role; none of them holds anything that changes the AI accounts, keys or limits. A limit per role or group is SW126. The Backlog manager also holds `group.read`, so its Access page can list the groups to give access to; the worker and the member do not, because they cannot open that page (SW124).

## 3. How the owner gives a group a role

Three places were possible. Recommendation: the Access page of a backlog, with a
Chat ask doing the same, and no console screen.

- **In the app (recommended).** On a backlog's Access page each group row gets one more line under its Can see / Can move switch: "Uses the Backlogs as: Backlog member". Giving a group access gives or swaps its role in the same call: Can see gives Backlog member, Can move gives Backlog worker, Can edit gives Backlog manager, and lowering the level swaps the role down. The page shows the role line change; it offers no tap.
- **In Chat.** One ask: "let Support use the Backlogs as a worker". The Triager needs a new tool for it; today only the per-person seat tool exists, and only the owner may call it.
- **In the console.** Not needed; the console already seats single people.

The same screen already needs the manage permission (`backlog.manage`), so
nobody else can hand out roles.

## 4. What a member sees at each step

| Step | Amina sees |
|---|---|
| Her group has no role | no Backlogs option on Home; opening a link says "You do not have access to the Backlogs" |
| Her group has a role, no backlog access | the Backlogs option on Home with "No backlogs shared with you yet" |
| Her group has Can see on a backlog | that backlog, its list and its board, read only |
| Her group has Can move on it | the same, and she can move issues between steps |
| Her group also has Backlog worker | she can create and edit issues in backlogs she can move in |

Rule: a person can do something only when the role allows it and the backlog
access allows it. A worker with only Can see on a backlog still cannot write there.

## 5. The traps

- **Two groups.** Roles add up: all permissions of every group's role. Access on one backlog is the highest level any of the person's groups holds (Can move over Can see).
- **Leaving a group.** The role and the access go with the membership, immediately. Nothing is copied to the person.
- **One group for both.** Allowed and the normal case: the Support group holds a role and is given access. The two lists are separate, so removing a backlog's access does not take the role away.
- **The owner group.** The Product owner group always has Can move (D69). Give that group the Product owner role so its members can manage as well as move.
- **Triager and other AI roles.** They are agents linked one by one and act with no person, so group roles do not apply to them and their calls stay unrestricted. The open check on what the Triager sees once grants exist is SW50.
- **A person with no role anywhere.** Same as step one: nothing, and no error shown to others.

## 6. What to build

1. Let a group hold an agency role: one small record, and the roles a caller holds include the roles of the caller's groups.
2. Admit a resident to the task routes and tools when one of their roles has `task.read`, and enforce the role's permissions for them exactly as for agents.
3. Add the Backlog worker and Backlog member roles to the agency, and grant the Product owner role to the owner group.
4. Tools to give and take away a group's role, and the matching Triager ask in `chat-and-mcp.md`.
5. The role line on the Access page, which follows the level the owner picks.
6. The app: no Backlogs option on Home without a role, and "No backlogs shared with you yet".
7. A journey: a member of a group with no role, then with a role, then with access.

Row 2 changes who can reach the task module across the hub; the owner agreed to that in D76 and D79.

## Questions for the owner

Decided: D79, D80, D81 (owner, 2026-11-09, recommended options of A, B and C).

## What is built (hub copy, 2026-11-09)

Decisions: D76, D79, D80, D81. Hub-steward commits `5fcd483`, `6b01ded`, `76d1e75`, `fd20f20`.

- **A group holds a role.** A record per group and role; a member's roles are the linked or seated ones plus those of every group they are in, and they add up. A resident whose roles hold `task.read` is admitted to the task module and gated by those roles' permissions; a resident with no such role gets "not found".
- **Giving access gives the role.** Can see gives Backlog member, Can move gives Backlog worker, Can edit gives Backlog manager, by the group's highest level across all backlogs, and lowering the level swaps the role down; taking the last access takes the role away. The roles are found in the published agency by code or by name (`backlog_member`, `backlog_worker`, `backlog_manager`; "Backlog member", "Backlog worker", "Backlog manager"). An agency that has not defined them gives none, and the access list says `no_role`. The owner group is never given one.
- **Both must allow.** The role says what a person may do, the backlog access says where. A group with Can move and a read-only role cannot move issues; the access list says `role_too_small` so the Access page can warn. It arises only when the role is changed apart from the level.
- **Highest wins.** In two groups, the higher backlog level applies and the roles' permissions are joined.
- **Standalone tools are owner-only.** `agency_give_group_role` and friends give any role, so only the owner may call them; the Triager does not.
- **Open groups hold no role (D83).** Anyone can join a group set to open, so giving it a role is refused ("An open group cannot hold a role: anyone could join it. Make it invite-only first."), a role it held before it was opened is ignored while it is open and returns when the group is invite-only again, and backlog access for an open group is given with no role, so the Access page shows it as having none. Hub-steward `893f9bd`.
- **Not run against a live hub.**
