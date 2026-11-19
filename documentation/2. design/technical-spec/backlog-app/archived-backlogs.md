# Archived backlogs

A finished backlog can be archived as a whole, so the Backlogs list stops showing it. Moving every issue to an Archive step did not do that: the backlog stayed on the list. Issue ISS-172.

## What is stored

A backlog carries one more field, `archived`, true or left out. It lives in the same stored list of backlogs as the name and steps (the `backlogs` setting of the taskmanager module), so no table and no SQL migration change. Issues, their codes and their tags are not touched, and an archived backlog's issues still open by link. A smart backlog reads issues across backlogs as before, archived ones included.

## The tools

| Tool | Does | Needs |
|---|---|---|
| `taskmanager_backlog_archive` | Marks the backlog archived and answers its summary | Can edit on that backlog |
| `taskmanager_backlog_unarchive` | Takes the mark off | Can edit on that backlog |
| `taskmanager_backlog_list` | Every backlog the caller can see, each with `archived` when set | Can see |

Both tools belong to the `backlog.manage` permission. The first backlog cannot be archived: it takes the issues that have no place, so the list refuses it with a 400. `taskmanager_backlog_manage` replaces the whole list, so a backlog stays archived there only when it is sent with `archived: true`.

## The app

- The Backlogs list hides archived backlogs. When at least one backlog is archived, a Show archived checkbox appears under the list; ticking it lists them too, each marked Archived.
- The All issues row and its step counts still count every issue, archived backlogs included.
- The Edit backlog screen has Archive the backlog, or Bring the backlog back when the backlog is archived. Both go back to the list afterwards.
- Smart backlogs have no Edit backlog screen yet, so they can be archived through the tool only.

## Checks

- `mwanachama-backend-taskmanager/backlog_archive_test.go`: marked in the list, unmarked again, issues and codes kept, first backlog refused, Can edit needed.
- `mwanachama-backend-taskmanager/routes/backlog_ops_test.go`: the two routes and the `archived` field in the list reply.
- `app/src/features/backlogs/list/archivedBacklogs.test.tsx`: hidden, brought back by Show archived and marked Archived, no toggle when nothing is archived.
- `app/src/features/backlogs/manage/backlogManage.test.tsx` and `api.test.ts`: the Edit backlog actions and the two tool calls.
