# Import switch plan: the hub imports mwanachama-backend-git (ISS-105)

Planning page for ISS-105. Measured on 2026-11-16 in scratch copies only. Nothing in the repos was changed, tagged or pushed, and no test was run.

Owner rulings this plan follows (ISS-105 Log, 2026-11-16):

- Both APIs import `mwanachama-backend-git`.
- The per-repository routing layer moves into `mwanachama-backend-git` (G79).
- The hub holds no copy of backend code: no hand copy, no sync script, no committed `vendor/` folder. The existing hub copy is removed module by module as each module switches. This replaces the `vendor/` recommendation in `documentation/2. design/vendored-modules.md`.
- Public backends (git, shared) are imported at tagged versions from GitHub. For the five private backends the owner chooses, see "Private backends".
- Pushing a tag to a public repo is outward-facing, so the owner confirms each tag.

## Answer to the question: can git switch alone?

No. Git cannot switch alone. The shared module must switch first or in the same change.

Why: `mwanachama-backend-git` imports `github.com/aosanya/mwanachama-backend-shared/{spec,specstore,dispatch,httpwire,events,postgres}`. The hub's own `modules/shared` is a different Go package path (`wakalaserver/modules/shared/...`), so its `spec.Spec` is a different type from the backend's `spec.Spec`, even where the text is identical. Wherever the hub passes a shared type into the git module the build breaks.

### Where it breaks (git switched, shared left as the hub copy)

Experiment: a scratch copy of `code/wakala-api` with `modules/git` deleted, its 19 importing files rewritten to `github.com/aosanya/mwanachama-backend-git`, and `replace` lines to scratch clones of the two backends. `go build ./...` stops in `internal/agencies`:

| File and line | Error |
|---|---|
| `internal/agencies/gits.go:58` | returns `*backend-shared/spec.Spec` where `*wakalaserver/.../spec.Spec` is wanted (`mwanachamagit.ParseSpec`) |
| `internal/agencies/gits.go:73` | passes the hub `*spec.Spec` to `mwanachamagit.Provision` |
| `internal/agencies/gits.go:76` | passes the hub `*spec.Spec` to `mwanachamagit.NewGitManager` |
| `internal/agencies/gits_files.go:64` and `:67` | passes the hub `*spec.Spec` to `mwanachamagit.OpenRepoFile` |
| `internal/agencies/gits_files.go:258` | `RepoFile.GitHTTPHandler` is not in the backend (the file-backed smart HTTP store was hub-only; G78 moves it) |

Every one of these is in `internal/agencies` (the registry that builds a `GitManager` from an instance spec). The other 18 importers of the git module (`internal/accounts`, `internal/api/http`, the rest of `internal/agencies`) do not touch a shared type with it, but Go stops at the first failing package, so the scratch build proves the break in `internal/agencies` only, not that nothing else would break. The next experiment covers that.

### When shared switches with it

Second experiment: the same scratch copy with `modules/shared` also deleted and all 470 files that import it rewritten to `github.com/aosanya/mwanachama-backend-shared`. Two things were needed to make it build:

1. The hub's shared changes must exist in the backend's shared (see the diff below). With the backend's shared as it is, the build stops at `package .../plaintext (and disclosure, and consent) not found`.
2. The git module must be the hub's version (G78). With the backend's git at 5d6b99f, the only error left is `GitHTTPHandler` above.

With the hub's `modules/shared` laid over a scratch clone of the backend's shared and the hub's `modules/git` laid over a scratch clone of the backend's git, `go build ./...` of the whole hub API passes with no errors. So there is no source-level obstacle: the switch is mechanical once the backends hold what the hub holds.

### The shared diff (hub copy against mwanachama-backend-shared at 29047b7)

Method as in `documentation/2. design/vendored-modules.md`: rewrite the import path, parse and print every Go file so comments and formatting fall away, then `diff -r`. Non-test code.

Hub ahead, by file:

