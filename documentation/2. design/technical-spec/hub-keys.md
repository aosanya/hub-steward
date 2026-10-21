# Hub keys: how the agent gets into each hub

The agent's credential is a service key. The pages of this spec call it the service key and nothing else. It is minted by the API's operator, and each hub grants the `hub-steward` service to its Hub Steward role. The service then works in that one hub as an agent holding that role's permissions and no more. No key appears in a response, page or log.

An agency also has keys of its own, for callers that act for the agency. They are a different kind and are not what this page is about.

## Built in this repository

- Minting: the operator creates, lists and revokes service keys with the admin token (`POST`, `GET` and `DELETE /auth/service-keys`, `code/wakala-api/internal/api/http/service_keys.go`).
- Granting: when the console creates a hub it calls `agency_grant_service` for the `hub-steward` service and the agency's Hub Steward role (`serviceName` and `agency_grant_service` in `code/console/src/entry/hubSetup.ts`). Only an owner may grant, a role is required, and a missing service or role is refused.
- Rooms: the console creates three rooms in the new hub, the Managers' room, the Farmers' room and the Suppliers' room (`roomNames` in the same file), whatever the template.
- Model: through the agency's AI gateway in the API. The agency's model is an AI account set on the console's Models page. The agent holds no model key; the key is sealed in the API's database with `AI_MASTER_KEY`.
- Narrowing: the role's permissions are the only narrowing inside a hub. A tool whose permission the role lacks is refused.

## Not in this repository

- The agent that uses the key. Nothing here lists an agency's rooms, notices new messages, runs the model's tool calls or posts a reply. No code reads a service key from `HUBSTEWARD_SERVICE_KEY`, looks up the hubs a key serves, or finds rooms by name. This is the loop in [the agent](03-the-agent/README.md), and it is To be built, or runs outside this repository.
- A test of the whole way in over MCP. The API copy here has no test files; see [API server tests](../../4.%20qa/testing/02-results/api-tests.md).
- A route and tool allowlist for service callers. Until it is built, a role's permissions are the only narrowing.
- A watching role that runs against a hub made in the console. The Network Watcher is a role the riders' and the grid utility's templates declare; nothing here runs it.
