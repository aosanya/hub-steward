# The group on an agency key

Research and design for ISS-181, which carries owner decision D41 of ISS-174: an administrator sets one group on an API key when making it, and the key always acts as that group, with the group's roles and tags and no choice at run time. This issue stores and returns the group and refuses a group where the key's owner holds no seat. It does not change which roles a request uses.

| Built | Planned |
|---|---|
| Nothing before this issue | The group on the agency key, its seat check and its report on the key list |

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

The AI account is a provider credential, not an agent, and takes no group. A personal key belongs to no Instance, and a group belongs to one Instance's actor directory, so it takes no group either.

## What "the key's owner" is

`Manager.mint` records the minter as `MintedBy` on the key. On an agency key the minter is the Instance owner who called the route, because `mustOwnAgency` refuses everyone else. The owner's account id is also the owner's actor id in the Instance's actor directory, the same id `heldRoleKeys` in `api/http/caller_roles.go` passes to `ListRoleAssignmentsForActor`.

## Where the group is stored and read

| Question | Answer |
|---|---|
| Stored | A column `group_id` on `keyRow`, set by `CreateForAgency` and never changed afterwards |
| Set | The optional `group_id` of the body of `POST /instances/{instanceID}/api-keys`, read into a request type of its own so `POST /auth/api-keys` does not accept it |
| Checked | Before the key is made: the actor sibling's `ListRoleAssignmentsForActor(owner, true)` must hold an active seat whose `GroupID` is that group. A group that does not exist, belongs to another Instance or has no seat of the owner's gets the same refusal, 403 |
| Reported | The create response and `GET /auth/api-keys` carry `group_id`, empty for a key made without one |
| Read by a later issue | The caller `agency-key-<id>` leads back to the key row, which holds the group. No reader exists yet |

The group is not written on the member row. A member row also holds people, and under D40 a person's group is chosen per login session, so one column would serve two meanings.

## Open: the agent account

The agent member (`addAgent`) is a person who signs in, so under D40 the person picks a group each session and a fixed group on that row would contradict it. The granted service (`grantService`) acts without a login and is the other candidate for "AI agent account", but its key is minted by the operator, not by the Instance owner, so no seat of a key owner exists to check. This issue builds the agency key only and leaves the question to the owner.
