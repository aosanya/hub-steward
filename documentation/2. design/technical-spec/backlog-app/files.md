# Files

Decided by the owner on 2026-11-13 (hub issue ISS-1). Drawn as [mockups](../../mockups/app/files.html).

The Files screens let a person read what an agency keeps in its git module: code, and also documents. They are read only. The screens never say repository, branch, commit, diff or merge request.

## Who gets it, and where it is

| Question | Answer |
|---|---|
| Who gets Files | Any agency that mounts the git module. An agency without git never sees it. |
| Where is it | A bottom-bar tab called Files, beside Backlogs, Chat and the assistant, shown only when the agency mounts git |
| How the app knows | `agency_list_modules`, the read every existing tab already uses ([tabs.html](../../mockups/app/tabs.html)). The tab shows when the list carries the module with code `git` switched on. |

The module catalog has a `git` module (code `git`). The agency repo's tests find the module by that code in a draft; the live read of an agency without a draft id answered an empty list on 2026-11-02 ([app-agency-trace.md](../app-agency-trace.md), question 11), so the Files tab would not show there until that read is settled.

Who may call the git tools is a separate gate. The forms git mount answers owners and agents only; a resident, a non-member or an unknown agency gets 404, and whether residents may read it is still an open owner question ([forms-git-mount.md](../../../../../../mwanachama-wakala-api/documentation/2.%20design/forms-git-mount.md)). Until it is answered, a resident would see a Files tab that cannot open anything.

## The screens

| # | Screen | What it shows | Tool |
|---|---|---|---|
| 1 | Files tab | The tab in the bottom bar, on when the agency mounts git | `agency_list_modules` |
| 2 | Folders list | One row for each Folder: its name and "Changed 2 hours ago" | `forms_git_repository_list`, then `forms_git_commit_log` for each row |
| 3 | A Folder's top level | The folders and files at the top, then the README text under the list, nothing else | `forms_git_directory_list`, `forms_git_file_read` for the README |
| 4 | A folder inside a folder | The same list one level down; Back, or a breadcrumb of the folder names above | `forms_git_directory_list` |
| 5 | A code file | The name, one line "Changed 2 hours ago by Agent One", then the text highlighted with line numbers | `forms_git_file_read`, `forms_git_commit_log` |
| 6 | A document file | The same name and line, then the text rendered as a page | `forms_git_file_read`, `forms_git_commit_log` |
| 7 | An empty Folder | A Home-style card with its act inside it, never a grey glyph on a blank page. The screens only read, so the act is Back to Folders | `forms_git_directory_list` answering no entries |

A file shows only its current text and the one line under its name. There is no history list and no diff.

## What each tool takes and gives

Every tool also takes `instance_id`, the agency. Tool names are the module's own declared actions with the `git_` prefix turned into `forms_git_`. The declarations are in `mwanachama-backend-git/git.operations.json`.

| Tool | Takes | Gives | Does not give |
|---|---|---|---|
| `forms_git_repository_list` | nothing else | For each Folder: `id`, `name`, `default_branch` (a name), `default_branch_id` | No last-changed time, no description, no count of files, no author |
| `forms_git_directory_list` | `branch_id`, `path` (empty is the top level) | For each entry directly inside: `name`, `path`, `is_dir`, `size` | No last-changed time and no author for an entry; no content type; what `size` holds for a folder is not verified |
| `forms_git_file_read` | `branch_id`, `path` | One file: `id`, `sha`, `path`, `name`, `extension`, `size`, `encoding` (`utf-8` or `base64`), `content` | No content type (the `extension` is the only hint), no last-changed time, no author, no line count |
| `forms_git_commit_log` | `branch_id`, optional `path`, optional `limit` | Newest first: `sha`, `author` (a name), `message`, `timestamp` (RFC 3339) | `author` is the name git recorded, not an actor id, so it is not tied to a person in the agency |

The Folder's `default_branch_id` from the list is the `branch_id` every other call takes, so no branch is ever chosen or shown.

### Where each line comes from

| Line | Source |
|---|---|
| Folder name | `forms_git_repository_list`, `name` |
| "Changed 2 hours ago" on a Folder | Not in the list. `forms_git_commit_log` with that Folder's `default_branch_id` and `limit` 1, read as `timestamp`. It is one more call for each row, so a list of ten Folders makes eleven calls. No tool gives it in one call. |
| "Changed 2 hours ago by Agent One" on a file | `forms_git_commit_log` with the Folder's `default_branch_id`, the file's `path` and `limit` 1: `timestamp` and `author` |
| README under a Folder's list | The entry in `forms_git_directory_list` named README, then `forms_git_file_read` |

### Gaps

| Gap | What it means for the screens |
|---|---|
| The Folders list has no last-changed time | The Changed line costs one `forms_git_commit_log` call for each Folder. The row can show the name first and fill the time as each call returns. |
| Folder and file rows in a folder have no last-changed time or author | Rows in a folder show the name and, for a file, its size only. They do not say "Changed". |
| `author` is a name, not an actor | "by Agent One" is only as good as the name the committer set. Whether the agents and people of the hub commit under their display names is not verified. |
| No content type, only `extension` and `encoding` | The viewer is chosen by extension (below). A file without an extension is shown as plain text when `encoding` is `utf-8`. |
| No read size limit | `WithMaxFileSize` caps only writes. `forms_git_file_read` returns the whole content however large it is, so the limit for showing a file is to be set. |
| `forms_git_repository_list` is declared but not proven live | It is in the module's operations file and a wakala-api test names it; the earlier mockup notes said it was not built. It is not called against a running API in this page. |

## Which viewer opens a file

The viewer is chosen by the file's `extension`, then by `encoding`.

| Viewer | Extensions | Shown as |
|---|---|---|
| Code | go, ts, tsx, js, jsx, json, py, sh, sql, css, html, yaml, yml, toml, xml, mod, sum, makefile, env | Highlighted with line numbers |
| Markdown | md, markdown | Rendered as a page |
| Plain text | txt, log, csv, and any file with no extension whose `encoding` is `utf-8` | The text on a page, no line numbers |
| Image | png, jpg, jpeg, gif, webp, svg | The picture, from the `base64` content |
| Name and size only | Every other extension; any file whose `encoding` is `base64` and is not an image; any file over the limit | The name, the size and the Changed line, no content |

The size limit above which a file shows as name and size only is to be set by the owner. The backend has none for reading. Until it is set the app should read the `size` from `forms_git_directory_list` first and not call `forms_git_file_read` for a file it would show as name and size only.

Other documents (word processor, spreadsheet, PDF) are not in this design and fall under name and size only.

## The words on the screens

| The module says | The screen says |
|---|---|
| repository | Folder |
| directory | folder |
| file | file |
| commit | never shown; only "Changed 2 hours ago by Agent One" |
| branch | never shown |

## Not in this design

| Left out | Why |
|---|---|
| History | A file shows its current text and the one Changed line only |
| Diff | No history list and no diff |
| Editing | Read only; no write, delete or upload |
| Branches | The default branch is always the one read, and is never named |
| Merge requests, tags, import | Not screens of this app |
