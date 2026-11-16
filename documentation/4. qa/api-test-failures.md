# The 25 failing tests of `go test -race ./internal/api/http`, classified, 16 November 2026

The full `go test -race -timeout 40m` of `internal/api/http` in `code/wakala-api` (run by the ISS-89 agent in the shared working tree, 2143 s) reported 25 failing tests. This page says which of them fail on a clean checkout of `dev`, why, and which issue owns each cause. Nothing was fixed in this change. Timing numbers for the whole package are in `api-test-suite-time.md` and are not repeated here.

## Method

- Clean export: `git archive HEAD code/wakala-api | tar -x` into a scratch folder, so no other session's uncommitted file counts. The six families were run at `dev` `c09dd3e1`. The three `TestGitMount_` tests were run again at `35de985e` because `dev` moved while the work was under way (the route mount was committed in between).
- Family run: `go test -count=1 -timeout 15m -run 'TestMUN23|TestLengthNames_|TestRoleHolder_|TestTheMayorsReasonSteps|TestCatalogAndReportsTools_|TestGitMount_' ./internal/api/http`, without `-race`. It took 32 s on a machine at load 8 to 20.
- Each test alone: the test binaries were built once (`go test -c`, and with `-race`) and every test was run on its own three times with each binary (`-test.run '^Name$' -test.count=1`).
- `TestTheMayorsReasonSteps` reads `projects/hungarian-municipality`, a sibling repository, through a relative path. For it, the sibling's `agency` folder was exported at `fc3b5bf9` and placed where the test looks.
- The full list of 25 names was taken from the ISS-89 run (lines matching `--- FAIL`).

## Classes

- a: fails only in the dirty shared tree.
- b: fails on clean `dev` because of a defect in the code.
- c: fails on clean `dev` because the test is stale, depends on order or load, or depends on where it runs.

## Result

Alone, 3 runs without `-race` / 3 runs with `-race`: P pass, F fail, S skip, N no such test.

