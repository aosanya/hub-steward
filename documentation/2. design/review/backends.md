# Backends

Status
- sources module (`mwanachama-backend-sources`, mounted at `/instances/{instanceID}/sources` by `mwanachama-wakala-api/internal/api/http/sources_routes.go`, tools in `mcp_sources_permissions.go`): `../gaps.md` row 5 still says it is not mounted; the mount exists and checks the caller's agency role per action, so that row is stale (gaps.md is a design page; not edited). What is still missing is the rest of that row: nothing in wakala-api produces chunks or embeddings (grep of `internal` for chunk finds only tests), so the Knowledge page's chat call `sources_chunk_list` reads an empty table until someone files chunks by hand. Open; build finding. Passage search cost is performance.md 86.
- accounting module (`mwanachama-backend-accounting`, mounted at `/instances/{instanceID}/accounting` by `mwanachama-wakala-api/internal/api/http/accounting_routes.go`): decision 44 keeps it out of Manage payments, so no phone screen reads it. `CloseAccount` (`ledger_store.go` lines 113 to 148) checks the balance and then writes `closed_at` inside a default-isolation transaction with no row lock, so a `Post` landing between the two (`Post` only checks `ClosedAt` on its own read, lines 168 to 171) can leave a closed account holding a balance. Reversal and settlement are guarded by the unique-where-given indexes `reverses_once` and the settles twin (`provision.go` lines 39 to 54), so those two cannot race. Open, build finding, not a question.
- Market module, overlap with the agency: the steps and their actors exist twice, once as the agency's published workflow and once as `DefaultWorkflows` in Go, and only the Go copy is checked (engine.md, 2026-11-08). Open, HS549.
- Market `ListOrders` reads every order of the agency then keeps the caller's in Go (`orders.go` lines 118 to 131); the list is cut at the engine's `DefaultListCap` of 100 rows with no order before the Go filter (`mwanachama-backend-shared/specstore/store.go` lines 177 to 197), so once the agency has more than 100 orders the caller's can be missing from her own list, silently, and the `picker` and `poster, state` indexes on `order` are not used. Open, build finding; the filter must move into the query.
- Market lists with no filter or order and a name lookup per row: `ListNotices` (state only, cap 100, `asks.go` lines 244 to 246) then `nameOf` per notice, `ListQuotes` and `ListDrafts` (notice only), `ListAsksBy` and `ListYesesBy` (`asks.go` lines 177 to 203). Same shape as Q159. Open, build finding.
- permissions module: a withdrawn grant keeps no record of who withdrew it or when, and a re-grant overwrites the earlier grant's giver and date (`mwanachama-backend-permissions/grant.go`). Turned into Q158.
- The engage module (notices, events, volunteer calls; `mwanachama-backend-engage`) is in the agency's module catalog and permission catalog but is not required by `mwanachama-wakala-api/go.mod` and has no mount (board row WK209 on hold); it has no list operation; `PickOffer` counts then inserts with no transaction so a call can overfill, and `CountUnread` reads every sent notice uncapped. Turned into Q156 and Q157. Open.
- The catalog's ratings attachment opens a second connection pool to the catalog database and has no design page: `mwanachama-wakala-api/cmd/server/ratings.go` `buildRatings` calls `openDeclaredDB(catalogMount.prefix)` again after `buildCatalogMount` (`catalog.go` line 71) already opened it, so the one catalog database holds two pools of up to 4 connections each (`internal/accounts/pool.go` `ModulePool`, applied by `limitModulePool`) and the ratings pool is used by operator-only routes (`internal/api/http/catalog_ratings_routes.go` `OperatorRoutesFor`, gated by `catalogScope`). `internal/specs/wakala.catalog.json` line 5 attaches ratings to the storefront `entry` role only; the reports mount attaches nothing, and no studio or app page draws a rating, so the module is mounted with no journey. `ratings.Provision` runs on every boot (DDL checks on three tables), not through `spec.Migrate`, so it has no test twins. The ratings module (`mwanachama-backend-ratings`) is not checked out: its indexes, similarity recompute cost and how a rating is bounded are unverified. Open; build item (reuse the catalog's `*gorm.DB`) and a question only if the owner wants ratings drawn. No question.
- A boot-time grant seed runs before the server listens and grows with agencies times residents: `mwanachama-wakala-api/cmd/server/main.go` line 88 calls `SeedResidentGrants` (`internal/api/http/resident_grants.go` line 143), which for every resident of every agency calls `admit`: one role read, one `SeedActions` of every resident action (the role is rebuilt per member, not per agency) and one `CreateGrant` per scope (3 scopes), all serial and with no batch. Read from code, not measured: 30 agencies of 300 residents is about 9,000 members and some 45,000 calls to the rights store on every restart or deploy, with the port closed meanwhile; the first error returns and the agencies after it are never seeded (the log line says a resident is then refused forms until they join again). Joining runs the same `admit` in the request (`join_routes.go` lines 57 to 69): the member row is written first, the grants after, so a failed grant answers 500 with the person already a member, and a retry heals it only because `Join` answers 'member' with role resident and the route grants again. Leaving withdraws the grants before the member row is deleted (`leaveInstance`), so a failed delete leaves a resident with no grants. Open; build work (seed the role once per agency, skip a resident who already holds the grants, run off the boot path, continue past one agency's failure), no question.
- forms `photo` and `file` answers hold opaque file ids owned by a files module that is not checked out and is not mounted in `mwanachama-wakala-api`; `UseDefaultMaxFiles` has no caller there and nothing sets `captured_file_ids` (`mwanachama-backend-forms/approval_impl.go` line 17, `models/files.go`), so `require_capture` can never be satisfied in this deployment. Turned into Q154. Open.
- The shared dispatcher drops the cause of every error its status table does not name, on both doors: `mwanachama-backend-shared/dispatch/dispatch.go` `handlerFor` answers the fixed text `internal error` (const `opaque`) with status 500 and `tools.go` `invokerFor` returns `errors.New(opaque)`, and neither writes the real error to a log, so a failing write in forms, actor, comm, agency, catalog or taskmanager (each mounted through it) leaves no server-side trace of why; `mwanachama-wakala-api/cmd/server/requestlog.go` is opt-in (`WAKALA_REQUEST_LOG`) and logs method, path, status and tool name only, not the error. A person sees a 500 and the operator cannot tell a lost database connection from a bug. Build work, not a question: log the error with the operation name at the point it is replaced (one line per 500, no cost on the success path). Read from code, not run. Open.
- The dispatcher's MCP door treats a required argument sent as `null` as present: `tools.go` `invokerFor` tests `len(in[key]) == 0` on the raw JSON, and `null` is four bytes, so the key passes and binds as the zero value (`tools_bind.go` `bindTool`); the manager then sees an empty string or zero where the schema said required. Whether each manager refuses the zero value was not read for every operation. Build work. Open.
- taskmanager `loadTagNames` (`mwanachama-backend-taskmanager/task_impl_task.go`) swallows every read error and returns no tags, and `ListTasksInProject` / `GetTaskByName` cap silently at 500 (`list_limit.go` `maxListPage`): a project over 500 tasks answers not found for a task past the cut, with no signal. Build work. Open, see performance entry 62.
- taskmanager task placement (commit d0d5f2a, `task_rank.go`, `taskmanager.operations.json` `place_task`) is declared but not wired in the checked-out code, read from code and not run: `nextRank` and `sortByRank` have no caller, `CreateTask` (`task_impl_task.go` line 24) mints no rank so every new task keeps rank 0, and `ListTasks` (line 202) and `ListTasksInProject` have no order by rank, while the blueprint says rank is 'minted at the bottom on creation' and `task_rank_test.go` expects rising ranks and rank order. Either the tests fail at this commit or the wiring is missing from it. Build matter, not a question. Open.
- taskmanager `PlaceTask` takes no lock: two people placing cards at once each read the whole board's ids and ranks, then write, so one placement is lost or two cards share a rank (ties then read by creation time). Open, performance.md entry 54.
- forms `respondent` rows (`mwanachama-backend-forms/public_impl.go` `UpsertRespondent`) are created by anyone who can reach an open public link and are never removed; a declaration is written by `respondent_id` the caller sends (`DeclareChapter` does not check that the respondent was registered through this link or exists at all). Open; see performance.md entry 53.
- comm moderation writes are not guarded against a second writer: `CreateRemoval` inserts without looking for a removal of the same message and the removal table has no unique key on `message_id`, so two moderators withholding one post at the same moment write two removals and two act-log rows; `CreateDispute` does not look for a dispute on the removal and nothing is unique on `removal_id`; `DismissReports` takes a row lock on a removal lookup that finds nothing in the case that matters, so it locks no row and a removal can land after its check (`mwanachama-backend-comm/moderation_impl.go` lines 79 to 156, `moderation_dismissal_impl.go` lines 20 to 38). Open; build finding. The member app has no screen for any of it (Q139).
- Agency review has no owner of its running state: the agency module holds `review.running` and refuses a second run (`review_start_impl.go`, unique index `running_unique`), wakala-api's `reviewruns.Runner` holds the only in-flight guard (a process map, `claim`), and nothing ends a review whose model call never returns (`runner.go` `review`). Two replicas and a restart start the same part twice (performance 50). Turned into Q137 for the stop time. Open.
- Actor `SetGroupJoinMode` and `SetGroupHidden` (`mwanachama-backend-actor/join_impl.go` lines 19 to 45) change one column and leave the group's pending join requests as they were, so a group switched to open keeps requests that nothing settles until a leader decides or the person joins herself. Turned into Q132. Open.
- wakala-api `GET /owner/member-sessions` (`session_routes.go` `listOwnedMembersSessions`, `membersOfOwnedAgencies`) is one sessions read per member and one actor read per member for the name (`memberNameIn`), over every agency the caller owns, with no limit or paging; studio `app/api/administration.ts` line 37 calls it. Read from code, not measured; it hurts at a few hundred members across owned agencies. Open (build work, not a question).
- A seat in actor needs a group: `GrantRole` (`mwanachama-backend-actor/role_assignment_impl.go` line 28) refuses a seat whose group is not live and the unique index `held_once` is per actor, group and kind, so an agency job such as the Hub manager or the Market manager (decision 124, `roles.html` kind Agency job) has no group to sit in, and no wakala-api code calls `GrantRole`. How an agency job is held is the board's HS680; open, build finding.
- A publish removes people from roles and a rollback does not give them back: `rolesPublished.PublishAgency` (`mwanachama-wakala-api/internal/api/http/definition_role_kinds.go`) syncs role kinds from the document of any channel it publishes, `SyncDefinitionRoles` (`mwanachama-backend-actor/definition_role_impl.go`) ends every live seat of a dropped role, and `SetPublicationChannel` never syncs, so a rollback leaves the kind retired and the seats ended. Turned into Q130.
- Agency `DeleteRisk` leaves the risk's threat and consequence links behind: it deletes the risk's pathways by `risk_id` and the risk row, but `risk_threat` and `risk_consequence` rows are keyed by `risk_code` and nothing removes them (`mwanachama-backend-agency/risk_impl.go` DeleteRisk lines 113 to 128; `risk_threat_impl.go` and `risk_consequence_impl.go` have only link-level deletes). The orphan links are still copied into the next draft (`draft_impl.go` 398 to 404), written into the published document (`document.go` 273 to 278), counted as a use that blocks deleting the threat or consequence (`library_part_impl.go` 155 `ErrLibraryPartInUse`), and counted by the bow-tie scan (`bowtie_scan.go` `checkPartControls`, which loops over every link whether or not its risk still exists, and raises 'has no control' for a part only a dead risk used). The scan has no dangling-link rule, unlike the work-item and role-assignment checks. Open; build finding. Whether half-drawn bow-ties may publish is turned into Q129. Read from code, not run; `risk_test.go` calls DeleteRisk but I did not find a test that lists links afterwards.
- Schedule sweep: one goroutine, one pass through all agencies, no lock between replicas, no list cap (open, performance entry 42): `internal/agencies/schedule_sweep.go`.
- Task manager `ListCasesByVotes` ranks after a 500-row cap: with more than 500 open cases the most voted older ones are missing from the ranked list (`case_vote.go` 163 to 183). Open; build finding.
- wakala-api account router (`internal/accounts/router.go`): one mutex guards the pool and is held across a dial and a migrate; eviction closes a hub under running requests; the limit 32 is hard-coded. Turned into Q127.
- Two languages tables are created by AutoMigrate at boot in the shared database (`languages/store.go` `agency_languages` key instance_id, `operator_studio_languages` key account_id); both keyed by their lookup column, no index gap. `GET /instances/{id}/me/studio-language` takes up to three reads (role, person, agency) when the studio opens; small, open as a note only. The forms module holds reviewed translations (`forms.blueprint.json` role translation) while the agency module holds none, so two modules would own 'text in another language'. Turned into Q123.
- wakala-api member invitations: the batch route (`internal/api/http/member_invite_batch.go`) creates an account and an admission for each of up to 500 rows one after another inside the request, then mails in a detached goroutine (`sendPaced`) whose result is only logged (`logMagicLinkOutcome`); a restart loses the unmailed rest and the invitation row stores no delivery state. Its mail is the project's bare sign-in link, not the single invitation's text (`invitation_mail.go` `describe`, sender, responsible agency, misuse contact). Turned into Q122.
- wakala-api `internal/controlenforce` is dead code: nothing imports it, so a control marked Enforced (Block, Hold for approval) is only text in the agent's instructions (`ai_parts.go` 31-33), and its log is memory only. The group order gate (`approvals_apply_groupgate.go`) never reads controls. Turned into Q121.
- Drafts: the module cannot say "the one open draft"; it lists all open drafts ordered by `created_at` with no limit and each caller chooses (see definition.md). `CreateDraft` counts every draft row to enforce the cap of 40 inside the transaction, so a race can pass the count by a few (`limits.go`). Open.
- wakala-api `internal/launch/launch.go` `run`: no step of a launch can be repeated. The grant is spent before the token exchange (line 354), the token is revoked when the run returns, and any failure after `SetProject` (line 403) leaves the customer's project in their account with status `failed`; the goroutine in `api/http/launch.go` has no resume at boot, so a restart leaves `creating` for ever. Turned into Q109.
- Publish swallows a failed role sync: `rolesPublished.PublishAgency` (`mwanachama-wakala-api/internal/api/http/definition_role_kinds.go` line 25) logs `definition role kinds not synced` and still answers success, so a published version can name roles the actor module has no role kind for; nothing retries it (open; build finding, fix: return the error or record the sync as pending and retry on the next open).
- Leave group (decision 129) has no operation: actor's `Deregister` (`mwanachama-backend-actor/registration_impl.go` 84-99) deletes the registration but not the seat, so a leader who left keeps `leadsRoom` true while `inRoom` is false (`mwanachama-wakala-api/internal/agencies/rooms.go` 87-124); `RemoveFromGroup` ends seats but needs a remover and records an eviction. No last-leader guard exists. Turned into Q120.
- Usage page (decision 162): the agency review calls `ChatAccount` with no `CheckLimits` or `RecordUsage` (`reviewruns/model.go` 41-56) and test runs call both around each call with `RoleID` empty (`testruns/aimodel.go` 42-47), so the role bars and the Kind of work donut would miss review tokens and carry no role for test tokens until HS743 lands; the AI module is not checked out, so double counting inside `ChatAccount` is unverified. Turned into Q126.
- wakala-api `/mcp` accepts a batch of up to 16 messages that run together (`mcp_body_guard.go`, `limits.go`) while the per-agency gate holds 4 (`dbpool/gate.go`) and lets a waiter through after 10 seconds, so one agent can crowd out the members of its agency. Turned into Q133 (performance.md entry 47).
- A launched project's later tables never get row-level security: `mwanachama-wakala-api/internal/launch/launch.go` `secure` (line 253) runs `provision.SecureTablesSQL` once, after the import, and nothing else in the code issues `ENABLE ROW LEVEL SECURITY`, while `internal/agencies/registry.go` builders (`buildForms`, `buildComm`, `buildTaskManager`, `buildAssetManager` and the others, lines 282 to 521) call each module's `Provision` on first use, so a module mounted or first opened after launch creates its tables in the customer's exposed `public` schema without the second lock. The first lock (schema grants revoked from `anon` and `authenticated`, `provision.go` `SchemaStatements`) still holds, so this is a missing second layer, not an open door, read from code and not run. Engineering fix, not a question: run `SecureTablesSQL` after each lazy `Provision` in a launched project. Open. Cost: one catalog scan and one `ALTER TABLE` per table the first time a module is built for an agency, nothing on a request.
- `provision.CreateUserFunction` returns the existing user's id for a known email and ignores `p_role` (`provision.go` lines 213 to 216): a person already in the project as a member who launches an agency is not stamped `admin` in `raw_app_meta_data`, so their token lacks the claim the first launch gave. It also checks then inserts, so two launches for one new email at once end on the unique email error. Read from code, not run. Open.

- agency: draft and publication are in one table set; the publication row holds the whole document as json. Ownership of "workflow step" is split: `work_item` (title, prompt) and `event_flow_step` (topics, consumer, handler) both describe steps, joined by `workflow_code` (event_flow_step) and `workflow_id` (work_item). Open.
- agency `ListIssues` rewrites the issue rows on every read (`issue_impl.go` lines 236 to 245: delete, scan, insert inside a transaction), so a GET writes and two people opening the issues page on one draft take turns. Open.
- agency `nextCode` (`mwanachama-backend-agency/store.go` lines 152 to 183, used by `createWithCode` line 226, `import.go` lines 185 and 204 and the boot backfill `provision.go` line 330) still has the shape that actor fixed on 2026-11-03 as ACT77 and ACT78 (`mwanachama-backend-actor/store.go` line 96, `code_guard.go`). (1) When the counter row is missing it reads, finds none and inserts; two first creates of a kind in one agency both insert, the loser gets a unique violation, and on Postgres that aborts the transaction, so the create fails (actor saw this on the hub stack; SQLite, which the race tests use, keeps the transaction usable and hides it). (2) The `code` index is a plain index (`agency.blueprint.json` line 52 and the same on each coded object), not unique, and nothing checks that the claimed number is free, so a counter that is behind the data (rows loaded by SQL or an import that carried its codes) hands out a code a row already holds with no error. Event-flow steps join by `workflow_code` and control and value attachments by code, so a duplicate code mixes two workflows or two targets silently. Open; build work: copy actor's seed with ON CONFLICT DO NOTHING and its taken-code skip, and add a drift check at boot. No question for the owner.
- The publication's version and channel are not unique at the store; `publication_race_security_test.go` (AG52) states the hole as open. Open; build work.
- task manager: no real foreign keys, only columns; `workflow_run` has no version pin. Open.
- Hundredth agency: each agency has its own table set, so 100 agencies carry about 1,800 tables and about 5,000 indexes (18 agency objects plus 4 spec tables, read from the blueprints, not counted in a database). Open; not measured.
- wakala-api pool: `cmd/server/dbpool.go` sets max open and idle connections; the staging DSN is a pooler on port 5432, which is session mode, so prepared statements are fine there; a transaction-mode pooler (6543) would not be. Open; check which one production uses.
- forms: the caller's groups come from a function the host supplies (`UseGroups`, wired in `mwanachama-wakala-api/internal/agencies/registry.go` line 416); a Waiting list is only as fast as that function, which was not read. Open.
- comm: unread counting lives in the chat store and aggregates group-wide; see performance.md 11.
- wakala-api `internal/agencies`: the registry builds one manager per (module, agency) and caches it without expiry; a manager build migrates the agency's tables (see performance.md). The membership table and the agency list are the only tables with hand-kept SQL migrations; the rest depend on boot-time provisioning, so `cmd/migrate up` alone does not make a working database (see indexes.md entry 15). Open.
- Group order lines: the market module is not among the repos checked out, only its client and a fake in `submission/code/market`, so the join, change and take-out writes and the Send against the minimum could not be read. Not verified; closed for the product half on 2026-10-29, decision 92.

- wakala-api `internal/dbpool`: the per-agency gate of 4 is held for a whole transaction and admits a statement after 10 seconds regardless; see performance.md 28. Open.
- wakala-api `cmd/seedrole` seeds the one `studio_operator` role from a hand-kept list of eleven modules (`internal/operatorrole/operatorrole.go` `Modules()`), run by a person with `--apply`; nothing checks that list against the modules the server mounts or maps to actions. `go.mod` also holds insights, ratings, sources, riskmanager, voting, git and assetmanager, and `mcp_tool_actions.go` maps the insights tools to actions, yet those actions are not in the seed, so a seeded operator gets them only if someone grants them by hand. The only test using the list (`staff_operator_market_comm_test.go`) seeds it to test market and comm. The permissions module is not checked out, so whether a re-seed also removes an action a module dropped is unverified. A build item (a test that every mounted module's actions are in `Modules()` or named as excluded); not a question. Open.

Log
- wakala-api guards are per process: the sign-in strikes and windows (`internal/throttle/strikes.go`, `window.go`, limits in `limits.go`: 5 tries per client, 50 per address, 15-minute lock, 20,000 tracked keys), the refused-bearer memory and the verified-token cache (`internal/api/http/middleware.go`) live in the memory of one server process. With two or more processes the limits multiply by the process count and a restart empties every lock; a revoked API key stays accepted on the other processes for up to 5 seconds (`internal/authz/cache.go` `MaxTTL`; `apikeys/cached.go` `Revoke` bumps only the local epoch). Open; build finding, matters only when the API runs on more than one process (read from code, not measured; the process count is not in the repo).
- API keys: `wakala_api_keys` (`internal/apikeys/row.go`) is a credential, not a definition, so it stays outside the agency definition; a key minted for one agency carries `instance_id`. Nothing in the premise needs it to move. Closed on 2026-10-30, no change.
- agency `StartReview` refuses a second run by counting running reviews and then inserting, inside one transaction (`review_start_impl.go` lines 14 to 30) with no unique index on a running review per draft; two presses at once on Postgres under read committed can both pass and start two sets of six model calls. The in-process `inFlight` map of the runner (`runner.go` `claim`) does not cross servers. Open; a build fix (a partial unique index on draft_id where status is running), not a question.
- catalog `Book` (`mwanachama-backend-catalog/slot.go` lines 56 to 99) checks capacity by counting standing bookings and then inserts, inside a transaction with no row lock on the slot and no unique constraint on the booking, so on Postgres at read committed two members booking the last place at the same moment both pass `taken >= capacity` and both are booked, and one member tapping twice can hold two places (the `mine > 0` check races the same way). The slot is mounted in wakala-api (`internal/specs/wakala.catalog.json` roles slot and booking) and the lab seat form is the drawn user (`pages_chat_lab.py`). Open; build finding, not a question (the answer to an overbooked seat is a fix, not a product choice).
- The workspace module (studio workbooks, shares, desks) is mounted once for all agencies at instance `wakala` (`mwanachama-wakala-api/cmd/server/workspace.go`, `internal/specs/wakala.workspace.json`) and its `PublicRoutes` (the route that opens a workbook by share key with no account) are registered bare in `internal/api/http/workspace_routes.go` line 18, while the forms respondent routes go through `anonymousDoor.guard` (`forms_routes.go` line 32) and the reports filing route through its own door (`reports_routes.go` lines 29 to 33); so nothing limits the rate of guesses at a share key or the body size on that open route. Read from code only: the workspace module is not checked out, so whether the key is long and random, and whether the module limits tries itself, could not be verified. Build work, not a question for the owner. Open; also unverified: `uses` rows (one per act) have no visible writer or prune in wakala-api, so their growth is unknown.
- taskmanager `saveRun` is a full-row update with no guard on status or the limit: the run writes the answer path and the sweep path can overwrite each other (Q144). The compare-and-swap the module's CLAUDE.md describes covers the failure budget only. Evidence: `mwanachama-backend-taskmanager/workflow_run.go` 312-319.
- A report's promises belong to no module: they are task rows whose link to the form and report version is JSON text inside the task's `context` column (`mwanachama-wakala-api/internal/agencies/report_promises.go`), found by scanning the board, written one task at a time with no undo, and their outcome sits beside, not in, the task's status. open; outcome versus status turned into Q147; the scan is performance entry 67.
- The case message thread's reader check is wakala-api glue over three modules (taskmanager case and tasks, actor membership, permissions grants) with no cache (`internal/agencies/case_threads.go`). open; see performance entry 71.
- Delegations in actor are stored but nothing consults them (read from code, not measured): `mwanachama-backend-actor/delegation_impl.go` `CreateDelegation`, `RevokeDelegation`, `ListDelegations` have routes and tools, but `ActsFor` is a Go method with no address and no caller in any checked-out repo (searched wakala-api, agency, forms, comm, taskmanager, catalog), so a granted delegation changes nothing a person can do. No drawn studio or app screen shows one either. The grant takes any existing delegate and subject with no consent from the subject and no check that the grantor has any link to either; who may grant is left to the mount's gate on `actor.delegation.create` (`documentation/2. design/delegations.md` lists it as open for the owner), and the action is in no agent permission (`wakala-api documentation/2. design/agent-role-permissions.md` line 87). A duplicate pair is not refused, so the same pair can be granted many times. Open; not a question while no drawn feature uses it, to be asked the day a screen needs it.

## 2026-10-29 15:00 UTC

Agency traced in detail; task manager blueprint read; forms, comm, catalog, actor not yet.

## 2026-10-29 15:45 UTC

Forms and comm read; forms registry wiring noted.

## 2026-10-29 16:35 UTC

Traced the shared engine (specstore, spec migrate) and actor. Findings added to the status list above in this entry: the engine emits no foreign keys for any module (`spec/migrate.go` `createIndexes` only builds indexes; partial indexes with a where clause are supported, so soft-delete partials are possible without engine work); a list with no limit returns the whole table (S24, open, `specstore/store_listcap_test.go`) and every module inherits it; actor roster `ListGroupActors` has no limit and filters through three nested NOT IN subqueries over role seats (`outsider_impl.go`), turned into Q84.

## 2026-10-29 17:10 UTC

Read registry.go, caches.go, membership.go and the migrations folder. Market backend not available to read.

## 2026-10-30 14:35 UTC

Read `internal/dbpool` and the token cache in `middleware.go`; one finding, performance.md 28.

## 2026-10-30 20:50 UTC

Traced throttle and API keys end to end: per-process guards and the 5-second revoke window noted; the key table stays outside the definition.

## 2026-10-31 06:40 UTC

Read the review tables' start path. One gap opened (double press); no question.

## 2026-10-31 08:40 UTC

Traced the agency launch (launch.go, api/http/launch.go, shopdb.go): spend-then-exchange, no resume, no clean-up of a made project, no sweep of `creating` rows. One gap, turned into Q109. Idempotence of the import and first-user function not read.

## 2026-10-31 12:35 UTC

Read agency `limits.go`, `draft_impl.go` `CreateDraft`, `ListDrafts`, `ArchiveDraft` and the three wakala-api and console draft pickers. Opened one gap (no single open draft); the cap is recorded in definition.md.

## 2026-11-01 20:45 UTC

Read the registry's membership row and the agency-role link route. A person holds at most one agency role, only an agent can be linked, the value is a role row id (a code also resolves in `role_brief_impl.go`). Cross-module note: the actor module's role kinds and the agency's roles are two lists with no join, so "who holds a role" has two answers. Turned into Q111; indexes.md carries the keys.

## 2026-11-02 02:42 UTC

Read the publish wrapper in wakala-api. One swallowed error path found.

- Group roles (decisions 121, 128, 130): actor models a seat as actor, group and role kind, so a role held in one group already exists. It has one switch, `leads_group`, that lets a seat decide join requests and invite (`mwanachama-backend-actor/leader_impl.go` `mustLead`); `capabilities` on the role kind is stored and read by no code. Per-action assignment to a group role (decision 128) is not built; build work, not a question. Open; Q119 covers only the Vice Admin takeover.
- Who may send a group order (decision 127): in the mounting API the market's coordinator check is the instance owner or a seated agent for the whole agency (`mwanachama-wakala-api/internal/agencies/registry.go` lines 633-638 `UseCoordinators`, `internal/api/http/market_coordinator_gate.go`), with no group in the question. A person who coordinates one group through a seat cannot pass it. The market module is not checked out, so how `SendGroupOrder` uses the check is unverified. Open.

## 2026-11-02 16:40 UTC

Traced group roles in actor and the market's coordinator check against decisions 121 to 133. Two bullets added; Q119 opened.

## 2026-11-02 20:40 UTC

Traced Leave group on the new group page against actor and the room checks. One bullet added; Q120 opened.

## 2026-11-03 00:40 UTC

Traced wakala-api controlenforce, formsettings against the Controls page. One bullet added; Q121 opened. formsettings (agency_forms_approval, one row per instance, primary key instance_id) has no gap.

## 2026-11-03 03:00 UTC
Traced member invitations (single and batch), `invitemail` and the SMTP sender. Opened one backend gap, turned into Q122. Launch journal (`launchlog/journal.go`) is memory only by its own doc and keeps 32 launches, 256 events each; the durable record is the shopdb row, so no new gap there.

## 2026-11-03 04:40 UTC
Traced the languages package and the forms translation role. Ownership overlap noted; the three-read studio-language route is small.

## 2026-11-03 06:30 UTC
Traced operatorrole and cmd/seedrole (never traced before). One gap opened (hand-kept module list, no drift test). No question: build work.

## 2026-11-03 11:30 UTC
Traced the callers of the AI gateway for the new Usage pages. One gap, turned into Q126. Nothing in wakala-api calls the new `ai_usage_breakdown` yet; the module is not checked out.

## 2026-11-03 14:35 UTC
Re-read agency `nextCode` against actor's ACT77 and ACT78 fixes of the same day: the bullet above is reopened (it was marked closed and not rechecked). Read comm's person-reach design (HS691): cost noted in performance.md 37. No question: both are build work.

## 2026-11-03 16:40 UTC
Read internal/accounts (router, pool) and internal/session (cached, ledger) in wakala-api. One gap (the router), turned into Q127. mwanachama-backend-auth, which stores the session ledger, is not checked out, so its table and indexes were not read.

## 2026-11-03 18:50 UTC
Read wakala-api `internal/api/http/mcp_session_binding.go` and `internal/session/session.go`. One new risk, recorded as performance.md entry 39 (whole-map scans under one lock). Ownership check is right: a session id held by another caller answers 403 with a distinct message, which tells a caller that the id exists; not opened as a gap because ids are random and unguessable. No question.

## 2026-11-04 04:50 UTC

Task manager cases and votes: the vote key makes a double vote a no-op and a lost insert race is re-read (`case_vote.go` recordVote), so no duplicate vote. The ranking cap is the weakness (performance.md entry 40).

## 2026-11-04 UTC

Read the schedule sweep, the repeating task store and the standing message sender. One gap opened (performance entry 42).

## 2026-11-04 08:30 UTC

Read shopauth and supabasemgmt in mwanachama-wakala-api. Both only forward to the identity and management APIs and hold no state; the cost findings are performance entries 43 and 44. `mwanachama-backend-auth` (the `LastSeen` throttle) is still not checked out, so entry 43 cannot be closed or confirmed.

## 2026-11-04 UTC

First trace of the risk pages (`studio/agency/bowties.html`, `hazards.html`, `threats.html`, `consequences.html`) against the agency blueprint and `risk_*_impl.go`, `bowtie_scan.go`, `library_usage.go`. One gap opened: DeleteRisk leaves its links behind. No question: it is build work.

## 2026-11-04 12:35 UTC

Traced the Roles page (`studio/agency/roles.html`) against actor role kinds and seats and the publish wrapper. Two gaps opened (seats ended by a publish and not restored by rollback, turned into Q130; an agency job has no group to sit in).

## 2026-11-04 17:00 UTC

Traced member sessions routes and group settings (wakala-api session_routes.go, actor join_impl.go). Opened the entries above.

## 2026-11-04 18:40 UTC

Read the MCP body guard and batch cap against the tenant gate. One gap, turned into Q133.

## 2026-11-05 06:50 UTC

Review running state has two holders and no stop (agency review rows, reviewruns Runner). Opened one bullet, turned into Q137.

- comm `push_delivery`: one row per phone per notice, kept 90 days, indexes on notification and actor only, so the prune by time scans; the per-agency slot cap of 16 means total push concurrency grows with cached agencies (`push_delivery.go`, `comm.blueprint.json`). Open, performance.md entry 51; retry choice turned into Q138.
- Removing a person from the agency is two writes in two databases with no undo, and the last-owner check races (`mwanachama-wakala-api/internal/api/http/member_removal.go` `removeFromAgency`, `mayRemove`; `internal/agencies/removal.go`; `mwanachama-backend-actor/removal_impl.go` `RemoveFromAllGroups`). `removeFromAgency` first removes the person from every group in the agency's own tables, one transaction per group, then deletes the membership row in the registry database; a failure between leaves a member with no groups (a retry repairs it, nothing reports it). `mayRemove` counts owners by loading every member and then removes outside any transaction, so two owners removing each other at the same moment both see two owners and both pass, leaving an agency with no owner; the registry delete has no `AND` guard on the owner count. Nothing in the removal touches steps, tasks or approvals the person holds (not found in the files read; the role seat link is on the membership row and goes with it). Template mint has the same shape: `mcpMintTemplate` writes the catalog entry and then its private parts as two calls, so a failed second write leaves a pending entry with no readme (`internal/api/http/mcp_tools_template.go`); the template spec has no scenarios or step kinds, so a minted template carries none of the premise's tests (`internal/templates/spec.go`). Open, build work; performance.md entry 55.
- A step's actor can be a group, but only roles are ever matched at run time: the agency accepts a group id in `role_id` (`actor_pick_impl.go`), the studio offers groups (decision 94), and the member app's open-steps read keeps only steps whose id is a role the caller holds (`mwanachama-wakala-api/internal/api/http/caller_open_steps.go` lines 89 to 103). Turned into Q151. The agency also reads the group list of another module on every publish and scan (performance 74).

## 2026-11-05 UTC

Read comm Web Push delivery. One bullet; see performance.md entry 51.

## 2026-11-05 UTC (second run)

Read catalog slot booking. One bullet; see indexes.md and performance.md entry 52.

## 2026-11-05 UTC (third run)

Read comm moderation store. One bullet.

## 2026-11-05 UTC (fourth run)

Read taskmanager task placement against the operations file, the blueprint and the list reads. Two bullets; see performance.md entry 54 and indexes.md.


## 2026-11-05 UTC (fifth run)

Read agency member removal and template mint. One bullet; see performance.md entry 55.
## 2026-11-06 UTC (second run)

Insights are the one module mounted once for all agencies (`cmd/server/main.go` fixed instance `app`), so tenant separation rests only on `scopeInsightsToMembership` (REST) and `membershipScopedInsights` (MCP). The earlier open holes (trailing body data, subject only in the body, empty subject on create) are closed in `insight_scope.go`: a body with trailing data, or no subject, is now refused with 400. Open: the module itself is not checked out, so its list cap, indexes and the exact `subject_id` column cannot be verified; cost in performance.md entry 60.

## 2026-11-06 UTC (third run)

Read the workspace mount in wakala-api (`cmd/server/workspace.go`, `workspace_routes.go`, `router.go`, `authorize_test.go`) against the other anonymous doors. One bullet, no question: the module is not checked out and the finding is build work.


## 2026-11-06 UTC (fourth run)

Read `internal/provision/provision.go` and its callers in `internal/launch/launch.go` against the lazy module builders in `internal/agencies/registry.go`. Two bullets: row-level security is applied once at launch, and the seed user function does not stamp the role of an existing user. No question.

## 2026-11-06 UTC (second run)

Taskmanager run writes read against the step limit sweep; see engine.md. One gap, turned into Q144.

## 2026-11-06 UTC (third run)

Task manager list paths read for swallowed errors and silent caps; one gap added.

## 2026-11-07 UTC

Read report_promises.go, case_threads.go, ask_closed.go; two bullets added.

## 2026-11-07 UTC (second run)

Traced actor delegations (delegation_impl.go, blueprint, operations, delegations.md); one bullet, performance entry 73.

## 2026-11-07 UTC (third run)

Traced the groups lister the agency uses against actor ListGroups; bullet added, performance entry 74.

## 2026-11-07 UTC (fourth run)

Traced shared dispatch (dispatch.go, tools.go, tools_bind.go) against wakala-api requestlog.go; two bullets, no question (engineering only).

## 2026-11-07 UTC (fifth run)

Traced forms file answers to the host; one bullet, turned into Q154.

## 2026-11-07 UTC (sixth run)

Traced the agency join, leave and boot seed of resident grants (join.go, join_routes.go, resident_grants.go, main.go). One bullet, no question (engineering only).

## 2026-11-08 UTC

Traced the catalog ratings attachment (ratings.go, catalog_ratings_routes.go, wakala.catalog.json); one bullet, no question (engineering only). Ratings module not checked out.

## 2026-11-08 UTC (second run)

forms `Register` and `listOf` skip the shared engine's list cap, so forms is the one module whose lists the cap does not reach; see performance.md entry 77. Forms `StableIdentity` and `Resolve` have no caller in wakala-api.

## 2026-11-08 UTC (third run)

Traced the voting mount (voting_routes.go, pollManagerFor, buildPollManager). Polls have REST routes only, no MCP tool and no notify rule; the voting module is not checked out, so its tables and indexes are unread. First request per agency runs table creation, same cost as Q89. Turned into Q155 on the app side.

## 2026-11-08 UTC (fourth run)

First trace of the engage module (blueprint, 15 operations, post.go, notice.go, volunteer.go) against the module catalog, the wakala-api go.mod and the specstore list cap. Opened the mount gap, the missing list, the pick race and the uncapped unread count; Q156, Q157.

## 2026-11-08 UTC (fifth run)

mwanachama-backend-permissions (now checked out): grants only add and a withdrawal is a soft flag (`deleted`), but the flag records neither who withdrew nor when, and `reinstate` (`grant.go` lines 68 to 85) overwrites `granted_by`, `granted_at` and `ends_at` of the earlier grant, so the "trail of what was held" the blueprint promises keeps only the last grant. Turned into Q158. `replaceActions` (`action.go` lines 108 to 150) deletes a role's actions and inserts them one statement at a time in a transaction, so a seed of a role with 80 actions is 80 round trips; the wakala-api cache wrapper bumps the global epoch on every such change (`caches.go` lines 132 to 160), which empties every cached answer for every subject at once. Neither is a question.

Status additions (2026-11-08)
- market module (`mwanachama-backend-market`, first time checked out): the group order's own state changes are safe against each other (`manager.go` `updateGroupFrom` writes only when state and terms version still match, so two Sends do not both win), but a line is written with a read-then-whole-row update and no such guard: `JoinGroupOrder` checks `openGroup` and then inserts, so a join can land after `SendGroupOrder` has committed; `MarkLinePaid` and `DecideSilentLine` rewrite the whole line, so a paid mark and a changed quantity at the same moment overwrite each other. Turns Q134's moment into a code fact; open.
- market `line` has no unique `(group_order_id, picker)`: `JoinGroupOrder` asks `myLine` first and inserts if none, so a double tap on a slow phone can create two lines for one farmer and the total counts both (`group.go` lines 203 to 224; blueprint index is `group_order_id` alone). Build finding.
- market `AskRevision` changes the order and then, in a separate statement with no transaction, sets every line to waiting, including lines that had answered No; a failure between them leaves the new terms with old answers (`group.go` lines 227 to 250). `note` (the trail) is also a separate insert, so a change can succeed and its audit line be lost while the caller sees an error. Build finding.
- ai module (`mwanachama-backend-ai`, first time checked out): limits are per agency, account and AI role only; no per-person limit exists (Q153 updated). Costs of the call path are in performance.md item 81.
- auth module (`mwanachama-backend-auth` `last_seen.go`): throttle exists; failure path in performance.md item 82.

## 2026-11-08 UTC

Market, AI and auth modules read for the first time (they were not checked out before). Four status bullets added above; Q159 opened, Q153 recommended.

## 2026-11-08 UTC (market orders, quotes, asks)
Module-level read of the market orders, notices, quotes and asks lists.

## 2026-11-08 UTC (accounting)
Accounting ledger store, blueprint and provision read; one status bullet added.

## 2026-11-08 UTC (sources)
Read the sources module and its mount; added the stale gaps.md row and the empty chunk table.

## 2026-11-08 UTC (riskmanager mount)

- The agency keeps risks twice: bow-ties in the draft and published document (`risk`, `risk_pathway`) and the risk register mounted at `/instances/{id}/risks` (`mwanachama-backend-riskmanager`), with no field that ties a register risk to a published bow-tie code, publication or version. Evidence, ratings and actions are run data, so they correctly stay outside the definition; the missing link is the finding. Turned into Q162. Open.
- `mwanachama-wakala-api/documentation/3. implementation/risk-manager-mount.md` says the module code is not in the agency's catalogue; `mwanachama-backend-agency/models/modules_catalog.json` line 17 lists `riskmanager`. Stale page in a read-only repo. Open; build finding.
- `riskmanager` `Gaps` (`gaps.go`, `gaps_bulk.go` `bowtiesOf`) loads seven tables for the whole register in seven queries and cuts `limit`/`offset` after ranking in memory, with evidence read for every barrier in full history (append-only, `barrier_recorded` index serves the read) though only the latest row of each barrier is judged (`models/query.go`). Grows with risks times barriers times evidence rows per barrier; the module documents and tests the round trips (`gaps_scale_test.go`), not the row volume. Not a member path; fine at tens of risks; read from code, not measured. Open; build finding (read latest evidence only).
- Indexes on the register read from the blueprint: `risk_side`, `pathway_control` (unique), `risk`, `control`, `barrier_recorded`, `risk_kind_assessed`, `risk_status`, `status_due`, `status_owner`, `parent_pathway`; each filter in `bowtiesOf` (risk_id, barrier subselect) has one. No missing index found.
