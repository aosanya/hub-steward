# Modules moved to sibling repositories

A module listed here is no longer a folder under `code/wakala-api/modules`. The hub imports the sibling repository at a tag, with no `replace` line, and the hub keeps only the wiring around it (routes mounts, permission checks, per-agency managers, MCP tool registration).

| Module | Sibling repository | Tag | Moved on | Notes |
|---|---|---|---|---|
| `comm` | `github.com/aosanya/mwanachama-backend-comm` | v0.1.0 | 2026-11-19 | The package is named `mwanachamacomm`, as the hub copy was; the subpackages are `models` and `routes`. The sibling adds the tool `comm_chat_thread_read` (action `comm.chat_thread.read`), so the pinned MCP roster grows by one in every mount configuration. It refuses a message or reaction that draws nothing, where the hub copy refused only a blank one. The action is not yet in the permission catalogue, see below. |
| `digitaltwin` | `github.com/aosanya/mwanachama-backend-digitaltwin` | v0.1.0 | 2026-11-19 | The package is named `digitaltwin`; the hub files that import it keep the alias `mwanachamadigitaltwin`. The sibling's `mcp` package registers every declared operation and is not used by the hub; the hub-only filter that serves the node list and read tools and the address, tenure and land use tools, and resolves the agency per call, moved to `internal/digitaltwinmcp`. The sibling also names the five tenure kinds as constants; the values are the same. |

Each sibling lists every difference from the hub copy it replaced in its own `documentation/3. implementation/hub-import-drift.md`.

## What stays in the hub

| Module | Hub files |
|---|---|
| `comm` | `internal/api/http/comm_routes.go`, `resident_comm.go`, `mcp_tools_actor_comm.go`, `form_thread_landing.go`, `join_threads.go`, `join_decisions.go`, `join_requests_told.go`, `member_removal.go`, `membership.go`, `market_announced.go`, `market_announced_calledoff.go`, `market_names.go`, `survey_announcements.go`, `results_announcements.go`, `invited_group_names.go`; `internal/agencies/registry.go`, `caches.go`, `rooms.go`, `room_recipients.go`, `case_threads.go`, `case_notices.go`, `subject_threads.go`, `join_threads.go`, `late_bills_sweep.go`, `schedule_sweep.go`; `internal/notifyrules`; `internal/testruns/comm_stage.go`; `cmd/server/webpush.go`; the comm entries of `modules/agency/models/permissions_catalog.json`; the mount of `comm_notification_raise` and the three events it lets through (`report_handed_over`, `payment_late`, `payment_list_handed_over`) in `internal/agencies/registry.go` |
| `digitaltwin` | `internal/digitaltwinmcp/resolve.go`, `internal/api/http/digitaltwin_routes.go`, `mcp_tools_digitaltwin.go`, `record_row_lineage.go`; `internal/agencies/registry.go`, `caches.go`, `address_check.go`; `internal/accounts/router.go`; the digitaltwin entries of `modules/agency/models/permissions_catalog.json` and the `places` entry of the module catalogue |

## Open after the comm switch

The sibling's tool `comm_chat_thread_read` runs the action `comm.chat_thread.read`. The permission catalogue does not name that action, so only an agency's owner may call it: a member or role holder is refused until the catalogue lists it, for example under `chat.thread`, and a resident is refused until `residentCommActions` in `internal/api/http/resident_comm.go` lists it. The catalogue belongs to the agency sibling. Whether a member or a resident may read a thread by id is the owner's decision; nothing was added in the hub.
