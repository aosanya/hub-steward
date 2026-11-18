# Fix flow once both APIs import the backends

How a fix reaches the hub API (`code/wakala-api`) and `mwanachama-wakala-api` after both import `mwanachama-backend-git` and `mwanachama-backend-shared` (hub issue ISS-105). The plan behind it is `import-switch-plan.md`; the study is `documentation/2. design/vendored-modules.md`.

## Rules

- A fix is made in the backend repo that owns the code. `mwanachama-backend-git` is the custodian of the git module; `mwanachama-backend-shared` is the custodian of shared. Never in the hub.
- No copy, no sync script, no committed `vendor/` folder. The hub holds no backend code. A `replace` to a sibling folder is never committed in the hub.
- A hub fix that cannot wait for a tag is still made in the backend and tagged as a patch version.
- Shared before git. `mwanachama-backend-git` requires `mwanachama-backend-shared`, so when a fix touches both, the shared tag comes first and the git `go.mod` is bumped to it before the git tag.
- Both APIs move together. Their `go.mod` files carry the same version of each backend, so a route behaves the same in both.

## The steps

1. Write the red test first in the backend repo. See it fail for the reason the bug gives.
2. Make the fix. Run the tests in the backend repo, then run them again on a clean export of the commit (a fresh `git clone` or `git archive` into an empty folder, no sibling folders, no `replace`). Both runs are green.
3. The owner confirms the tag. Pushing a tag to a public GitHub repo cannot be taken back: the public proxy and checksum database remember the first hash, so a wrong tag is superseded by a new version, never moved. Nothing is tagged until the owner says the number.
4. Tag and push it. When shared changed, do it for shared first, wait until `go list -m github.com/aosanya/mwanachama-backend-shared@vX.Y.Z` answers, bump the require in `mwanachama-backend-git/go.mod`, test, then tag git the same way.
5. Bump the version in `projects/hub-steward/code/wakala-api/go.mod` (`go get github.com/aosanya/mwanachama-backend-git@vX.Y.Z`, then `go mod tidy`). Commit `go.mod` and `go.sum`.
6. Bump the same version in `mwanachama-wakala-api/go.mod`. Commit.
7. Run the git tests in both APIs (`go test ./modules/...` is gone with the copy; run `go test ./...` in each API, which covers the code that uses the module). Done when both are green.

A tag must be visible on the public proxy before the commit that requires it, or every build in between fails.

## The five private backends

Agency, catalog, permissions, ratings and workspace are private repositories. The owner chose to make them public, and does it on GitHub. After a repository is public it follows the steps above like git does: custodian repo, red test, owner confirms the tag, tag, bump both `go.mod` files.

Until a repository is public:

- `mwanachama-wakala-api` imports it from its sibling folder with a `replace` line, as it does today. This is the only place a `replace` stays.
- The hub cannot import it: the hub's Docker build context is one folder and a fresh clone has no siblings, so a `replace` cannot work there. The hub keeps its existing copy of that module for now, which is the one exception to "no copy". It is not synced by script. It is removed in the same change that switches the module to an import, once the repository is public and tagged.
- A fix to one of the five is made in its own repo. Mirroring it into the hub copy by hand stays a stop-gap until the owner flips visibility.
- The per-area tally of the board (MUN1301) is such a stop-gap copy in the hub's `modules/catalog`: `board_item_tally.go`, `board_item_tally_backing.go`, `board_item_tally_book.go`, the `AreaTally`, `BoardItemAreaTally` and `AreaPopulation` types in `models/board_item.go`, `AreaDirectory` and `UseAreaDirectory` in `catalog_manager.go`, and the `tally_board_items_by_area` operation in `catalog.operations.json`. It mirrors `mwanachama-backend-catalog` ab977c1, and `internal/agencies/area_directory.go` mirrors `mwanachama-wakala-api` 06964cb. Both commits are not on origin. The copy is removed in the change that makes catalog public and imports it.

- The row allowance of MUN1407 is such a stop-gap copy in the hub's `modules/agency`: `row_allowance.go` and the `ctx` argument of `validateRowAnswers` in `record_impl.go`. It lets `addLiveRow` (`internal/api/http/record_rows.go`, `record_details_allowance.go`) accept the details the owner added and waive a Required question the owner switched off. It belongs in `mwanachama-backend-agency` and is removed in the change that makes agency public and imports it.

The routing layer in `mwanachama-backend-git` must not import the private catalog. It takes the catalog through an interface (G79).

## What the owner decides

- Each tag number, one at a time.
- When each of the five repositories becomes public.
