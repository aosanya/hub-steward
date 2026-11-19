# Modules moved to sibling repositories

A module listed here is no longer a folder under `code/wakala-api/modules`. The hub imports the sibling repository at a tag, with no `replace` line, and the hub keeps only the wiring around it (routes mounts, permission checks, per-agency managers, MCP tool registration).

| Module | Sibling repository | Tag | Moved on | Notes |
|---|---|---|---|---|
| `git` | `github.com/aosanya/mwanachama-backend-git` | v0.1.0 | 2026-11-19 | The package is named `mwanachamagit`, as the hub copy was; the subpackages are `models` and `routes`. A tag pushed over git is accepted under the tag rules, where the hub copy refused it ("only branches can be pushed to the hub"); a push over 32 MiB is refused with a plain message. The hub's per-repository routing layer (`repositoryFolderGit`, `RepositoryFileAt`, `RepositoryFileInFolder`, `ErrImportNeedsRepositoryFile`) is gone from `internal/agencies`; the registry builds the module's `NewRoutedGitManager` and uses the module's declarations. |
| `insights` | `github.com/aosanya/mwanachama-backend-insights` | v0.1.0 | 2026-11-19 | The package is named `mwanachamainsights`, as the hub copy was; the subpackages are `models`, `routes` and `mcp`. The module is identical to the hub copy apart from tests and the count route that the hub already had. The hub's tool-to-action table still spells two actions `insight.insight.*` where the module declares `insights.insight.*`. |

Each sibling lists every difference from the hub copy it replaced in its own `documentation/3. implementation/hub-import-drift.md`.

## What stays in the hub

| Module | Hub files |
|---|---|
| `git` | `internal/agencies/gits.go`, `repository_catalog.go`, `registry.go`, `caches.go`; `internal/api/http/forms_git_routes.go`, `git_route_auth.go`, `git_route_serve.go`, `mcp_tools_forms_git.go`, `mcp_tool_actions.go`, `results_files.go`; `internal/specs/wakala.git.json`; the git entries of `modules/agency/models/permissions_catalog.json` |
| `insights` | `cmd/server/main.go`; `internal/api/http/deps.go`, `insight_routes.go`, `insight_scope.go`, `insight_mcp_scope.go`, `mcp.go`, `mcp_tool_actions.go`, `mcp_actions.go`; `internal/accounts/router.go`; the `insight.count` entry of `modules/agency/models/permissions_catalog.json`; the insight lines of `internal/api/http/testdata/mcp_lazy/*.txt` and `testdata/mcp_roster/no-mounts.txt` |

## Tests that changed with the git move

| File | Test | Before | After |
|---|---|---|---|
| `internal/agencies/gits_files_test.go` | `TestGitFolder_ManyRepositoriesShareAFewOpenFiles` | Asserted at most one open file after each read, through the unexported `openFiles` of the hub's manager. | Still reads four repositories through one open slot; the open-file count is asserted by `TestRoutedGitManager_ManyRepositoriesShareAFewOpenFiles` in the sibling, where the counter is reachable. |
| `internal/agencies/gits_files_test.go` | `TestGitFolder_AFileCopiedIntoTheFolderWithNoCatalogEntryIsIgnored` | Opened the stray file through the manager's unexported `files` field. | Builds its own `RepoFiles` over the folder with the catalog's registration check and opens the stray file through that. |
| `internal/agencies/gits_files_test.go` | the fixture and `TestGitFolder_ImportingARepositoryIsRefusedOnFiles` | Typed the manager as `*repositoryFolderGit` and compared with the hub's `ErrImportNeedsRepositoryFile`. | Types it as `*mwanachamagit.RoutedGitManager` and compares with the module's `ErrImportNeedsRepositoryFile`. |
| `internal/agencies/repository_file_test.go` | `TestRepositoryFileAt_*`, `TestRepositoryFileInFolder_FindsTheFileThroughTheCatalog` | Tested the hub's copy of `RepositoryFileAt` and `RepositoryFileInFolder`. | File removed with the copy; the same code and tests live in the sibling's `repository_file_stat.go` and `repository_file_stat_test.go`. |

The hub's own `modules/git` tests went with the module folder. The one that pinned a refused tag push, `TestDecidedGitPush_APushedTagIsRefusedWithThePlainMessageAndNoTagAppears`, is replaced in the sibling by the tag-push tests (`git_smarthttp_file_tags_test.go`).
