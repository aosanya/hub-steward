# The API server

A guide for someone who is about to change [code/wakala-api](../../../code/wakala-api). It says where things live and how to add to them. Every path below is under `code/wakala-api`. The whole stack is in [architecture.md](architecture.md).

## Run and check it

```sh
cd code/wakala-api
go build ./...
go vet ./...
go test ./...
go build -o /tmp/wakala-server ./cmd/server
PORT=8082 WAKALA_SQLITE_PATH=/tmp/wakala.db /tmp/wakala-server
```

- **No test files.** The copy in this repository has none, so `go test` only compiles it. `go build` and `go vet` are the checks that mean something.
- **Port.** The server listens on `:8080` unless `PORT` is set (`cmd/server/main.go`). The Docker setup and this guide use 8082.
- **`.env`.** On a normal start the server reads `.env` from the working directory and applies each entry that is not already in the environment (`cmd/server/env.go`). Start it from a directory with no `.env` unless you want one read. A staging run reads none (`cmd/server/staging.go`).
- **Database.** With `DATABASE_URL` set it opens Postgres. Without it, SQLite at `WAKALA_SQLITE_PATH`, or in memory when that is unset (`buildDeps` in `cmd/server/main.go`). Member accounts and sign-in sessions are built only on the Postgres path.
- **Settings.** The names are in [.env.example](../../../.env.example). The ones the server reads are the `os.Getenv` calls in `cmd/server`.
- **Signing in.** `POST /auth/signin` takes `{"email","password"}`, sets the session cookie and answers 201; without the cookie `/me` and `/instances` answer 401. The accounts come from `enrol` in the hub-steward-swe loader. A wrong password five times in a row locks that email from that address for 15 minutes (`internal/throttle/limits.go`, `signin_guard.go`); a right one clears the count. The QA hub, its fixed ports, the people and where their passwords are kept: `hub-steward-swe/documentation/4. qa/qa-environment.md`.
- **Health.** `GET /healthz` answers `{"status":"ok"}` (`internal/api/http/router.go`).

## How the repository is laid out

| Path | What it holds |
|---|---|
| `cmd/server/` | The program: environment, database, the dependency bundle, and the timers (schedule sweep, step-limit sweep, review resume) |
| `internal/api/http/` | Every route and the MCP server, hand-written on `net/http`'s `ServeMux`. `router.go` lists the registrations |
| `internal/agencies/` | The registry. Each agency is an instance with its own table set; `registry.go` explains why |
| `internal/accounts/` | Picks the database connection for a caller (`router.go`) and carries the caller's identity in the request context |
| `internal/approvals/` | The proposal store behind approvals |
| `internal/authz/`, `internal/session/`, `internal/apikeys/` | Permission caches, signed sessions, API and service keys |
| `internal/shopauth/` | Sending and checking the emailed sign-in link |
| `modules/` | One folder per module: `agency`, `actor`, `comm`, `forms`, `catalog`, `market`, `riskmanager`, `voting`, `custody`, `digitaltwin`, `engage`, `taskmanager`, `sources`, `assetmanager`, `ai` and others |
| `modules/shared/` | The engine the modules share: `spec`, `specstore`, `dispatch`, `httpwire` |

## How a module becomes routes and tools

A module declares its objects and its operations in JSON, and writes only the behaviour in Go. `modules/agency/doc.go` sets out the layout:

