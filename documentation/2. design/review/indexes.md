# Indexes, keys and foreign keys

Read from the blueprints, not from a database.

Status, worst first
- `chunk` (sources, `sources.blueprint.json`): indexes `source_id, position` and `embedding_model`; `SearchChunks` filters `embedding_model = ?` (and `source_id = ?`) with no limit and no vector index, so the second index only narrows by model and a single model means a full scan (performance.md 86). Needed: a database vector index (needs a vector field type in the engine) or a bound on the scan; keep both present indexes. `verification` has `(subject_role, subject_id, created_at)` which serves `standing` but the query has no limit, so it still reads the whole history; add `limit 1`. `source` has `kind` and `created_at` and `ListSources` has no limit; `annotation` has `(target_module, target_id)` and `source_id`. No foreign keys anywhere (columns only). Read 2026-11-08, first time.
- `entry` (accounting): indexes `debit_account_id`, `credit_account_id`, `reverses_entry_id` (unique where given), `settles_entry_id`; the balance and list query is `debit_account_id = ? OR credit_account_id = ?` ordered by `coalesce(nullif(occurred_at,''), posted_at)` (`ledger_store.go` `entriesTouching`). The two single-column indexes can serve the OR, the order cannot use any index. `account`: `identity` (category, holder_id) unique, `code`, `opened`; `budget`: `period` unique (account_id, period_start, period_end). No unused index found. Open only if the ledger ever sits on a path people wait on.
- `ask` (market): indexes `poster_id, answer` and `request_id`; `ListAsksBy` filters `picker = ? OR poster_id IN (subselect)` (`mwanachama-backend-market/asks.go` line 169) and `CreateAsk` counts on `poster_id, picker, request_id, offer_id` (line 51): `picker` has no index, so the OR can be answered only by reading the table. Needed: index on `picker`; unique on `(picker, poster_id, request_id, offer_id)` to stop double asks, cost one extra index write per ask, which is rare. Open.
- `yes` (market): index `poster_id, state` only; `ListYesesBy` and `closeYeses` filter by `picker` (`asks.go` line 169, `workflows.go` line 181) with no index on it. Needed: index on `picker`; `closeYeses` should instead update by primary key (the order's `yes_id`), which needs none. Open.
- `quote` and `draft` (market): index on `notice_id` only; `SendQuote` counts on `(notice_id, poster_id)` and the database does not stop a duplicate. Needed: unique `(notice_id, poster_id)`, which also serves the count. Open.
- `order` (market): `picker` and `(poster_id, state)` exist and `ListOrders` filters in Go, so neither is used (backends.md, 2026-11-08). Keep both; use them in the query.
- `grant` (mwanachama-backend-permissions `permissions.blueprint.json`, read 2026-11-08, first time the module is checked out): primary key (subject, scope, partition, role_code) already serves `MayPerformIn`, `ActionsFor` and `AccessOf`, so the declared index `subject_scope` (subject, scope, partial on not deleted) duplicates its first two columns and costs a second write on every grant and withdrawal for no read. `ListGrants` filtered by scope alone (`endRecordGrants`, `record_grants.go` line 47) or by role alone has no leading `subject`, so it scans the table (capped at 100 rows by `listCap`, `grant.go` line 132). Needed: index (scope, partition) partial on not deleted; drop `subject_scope`. `role_action`: the declared index (role_code, action) is the primary key again, a pure duplicate. Read from code, not measured. Open; see performance.md entry 78.
- `post`, `rsvp`, `attendance`, `offer`, `pick`, `read_marker` (mwanachama-backend-engage blueprint): every child has a unique `(post_id, participant_id)` or `(post_id, offer_id)` index, which also serves lookups by post; `post` has `(posted_at)` and `(kind, posted_at)` only, so the unread query (`kind` and `state`) and any group filter (a JSON column) have no index; `read_marker` lookup by participant alone has none. No foreign keys, ids are generated in code. Turned into Q157. Open.
- `agency_instance_join_requests` (`mwanachama-wakala-api/internal/agencies/join.go` `joinRequestRow`, migrations 000007 and 000010): key (instance_id, user_id) is right for the pending check and for one row per person; the coordinator's list filters instance_id and status and sorts by created_at with no index past the key prefix, and a refused row is kept for good (only a withdrawn pending request is deleted, `withdrawRequest`), so the list reads every refused request of the agency to show the pending ones. Small today (one row per person per agency); a partial index on (instance_id, created_at) where status is pending is the fix if refusals pile up. Open; build work, no question.
- Task manager join tables read against their queries (2026-11-06): `membership` (primary key task_id, project_id; index `project`), `tagging` (task_id, tag_id; index `tag`), `blocker` and `dependency` (from_task_id, to_task_id; index `to_task`) all have the key or index their reads use. `task` has no index on `task_name` or `project_name`, which `GetTaskByName` avoids only by listing the project and comparing in Go (performance entry 62); `task.deleted` has no partial index although `ListTasks`, `GetTask` and every write filter `deleted = false`, so every task read carries the filter over whatever index it picks. At board sizes of hundreds this costs nothing; read from blueprint, not measured. Low, open.
1. `record_row` (agency): indexes `record`, `record_code`, `record_order`; none on `replaces` and none with `created_at`. `settleReplacement` filters `replaces = ?` (full scan per correction) and `refuseDuplicate` filters `record_code = ? AND created_at >= ?` (reads every row of the record). Needed: unique on `replaces` ignoring empty (also makes a double correction impossible, Q141), and (`record_code`, `created_at`). Cost: one more index entry per payment write, rare. There is no `draft_id` index either, though `ListRecordRows` scopes on it (`record_impl.go`). `api-shared` `audit_event` has indexes on actor, subject_type and subject_id separately and no (`subject_type`, `subject_id`, `created_at`) for its ordered read, but wakala-api does not use that module, so nothing audits payment rows beyond the row history itself. Open, performance entry 57.
4. `task` (task manager): index `rank` alone; `place` orders by `rank, created_at, id` with `deleted = false`, so the sort is not served. Needed: (deleted, rank, created_at, id) or a partial index on rank where not deleted; cost: one more write per card move, which is rare. `rank` is never written at creation in the checked-out code (backends.md), so every task sits at 0 and the index separates nothing until someone places a card. Open, performance.md entry 54.
- forms `declaration` (`forms.blueprint.json` line 180): the only index is unique (respondent_id, form_id); `ListDeclarations` and `CountDeclarations` (`declarable_impl.go` lines 29 and 54) filter on form_id alone, so they cannot use it (form_id is second) and scan the agency's declaration table for each read of one form's results. Needed: an index on (form_id, created_at), which costs one more index entry on each anonymous declaration write (60 a minute per address at most). `respondent` also needs first_seen_at indexed if unclaimed rows are ever cleared. Open.
- comm `removal` and `dispute`: no indexes declared at all (`mwanachama-backend-comm/comm.blueprint.json`). `GetRemovalForMessage`, `ListRemovalsForStructure`, `GetDisputeForRemoval` and the locked lookup in `DismissReports` filter `message_id`, `structure_id` and `removal_id`, so each is a scan of the table; the table grows with withheld posts, small today. Needed: unique `removal(message_id)` (also makes the double removal impossible), `removal(structure_id, removed_at)`, unique `dispute(removal_id)`. `report` has (message_id, reported_by) unique and (structure_id, message_id); the queue orders by `reported_at`, so it sorts after the read; `ListReportQueue` and `ListRemovalsForStructure` pass no limit. Write cost: one entry per report, removal and dispute, all rare. Open; build finding.
- `review`: indexes `draft` (draft_id) and the partial unique `running_unique` (draft_id where running); `ListRunningReviews` with no draft (the resume at boot, `review_read_impl.go` line 158) filters `status = running` and orders by `started_at`, which neither index serves, so each agency's review table is scanned once per restart. Small today (one row per press of Run review, kept with the draft and never removed), so no index is needed; the table grows with presses, not with members. `review_area` has `review` (review_id) only, which serves `reviewAreaRows` and `readingArea`; `review_finding` has `review` (review_id) only, while `carriedFindings` and `findingViews` read by `area_id`, which is unindexed (up to 7 parts times the findings of each, read from the blueprint, `agency.blueprint.json` lines 727 to 745). Needed if a review holds hundreds of findings: `review_finding(area_id, ordinal)`; its write cost is one index entry per finding, written only when a part is recorded.
- `actor_role_assignment`: indexes `actor`, `group`, `kind` and the partial unique `held_once` (active only) cover every read traced (`ListRoleHolders`, `ListRoleAssignmentsForActor`, retire check); `ListRoleHolders` has no limit, see performance 45. No gap in the index set; `actor` and `kind` are both single-column and the `held_once` prefix is `actor_id`, so the `actor` index is redundant on writes (every grant and every end pays for four index updates). Low.
- Risk tables (agency blueprint, read 2026-11-04): `code` is a plain index on risk, risk_pathway, hazard, threat and consequence, but a fork copies every code into the new draft, so one code is held once for each draft that contains it; every lookup by code also filters `draft_id` (`risk_threat_impl.go` `codeInDraft`, `requireCodeInDraft`), and the only index that can serve both is two single-column ones, so the planner uses one and filters the rest. A composite (`draft_id`, `code`), unique for the library parts whose title is unique per draft, would serve the lookup and replace the `draft` index. Likewise the `target` index on control_attachment is (target_type, target_code) without `draft_id`, and the `consequence.hazard` index is `hazard_code` without `draft_id`: both read across all drafts and filter. Small per agency (one table set each), grows with drafts kept: each fork duplicates every row (`draft_id` is not a retention bound; see the draft cap). Cost of the change: one wider index per table on each write to a draft, on a path (editing a bow-tie) that is not a hot read. Open; build finding.
- Task manager `repeating_task` has one index, (assignee_kind, assignee_id), but the sweep's query filters `stopped_at IS NULL` and reads the whole table; `repeating_task_period` is keyed by `period_key` with an index on `repeating_task_id` (fine). Open, see performance entry 42: `mwanachama-backend-taskmanager/taskmanager.blueprint.json` lines 1455 and 1500. A partial index on running rows would cost one write on start and stop only.
- `case` (task manager): indexes `requester` and `subject` only, no `status` and no (`status`, `opened_at`); `ListCases` filters status and orders by `opened_at DESC` (`mwanachama-backend-taskmanager/case.go` 80 to 100). Open.
- `draft` (agency): only a non-unique index on `status`; no partial unique index guarantees one open, undeleted draft, and `ListDrafts` orders by `created_at` which has no index (`agency.blueprint.json` draft indexes, `draft_impl.go` `ListDrafts`). Cost of a partial unique index on `status` where open and not deleted: one small index on a table of at most 40 rows, written only when a draft is created or archived, so nothing on a path people wait on. Open.
- `test_run` correction: the Runs list orders by `queued_at DESC` (`scenario_run_impl.go` line 182), not `started_at`; the wanted index is (scenario_id, queued_at), not (scenario_id, started_at) (open). `agency_publication.content_hash` is indexed (`agency.blueprint.json` line 519) but not unique, and `findPublicationBy` takes the first match, so two publications with one hash would answer arbitrarily; republishing unchanged content is refused, so none is expected.
- Forms: the one-open-approval index was changed on 1 Nov (`mwanachama-backend-forms/provision.go` line 268, `WHERE decided_at = '' AND form_id <> ''`) but is created with `IF NOT EXISTS` under the same name, so an existing database keeps the old, narrower definition and a fresh one gets the new: the drift this log tracks. Open; a build fix (drop and recreate on a changed definition), not a question.
- Shared engine: `specstore.InsertOnce` (commit `bad8d22`, `ON CONFLICT DO NOTHING`) has no caller in any checked-out repo yet; it only protects a table that has a unique key matching the conflict, so each future caller needs that unique index named in its blueprint. Open, watch.

1. `agency_publication`: version and channel are plain indexes, not unique; the latest of a channel is found by `channel = ?` with no order; two rows can hold one channel (AG52). Needed: unique (version); unique (channel) where channel is not empty. Cost: one check on publish, which is rare.
2. `workflow_run` (task manager): no version column, so no index to find "orders on version N". Needed: a version column and a partial index on status for runs that are still going.
3. Every draft-scoped agency table has an index on `draft_id` alone and another on `code` alone; every query is `draft_id = ? ` plus an order or a code. Needed: (draft_id, code) in place of the two for goal, objective, workflow, work_item, role, module, value, rule; (draft_id, ordinality) for ordered lists. Cost: one fewer index per table.
4. `event_flow_step.workflow_code` is not scoped to a draft: two drafts' steps share a code. Needed: (draft_id, workflow_code).
5. `task` has `status`, `assigned_to`, `held_by` apart; the board query is by assignee and status. Needed: (assigned_to, status) where not deleted.
6. Soft delete: every table has `deleted` and none has a partial index. Needed where lists filter it.
7. No real foreign keys in any blueprint read; ids are strings made in the program (a key made without a round trip).
8. New design objects (step fields, records, rows, scenarios, runs, reports): keys by program-made id; index each by its owner (workflow code and draft_id; scenario id and run time). Not built.
9. forms `propagation` and `target`: only (form_id, chapter_id) unique; the member read filters chapter_id first. Needed: (chapter_id, form_id), which doubles as the cover for the Waiting list. Cost: one more index on a write done once per form send.
10. forms `submission`: unique (form_id, member_id, chapter_id, period_key) plus member_id alone; `ListAnswered` orders by sent time. Needed: (member_id, submitted_at). 
11. forms `answer`: unique starts with question_id; reading one member's answers to a form has no leading form_id plus member_id index (only form_id). Open.
12. comm `chat_message`: no index on author_id or read point; unread query filters author. Closed on 2026-10-29, decision 97 (HS302).
13. comm `notification`: needs (actor_id, created_at) where read_at is null for the badge.
14. catalog `entry`: the shipped declaration indexes one document path, `_template.sector` (`mwanachama-wakala-api/internal/specs/wakala.catalog.json`), and the blueprint indexes only `visibility`. A Payments record's rows kept as entries and read by order would filter a document path that has no index: a scan of the entry table on every Manage payments open. Needed: a path index on the order id in the record's declaration, `not_deleted`, plus the cost of one more index on every row write. Not built.
15. The SQL migrations in `mwanachama-wakala-api/internal/store/postgres/migrations/` (000002) still create the old agency shape: `agy_example_*` tables, `agency_publications` with a `status` column, `work_plans`, `context_sources`, `departments`, role assignments keyed on `work_item_id`. The agency now declares its tables from the blueprint and hashed names (`mwanachama-backend-agency/CLAUDE.md`), so a database made by `cmd/migrate` differs from one made at boot, and the file's own header says AutoMigrate at boot is the source of truth. Only `agency_instances` and `agency_instance_members` (primary key (instance_id, user_id), index on user_id) are current; the membership lookup by (instance_id, user_id) is covered by the key. Open; build finding.
16. `agency_instance_members` has `idx_agency_instance_members_user` on user_id (migration 000006, checked 2026-11-02) but no index serving `membershipsWhere` ordering by `agency_instances.created_at` for a user; it is a join per user, small per person, fine until a person belongs to hundreds of agencies. Not a risk today.
17. `workflow_run` (task manager): the stale-run sweep filters `last_event_at`, `timeout_published`, `paused_at` and then status in Go; the only index is plain `last_event_at`, and finished runs keep old values there, so the index range holds every finished run for ever. Needed: a partial index on runs still going, by last activity, or the sweep filtered by status first. `current_step_started_at` (the second sweep) has no index. Cost: one index write per step change of a run, which a run does a few times in its life. Open.
18. Test twins (shared engine): primary key `(run_id, key)`, every declared index led by `run_id`, a `unique` field becomes a unique index on `(run_id, field)` (`spec/migrate.go` `createTable`, `createIndexes`). Removing one run's rows by `run_id` is served by the key prefix. The twins add no index to a live table, so no cost on live writes; they add about 394 relations per agency (Q89). Closed as a design check on 2026-10-29.
- `agency` `record_row` (`agency.blueprint.json` 374 to 392): indexes `record` and `record_code` only; no `draft_id`, and no composite (`record_code`, order) for a per-order payments list (Q95), no farmer column for a Farmer's own rows; the farmer is inside the `answers` json, filtered in Go. Needed: composite (`record_code`, order) and a farmer column, 2 index writes per payment, a few dozen a week. Open.
- `test_run`: indexes `scenario` and `draft` alone; the Runs list orders by `started_at DESC` per scenario (`scenario_run_impl.go` line 188). Needed: (scenario_id, started_at). Cost: one small index written once per run. Open.
- `record_row`: indexes `record` and `record_code`; the blueprint declares a `draft_id` column and no index on it, and a draft-scoped read or copy of a draft's rows filters on it. Needed only if rows are read per draft; the Manage payments read is by record, which is covered. Low; open.
- `agency_publication.tag`: no index; fork from a tag filters on it (`findPublicationBy`). Table stays small; low.
- `code_sequence`: one row per kind; primary key `entity_type`; `nextCode` (`store.go` line 126) updates that row inside each create, so every create of one kind in an agency queues on one row until its transaction commits, and the first create of a kind in a fresh agency, run twice at once, loses on the primary key and answers a conflict with no retry. Small; open.
- `<slug>_approvals` (`internal/approvals/approvals.go`): primary key id (a UUID made in Go, no round trip); no foreign key; indexes present: status only; needed: (status, proposed_at) for the list, which orders by `proposed_at desc`. Written by AutoMigrate on first open per agency, so a fresh and an existing agency can differ. Open.
- `agency_notification_rules`: primary key (instance_id, event) serves the one query (`instance_id = ?`); no other index needed; the table is one shared table, not per agency. Fine.


20. catalog `entry`: the public listing orders `name, id` after filtering `deleted = false` and `visibility = 'public'` (`entry_list.go` 63); only `slug_live` (unique, live rows) and `visibility` exist (`catalog.blueprint.json` 87 to 102). Needed: (visibility, name, id) in place of the lone `visibility`, where not deleted, so the page reads in order with no sort. Cost: one wider index in place of a narrow one; entries are written rarely (a review, an edit), not on a path people wait on. Open.

Log
- `wakala_api_keys` (`internal/apikeys/row.go`, AutoMigrate): primary key `id` (generated in code, no round trip); no foreign keys; no other index. Queries filter `minted_by`, `account_id`, `COALESCE(service,'') <> ''` and `revoked_at IS NULL` (`apikeys.go` `checkRoom`, `List`; `service.go` `ListServices`, `LiveServices`); the `COALESCE` could not use a plain index anyway. At most 100 live keys per account, so no index is needed. Closed on 2026-10-30, no change.
- `agency_notification_rules` (`internal/notifyrules/store.go`): primary key (instance_id, event), read by instance prefix; right shape. The table sits outside the draft (no draft or version column), already raised as Q104.
- Review tables (agency blueprint): `review` has `draft` (draft_id); `latestReview` and `ListReviews` order by `started_at desc`, which that index does not carry, so a draft with many runs sorts in memory (small today, grows by one row per press); `review_finding` has `review` (review_id) and `findingViews` orders by `title, id`, again in memory; `review_comment` has `finding` (finding_id), read with `IN` over every finding of a review. A running review is found with `draft_id` and `status`, filtered after the index. No index needed on a path people wait on; a unique partial index on (draft_id) where status = running is needed for correctness, see backends.md. Drafts have no foreign key to these rows (columns only, like the rest of the declared tables). Open.
- `booking` (catalog blueprint lines 663 to 745): indexes `slot` (slot_id), `holder` (holder_id), `day` (day), none unique. `Book` counts `slot_id AND cancelled_at = ''` twice per booking, which the `slot` index serves (a slot holds a handful of rows). Needed: a partial unique on (slot_id, holder_id) where cancelled_at is empty to stop one holder taking two places, and a lock on the slot row (`FOR UPDATE` in `Book`, after `take`) because a unique index cannot enforce a capacity above one. Cost: one more index on a table written once per booking and updated once per cancel; no read people wait on changes. `holder` orders by starts_at, id after the index, fine at a few hundred rows per member.
20. `task` has no key for a promise's form and report version: the link is JSON text in `context` (`taskmanager.blueprint.json` task context, `mwanachama-wakala-api/internal/agencies/report_promises.go`), so `ReportPromises` cannot use any index and scans the board (performance entry 67). Needed: a link row (task_id, form_id, report_version) with an index on (form_id, report_version); costs one insert per promise at publish and nothing on the task write path.

## 2026-10-29 15:00 UTC

Read agency and task manager blueprints. Migrations and the other modules not yet read.

## 2026-10-29 15:45 UTC

Read forms and comm blueprints for indexes.

## 2026-10-29 16:15 UTC

Read catalog blueprint indexes and the wakala catalog and reports declarations.
3. `actor_group_assignment`: key (actor_id, group_id), one index on group_id; the member's own groups (actor_id first) use the key, the roster filters `deleted` and an outsider subquery on `actor_role_assignment`, whose indexes are three single columns (actor_id, group_id, kind_id). Needed for the outsider subquery: composite (kind_id, active, actor_id) or a partial index on active seats. Closed for the roster edge on 2026-10-29, decision 98 (HS303); the index is build work. Also: the engine emits no foreign key constraints for any table (`spec/migrate.go`), so every `*_id` column is a plain column.

## 2026-10-29 16:35 UTC

Traced actor blueprint indexes and shared `spec/migrate.go`.

## 2026-10-29 17:10 UTC

Read the wakala-api migrations folder and `internal/agencies/member.go`. Migrations were never read before; entry 15 opened.

## 2026-10-29 20:40 UTC

Read the sweep queries and the engine's twin tables against the indexes; entries 17 and 18.

## 2026-10-30 00:30 UTC

19. forms `answer` (`forms.blueprint.json` 217 to 219): the unique index starts with `question_id`, the other with `form_id`. A Route reading one question's answers across a form would need (form_id, question_id) so the rows come without a scan of the form; reads by `member_id` within a form need (form_id, member_id) (entry 11). Cost: one more index write per answer sent, which people wait on, so add only one: (form_id, question_id, member_id), which covers both reads. Open.

## 2026-10-30 02:40 UTC

Added `record_row`.

## 2026-10-30 10:35 UTC

Read the agency blueprint indexes for the scenario, test run and record row objects and the counter.

## 2026-10-30 12:40 UTC

test_run (agency): indexes `scenario` and `draft` only. `ResumeRuns` filters on `result` and sorts by `queued_at, id` with no index: add `result` (small, only two live values among many terminal ones, so a partial index fits). The index costs one write per run state change, which is a few a run. Foreign keys: `scenario_id`, `draft_id` are columns only.

## 2026-10-30 18:35 UTC

Keys and indexes of approvals and notification rules.

## 2026-10-30 20:50 UTC

Checked the two wakala-api tables read on request paths, keys and notification rules; neither needs a new index.

## 2026-10-30 22:30 UTC

Catalog `entry` list order against its indexes: entry 20.

## 2026-10-31 06:40 UTC

Listed the four review tables' keys and indexes against their queries in `review_read_impl.go` and `review_start_impl.go`.

## 2026-10-31 12:35 UTC

Checked the draft table's keys against the way three callers find the working draft. One gap, above.

## 2026-11-01 20:50 UTC

`agency_instance_members` (wakala-api registry, `member.go` `memberRow`): primary key (instance_id, user_id), one `agency_role_id` text column, no index on it. Reading "who holds role X" (for notify targets, the Test page, role removal checks) needs an index on (instance_id, agency_role_id); with a set of roles per person (Q111) the need is a table keyed (instance_id, user_id, role_code) plus an index (instance_id, role_code). Cost: one extra index write per role change, a rare write; the per-request membership read is already cached. Read from code, not measured.

## 2026-11-02 02:45 UTC

Corrected the test_run index column and noted the content_hash index.

## 2026-11-02 04:40 UTC

Read forms `d8798da` and shared `bad8d22`. Added the approval index drift and the unused InsertOnce.

## 2026-11-04 04:50 UTC

Read the task manager `case` and `case_vote` blueprint indexes against `case.go` and `case_vote.go`. `case_vote` is keyed by a hash of case and member (one vote per member, race-safe through the key) and has an index on `case_id`, which serves the count and the list. `case` lacks a status index. `task.due_at` has none.

## 2026-11-04 UTC

Checked the repeating task indexes against the sweep. One bullet added.

## 2026-11-04 UTC

Risk tables read from `agency.blueprint.json`. One entry opened (codes repeat across drafts, composite with `draft_id` needed).

## 2026-11-04 12:35 UTC

`actor_role_assignment` checked against its readers; one low note.

## 2026-11-05 06:50 UTC

Read the review, review_area and review_finding indexes against the reads of the review path. One bullet; no index recommended yet.

- `push_delivery` (comm): indexes `notification` and `actor`; `PrunePushDeliveries` filters `at < ?` with no index on `at`, and the table gets one row per phone per notice for 90 days (`push_impl.go` line 121, `comm.blueprint.json` lines 1339 to 1342). Wanted: an index on `at`, or prune in slices; each extra index costs one more write per delivery row. Open, performance.md entry 51.

## 2026-11-05 UTC

Read the push_subscription and push_delivery keys: endpoint unique, actor indexed, which fits the send read; only the prune lacks an index.

## 2026-11-05 UTC (second run)

Booking keys and indexes read; the capacity race has no database guard.

## 2026-11-05 UTC (third run)

Read comm moderation blueprint indexes. One bullet.

## 2026-11-05 UTC (fourth run)

Read forms declaration and public_link indexes against the list reads. One bullet.

## 2026-11-05 UTC (fifth run)

Read the task `rank` index against the placement query. One bullet.

## 2026-11-05 UTC (sixth run)

comm `notification` (actor_id, created_at) is the only index and serves List and UnreadCount; no partial index on unread rows, no retention (performance 56). `notification_acknowledgement` has notification and actor single-column indexes, no composite.

## 2026-11-05 UTC (seventh run)

Read `record_row` indexes against the correction and duplicate checks; entry 1 added at the top; noted that the audit module in api-shared is not mounted by wakala-api.

## 2026-11-06 UTC (second run)

Insights (`app_insights`, `app_insight_notes`, one shared set for every agency): the SQL mirror `000005_insight_scope_and_notes.up.sql` indexes `agency_id`, but the column is `subject_id` since 2026-09-30 and no later migration mirrors it, so a fresh database built from the mirrors and one built by `Provision` can differ; the module is not checked out so the declared index on `subject_id` could not be read. Needed: an index on `subject_id` (every list filters by it, `insight_scope.go`) and on `insight_id` of the notes (present). Open until the module is read. See performance.md entry 60.

## 2026-11-06 UTC (third run)

Task manager join tables and the `task` table checked against `ListTasks`, `GetTask`, `GetTaskByName`; one low gap added.

## 2026-11-07 UTC

One key gap added for report promises.

## 2026-11-07 UTC (sixth run)

Added the join request table (key present, pending list unindexed past the key, refused rows kept).

## 2026-11-08 UTC (second run)

forms `submission`: `Register` counts by `form_id` and `period_key`, but the only indexes are `form` (form_id) and the unique `form_member_group` (form_id, member_id, chapter_id, period_key), so the period filter is applied after reading every row of the form; harmless for an ordinary form, a scan of one row per member per week for a standing one. forms `question`: the `supersedes` index cannot serve `supersedes_question_id <> ''`, so `currentQuestionCount` scans the table (performance.md entry 77). Read from code, not measured.

## 2026-11-08 UTC (fourth run)

Engage tables listed from the blueprint; unread and group-filter gaps noted.

## 2026-11-08 UTC (fifth run)

Permissions module read for the first time: grant and role_action carry an index that repeats their primary key; the by-scope grant list has no index. Foreign keys: none (role_code is a bare column; a retired role keeps its grants by design). `permission` (partition, permission, role_kind, layer) key serves `ListPermissions` by partition prefix.

Additions (2026-11-08)
- `line` (market): index `group` on group_order_id only. `ListGroupOrdersBy` with `mine` filters `picker = ?` inside a subselect (`group.go` lines 399 to 402), which no index serves; `myLine` filters `group_order_id AND picker`. Needed: unique (group_order_id, picker), which stops the double line and serves `myLine`, and a plain index on picker for the subselect; cost: two index writes per join, a few joins per order.
- `group_order` (market): index `poster` only; the list orders by `id` after `state` and `coordinator` filters; at the sizes of a hub this is a scan of one agency's orders, fine until thousands. Unused: none found.
- `usage` (ai): index `account_window (agency_id, account_id, window_kind, window_start)` serves the day and month sums and the week sum (day rows from the first day of seven); the role filter `role_id = ?` is not in it and is a filter on a handful of rows. `minute` rows are never deleted, so the index grows with minutes of use. `usage_day`: `agency_day (agency_id, day)` serves the reads; the id is a seven-part string key (agency, account, role, day, model, kind, person), wide but written once per combination per day.

## 2026-11-08 UTC

Market line and group_order, AI usage tables read against their queries.

## 2026-11-08 UTC (market orders, quotes, asks)

Indexes of ask, yes, quote, draft and order read against the filters in asks.go, quotes.go and orders.go.

## 2026-11-08 UTC (accounting)
Accounting blueprint indexes read against ledger_store.go.

## 2026-11-08 UTC (sources)
Added the `chunk` and `verification` entry at the top; read the sources blueprint.

## 2026-11-08 UTC (riskmanager)
Register tables read from `riskmanager.blueprint.json`: every filter used by `bowtiesOf`, `summarisePathways` and `rankedBarriersOn` has an index; no gap opened. Evidence has no bound on growth (append-only, no prune).
