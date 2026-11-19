# Modules moved to sibling repositories

Each module listed here no longer lives in `code/wakala-api/modules/`. The hub imports it from its sibling repository at a tag, with no `replace` line, and the in-tree folder is deleted. Fixes to the module are made in the sibling and the hub takes them by moving the tag. Each sibling lists every difference from the old hub copy, and what the merge took, in its own `documentation/3. implementation/hub-import-drift.md`.

| Module | Sibling repository | Tag | Date | Notes |
|---|---|---|---|---|
| permissions | `github.com/aosanya/mwanachama-backend-permissions` | v0.1.0 | 2026-11-19 | The package is named `mwanachamapermissions`; the hub files import it under the alias `permissions` or `mwanachamapermissions`, as before. The hub's `PermissionsManager` wrapper (`internal/api/http/caches.go`), the permission catalogue and the `cmd/server/permissions.go` wiring stay in the hub. The code was identical to the hub copy; the sibling gained the hub's five test files. |
| voting | `github.com/aosanya/mwanachama-backend-voting` | v0.1.0 | 2026-11-19 | Package `voting`; `models` and `routes` are imported from the sibling's subfolders. The hub gains the poll window rule: `opens_at` and `closes_at` are RFC 3339, compared by instant and stored as UTC, and a window that does not close after it opens is refused with 400. The hub's asker change (`mine`, `in_audience`) was merged into the sibling. The resident gate, the routes mount and the agency registry wiring stay in the hub. |

## Open in the siblings

- `mwanachama-backend-permissions`: two tests in `routes/`, `TestAQuestionNamingNoScopeIsRefusedEvenForAnEverywhereGrant` and `TestAnEmptySubjectCanNeitherHoldAGrantNorPassTheCheck`, expect `200` for a missing `scope` or `subject` and get `400`, because shared's dispatch now refuses a missing required query argument. The hub does not run them.
- `mwanachama-backend-voting`: two tests in `result_cover_test.go` fail on the tag, `TestPublishingAgainReplacesThePublisherAndGroups` and `TestAPublishedCountIsReadOnlyByAMemberOfAPublishedGroup`. The code is unchanged from the hub; the tests disagree with it. The hub does not run them.