- `<module>.blueprint.json` names the objects, fields and indexes.
- `<module>.operations.json` names the operations. One entry holds the HTTP `method` and `path`, the `call` (a method on the module's manager), the `action`, the `args`, what it `returns`, and the `tool` name (see `modules/agency/agency.operations.json`).
- `*_impl.go` holds the manager methods the operations call.
- `routes/` builds the HTTP routes: `dispatch.Dispatch` binds each operation's `call` to the manager by reflection (`modules/shared/dispatch/dispatch.go`, `modules/agency/routes/routes.go`).
- `mcp/` builds the MCP tools from the same file with `dispatch.Tools` (`modules/shared/dispatch/tools.go`).

`Spec.Validate` (`modules/shared/dispatch/spec.go`) tracks the action, the address and the tool name of every operation, so a duplicate is reported when the spec loads.

`internal/api/http/router.go` registers each module's routes. `newMCPServer` in `mcp.go` registers each module's tools on `/mcp` (`oauth_resource.go` holds the path). `operation_routes.go` lists the mounted modules so `GET /me/operations` can say what a caller may do.

## Agencies and the module switch

- An agency is an instance. `internal/agencies/registry.go` gives each one its own tables from `mwanachamaagency.SpecFor(TableSlug)`.
- Which modules an agency has is switched in its draft. `modules/agency/models/modules_catalog.json` lists every module with `enabled`, `locked`, `mount` and `requires`.
- `internal/api/http/module_switch.go` caches an agency's switched-on set for 30 seconds (`mountedModulesExpiry`), so a change can take that long to show.
- A module can be mounted under a name the agency chooses (`module_mounts.go`, `modules/agency/module_mounts.go`).

## Where the large parts are

- **Approvals.** The routes are in `internal/api/http/approvals_routes.go`: propose, list, decide, amend. Deciding is for an agency owner (`mustOwnAgency`, line 50). A decided proposal is carried out only if its kind is in the `approvalAppliers` map in `approvals_apply.go`; any other kind is recorded and nothing is written.
- **Accounts and sign-in.** `POST /auth/magic-link` is in `member_signin.go`; the link is sent and checked by `internal/shopauth/`. [local-database.md](local-database.md) says how to run it.
- **The AI gateway.** `POST /instances/{instanceID}/ai/v1/chat/completions` is in `ai_gateway.go`. Accounts, roles, instructions and limits are in `modules/ai/` and `ai_routes.go`. A provider is `openai_compatible`, `anthropic` or `gemini` (`modules/ai/models/models.go`). A stored key is sealed with `AI_MASTER_KEY` (`modules/ai/seal.go`). [other-models.md](other-models.md) covers the choice of model.
- **Permissions.** A role holds permission codes; each code lists the actions it opens (`modules/agency/models/permissions_catalog.json`). An agent's tool calls are checked against its role (`internal/api/http/agent_permissions.go`).
- **Agent keys.** Service keys are in `service_keys.go` and `service_grants.go`.

## Add an operation to a module

1. Add the method to the module's manager and write it in a `*_impl.go` file.
2. Add an entry to the module's `<module>.operations.json`: `method`, `path`, `call`, a new `action`, `args`, `returns`, `tool`.
3. If the method can return a new error, add it to the file's `errors` map with its status, and to the `sentinels` map in the module's `routes/routes.go`.
4. If a role should be able to hold it, add the `action` to a permission in `permissions_catalog.json`, or add a new permission.
5. A tool written by hand, outside the operations file, is mapped to its action in `internal/api/http/mcp_actions.go`.
6. Run `go build ./...` and `go vet ./...`, then start the server and call the route.

## Add a module

Copy the shape of a small module, such as `modules/riskmanager`: a blueprint, an operations file, a manager, `provision.go`, `routes/` and `mcp/`. Then:

1. Add its entry to `modules_catalog.json`.
2. Register its routes in `internal/api/http/router.go` and its tools in `newMCPServer`.
3. Add it to `mountedOperations` in `operation_routes.go`.
4. Have the registry provide its manager and create its tables: `internal/agencies/registry.go` calls each module's `Provision` for every agency.

## What is not here

- **The reply loop.** Nothing in `code/` reads a room, decides and posts a reply. The roles, rooms, keys and tools it would use exist. [hub-keys.md](../../2.%20design/technical-spec/hub-keys.md) says what is built.
- **The digital twin.** It is a catalog entry that is off and has no mount, and there is no `modules/digitaltwin`.
- **Tests.** There are no Go test files here.

## Mistakes to avoid

- Starting the server where a `.env` sits that points at a database you care about. The file is read.
- Adding a route in `router.go` by hand when the module has an operations file. Declare it in the file, so the route, the tool and the permission stay together.
- Reusing an `action` or a tool name. The spec refuses a duplicate when it loads.
- Adding a sentinel error in one of the two places only (the `errors` map and `routes.go`).
- Expecting a module switch to show at once. The cache holds for 30 seconds.
