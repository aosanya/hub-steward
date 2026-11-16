# Vendored modules: copy or dependency (Q23)

Question Q23 (hub issues G76 and ISS-6): should the modules copied into `code/wakala-api` (`modules/*` and `internal/agencies`) become Go dependencies on the `mwanachama-backend-*` repos and `mwanachama-wakala-api`, instead of being copied?

Measured on 2026-11-16, read-only. The backend repos were at `mwanachama-backend-git` 512a589 (2026-11-14) and `mwanachama-wakala-api` 8bd70b3 (2026-11-15).

## What is copied

| Copy in the hub | Source repo | Go module path in the hub | Go module path in the source |
|---|---|---|---|
| `code/wakala-api/modules/<name>/` for 23 modules: accounting, actor, agency, ai, assetmanager, auth, catalog, comm, custody, digitaltwin, engage, forms, git, insights, market, permissions, ratings, riskmanager, sources, taskmanager, voting, workspace, and shared | `mwanachama-backend-<name>` | `wakalaserver/modules/<name>` | `github.com/aosanya/mwanachama-backend-<name>` |
| `code/wakala-api/modules/shared/` (spec, specstore, dispatch, httpwire, gormutil, events, geo, identity, mcpui, recur, plus hub-only consent, disclosure, plaintext) | `mwanachama-backend-shared` | `wakalaserver/modules/shared/...` | `github.com/aosanya/mwanachama-backend-shared/...` |
| `code/wakala-api/internal/` (including `internal/agencies`, 86 files in the source) and `cmd/` | `mwanachama-wakala-api` | `wakalaserver/internal/...` | `github.com/aosanya/mwanachama-wakala-api/internal/...` |

1,222 Go files in the hub import `wakalaserver/modules/...` (586 import references go to shared, 282 to agency, 151 to forms, 143 to actor, 138 to taskmanager).

The copy was made on 2026-11-04 in three commits ("Copy in the agency, actor, catalog and permissions modules...", f871f83c, b4660864). Since then 302 commits have touched `modules/`.

Three things the copy changes while it copies:

1. Import paths: `github.com/aosanya/mwanachama-backend-X` becomes `wakalaserver/modules/X`.
2. Comments are removed (the no-comments rule). The hub's files are the backend's files with the comments gone; the raw diff of `git` is 837 backend-side lines, almost all comments.
3. The backend's `cmd/`, `documentation/`, `scripts/`, `go.mod`, `go.sum`, `CLAUDE.md`, `README.md`, `Makefile` and `LICENSE` are not copied, and shared's `entitygraph`, `memory`, `postgres`, `schema`, `vocab`, `orgpolicy`, `orgsettings` and `gormtest` are not copied either.

## How it is kept in sync today

By hand. There is no sync script, Makefile target, `go generate` step or CI check for it.

- Searched with no hit: `hub-steward/Makefile`, `hub-steward/scripts/` (`fake-api.py`, `local-setup.sh`, `local-setup.test.sh`), `code/wakala-api/Makefile` (only `restart` and `restartQA`), `code/wakala-api/scripts/` (only `two_process_poll_replace.sh`), `.github/workflows/ci.yml`, `docker-compose.yml`, `documentation/3. implementation/guides/` (`api-server.md`, `architecture.md`, `ci.md`), and the backend `CLAUDE.md` files of `mwanachama-backend-git` and `mwanachama-wakala-api`. None describes how the hub copy is refreshed, and the two backend `CLAUDE.md` files do not mention the hub copy.
- What the git history shows is a person or agent re-applying a backend change in the hub, named in the commit message: "Mirror: InitRepo in single-repository mode ignores deleted repositories (hub issue G75)" (ea4e2393), "git module: DeleteFile removes the path from the tree..." (d29bce37, G73), "git: Delete and Purge release the cached handle..." (6fca6c0a, G74), "git module: per-repository SQLite files... from mwanachama-backend-git G57 to G72" (4c5ce035, ISS-6), and for taskmanager "as the backend copy does (e54b6d6)" (34a8d6af, d78f24f9). The matching backend commits are `ae09abd`, `5d0fa0c` and `512a589` in `mwanachama-backend-git`.
- The other direction also happens. Fixes written in the hub (MUN issues, for example MUN82 import codes, MUN172 plaintext, MUN245 reversals, MUN308 git errors) are in the hub copy only.
- `documentation/3. implementation/guides/api-server.md` and `README.md` used to say the hub copy has no test files. They are corrected: the hub copy holds Go test files (363 `_test.go` files when this was measured).

