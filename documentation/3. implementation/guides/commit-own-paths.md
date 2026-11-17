# Commit with `commit-own-paths.sh`

Agents and sessions share one working tree. Commit with the script, never with a temporary index of your own: an index built from an old `HEAD` reverts whatever landed after it.

```sh
sh scripts/commit-own-paths.sh -m "message" path [path...]
```

Paths are whole files or folders, relative to where you stand or to the repo root. The script prints the new commit hash.

What it does:

- Builds a temporary index from the `HEAD` of that moment (`git read-tree HEAD`, never empty), adds the named paths from the working tree, and writes the commit with `git commit-tree`.
- Moves the branch with `git update-ref` and the old value, so it only moves if `HEAD` is still where it started. If another commit landed first, it rebuilds from the new `HEAD` and tries again, up to 3 times, then exits 4.
- Adds the `Co-Authored-By` line to the message.
- Leaves the working tree alone. The real index is changed only for the committed paths, and only where nobody had staged a different version, so a later bare `git commit` cannot revert them and other people's staged files stay staged.

What it refuses:

| Case | Exit |
|---|---|
| No `-m` message or no path | 2 |
| A path outside the repo, the whole repo, or a detached `HEAD` | 1 |
| The commit would change any path that was not named | 1, naming them |
| The named paths have no changes | 3 |
| `HEAD` moved on all 3 attempts | 4 |

An untracked file is committed only when it is named. A named file that was deleted in the working tree is committed as a deletion.

It works on whole files. Two agents who edit the same file cannot split it with this script: one of them commits the file once the other's hunks are in, or stages a diff they trust with `git apply --cached` into a scratch index of their own.

Never use `git add -A`, `git stash`, `git reset` or `git checkout -- <file>` in the shared tree.

`sh scripts/commit-own-paths.test.sh` covers the cases above in a scratch repo, including ten rounds of two callers at once; `make test` runs it.