| Test | Class | Alone, no race / race | Cause | Issue |
|---|---|---|---|---|
| TestGitMount_NoKeyIsAnswered401WithTheBasicChallenge | a | N N N / N N N at c09dd3e1; P P P / P P P at 35de985e | The test file was an uncommitted new file of another session and the `/git/` route was not mounted yet (404, want 401). Committed with the mount in `1ed02ad2` (ISS-88). | none needed |
| TestGitMount_AWritersKeyPushesANewBranchAndTheDefaultBranchIsRefused | a | N N N / N N N at c09dd3e1; P P P / P P P at 35de985e | Same: clone answered 404 because the route was not mounted. | none needed |
| TestGitMount_AWritersKeyPushesMoreThanOneMebibyte | a | does not exist at c09dd3e1; at 35de985e the test is named TestGitMount_ASinglePushBodyOverOneMebibyteIsNotCutByTheJSONBodyLimit and passes P P P / P P P | Same: 404 before the mount. The 413 on a push over 1 MiB is ISS-106. | none needed |
| TestMUN234c_ReplayMCP_Round1 | b | P P P / P F P (fails in the family run, and with race: subtests actor_create_role_kind, taskmanager_project_create, taskmanager_task_create) | Two creates at once: raw SQLite lock text in the answer, a duplicate project, and an "internal error" on issue create. Depends on timing. | ISS-108, MUN703, ISS-109 |
| TestMUN234c_ReplayMCP_Round2 | b | P P F / F F F (passes in the family run; with race the failing subtest changes from run to run: agency_create_role, agency_create_goal, agency_create_value, agency_create_workflow) | Same raw SQLite lock text from `nextCode` on simultaneous creates. | ISS-108 |
| TestMUN235cRound2Delegations | b | F F F / F F F | A delegation may end in the past or in year 0001; a malformed end is refused without naming `ends_at`. | MUN683 |
| TestMUN235cRound3RepeatingTasks | b | F F F / F F F | A rule that can never fire (every 31 February) is accepted. | MUN690 |
| TestMUN235cRound4TaskDueDates | b | F F F / F F F | `due_at` is stored as typed (year 10000, "next friday", a date, spaces). | MUN697 |
| TestMUN235cRound5OtherDueDoors | b | F F F / F F F | The same on patch and put. | MUN697 |
| TestMUN235cRound6RepeatingEngineOnStoredTasks | b | F F F / F F F | A huge interval runs the next period to year 152074901699; a daily task from year 2 takes 242 ms to answer a period (cap 100 ms); a daily task from 9999-12-31 has its next run in year 10000. | MUN704, ISS-114 |
| TestMUN236c_RoundTwoIssueNotesAndDescriptions | b | F F F / F F F | A body over 64 KiB answers 400 "the body is not valid JSON" for valid JSON, want 413 or a message naming the length. | MUN685 |
| TestMUN236c_RoundThreeIssueDescriptionsOnUpdate | b | F F F / F F F | The same on patch and put. | MUN685 |
| TestLengthNames_RoundOneGroupsAndActors | b | F F F / F F F | Group, actor display name and hierarchy names have no length limit (10 000 and 100 000 characters stored) and accept spaces only. | MUN678 |
| TestLengthNames_RoundTwoFormsAndPolls | b | F F F / F F F | Form titles and poll questions have no length limit. | MUN679 |
| TestLengthNames_RoundThreeBacklogsProjectsAndIssues | b | F F F / F F F | Backlog, project and issue names have no limit; project and issue names accept spaces only; an agency name of spaces only is accepted. | MUN680, MUN681 |
| TestRoleHolder_APersonHoldingJoinRequestDecideApprovesAnAgencyJoinRequest | b | F F F / F F F | The agency join-request and invitation routes call `mustBeMember`, which is false for a resident, so a role holder gets 404. | ISS-110 |
| TestRoleHolder_APersonHoldingMemberInviteInvitesAnAddress | b | F F F / F F F | Same, 404 want 202. | ISS-110 |
| TestRoleHolder_APersonHoldingMemberInviteLeadingTheGroupInvitesAList | b | F F F / F F F | Same, 404 want 200. | ISS-110 |
| TestRoleHolder_APersonHoldingMemberInviteNotLeadingTheGroupIsRefusedInvitingAList | b | F F F / F F F | Same, 404 want 403. | ISS-110 |
| TestRoleHolder_APersonHoldingJoinRequestDecideApprovesAGroupJoinRequest | c | F F F / F F F | The applicant is never admitted to the agency, so asking to join a group answers 404 before the role holder is tried. | ISS-111 |
| TestRoleHolder_APersonHoldingJoinRequestDecideDeclinesAGroupJoinRequest | c | F F F / F F F | Same. | ISS-111 |
| TestRoleHolder_APersonWithoutJoinRequestDecideIsRefusedDecidingAGroupJoinRequest | c | F F F / F F F | Same. | ISS-111 |
| TestRoleHolder_APersonHoldingJoinRequestOperateListsAGroupsJoinRequests | c | F F F / F F F | Same. | ISS-111 |
| TestTheMayorsReasonStepsAskForAReasonInTheMayorsOwnName | c | S S S / S S S in a bare export; F F F / F F F with the sibling repository beside it | Location dependent: it skips when `hungarian-municipality` is not beside the repo and fails on WI-31-6, whose reason question is optional in the template. | ISS-113 |
| TestCatalogAndReportsTools_EachAgencyHasItsOwnEntries | c | F F F / F F F | The private-notes read answers only the notes, never the entry name the test looks for; the isolation checks before it pass vacuously. | ISS-112 |

Totals: 3 in class a, 16 in class b, 6 in class c, 25 in all.

## What the run showed besides the classes

- In the family run on the clean export (without `-race`) 20 of the 25 failed. The other five: the three `TestGitMount_` tests do not exist at `c09dd3e1`, TestTheMayorsReasonSteps skips in a bare export, and TestMUN234c_ReplayMCP_Round2 passed (it failed 3 of 3 alone with `-race` and 1 of 3 without). So the dirty shared tree explains only the three git tests; the other 22 are not caused by other sessions' uncommitted edits.
- Most class b tests are probes written by the MUN234 to MUN236 rounds to hold a known bug open; they fail until the matching issue is fixed. They are expected failures of the suite, not regressions, and they are why the package is never green.
- TestRoleHolder tests that expect a refusal (for example "Without join_request.decide is refused deciding an agency join request") pass on 404, because 404 is also a refusal. They would pass if the route did not exist.
- The timing-dependent failures (Round1, Round2, the 100 ms cap in MUN235c Round6) fail more under `-race` and under load.

## Reproduce

Export `dev` into an empty folder, build the two test binaries inside `internal/api/http`, and run one test with `-test.run '^Name$' -test.count=1 -test.timeout 10m`. Do not run the whole package under `-race` on a loaded machine: it takes about 40 minutes (see `api-test-suite-time.md`).
