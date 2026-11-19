# Modules moved to sibling repositories

A module listed here is no longer a folder under `code/wakala-api/modules`. The hub imports the sibling repository at a tag, with no `replace` line, and the hub keeps only the wiring around it (routes mounts, permission checks, per-agency managers, MCP tool registration).

| Module | Sibling repository | Tag | Moved on | Notes |
|---|---|---|---|---|
| `forms` | `github.com/aosanya/mwanachama-backend-forms` | v0.1.0 | 2026-11-19 | The package is named `mwanachamaforms`, as the hub copy was; the subpackages are `models` and `routes`. `Provision` takes options: the hub passes `WithAgencyApprovals(approvals.FormsStore{})` (`internal/approvals/forms_store.go`), because Go does not let the sibling import `wakalaserver/internal/approvals`. A `time` answer is strict `HH:MM` (`07:05`; the hub copy also took `7:05`). The text of a report is read with the host's reason hidden: 502 with no reason, 422 `ErrReportNotText` for a file that is not text, a missing form answers as a missing report. |
| `audit` | `github.com/aosanya/mwanachama-backend-audit` | v0.1.0 | 2026-11-19 | The package is named `mwanachamaaudit`; the subpackages are `models`, `routes` and `mcp`. The hub keeps its HTTP wiring of the list tool. |
| `council` | `github.com/aosanya/mwanachama-backend-council` | v0.1.0 | 2026-11-19 | The package is named `mwanachamacouncil`; the subpackages are `models`, `routes` and `mcp`. The hub keeps the council tool wiring. |

Each sibling lists every difference from the hub copy it replaced in its own `documentation/3. implementation/hub-import-drift.md`.

## What stays in the hub

| Module | Hub files |
|---|---|
| `forms` | `internal/api/http/forms_routes.go`, `forms_catalog_routes.go`, `mcp_tools_forms.go`, `mcp_tool_actions.go`, `resident_forms.go`, `form_*.go`, `results_*.go`, `survey_announcements.go`; `internal/agencies/registry.go`, `approval_limits.go`, `address_check.go`, `inspector_forms.go`, `report_text.go`; `cmd/server/forms.go`; `internal/approvals/forms_store.go` |
| `audit` | `internal/api/http/mcp_tools_audit.go`, `deps.go`, `mcp_audit_paper_consent.go` |
| `council` | `internal/api/http/mcp_tools_council.go`, `deps.go` |