| File | What the hub has that the backend does not |
|---|---|
| `dispatch/bind.go`, `dispatch/tools_bind.go` | `describeDecodeError` messages, `min=` query tag option (MUN313), a required query argument check, plain type words in errors |
| `dispatch/dispatch.go`, `dispatch/tools.go` | refusal of unstorable text through `plaintext.Unstorable`, `logFailure`, plain error answers through `httpwire.PlainWithLog` and `httpwire.PlainError` |
| `dispatch/decode_error.go`, `dispatch/failure_log.go` | new files (61 and 7 lines) |
| `httpwire/httpwire.go`, `httpwire/plain_message.go` | `WriteErr` answers `PlainMessage(msg)`; new file (37 lines) |
| `gormutil/gormutil.go` | `IsUniqueViolation` |
| `specstore/tx.go` | new file (13 lines) |
| `geo/ward.go` | new file (68 lines) |
| `plaintext/`, `consent/`, `disclosure/` | new packages, hub only |

Backend only (stay in the backend, the hub never imported them): `entitygraph`, `entitygraphtest`, `gormtest`, `memory`, `orgpolicy`, `orgsettings`, `postgres`, `schema`, `vocab`. `git` itself imports `postgres`, so the hub gets it through the dependency without copying it.

There is no line where the backend is ahead of the hub in the six differing files. The hub's shared must therefore be written into `mwanachama-backend-shared` before any hub code can import the backend's shared; that is the missing step called out below.

### Everything in the hub that imports shared types

470 non-shared Go files (84 of them tests) import `wakalaserver/modules/shared/...`: spec 224 import lines, specstore 116, dispatch 99, httpwire 33, geo 20, identity 20, gormutil 12, recur 6, events 4, mcpui 1; hub-only plaintext 24 files, consent 22, disclosure 4. By owner of the files:

| Where | Files |
|---|---|
| `internal/api` | 48 |
| `modules/taskmanager` | 43 |
| `modules/actor` | 36 |
| `modules/comm` | 29 |
| `modules/catalog`, `modules/forms` | 25 each |
| `modules/voting` | 20 |
| `modules/ai` | 18 |
| `modules/auth` | 17 |
| `internal/agencies`, `modules/git`, `modules/riskmanager` | 16 each |
| `modules/agency`, `modules/engage`, `modules/sources` | 15 each |
| `modules/custody` | 14 |
| `modules/assetmanager`, `modules/digitaltwin`, `modules/insights`, `modules/market` | 13 each |
| `modules/ratings` | 10 |
| `modules/permissions`, `modules/workspace` | 9 each |
| `modules/accounting` | 8 |
| `internal/testruns` | 4 |
| `cmd` | 3 |
| `internal/reviewruns` | 1 |

