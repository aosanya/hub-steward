# The assumed group of a login session

Built for ISS-180 on the owner's answers D32, D33, D40, D41 and D42 of ISS-174 (see [Record permissions](record-permissions.md)). A person who holds seats in an Instance picks one of the groups those seats are in and acts as that group. The choice belongs to one login session and one Instance, and it ends with the session.

| Built | Planned |
|---|---|
| Listing the groups a person holds seats in, assuming one, reading the choice back, the per-session store | Making a request use the choice: the roles of the assumed group only (the issue after this one, H3), the tags of the group (H2), the group on API keys and agent accounts (ISS-181), the login screen (ISS-177) |

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
| The session key | `api/http/assumed_group_session.go`, `loginSessionKeyOf` | Names the login session of a request without keeping the token. A cookie session is `cookie:` and the digest of the token (the `digest` of `middleware.go`), and only when the session belongs to the caller. A project login is `project:` and its `session_id` claim. An API key or agent account has no login session and gets no key |
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
| An API key or an agent account has no login session, so it cannot assume a group. Its group is set once on the key by an administrator (ISS-181) | D41 |

## 4. How a choice ends

A cookie session is keyed by the digest of its token, and a signed-out or expired token can no longer be verified, so a row of an ended session can never be reached again. Every write also removes the rows that are past their end time. The end time of a cookie session is the session's own expiry. The end time of a project login is a fixed window from the last time the choice was written or read (`assumedGroupProjectWindow`, 30 days), because a refresh keeps the same `session_id` and the token's expiry is not the end of the session.

## 5. The routes

| Route | Answers |
|---|---|
| `GET /instances/{instanceID}/my-groups` | 200 with `groups`, each with `id`, `name` and `roles` (the names of the person's role kinds in that group), and `assumed_group_id` (empty when none). A person with no seat gets an empty list |
| `GET /instances/{instanceID}/my-group` | 200 with `group` (`id`, `name`), or `"group": null` when the session has no choice |
| `PUT /instances/{instanceID}/my-group` with `{"group_id": "..."}` | 200 with the same body as the read. 400 for a blank group id. 403 when the person holds no seat in the group or the group does not exist, and 403 for a caller with no login session |

All three answer 404 to a person who is not a member of the Instance, and 401 with no sign-in.
