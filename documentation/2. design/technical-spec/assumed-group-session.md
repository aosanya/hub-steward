# The assumed group of a login session

Built for ISS-180 on the owner's answers D32, D33, D40 and D42 of ISS-174 (see [Record permissions](record-permissions.md)), and reworked by ISS-194 for D56 and D57. A person who holds seats in an Instance picks one of the groups those seats are in and acts as that group. The choice belongs to one login session and one Instance, and it ends with the session. An AI agent working through an API key does the same, and its key is its session (section 6).

| Built | Planned |
|---|---|
| Listing the groups a person holds seats in, assuming one, reading the choice back, the per-session store | Making a request use the choice: the roles of the assumed group only (the issue after this one, H3), the tags of the group (H2), the login screen (ISS-177) |

## 1. How a request knows its person, session and Instance today

All paths are under `code/wakala-api/internal/`.

| What | Where | How |
|---|---|---|
| The person | `api/http/middleware.go`, `callers.require` and `callers.identify` | Tries a bearer token first (an API key through `apikeys.Verify`, then a project token through `projectUser`), then the `wakala_session` cookie through `session.Manager.Verify`. It stores the person's id in the request context with `asCaller`. Everything after reads it with `accounts.IDFromContext` |
| The session | `session/session.go` (`HMACManager.Mint`, `Verify`, `Revoke`) and `api/http/session_routes.go` (`sessionClaimOf`, `callers.projectSessionOf`) | A cookie session is a signed token with a random nonce, so two logins of one person are two tokens. A project (GoTrue) login carries a `session_id` claim that stays the same when the token is refreshed. The request context carries neither: only the person |
| The Instance | the path `/instances/{instanceID}/...`, and `partitionOf(ctx)` set by `withPartitionContext` | One login spans every Instance, so a choice cannot be a claim inside the session |
| The roles a person holds | `api/http/caller_roles.go`, `heldRoleKeys` and `heldAgencyRoles` | The union of three sources (see [every row path](record-permissions-hub-paths.md), section 3). Copies of it are in `agent_permissions.go`, `group_role_access.go`, `declaration_register.go` and `step_role_board.go` |

## 2. Where the choice is kept and read

| Part | File and function | What it does |
|---|---|---|
| The session key | `api/http/assumed_group_session.go`, `loginSessionKeyOf` | Names the login session of a request without keeping the token. A cookie session is `cookie:` and the digest of the token (the `digest` of `middleware.go`), and only when the session belongs to the caller. A project login is `project:` and its `session_id` claim. An API key is its own session: `key:` and the key id (section 6) |
| The store | `agencies/assumed_groups.go`, interface `AssumedGroups` on the registry, table `agency_assumed_groups` | One row for each session key and Instance: the person, the group and the time the row stops counting. The registry is the hub's own, so the actor and auth siblings are not changed |
| The router passthrough | `accounts/assumed_groups.go` | The same calls on `accounts.Router`, so the store is reached when a person has their own database |
| The routes | `api/http/assumed_group_routes.go` | `GET .../my-groups`, `GET .../my-group` and `PUT .../my-group` |
| The seats and groups | the actor sibling, through `Registry.ActorManager`: `ListRoleAssignmentsForActor`, `GetGroup` and `ListRoleKinds` | The groups a person may assume are the groups of their active seats. The hub does not copy the sibling's code |

Where a later issue reads the choice: the one resolver of H3 replaces the body of `heldRoleKeys` in `caller_roles.go`. It takes the person from `accounts.IDFromContext` as today, the Instance from its argument, and the group from `AssumedGroups.AssumedGroupOf(ctx, sessionKey, instanceID, caller)`. The session key has to reach it, so H3 adds one context value beside the person in `asCaller` (`middleware.go`). That change is left for H3: this issue only stores and returns the choice, and it does not change which roles a request uses.

## 3. The rules

| Rule | From |
|---|---|
| A person may assume a group only when they hold an active seat in it. A group that does not exist is refused with the same message, so ids cannot be probed | D33, D42 |
| The owner of the platform or of the Instance is checked like anyone else and assumes a group through seats | D42 |
| The choice is kept for one login session and one Instance. Two logins of one person, a phone and a laptop, may act as different groups at once | D40 |
| A session with no choice reports none. Nothing is remembered between logins: a new login starts with no choice | D32, D40 |
| A person in several groups may assume another one at any time. It replaces the earlier choice of that session | D32 |
| A choice is read back only when the group still has a seat of the person. A seat that ended makes the choice report none | D33 |
| An API key is a session of its own and assumes a group like a person, among the seats of the member it stands for. A new key starts with no group | D56, D57 |

## 4. How a choice ends

A cookie session is keyed by the digest of its token, and a signed-out or expired token can no longer be verified, so a row of an ended session can never be reached again. Every write also removes the rows that are past their end time. The end time of a cookie session is the session's own expiry. The end time of a project login is a fixed window from the time the choice was written (`assumedGroupProjectWindow`, 30 days, the length of a cookie session), because a refresh keeps the same `session_id` and the token's expiry is not the end of the session. A read does not extend it: after the window the person picks a group again.

## 5. The routes

