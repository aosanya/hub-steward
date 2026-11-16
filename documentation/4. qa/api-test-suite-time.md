# Why `go test -race` of the wakala-api HTTP package takes 40 minutes, 16 November 2026

Several agents reported that `go test -race ./internal/api/http` in `code/wakala-api` does not finish in 10 to 40 minutes, and one run died at the 600 s timeout inside `TestGroupNameTranslations_OwnerCannotDoTranslateAGroupNameToCharactersThatDrawNothing` while "building a router". This page says what takes the time, with numbers, and what to change.

All numbers come from a clean export of hub-steward `dev` at `72608dc0` (`git archive` into a scratch folder, no other session's uncommitted files), Go 1.27.3, darwin/arm64, 11 cores. The machine was shared: 16 to 22 test processes from other agents were running during the measurements and the load average went from 6 to 54. Timings are therefore noisy by roughly 20 percent; the ratios are stable across repeated runs.

## Short answer

- The package has 674 test functions in 226 files. None calls `t.Parallel`, so they run one after another in one process, using about one core.
- Without `-race` the whole package takes about 136 s. A typical test takes 0.1 s (median 0.10 s, 90th percentile 0.25 s).
- With `-race` every test costs about 1.6 s (18 times more). A sample of 48 tests took 5.7 s without and 104.8 s with `-race`; scaled to 136 s that is about 41 minutes for the whole package.
- Go's default `-timeout` is 10 minutes. A 41-minute run is always killed at 600 s, and the panic names whichever test happened to be running. `TestGroupNameTranslations_...` is not slow or stuck: it takes 0.09 s without `-race` and 1.6 to 2.1 s with it. The "building a router" frame is real, because building the router is the biggest single cost per test (see below), so a kill is most likely to land there.
- Nothing is hung. There is no shared lock, port, or file between tests.

## What one test does before its first assertion

Most tests start with `newStepRunWalk` (136 of 226 test files use it or `newDesignAgentWalk`, 197 constructor calls, plus 36 direct `NewRouter` calls). It lives in `internal/api/http/step_runs_harness_test.go` and does, per test:

1. Opens a fresh in-memory SQLite database (`file:wakala_step_runs_N?mode=memory&cache=shared`, N from an atomic counter, so databases never collide).
2. Builds a registry and the insights module (`agencies.NewRegistry`, insights `Provision`).
3. Calls `NewRouter(deps)`.
4. Creates an instance through `POST /instances`, which builds the agency manager and runs `spec.Migrate` for the instance.
5. Creates a group and, for the plan walks, a draft, a workflow and its steps, publishes it, and seats people (actor manager `Provision`, a second migration).

Measured per walk (empty plan):

| Phase | Without `-race` | With `-race` |
| --- | --- | --- |
| Open SQLite, NewRegistry, insights | 4 ms | 59 ms |
| `NewRouter` | 38 to 57 ms | 505 to 725 ms |
| `POST /instances` (migrate the instance) | 27 ms | 890 ms |
| Whole walk, empty plan | about 70 ms | about 1.5 s |
| Whole walk, referral plan with one volunteer | about 78 ms | about 1.65 s |

The rest of a typical test (a handful of HTTP calls through `httptest`) is a few milliseconds. The test body is almost never the cost; the setup is. Under `-race` a CPU profile of the single test is 1.83 s of samples, of which `modernc.org/sqlite` memory allocation and ThreadSanitizer bookkeeping (`sqlite3MemMalloc`, `__tsan::MemoryRangeSet`, `__tsan_read`, `checkptr`) are the top frames. The SQLite driver is C transpiled to Go, and every one of its memory operations is instrumented, which is why DDL-heavy work slows down 20 to 30 times.

### The router costs what it costs because it registers 702 MCP tools

`NewRouter` ends up in `registerMCPRoutes`, which calls `newMCPServer`. That function registers every module's tools (`agencymcp.RegisterToolsAs`, `registerDeclaredTools`, and the other `register...MCPTools` calls). The server holds 702 tools, and `mcp.AddTool` resolves a JSON schema for each one (`jsonschema.Schema.Resolve`, `remarshal`). In the profile of eight consecutive router builds, `newMCPServer` is 91 percent of `NewRouter`. A build costs 38 ms without `-race` and about 510 ms with it, every time, and nothing is cached between builds. Only about 25 tests ever send a request to `/mcp` or call `mcpCall`, yet all 674 pay for it.

### The instance migration costs what it costs because of 534 DDL statements

One instance ends up with 129 tables and 405 indexes. `spec.Migrate` creates two tables per object (the live one and a `_test` twin for scenario runs) and each index, one `db.Exec` per statement, with no batching. Table names include the instance slug (`TableFor` is `<slug>_<mount>_<hash>`), so a migrated database cannot simply be reused for another instance: it has to be created for each instance. Wrapping `spec.Migrate` in one transaction was tried and made no measurable difference under `-race` (1.6 to 1.75 s against 1.75 to 2.15 s for the same test, within noise), so the cost is the engine, not the commits.

## Things that were checked and are not the cause

| Suspect | Result |
| --- | --- |
| One shared Postgres or a real server per test | No. Every walk uses its own in-memory SQLite database. |
| Loading all agency JSON per test | No. It does not appear in the profile. |
| Ports | `httptest.NewServer` is used in 3 files and the two-process tests use `t.TempDir` files; ports are random and files are per test. No two tests contend. |
| A shared lock or mutex | The only `sync.Mutex` in tests is local to one agent-review fake. There is no package-level lock and no `TestMain`. |
| Hangs | The whole non-race run finished by itself in 136 s with every test accounted for (674 results). |
| `GOMAXPROCS` | 11 (the default). It does not help, because the tests run serially and use about 1.06 cores (`106% cpu` in `time`), so ten cores sit idle. |
| Machine load | Real but secondary. At the start of the investigation 20 `go test`, `go build` or `.test` processes were running (4 `go test -race` of this package or a sibling, 2 `http.test`, 2 `git.test`), and the load average rose from 6.6 to 54 while four or more agents ran the suite at once. This slows everything by tens of percent but does not turn 2.5 minutes into 40. |

The slowest tests without `-race` are the process-based ones: `TestFormSend_UnderFlagTwoProcessesSharingASqliteFileCountOneVoice` (9.7 s), `TestFormSend_UnderRefuseTwoProcessesSharingASqliteFileKeepOneVoice` (5.6 s), `TestMUN234b_Round2_Agency` (5.2 s), `TestFormsResultsFilesListsEachStoredFileVersionNewestFirst` (4.7 s). The 20 slowest add up to about 59 s of the 136 s; the other 650 tests are setup-bound.

## Side finding, not about time

The non-race run in the clean export reports 23 failing tests. The ones that were looked at fail on the export, not on the speed: `published_swe_agency_mounts_test.go` reads `../../../../../../hub-steward-swe/agency/agency.json`, which is not in an export of one repo; the `misuse_*_db_test.go` files skip or fail on `DATABASE_URL is not set`. Others (`TestRoleHolder_...` answering "instance not found", `TestMUN234c_ReplayMCP_Round1`, `TestLengthNames_...`) were not looked into. They are listed here so nobody reads them as timeouts.

## Options, cheapest first

### 1. Build the MCP server on the first `/mcp` request, not in `NewRouter`

Wrap `newMCPServers(d)` in `registerMCPRoutes` in a `sync.Once` so the 702 tools are registered when the first MCP request arrives. Tests that never touch `/mcp` skip the whole cost. Effort: a few lines in `mcp.go` and `mcp_visible.go`, no test edits. Expected saving: about 0.5 s of 1.65 s per walk under `-race`, so the package drops from about 41 to about 28 minutes; without `-race` from 136 to about 110 s. The first MCP request in production pays the build once (a few tens of milliseconds, and the server also starts faster), and the build must stay safe under concurrent first requests, which `sync.Once` gives.

### 2. Run the package in parallel shards with a stated timeout

Compile once (`go test -race -c`), list the tests (`-test.list .`), split them into N groups by name, and run the binary N times at once with `-test.run '^(a|b|...)$'` and `-test.timeout 45m`. The tests share nothing, so shards cannot interfere; the two-process tests use their own temp files. With six shards on this machine the unchanged suite should take about 41 / 6, roughly 7 to 8 minutes when the machine is idle, and combined with option 1 about 5 minutes. Effort: one script and one Makefile target (`make test-api-race`), no code changes in tests. The cost is that when many agents run it at once the cores are shared, so the saving shrinks with load. Until this exists, anyone who runs the whole package under `-race` must pass `-timeout 60m` or the run is killed at 10 minutes.

### 3. Cut the instance migration (largest saving, largest effort, not yet proven)

`POST /instances` and the actor `Provision` cost about 0.9 s of the 1.65 s under `-race`. Two ways to cut it, neither measured end to end:

- Create the `_test` twin tables of each object lazily, on the first scenario run, instead of with every instance. That halves the tables (about 64 of 129) and the indexes on them. It changes production behaviour, so it needs the owner's agreement and a check of everything that reads the `_test` names.
- Migrate one baseline instance per package once, dump the database (`VACUUM INTO` a file), and give each test a copy with that instance already in it. The instance id is then fixed across tests, and the registry still re-runs `CREATE TABLE IF NOT EXISTS` for each manager it builds, so the saving is smaller than it looks until that is also skipped for an already migrated instance.

This is the "share one migrated database across tests" idea. It is listed so nobody tries it first: the table names carry the instance slug, a transaction around the migration did nothing, and the manager rebuild repeats the DDL. Not filed.

### Not worth doing now

- Splitting the package into several packages: the walk helpers (`newStepRunWalk`, `referralPlan`, the `misuse_*` fakes) are shared by 136 files, so a split mostly means copying them, and option 2 gets the same parallelism without moving a file.
- A `fast` build tag for the unit tests: nearly all 674 tests are walks that build a router and an instance. There is no small unit-test subset to tag, so the tag would exclude almost nothing.

## Running the package under -race in shards: `make test-api-race`

Option 2 exists as a Makefile target in the repo root (ISS-103). Agents run it instead of a bare `go test -race ./internal/api/http`.

- `make test-api-race` compiles the package's test binary once with `go test -c -race`, lists its tests with `-test.list`, deals the names round-robin into N shards, and runs the binary once per shard at the same time with `-test.v -test.timeout=45m` and `-test.run '^(name|name|...)$'`.
- `N` sets the number of shards (default 6) and `FILTER` is a regular expression for `-test.list` that narrows the run (default `.`, the whole package): `make test-api-race N=3 FILTER='^TestMUN235b'`.
- The target ends with a line per shard (test count and exit code), the names of the failed tests, a note if a shard hit the timeout, and `tests listed, ran, seconds`. It exits 1 when any shard exits non-zero, or when the union of the shard lists is not exactly the list (a test in no shard or in two).
- The scripts are `scripts/test-api-race.sh` and `scripts/split-test-names.sh`. The splitting logic has a plain shell test, `scripts/split-test-names.test.sh` (ten names in three shards, an empty shard, one shard, an empty list, bad counts), which `make test` runs first.
- A shard with no names is not started. Shard output is kept only in a scratch folder that the script removes on exit, so the failed test names in the summary are what remains; rerun a failed test alone with `go test -race -run '^TestName$' ./internal/api/http`.

Measured on a clean `git archive` export of `dev` at `3b7dd396` (Go 1.27.3, darwin/arm64, 11 cores, load average 15 to 20 from other agents during the run), with `N=3` and `FILTER='^(TestRoleHolder|TestGroupRoles|TestMUN235b|TestToolList|TestRequestBody)'`, which selects 62 tests:

| Step | Time |
| --- | --- |
| Compile with `-race` | 31 s |
| Run of three shards (21, 21, 20 tests) | about 230 s |
| Whole target | 262 s |

62 tests listed, 62 ran. The run reported 8 failed `TestRoleHolder_...` tests, all of the "instance not found" kind that the export already showed before this change (see the side finding above); the target exited 1 for them, as it should. The 230 s for 62 tests is far above the 1.6 s per test of an idle machine because the load average was above the core count; the idle-machine figure for the whole package (under 10 minutes with six shards) has not been measured, because the whole package was not run on a loaded machine.

## Issues filed

Option 1 and option 2 are on the `backlog` backlog of the hub-steward project, tagged `tests` and `bug`, in `to-do`. Option 1 is ISS-102 and option 2 is ISS-103. Option 3 is not filed.

## How to repeat the numbers

From a `git archive` export of `dev`, in `code/wakala-api`:

- Build once: `go test -c -o /scratch/http.test ./internal/api/http` and the same with `-race`.
- One test: `/scratch/http.race.test -test.run '^TestGroupNameTranslations_OwnerCannotDoTranslateAGroupNameToCharactersThatDrawNothing$' -test.count=1 -test.v -test.cpuprofile race.prof`, then `go tool pprof -top -cum http.race.test race.prof`.
- Whole package, no race: `/scratch/http.test -test.v -test.count=1`, then sum the `(N.NNs)` on the `--- PASS` and `--- FAIL` lines.
- Sample: take every 13th passing name, 48 of them, join with `|` into `^(...)$`, and run both binaries with `-test.run`.
