# How a test runs

Status
- A test block with no tool fails at once (`act.go` `namedTool`), and the studio draws no way to name one (turned into Q113).
- `ListTestRuns` (`mwanachama-backend-agency/scenario_run_impl.go` line 178) loads every run of a scenario in full with no limit, now including `trail` and each step's `sent` and `answer` (commit `94ead5e`), and `present` runs up to two more reads per run (`draftLabel`: the draft row, then the publication whose `content_hash` matches, read as a whole row with its document, `publication_impl.go` line 443 has no column list) (open; build finding, see performance.md).
- A test gives every actor the permissions its own blocks name, so a role that lacks a permission still passes: `wakala-api/internal/testruns/agent.go` line 62 calls `RunStage.Derive` (`stage.go`), which adds the action of each block's tool to `derived[actor]`, and `allowedActions` merges it with the role's real permissions (loaded in `cmd/server/testruns.go` line 135). The only per-actor check of the Test agent (`act.go` `namedTool`) therefore reads a list the scenario wrote itself. Turned into Q114.
- Each model-driven block rebuilds the run's known facts with 4 reads plus one `ListAsks` per actor (`stage.go` `Known`, called from `act.go` line 33); bounded by the scenario, test only. Open, low.
- The test-run budget is checked before and recorded after each model call as two separate calls (`testruns/agent.go` 195-215), and a failed `Record` aborts the run after the tokens were spent and the reply thrown away; with scenarios running at once each can pass the check before any records, so the budget can be passed by up to one call per scenario running at once. The meter has no role (`aimodel.go` 42-47). Open; build finding, not read inside the AI module.

- `agency_run_scenarios`, `agency_get_test_run`, `agency_create_scenario` and `agency_list_scenarios` are illustrative; no scenario object exists in the agency blueprint. Open.
- Test copy of the draft with its own market records: closed on 2026-10-29, decision 85 and the engine's `_test` twins (see the first bullet below).
- Time in a test: closed on 2026-10-29, decision 101.
- A run must not touch real orders or members: the proposal says so; nothing enforces it, and the notifications go through the comm module, which has no test mode. Open.
- Existing integration tests in the backends use sqlite and call handlers through the real mux (comm, forms); they can be reused for a scenario's steps but not for the Test agent. Open.
- The engine creates, evolves and indexes a `_test` twin of every declared table with a `run_id` column (`mwanachama-backend-shared/spec/migrate.go`), so where a run's data goes is settled by decision 85. Nothing reads or writes a twin: `specstore/store.go` `TestTable(role)` is the only reference, and removing a run's rows by `run_id` is left to a runner that does not exist. A module's manager, built against one fixed table, has no way to be pointed at a twin for one run. Open; build work.
- A scenario step that notifies goes through comm's `Raise`, which also sends a Web Push in the background when a sender is set (`mwanachama-backend-comm/CLAUDE.md`, CM35). A run that points comm at its twin tables finds no push subscription there, so no real phone is pushed; a run that sends only the notification row to a twin but still hands the sender the live subscriptions would push to real members. Not verified, because no runner exists. Open.
- Where a run reads the definition: the Test agent runs on the draft, so it reads draft rows, or `buildDocument(draft)` (a full list of every draft table, `document.go`). For Run all of N scenarios that is N rebuilds unless the document is built once and shared; the draft cannot change under a run unless the designer edits meanwhile. Engineering choice, open.
- The publish gate (every scenario Passed on the draft, decision 82 d) cannot run scenarios inside `PublishAgency`, which holds one database transaction (`publication_impl.go` line 217 on) and may not stay open across model calls. The gate must read stored pass records, which decision 82 d already sends back to Not run yet when a rule or workflow changes. Open; build work.
- Test tokens come from the hub's one token pool (decision 82 f); AI roles carry their own per-day and per-week limits (`mwanachama-wakala-api/internal/api/http/ai_weekly_role_limits_test.go`), but the code that checks them is in `mwanachama-backend-ai`, which is not checked out, so whether a Run all can use up what members' assistants need is not verified. Open.
- Correction on 2026-10-30: the first bullet above is stale. `agency.blueprint.json` now declares `scenario`, `scenario_actor`, `scenario_input` and `test_run` (with `draft_version`, `steps`, `tokens`, `stop_reason`), and `scenario_impl.go`, `scenario_run_impl.go` and `scenario_sendback_impl.go` hold their manager methods. What stays illustrative is the tool names in the captions until the wakala-api route is traced. Partly closed.
- `ListTestRuns` (`scenario_run_impl.go` line 184) has no column list and no limit, so the Runs list reads every run of a scenario with its whole `steps` JSON; the Runs list should read a summary and open one run on demand. Open (performance.md entry 26).
- A new draft wipes every scenario's pass. Turned into Q101.
- Correction on 2026-10-30 12:40: the runner exists. `mwanachama-wakala-api/internal/testruns` (`runner.go`, `agent.go`, `stage.go`, `judge.go`, `aimodel.go`) is built by `cmd/server/testruns.go` `testRunSeat.build` per run; it reads the draft, seeds approved test shops in the market twin, plays each block with the Test agent (up to 6 model moves, `maxMoves`) and checks each expectation with one more model call. The bullets above that say nothing reads a twin or that no runner exists are stale. Closed.
- The stage plays only the `market` module: `RunStage.Ready` returns `ErrNoTestCopy` for any other touched module, so a scenario that touches forms, comm, catalog or taskmanager stops. `Respond` plays only a send-the-group-order or an ask-the-buyer block, picked by looking for the words "send" and "order" in the block's free-text action; every other non-person block fails with "The test copy cannot play this step yet". Turned into Q102.
- A block's expectation is judged by a model reading the steps and the stored rows (`judge.go`); the same unchanged scenario can pass and fail. A reply with no JSON stops the run. Turned into Q103.
- Where a run's data goes and who is pressed: a run keeps its queue in the agency manager's memory (`scenario_run_board_impl.go` `runBoard`) with `ResumeRuns` reading waiting and running rows once per instance on its first `AgencyManager` call (`internal/agencies/registry.go` line 258). The limit Scenarios at once is therefore per process, not per hub, if the API runs more than one copy. Open; engineering.
- No clock is moved in the stage: a Supplier "answers within a day" is played by the next block, not by waiting (decision 101); nothing in `stage.go` checks a time limit. Open; confirm against decision 99.

Log

## 2026-10-29 15:00 UTC

Read test-run.html screen 1 caption. Q82 added (closed 2026-10-29, decision 101).

## 2026-10-29 20:40 UTC

Traced where a run's data goes (twins exist, no runner), the push side of comm for a test notify step, and why the publish gate cannot run inside the publish transaction. Q89 added.

## 2026-10-30 10:35 UTC

Found the scenario objects now exist in the agency; checked how a pass travels into a new draft and how test runs are listed.

## 2026-10-30 12:40 UTC

Read the new Test agent in `wakala-api/internal/testruns` and its wiring; closed the stale no-runner bullet; found the market-only stage, the word-matched step playing and the model judge. Q102 and Q103 added.

## 2026-11-02 02:40 UTC

Read the 1 Nov changes to run steps (module, endpoint, sent, answer, trail) and the runs list. Opened the list-cost gap.

## 2026-11-02 04:40 UTC

Read wakala-api commit `f9f1013` (1 Nov). Found the derived permissions in the Test stage. Q114 added. Checked that Q113's recommended picker list (`Stage.Tools`) inherits the same hole.

## 2026-11-03 11:30 UTC
Re-read the meter around the model call for the Usage work.
