# Git over HTTP from a per-repository file: concurrency results, 16 November 2026

Part of ISS-88 (todo TD-1464, the concurrent-pushes part). The tag-push and push-size-cap parts of that todo wait for owner answers and are not covered here.

The tests are in `code/wakala-api/modules/git/git_smarthttp_file_concurrency_test.go`. Each one starts the real handler (`RepoFile.GitHTTPHandler`) on a temp per-repository `.db` file and drives it with a real `git` binary: clone, commit, push, fetch, `fsck --strict`. Run with `go test -race -count=1 -run TestRepoFileGitHTTPConcurrency ./modules/git/` from `code/wakala-api`.

## How the file is shared

One `RepoFile` opens the file with `busy_timeout(10000)` and a single connection (`SetMaxOpenConns(1)`), so every request in one process takes its turn on that connection. A second handle on the same file, which stands in for a second process, waits up to ten seconds on a lock before SQLite answers "database is locked". Every request builds its own in-memory snapshot of the file, so two pushes never share a working copy.

## Results

| Case | Test | Result |
|---|---|---|
| Ten pushes of ten different branches at the same moment | `TenPushesOfTenBranchesAtTheSameTime` | All ten accepted, 0 refused. Ten pushes finished in 0.33 s to 0.80 s in total over four runs (0.80 s under `-race` with other sessions running, 0.33 s to 0.46 s on a quiet machine). Every branch reads back through the file tools (tip, file content, log starts at the pushed commit) and through a fresh clone (tip, file, `fsck --strict`); eleven branch rows exist; the default branch did not move. |
| Pushes to one branch while another branch takes tool writes and a merge | `APushDuringToolWritesAndAMergeOnAnotherBranch` | Six pushes and six `WriteFile` calls plus one `MergeBranch` ran together in 0.5 s to 1.0 s, 0 refused, 0 tool errors. All six pushed commits are in the log read through the tools, all six files read back, the merged tool files are on the default branch and in a fresh clone of it, and a clone of the pushed branch is at the last pushed commit. |
| A second handle on the same file writing while ten pushes run | `AToolWriteFromAnotherHandleToTheSameFileDoesNotLoseOrHidePushes` | 0 refused pushes, 0 failed tool writes in four runs (18 to 36 tool writes landed during the 0.65 s to 1.45 s the ten pushes took). The ten-second busy wait absorbed every lock; no "database is locked" reached a caller. Every pushed branch reads back through the tools and a fresh clone. |
| Clones during eight pushes of one branch | `ACloneDuringPushesSeesTheOldOrTheNewStateNeverAHalfIndexedOne` | Seven pushes took 1.9 s to 2.9 s while three clone loops ran 21 to 25 clones per run. No clone ever landed on a tip that no push made, and no clone had a broken tree (`fsck --strict` clean, `state.txt` matched the tip). In 4 of 10 runs one or two of the clones failed with `fatal: Remote branch live not found in upstream origin`. One earlier run also had two clones answered with HTTP 500. |
| Branch row moved before the commit's object is stored | `ABranchMovedToACommitWhoseObjectsAreNotStoredYetIsStillCloneable` | Fails today, every run: the same "Remote branch live not found". |

Refused pushes: none in any run of any case.

## Open defect: a clone can find the branch missing during a push

A push is recorded in two steps. `indexPushedBranchFrom` (`git_impl_push.go`) moves the branch row to the new commit; afterwards `storePushedObjects` (`git_smarthttp_file_store.go`) writes the raw object bytes onto the commit, tree and blob rows. A clone builds its snapshot (`git_smarthttp_file_snapshot.go`) from those raw bytes and, in `loadRefs`, leaves out any branch whose tip has none. A clone that lands between the two steps therefore sees no branch at all, which is neither the old state nor the new one. The snapshot is also read in separate queries rather than one read transaction, and the advertisement (`info/refs`) and the pack request are two requests, which is the likely source of the HTTP 500 seen once and not captured.

It is filed as ISS-95 in the Git per-repo SQLite backlog. The deterministic test above stays red until it is fixed, and the stress test counts the missing-branch clones in its log line without failing, so the package is red in one place only.

## What this does not cover

Two pushes to the same branch at the same moment. Tag pushes and the push size cap, which wait for owner answers. Two processes, as opposed to two handles in one process.