## Drift measured

Method: copy each `mwanachama-backend-<name>` (without `cmd/`, `documentation/`, `scripts/`, go.mod, go.sum and the top-level docs), rewrite the import paths to the hub's, run every Go file through the Go parser and printer on both sides so comments and formatting fall away, then `diff -r`. Test files are counted separately.

### The git module (the question's example)

After the rewrite and the comment strip, `modules/git` differs by 40 lines in non-test code.

- Differing files: `errors.go`, `git.operations.json`, `operations.go`, `models/repository.go`, `git_impl_blobsearch.go`, `git_impl_fetchbranch.go`, `git_impl_fileops.go`, `git_impl_mergerequests.go`, `git_impl_push.go`.
- Only in the hub: `git_smarthttp_file.go`, `git_smarthttp_file_snapshot.go`, `git_smarthttp_file_store.go` (a file-backed smart HTTP store).
- Only in the backend, non-test code: none.
- Tests: backend-only `git_realgit_integration_test.go`, `git_realgit_shallow_test.go`, `postgres_integration_test.go`; hub-only `git_impl_fileops_siblings_test.go`, `git_smarthttp_file_test.go`, `routes/repository_list_test.go`, `routes/undeclared_cover_test.go`; one differing test file.

Every one of the 40 lines is the hub ahead of the backend, none is the backend ahead of the hub:

