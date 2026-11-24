# A key session assumes a group

Research and design for ISS-181, reworked by ISS-194. ISS-181 built owner decision D41 of ISS-174: an administrator sets one group on an API key and the key always acts as it. The owner then decided D56 and D57: an AI agent acts just like a person. A key stands for the agent member, each key session starts with no group (D32), and the agent assumes one of its own groups through the routes a person uses. ISS-194 removed the fixed group and let a key use those routes. The page keeps its name so the links to it hold. What a key session is, and how its choice is stored, is section 6 of [the assumed group of a login session](assumed-group-session.md).

| Built | Planned |
|---|---|
| A key session assumes a group through `my-groups` and `my-group`, stored per key and Instance. The key carries no group of its own | Making a request use the assumed group (the resolver of H3), cutting the session when the group is disabled (D54) |

## Where keys and agent accounts are made

Hub files are under `code/wakala-api/internal/`.

| Kind | Made at | Function | Caller id the request carries | Stored in |
|---|---|---|---|---|
| Personal key | `POST /auth/api-keys` | `createAPIKey` in `api/http/apikey_routes.go`, then `Manager.Create` | The minter's own account id | Table `wakala_api_keys`, `keyRow` in `apikeys/row.go` |
| Agency key | `POST /instances/{instanceID}/api-keys` | `createAgencyAPIKey` in `api/http/agency_api_keys.go`, then `Manager.CreateForAgency`, then `AddMember` as `agent` | `agency-key-<key id>` (`apikeys.AgencyKeyCaller`) | `keyRow` with `InstanceID`, and a member row of role `agent` |
| Service key | `POST /auth/service-keys`, admin token only | `createServiceKey` in `api/http/service_keys.go` | `service-<name>` | `keyRow` with `Service`, minted by `admin` |
| Agent member | `POST /instances/{instanceID}/agents` | `addAgent` in `api/http/instance_agents.go` | The person's own account id | Member row of role `agent` |
| Granted service | `POST /instances/{instanceID}/services` | `grantService` in `api/http/service_grants.go` | `service-<name>` | Member row of role `agent` with an agency role link |
| AI account | `ai.account.create` through `registerAIRoutes` in `api/http/ai_routes.go` | the sibling's AI manager | none | A model provider credential, not something that acts in a hub |

The AI account is a provider credential, not an agent, and assumes nothing.

## What a key stands for

| Key | The member it stands for | Where its seats are |
|---|---|---|
| Personal key | The person who made it, so it assumes among that person's groups, in a session of its own beside the person's logins | The Instance's actor directory, under the person's account id |
| Agency key | `agency-key-<key id>`, the account added to the Instance as an `agent` member | The same directory, under that account id. A key has the seats someone gave to its member, and none before |
| Service key | `service-<name>`, the same way | The same directory, under that account id |

`callers.identify` already turns a bearer token into `Key.AccountID` and puts it in the request context as the person, and `Key.ID` names the session. Both routes read the seats with `ListRoleAssignmentsForActor`, so a key and a person are checked by one piece of code.

## What the key request no longer takes

| Before (ISS-181) | Now |
|---|---|
| `group_id` in the body of `POST /instances/{instanceID}/api-keys`, stored on the key and checked against the seats of the owner who made it | Refused with 400 like any unknown field, and no key is made. `POST /auth/api-keys` refuses it the same way |
| `group_id` in the create reply and in each entry of `GET /auth/api-keys` | Not carried |
| `ownerSeatedIn`, `checkKeyGroup` and the 403 "you hold no seat in that group, so a key cannot act as it" | Removed. The check is the one the assumed-group routes make for a person |
| Column `group_id` on `wakala_api_keys` | Not read or written. A database made before ISS-194 keeps the empty column, because the migration only adds columns |

## What a key session does

| Step | Answer |
|---|---|
| A key is made | It has no group. It reaches no rows once the resolver of H3 reads the choice (D32, D57) |
| It asks which groups it may assume | `GET /instances/{instanceID}/my-groups` lists the groups its member holds an active seat in, with the roles of each |
| It assumes one | `PUT /instances/{instanceID}/my-group`. A group without a seat, and a group that does not exist, get the same 403 |
| Two keys of one member, or a key and a login | Each chooses on its own, because the session key differs |
| A key is revoked | It no longer signs in, so its choice can never be read again, and the next write removes its row once the window has passed |
| Its roles on a request | Unchanged until H3. Under D42 they will come only from the seats of the assumed group |