| Route | Answers |
|---|---|
| `GET /instances/{instanceID}/my-groups` | 200 with `groups`, each with `id`, `name` and `roles` (the names of the person's role kinds in that group), and `assumed_group_id` (empty when none). A person with no seat gets an empty list |
| `GET /instances/{instanceID}/my-group` | 200 with `group` (`id`, `name`), or `"group": null` when the session has no choice |
| `PUT /instances/{instanceID}/my-group` with `{"group_id": "..."}` | 200 with the same body as the read. 400 for a blank group id. 403 when the person holds no seat in the group or the group does not exist, and 403 for a caller that has no session to assume in |

All three answer 404 to a person who is not a member of the Instance, and 401 with no sign-in.

## 6. What a key session is (ISS-194, D56 and D57)

Owner decisions D56 and D57 of ISS-174 say an AI agent acts just like a person: a key stands for a member, each key session starts with no group, and the agent assumes one of its own groups through the routes of section 5. This section names the parts, from a read of `api/http/agency_api_keys.go`, `api/http/agency_api_key_group.go`, `api/http/assumed_group_session.go`, `api/http/assumed_group_routes.go` and `apikeys/`.

| Question | Answer |
|---|---|
| What a key session is | One key. A key never expires by itself and is not signed in again, so the key is the session. A new key is a new session with no group |
| Its id | `Key.ID` from `apikeys.Manager.Verify`, the same value `callers.identify` already verifies on every bearer request. The assumed-group store keys it as `key:` and the key id, beside `cookie:` and `project:` |
| The member it stands for | `Key.AccountID`, which `callers.identify` already puts in the request context as the person. An agency key stands for `agency-key-<key id>` (`apikeys.AgencyKeyCaller`), the account added to the Instance as an `agent` member. A personal key stands for the person who made it |
| Where the seats are | The actor directory of the Instance, read with `ListRoleAssignmentsForActor(member, true)`, the same call a person's groups come from. An agent holds the seats someone gave to its member |
| Where the choice is stored | The table `agency_assumed_groups` of section 2, one row for each session key and Instance. No new table and no column on the key |
| The old fixed group | `group_id` on `keyRow`, `Key`, `CreateForAgency`, the create reply, the key list, `ownerSeatedIn` and `checkKeyGroup` of ISS-181. D57 retires all of it, and `group_id` in the body of a key request is refused with 400 like any unknown field |
| What a key may do on the routes | Everything a person does there: list its groups, read the choice, assume a group it holds a seat in. 403 for a group without a seat or one that does not exist, with the same message |

The session key of a request is read in `loginSessionOf` before the cookie and the project token. `callers.keySessionOf` (`session_routes.go`) verifies the bearer token as an API key and, when the key's account is the caller, gives `key:<key id>`. A group assumed this way changes nothing about which roles a request uses yet: that is the one resolver of section 2. A disabled group (D54) is not built here. The end time of a key's choice is a fixed window from the time it was written (`assumedKeyWindow` in `assumed_group_session.go`, 30 days, the same as a project login), so the rows of a revoked key are removed by the next write and an agent that waits longer than the window assumes a group again.

## 7. The first group of a new Instance (ISS-203, D70)

Owner decision D70: creating an Instance also creates a first group and seats its owner there as administrator. The owner assumes a group like anyone (D42), so without a seat a new Instance's owner would meet the no-group message ([group screen](group-screen.md), state 6) on the first sign-in. Built by ISS-203.

| Question | Answer |
|---|---|
| Where an Instance is created | `registry.CreateInstance` writes the Instance row and the system tag `all`. It does not know the owner. Three callers then add the owner as a member with `AddMember(..., RoleOwner)`: the `POST /instances` route (`createInstance`), the MCP tool `agency_create_instance` (`mcpCreateInstance`), and the import (`runImport`, only when the import has an owner) |
| Where the seat is made | Straight after `AddMember` in those three callers, by one function, `agencies.SeatOwnerInFirstGroup` (`agencies/first_group.go`), so the three cannot drift. It reads the Instance's actor directory through `Registry.ActorManager`. A failure answers 500 and the Instance and its owner's membership already exist. A failure between the group and the seat leaves a group with no seat, and a later call then finds a group and does nothing |
| The sibling calls it uses | `ListGroups` (a directory that already has a group is left alone, so a second call makes no second group), `EnsureActor` (the owner is a person of the directory), `CreateGroup`, `ListRoleKinds` and `CreateRoleKind` (an active role kind named Administrator is reused, otherwise it is created), and `GrantRole`, a role assignment naming the person, the role kind and the group (D34, D35). `ErrSeatAlreadyHeld` is not an error. The sibling is not edited |
| The group | `Administrators` (`agencies.FirstGroupName`). It carries no tag: giving it `all` or another tag is the owner's act on the tags page after the publish (D24, D48) |
| The role | The role kind `Administrator` (`agencies.FirstGroupRoleKindName`), with no definition role. The seat makes the group appear in `GET my-groups` and lets the owner assume it. The permissions the role carries are not set here. The seat carries an approval limit of 0: a seat with no limit approves any amount (`ApprovalOutcomeFor` in the actor sibling), and the owner must not gain that by being seated |
| What is untouched | An Instance created before this change gets no group and no seat, and nothing runs when an Instance is read or listed. Its owner still meets the no-group message until an administrator seats them |
| Tests | `api/http/first_group_test.go`: the owner's `my-groups` lists Administrators with the role Administrator, the owner assumes it, the MCP tool and the import seat the owner, seating twice makes no second group, and an older Instance stays without a group |