All of these move in one mechanical rewrite when shared switches, because they hand shared types to each other and to git. The hub's copied modules (actor, forms, taskmanager and the rest) stay copied until their own turn, but they import the backend's shared by then; they are not blocked by it (the second experiment compiled all of them against the backend's shared).

## Which shared version does git need, and does v0.1.0 contain it

v0.1.0 (2026-09-14, 44eaf29) does not contain what git uses. It has entitygraph, events, httpwire, gormtest, vocab, orgsettings, orgpolicy, mcpui, memory, postgres and schema. It has no `spec`, `specstore`, `dispatch`, `geo`, `identity`, `gormutil` or `recur`. Shared HEAD is 141 commits after it. Git at 5d6b99f imports `spec`, `specstore` and `dispatch`, so git cannot build against v0.1.0 (experiment: with `replace` pointed at a checkout of v0.1.0, `go build` answers `module ... found (v0.1.0 ...), but does not contain package .../dispatch`, and the same for `spec` and `specstore`).

So git needs a new shared tag, and that tag must contain the hub's shared changes (the table above) because the hub will also import it. Proposed: `v0.2.0` of `mwanachama-backend-shared` (a minor bump: new packages).

Untagged `require ... v0.0.0` does not work for a consumer either. Experiment: a throwaway module requiring a tagged copy of git whose go.mod still says `shared v0.0.0` and has a `replace` fails with `mwanachama-backend-shared@v0.0.0: invalid version: unknown revision v0.0.0`. A `replace` in a dependency's go.mod is ignored by whoever imports it. The fix is in git's go.mod, not the consumer's (a consumer could also require shared at a real tag itself, which made the same throwaway build pass, but then every consumer must know).

## Proof: a clean consume from tags, no replace

All in `/private/tmp/claude-501/.../scratchpad`, nothing in a real repo. The commits and tags exist only in scratch clones.

1. Scratch clone of `mwanachama-backend-shared` (29047b7). Lay the hub's `modules/shared` non-test files over it, rewrite `wakalaserver/modules/shared` to `github.com/aosanya/mwanachama-backend-shared`, `go mod tidy` (go.mod gains `golang.org/x/text v0.29.0` and `gorm.io/datatypes v1.2.7` as direct requires), commit, `git tag v0.2.0`.
2. A small Go tool (`mkproxy`, uses `golang.org/x/mod/zip.CreateFromVCS`) writes the proxy layout from the tag: `proxy/github.com/aosanya/mwanachama-backend-shared/@v/{list,v0.2.0.info,v0.2.0.mod,v0.2.0.zip}`.
3. Scratch clone of `mwanachama-backend-git` (5d6b99f). Lay the hub's `modules/git` non-test files over it with the imports rewritten (this stands in for G78), delete the `replace` line, change `shared v0.0.0` to `v0.2.0`, `go mod tidy` with `GOPROXY=file://<proxy>,https://proxy.golang.org`, `go build ./...` (passes), commit, `git tag v0.1.0`, and `mkproxy` for it. Tidy turned `github.com/google/uuid` into an indirect require; nothing else changed.
4. Scratch copy of `code/wakala-api` without test files, `modules/git` and `modules/shared` deleted, the 19 git importers and the 470 shared importers rewritten to the backend paths, and two lines added to go.mod:

   ```
   require (
   	github.com/aosanya/mwanachama-backend-git v0.1.0
   	github.com/aosanya/mwanachama-backend-shared v0.2.0
   )
   ```

   `go mod tidy` also marks `go-git/go-git/v5` and `golang.org/x/text` indirect (they moved into the backends' direct requires). No `replace`, no `vendor/`, no sibling folder.
5. Environment used:

   ```
   GOPATH, GOMODCACHE and GOCACHE under the scratchpad
   GOPROXY=file://<scratchpad>/proxy,https://proxy.golang.org
   GOSUMDB=off  GONOSUMDB='github.com/aosanya/*'  GOFLAGS=-mod=mod
   ```

   `go build ./...` of the whole hub API passed (about 7 seconds with a warm cache). `go list -m all` reports both modules at `v0.1.0` and `v0.2.0`, fetched from the proxy, and `go.sum` carries their `h1:` hashes. A second run with `GOFLAGS` empty (the default read-only mode, as `go build` in the Dockerfile uses) and an empty module cache also built clean.

What the proof does not cover: test files (not compiled, no tests run, as instructed), `go vet`, the Docker build, and the hub's runtime behaviour. G78 was still landing in `mwanachama-backend-git` while this ran (commits from ISS-88 to ISS-101 appeared), so step 3 used the hub's copy as the stand-in for the finished G78, not the backend's new HEAD.

### Problems found

| Problem | Effect | Where it is handled |
|---|---|---|
| `mwanachama-backend-git` go.mod: `shared v0.0.0` plus `replace ../mwanachama-backend-shared` | A consumer fails (`unknown revision v0.0.0`); the replace is ignored | TD-1508 |
| Shared tag v0.1.0 has none of `spec`, `specstore`, `dispatch` | git cannot use it | needs a new shared tag (step 2 below) |
| The hub's shared changes exist only in the hub | the hub would go backwards on shared exactly as the Q23 study found for git | missing step, see below |
| `go.sum` has no hash for a tag until it is fetched once | a first fetch from GitHub goes through the public checksum database, so a tag cannot be moved or re-pushed afterwards | the owner confirms each tag (TD-1507); a wrong tag is replaced by a new version, never by re-tagging |
| `mwanachama-wakala-api` does not build today against the sibling backends | `internal/agencies/gits_files.go:253` and `gits.go:92`: `*repositoryFolderGit` does not implement `GitManager` (missing `RebaseBranch`, added to the backend by G69). Seen on the untouched repo with its own replaces, so it is not caused by this plan | TD-1511 must include the fix, or G79 removes the type |
| Scratch build of wakala-api with git and shared at the new tags and its other 18 `replace` lines kept | same two errors only; nothing else broke on the new shared | TD-1511 |

## Ordered steps

The step numbers map to the existing todos on ISS-105. Two steps have no todo yet and are marked.

1. TD-1504 (this page): plan and proof.
2. TD-1505: G78 lands. The hub's `modules/git` differs from the backend's git by import path only. The diff command is G78's `scripts/hub-copy-diff.sh`.
3. MISSING TODO, before TD-1507: land the hub's shared changes in `mwanachama-backend-shared`. Contents: the table in "The shared diff" (dispatch, httpwire, gormutil, specstore/tx, geo/ward, plaintext, consent, disclosure), written comment-free as the hub has it, with their tests (the hub's `modules/shared` test files go with them). Done when the same rewrite-and-strip diff shows the import path only. G78's tooling can be reused.
4. TD-1506: G79 lands. The routing layer (`gits_files.go`, `gits_files_routed.go`, `repository_catalog.go`, and the spec parsing of `gits.go`) lives in backend-git and reaches the private catalog through an interface, so backend-git stays public-only. This removes the `spec.Spec` call sites listed above from the API, and the registry then holds only a `GitManager` provider.
5. TD-1507: the owner confirms each tag. Proposed: shared `v0.2.0` at the commit of step 3, git `v0.1.0` at the commit of step 6 (first tag of git). Nothing is tagged earlier. Push shared first, then git.
6. TD-1508: change git's go.mod (shared at `v0.2.0`, no `replace`, `go mod tidy`), `go build` and `go vet` from a fresh clone with no sibling folder, then tag git.
7. TD-1509 and a second change MISSING FROM THE TODO: the hub API go.mod requires both tags; delete `modules/git`; and rewrite all 470 `wakalaserver/modules/shared/...` imports to the backend's shared and delete `modules/shared`. This is one commit, because git cannot go alone. The todo currently reads git only, and its instructions should say shared goes in the same change.
8. TD-1510: build and test from a fresh clone of the hub repo alone. See "Build, Dockerfile, make api, CI" below.
9. TD-1511: `mwanachama-wakala-api` requires the same two tags and drops the two `replace` lines (the other 18 stay). It needs the `RebaseBranch` fix first (see Problems).
10. TD-1512: write how a fix flows and update `vendored-modules.md`.
11. TD-1513: the owner decides the private backends.

Order inside the tags is fixed: shared first, because git's tidy needs shared's tag in the proxy before it can resolve.

## Build, Dockerfile, make api, CI

- `code/wakala-api/Dockerfile`: no change. It copies `go.mod go.sum`, runs `go mod download`, copies the folder and builds `./cmd/server`. With two public requires, `go mod download` fetches them from `proxy.golang.org` like every other dependency, with no token and no sibling folder. The build context stays the one folder.
- `make api` in `deployment/local` runs `docker compose build wakala-api` and so needs nothing new. Do not run it against the owner's stack to prove this; TD-1510 asks first.
- `.github/workflows/ci.yml`: no change. `go vet`, `go test`, `go build` in `code/wakala-api` fetch the same modules. The one thing to check is that CI runs with the default `GOFLAGS` (read-only), which needs `go.sum` committed with the two modules' hashes.
- A tag must be visible on the public proxy before the hub commit that requires it, or every build between the two fails. Order: push tag, wait until `go list -m github.com/aosanya/mwanachama-backend-git@v0.1.0` answers, then commit the hub change.

## How a future fix flows

1. The fix is made in `mwanachama-backend-git` (or shared), with its test. Never in the hub.
2. Tag a new version (the owner confirms the tag), shared first when shared changed.
3. Bump the require in both `hub-steward/code/wakala-api/go.mod` and `mwanachama-wakala-api/go.mod` (`go get ...@vX.Y.Z` and `go mod tidy`).
4. Each API runs its own tests and ships. Nothing is copied; `modules/git` and `modules/shared` no longer exist in the hub.

A hub fix that cannot wait for a tag is made in the backend and tagged as a patch version (`v0.1.1`); a `replace` to a local folder is for a developer's machine only and is never committed.

## Private backends

Not needed for git or shared (both public). Five backends are private: agency, catalog, permissions, ratings, workspace, and `mwanachama-wakala-api`. The hub copies all five today, and the hub repo is public. With "never copy" and "no vendor/", a real import of a private module needs one of:

1. Private module access with credentials in the build: `GOPRIVATE=github.com/aosanya/*` and a token for `git`/`go` (for Docker a build secret, not in the image; for CI a repository secret). A fresh clone of the hub builds only for someone who holds the token.
2. A sibling folder with a `replace` line as `mwanachama-wakala-api` does today. This cannot work in the hub's Docker build (the context is one folder) or in a fresh clone; it works only on the owner's machine.
3. Make the five repos public, after which they import like git does.

The owner chooses (TD-1513). The routing layer must not import the private catalog (G79 uses an interface for that). Until the owner chooses, those modules stay as the hub copy and are removed one at a time once imported.

## What needs the owner

- Each tag, one at a time: shared `v0.2.0` and git `v0.1.0` (or other numbers). Pushing a tag to a public GitHub repo cannot be taken back (the public checksum database remembers the first hash).
- The private-backends choice above.
- Whether `mwanachama-wakala-api` keeps its own `repositoryFolderGit` or takes the routing layer from G79 (TD-1511).

## Risks

- The hub going backwards on shared: any shared tag cut before the hub's changes land breaks the hub's error messages, query rules, text checks and consent code. Mitigation: step 3 and its zero-diff check before any tag.
- Shared is switched for 470 files in one commit. A conflicting edit by another session in the same files makes the rewrite messy. Mitigation: do it on a quiet tree, as one scripted rewrite, then `go build` and the tests.
- Comments: the backends keep comments, the hub's code has none. The import brings the backend's comments in as module source in the Go cache, not in the repo, so the no-comments rule for the repo is not broken; the backends follow their own rule when they are next touched.
- Public module cache: a tag served by `proxy.golang.org` cannot be removed from the world. A bad tag is superseded, not deleted.
- `go.mod` of the two APIs must agree: a different shared version in each is legal in Go but means two behaviours for the same route. The bump step above always changes both.
- The git module's `go.sum` and the shared tag's dependency set differ from the hub's (the hub is on pgx 5.11.0, git's go.mod on 5.10.0): Go picks the higher, so git runs against a newer pgx than it was tested with. Low risk; the git tests run in the backend repo before each tag.
- Tests were not run in any scratch build. The first real test run happens in TD-1510 and TD-1511.

## Files read

- `documentation/2. design/vendored-modules.md`, the ISS-105 description and Log
- `code/wakala-api/go.mod`, `Dockerfile`, `modules/git`, `modules/shared`, `internal/agencies/gits*.go`, `.github/workflows/ci.yml`, `deployment/local/Makefile`
- `mwanachama-backend-git` go.mod and top-level `.go` files, `mwanachama-backend-shared` go.mod, tag v0.1.0 contents and `git log`
- `mwanachama-wakala-api` go.mod and `internal/agencies/gits*.go`