- `ErrQueryRequired`, `ErrTitleRequired`, `ErrSourceBranchRequired` and their 400 mapping (MUN308); the backend still answers `fmt.Errorf` and so a 500.
- `last_commit_at` on `models.Repository` and in the list description (ISS-12).
- `indexPushedBranchFrom` split out of the push path.
- A tree is sorted with `object.TreeEntrySorter` (git's own tree order) where the backend sorts by name.
- `FetchBranch` of a missing branch answers `ErrBranchNotFound`.

So the git copy is small but it is not a snapshot of the backend. G73, G74 and G75 did land in both places; the hub's own fixes did not go back.

### All modules

Non-test files and lines, after the rewrite and the comment strip. "Differ" is files present on both sides with different text. Lines are removed plus added lines.

| Module | Differ | Only in hub | Only in backend | Diff lines |
|---|---|---|---|---|
| accounting | 11 | 2 | 1 | 484 |
| actor | 18 | 9 | 0 | 374 |
| agency | 21 | 2 | 1 | 230 |
| ai | 13 | 6 | 2 | 269 |
| assetmanager | 11 | 2 | 1 | 222 |
| auth | 0 | 0 | 1 | 0 |
| catalog | 20 | 5 | 2 | 363 |
| comm | 25 | 2 | 2 | 200 |
| custody | 25 | 6 | 0 | 432 |
| digitaltwin | 4 | 3 | 2 | 38 |
| engage | 11 | 1 | 0 | 138 |
| forms | 32 | 15 | 0 | 658 |
| git | 9 | 3 | 0 | 40 |
| insights | 3 | 2 | 1 | 24 |
| market | 10 | 0 | 1 | 261 |
| permissions | 0 | 0 | 2 | 0 |
| ratings | 0 | 0 | 1 | 0 |
| riskmanager | 15 | 2 | 2 | 136 |
| shared | 6 | 8 | 11 | 79 |
| sources | 0 | 0 | 1 | 0 |
| taskmanager | 29 | 16 | 1 | 1,545 |
| voting | 13 | 4 | 1 | 201 |
| workspace | 5 | 0 | 1 | 108 |

Reading it:

- Four modules match their backend in code: auth, permissions, ratings, sources. The other 19 differ.
- About 5,800 lines differ across the modules. Taskmanager (1,545), accounting, forms, custody, actor, catalog and market carry most of it.
- The "only in backend" column is mostly test data, spec fixtures and the backend's own entry files, not code the hub lacks. The exception is shared, where the backend has `entitygraph`, `memory`, `postgres`, `schema` and `vocab` and the hub does not.
- The hub is ahead in most of the differing files (its issues were fixed there), but not in all: the lines were not read one by one for the other 22 modules, only for git.

### internal and cmd

Same method against `mwanachama-wakala-api/internal` and `cmd`, with `github.com/aosanya/mwanachama-wakala-api` rewritten to `wakalaserver`.

| Folder | Differ | Only in hub | Only in backend | Diff lines |
|---|---|---|---|---|
| `internal/agencies` | 13 | 19 | 0 | 328 |
| `internal` as a whole | 77 | 54 | 6 | 1,667 |
| `cmd` | 4 | 2 | 5 | 41 |

The hub's `internal/agencies` has 19 files the backend does not (consent gate, consent withdrawal, group roles, approval limits, backlog roles, record writers, keyed lock and others). The backend has `controlenforce`, `operatorrole` and `store` under `internal/` that the hub does not.

## Can a Go module dependency work

What exists:

- Each backend is its own Go module (`module github.com/aosanya/mwanachama-backend-git`, `go 1.25.0`). `mwanachama-wakala-api/go.mod` already depends on 20 of them, each with a `replace github.com/aosanya/mwanachama-backend-X => ../mwanachama-backend-X` line, so it builds only when every backend sits next to it on disk.
- No `go.work` was found in the `mwanachama/` container.
- Tags: only `mwanachama-backend-shared` has one (`v0.1.0`). Every other repo has none, which is why the requires read `v0.0.0`.
- Visibility on GitHub: private are `mwanachama-backend-agency`, `-catalog`, `-permissions`, `-ratings`, `-workspace` and `mwanachama-wakala-api`; the rest, including git, shared, actor, forms and taskmanager, are public. `aosanya/hub-steward` is public.
- Hub build: `docker-compose.yml` builds `./code/wakala-api`; its `Dockerfile` copies `go.mod go.sum`, runs `go mod download`, copies the folder and builds `./cmd/server`. The build context is that one folder. `.github/workflows/ci.yml` runs `go vet`, `go test` and `go build` in `code/wakala-api`.

What follows:

1. A `replace ... => ../mwanachama-backend-git` cannot work in the hub. The Docker context and a fresh clone of `hub-steward` have no sibling folders. This is the same break as in the memory note on unpushed siblings, one level up.
2. A real `require` needs a tag or pseudo-version the Go proxy or git can fetch. Every backend except shared, and wakala-api, has no tag today; the require would pin a commit.
3. Five of the backends the hub copies are private. A hub build needs `GOPRIVATE=github.com/aosanya/*` and a token in the Docker build (a build secret, not in the image) for those, or those five repos must become public. Public repos need nothing.
4. `go mod vendor` removes both problems for the build: the hub commits a `vendor/` folder of the tagged backends and builds with `-mod=vendor`, no network and no token. It also keeps the whole source in the public hub repo, as the copy does today.
5. `internal/agencies` cannot be a dependency as it stands. Go refuses to import a package under `internal/` from another module. It would first have to move into a package that is not `internal` (for instance a `mwanachama-backend-agencies` repo or a public folder in wakala-api).
6. Imports: the hub's 1,222 files would change from `wakalaserver/modules/X` to `github.com/aosanya/mwanachama-backend-X`. That is one mechanical rewrite, the reverse of the copy step.
7. The 5,800 module lines and the hub's 1,667 `internal` lines are the real cost. The hub is ahead, so a dependency on today's backend tags would take the hub backwards (the git copy would lose its 400 errors and `last_commit_at`). The hub changes must go into the backends and be tagged before the hub switches.
8. The hub's source has no comments by rule. The backends do. A dependency (or vendor folder) brings the backends' comments into the hub, unless the backends are made comment-free too.

Observation for the owner: the public hub repo already carries the source of five private backends (agency, catalog, permissions, ratings, workspace) through the copy. That is true with either option below; it matters if the plan is to keep those five private.

## Options

1. Keep copying, and make it a script plus a check. Add `scripts/sync-modules.sh` that copies a backend, rewrites the imports, strips comments (the Go printer pass above) and refuses to overwrite a file the hub has changed since the last sync; a CI job reports the drift table above. The hub stays one folder that builds anywhere with no credentials. The cost: two homes for every fix remain, and the 5,800 lines of hub-only change still have to be carried by hand each time.

2. Go dependencies with a vendor folder, module by module. Tag the backends (`v0.1.0` style); first move the hub-only fixes into each backend and tag it; then the hub replaces `modules/<name>` with a `require` and `vendor/`. Start with the four modules that already match (auth, permissions, ratings, sources), then git (40 lines), then the small ones, and leave taskmanager, forms and accounting last. `internal/agencies` stays copied until it has a non-`internal` home.

3. Reverse it: the hub builds from `mwanachama-wakala-api` itself (a fork or a configuration of it) and `code/wakala-api` stops being a source tree. One source tree, no copy, no dependency graph to manage. The cost is the largest: the hub's 1,667 `internal` lines and `cmd` differences must be merged into wakala-api, and the hub stops being a place where the API can be changed on its own.

## Recommendation

Option 2.

The plain reason: the copy is already two codebases. Four modules match, 19 do not, the hub is ahead in the one module read line by line, and the only thing that joins the two is a person remembering to mirror a fix. A dependency makes a divergence impossible instead of something to measure. The vendor folder keeps the hub's build as self-contained as it is today (no token, no network, no sibling folders), so the Docker build and the public clone do not change.

It is staged on purpose. Nothing is lost by starting with the four matching modules and git, and each step is one module, one tag and one import rewrite. Option 1 is the fallback if the hub's changes are meant to stay in the hub, and it is the only one that costs nothing before an answer.

## Open question for the owner

Is the hub's copy of the modules a snapshot of the Mwanachama platform, which should take the platform's fixes and give its own back (then Option 2: its fixes go into the backends first), or is it the hub's own product that is allowed to change on its own (then Option 1, a script that reports drift and does not overwrite)?

A smaller follow-up if the answer is Option 2: may the five private backends stay private while the public hub repo holds their source in `vendor/`, or do they become public?

## Files read

- `hub-steward/code/wakala-api/go.mod`, `Dockerfile`, `Makefile`, `scripts/two_process_poll_replace.sh`, `modules/git/*`, `modules/shared/*`, `internal/agencies/*`, `cmd/`
- `hub-steward/Makefile`, `docker-compose.yml`, `README.md`, `scripts/`, `.github/workflows/ci.yml`, `code/README.md`
- `hub-steward/documentation/3. implementation/guides/api-server.md`, `architecture.md`, `ci.md`
- `hub-steward/documentation/2. design/technical-spec/02-mwanachama-modules/README.md`, `review/backends.md`
- `mwanachama-backend-git/go.mod`, `CLAUDE.md`, every top-level `.go` and `.json` file, and the same folders of the other 22 `mwanachama-backend-*` repos
- `mwanachama-wakala-api/go.mod` (the 20 `replace` lines), `Makefile`, `CLAUDE.md`, `internal/`, `cmd/`
- `git log` of `hub-steward` for `code/wakala-api/modules` and `mwanachama-backend-git`; `gh repo view` for each repo's visibility; `git tag` in each repo
