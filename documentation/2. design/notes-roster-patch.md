# Notes roster patch (ISS-271)

The hub change for the notes version of the taskmanager. Part of it is already in `code/wakala-api`; this page holds the part that cannot land until `go.mod` pins the tagged notes version, because the pinned build would fail the roster test before then.

## Already prepared (not committed)

- `internal/api/http/group_role_access.go`: `taskmanager.rule.overlap_list` is gone from `backlogReadActions`; `taskmanager.rule.note_add`, `note_list` and `note_list_of` are in `backlogReadActions` (adding a note needs only Can see); `taskmanager.rule.note_resolve` is in `backlogWriteActions` (resolving needs Can move).
- `internal/api/http/backlog_access_rules_test.go`: the level lists carry the new sets, and tests pin the production lists to them. Tests that need the notes version or the new catalogue skip with a message and switch on by themselves once the pins move.

## What the notes version changes in the tool roster

Read from `taskmanager.operations.json` of the notes worktree against the pinned v0.4.0 file: one action leaves and four arrive, and one of the four has no tool.

| Action | Tool | Change |
| --- | --- | --- |
| `taskmanager.rule.overlap_list` | `taskmanager_rule_overlap_list` | removed |
| `taskmanager.rule.note_add` | `taskmanager_rule_note_add` | added |
| `taskmanager.rule.note_list` | `taskmanager_rule_note_list` | added |
| `taskmanager.rule.note_resolve` | `taskmanager_rule_note_resolve` | added |
| `taskmanager.rule.note_list_of` | none (`"tool": false`, route only) | added |

Net: minus one, plus three, so +2 tools in every configuration (every configuration mounts the taskmanager).

## Pinned counts in `mcp_roster_pin_test.go`

`pinnedRosterCounts` becomes:

| Configuration | Now | After |
| --- | --- | --- |
| `no-mounts` | 845 | 847 |
| `catalog` | 914 | 916 |
| `reports` | 913 | 915 |
| `ai` | 879 | 881 |
| `catalog-reports` | 982 | 984 |
| `catalog-reports-ai` | 1016 | 1018 |

## Golden file `internal/api/http/testdata/mcp_roster/no-mounts.txt`

The file is one sorted tool name per line, 845 lines now and 847 after. The five other `*.added.txt` files list only what a mount adds on top of `no-mounts` and need no change (none of them names an overlap or note tool).

Remove line 742:

```
taskmanager_rule_overlap_list
```

Add these three lines between `taskmanager_rule_list_for_issue` (line 741) and `taskmanager_rule_produced_list`, in this order:

```
taskmanager_rule_note_add
taskmanager_rule_note_list
taskmanager_rule_note_resolve
```

The lines around the change then read:

```
taskmanager_rule_list
taskmanager_rule_list_for_issue
taskmanager_rule_note_add
taskmanager_rule_note_list
taskmanager_rule_note_resolve
taskmanager_rule_produced_list
taskmanager_rule_read
```

Regenerating with `ROSTER_UPDATE=1 go test ./internal/api/http -run TestEveryMountConfigurationListsExactlyItsPinnedMCPTools` writes the same file; diff it against this page before keeping it.

## Finishing after the tags

1. Tag the taskmanager notes version, then `go get github.com/aosanya/mwanachama-backend-taskmanager@<tag>` in `code/wakala-api` (no `replace`, no vendoring).
2. Tag the agency version whose `models/permissions_catalog.json` has `rule.read` with `note_add`, `note_list`, `note_list_of` and without `overlap_list`, and `rule.edit` with `note_resolve`; `go get` that tag too.
3. Apply the golden file edit and the count edit above.
4. Run `go vet ./internal/api/http` and `go test ./internal/api/http -run 'TestBacklogAccess_|TestEveryMountConfigurationListsExactlyItsPinnedMCPTools'`. No test in `backlog_access_rules_test.go` may still be skipped.
5. Run the full `wakala-api` suite once.

## Docs that name the retired tool

`rules-view-web-plan.md` still lists `taskmanager_rule_overlap_list` and `overlap_list` among the ten `rule.read` actions (lines 60 and 226). Its owner updates it when the notes version lands; it is not part of this patch.
