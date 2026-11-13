# Files

Decided by the owner on 2026-11-13 (hub issue ISS-1). Drawn as [mockups](../../mockups/app/files.html).

The Files screens let a person read what an agency keeps in its git module: code, and also documents. They are read only. The screens never say repository, branch, commit, diff or merge request.

## Who gets it, and where it is

| Question | Answer |
|---|---|
| Who gets Files | Any agency that mounts the git module. An agency without git never sees it. |
| Where is it | An option called Files on Home, beside Start, Ongoing and Backlogs, shown only when the agency mounts git, as Backlogs is shown only when the task module is on. The bottom bar is unchanged (Home, Chat, Notifications): there is no Files tab |
| How the app knows | The agency read the app already makes for Home ([tabs.html](../../mockups/app/tabs.html)): `agency_get_agency` and `agency_list_mounts`. The Files option shows when that read lists the module with code `git`, and is left out otherwise, so the check fails closed. See [The data layer](#the-data-layer). |

The module catalog has a `git` module (code `git`). `agency_list_modules` is not used: an earlier live read of it answered an empty list on 2026-11-02 ([app-agency-trace.md](../app-agency-trace.md), question 11), and the app's existing agency code and tests use `agency_list_mounts`.

Who may call the git tools is a separate gate. The forms git mount answers owners and agents only; a resident, a non-member or an unknown agency gets 404, and whether residents may read it is still an open owner question ([forms-git-mount.md](../../../../../../mwanachama-wakala-api/documentation/2.%20design/forms-git-mount.md)). Until it is answered, a resident would see a Files option on Home that cannot open anything.

## The screens

| # | Screen | What it shows | Tool |
|---|---|---|---|
| 1 | Home with Files | Home with the Files option beside Start, Ongoing and Backlogs, shown when the agency mounts git. The bottom bar is Home, Chat, Notifications, with no Files tab | `agency_get_agency`, `agency_list_mounts` |
| 2 | Folders list | One row for each Folder: its name and "Changed 2 hours ago". Back goes to Home, which stays chosen in the bottom bar | `forms_git_repository_list`, then `forms_git_commit_log` for each row |
| 3 | A Folder's top level | The folders and files at the top, then the README text under the list, nothing else. Back goes to the Folders list | `forms_git_directory_list`, `forms_git_file_read` for the README |
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
| `forms_git_directory_list` | `branchID`, `path` (empty is the top level) | For each entry directly inside: `name`, `path`, `is_dir`, `size` | No last-changed time and no author for an entry; no content type; what `size` holds for a folder is not verified |
| `forms_git_file_read` | `branchID`, `path` | One file: `id`, `sha`, `path`, `name`, `extension`, `size`, `encoding` (`utf-8` or `base64`), `content` | No content type (the `extension` is the only hint), no last-changed time, no author, no line count |
| `forms_git_commit_log` | `branchID`, optional `path`, optional `limit` | Newest first: `sha`, `author` (a name), `message`, `timestamp` (RFC 3339) | `author` is the name git recorded, not an actor id, so it is not tied to a person in the agency |

The Folder's `default_branch_id` from the list is the `branchID` every other call takes (the name sent is `branchID`, as in `git.operations.json` and as the reference picker already sends it), so no branch is ever chosen or shown.

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
| No read size limit | `WithMaxFileSize` caps only writes. `forms_git_file_read` returns the whole content however large it is, so the app sets its own limit, see [The size limit](#the-size-limit). |
| `forms_git_repository_list` is declared but not proven live | It is in the module's operations file and a wakala-api test names it; the earlier mockup notes said it was not built. It has only been run against a fake, see [Not verified against a live hub](#not-verified-against-a-live-hub). |

## The data layer

Source: hub issue ISS-2. Built in `code/app/src/files/api.ts`. Read only: the client has no write call.

### How the app learns git is mounted

| Step | What happens |
|---|---|
| Read | `mounted()` reuses the agency read the app already makes (`agency_get_agency` and `agency_list_mounts`, `code/app/src/agency/modules.ts`) and asks `hasModule` for the module code `git` |
| Fails closed | No git known means no Files option: not listed, the mounts read failed, both reads failed, or the answer unreadable |
| Never throws | `mounted()` answers true or false and never throws |

### The calls

| Call | Tool | Sends | Gives |
|---|---|---|---|
| `folders` | `forms_git_repository_list` | nothing else | For each Folder: `id`, `name`, `default_branch_id`. A row without a name or without a default branch id is dropped |
| `list` | `forms_git_directory_list` | `branchID`, `path` | For each entry: `name`, `path`, `is_dir`, `size` |
| `read` | `forms_git_file_read` | `branchID`, `path` | `extension`, `encoding`, `size`, `content` |
| `readme` | `forms_git_directory_list`, then `forms_git_file_read` | as above | The README of a folder, or none |
| `changed` | `forms_git_commit_log` | `branchID`, `path`, `limit` 1 | The newest entry: `timestamp` and `author`. None on an empty log or on any error, so the Changed line is simply left off |

### The size limit

| Rule | What it means |
|---|---|
| One number | `fileSizeLimit` is 1048576 bytes (1 MiB), one constant in `code/app/src/files/api.ts`. Change that number and nothing else |
| Read from the listing | The size comes from the directory entry, so a file over the limit is never fetched |
| At the limit | A file of exactly the limit is read |
| Not text | A file whose `encoding` is not `utf-8` (images included for now; the Image viewer below is not built in this layer) comes back as its name, size and a plain reason, "too large" or "not text", with no content |

### Not found

A missing folder or file, a path that is not in its parent's listing, or a folder where a file was asked, answers `status: "missing"` and is not an error. Any other failure is thrown, for the screen to show with Try again.

### The README rule

| Rule | Detail |
|---|---|
| Which entry | In the listing of that folder, the first entry that is not a folder and whose name is README with any single extension or none, ignoring case: README, readme.md, Readme.TXT |
| Not matched | READMEFIRST.txt; a folder named README |
| Too large or not text | A README that is too large or not text gives none |

### Who reads

Owners and agents only for now. Residents are not given Files; whether they may be stays the open owner question above.

### Not verified against a live hub

Tests: `cd code/app && npm test` gave 326 files, 3647 tests passed, 14 todo. `src/files/api.test.ts` has 39 cases. Every one runs against a fake of `callTool`; no running wakala-api has been called.

| Not verified | Why it matters |
|---|---|
| `forms_git_repository_list`, `forms_git_directory_list`, `forms_git_file_read`, `forms_git_commit_log` | Only run against the fake, never a running wakala-api |
| The not-found wording the hub sends | The client matches "not found" in the `McpError` message, ignoring case; other wording would be thrown as a failure |
| `is_dir` and `size` for folders | Whether they are filled for a folder entry is not known |
| `author` | Whether it is a person's display name is not known |
| `agency_list_mounts` for git | Whether it lists git for a real agency is not known |
| The Changed call cost | One `forms_git_commit_log` call for each Folder |

## Which viewer opens a file

The viewer is chosen by the file's `extension`, then by `encoding`.

| Viewer | Extensions | Shown as |
|---|---|---|
| Code | go, ts, tsx, js, jsx, json, py, sh, sql, css, html, yaml, yml, toml, xml, mod, sum, makefile, env | Highlighted with line numbers |
| Markdown | md, markdown | Rendered as a page |
| Plain text | txt, log, csv, and any file with no extension whose `encoding` is `utf-8` | The text on a page, no line numbers |
| Image | png, jpg, jpeg, gif, webp, svg | The picture, from the `base64` content. Not built in the data layer yet: an image comes back as name and size, reason "not text" |
| Name and size only | Every other extension; any file whose `encoding` is `base64` and is not an image; any file over the limit | The name, the size and the Changed line, no content |

The size limit above which a file shows as name and size only is the app's own, 1 MiB ([The size limit](#the-size-limit)). The backend has none for reading, so the app reads the `size` from `forms_git_directory_list` first and does not call `forms_git_file_read` for a file over it.

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
| A Files tab | The bottom bar is unchanged: Home, Chat, Notifications. The assistant is a screen inside Chat, not a tab |

## Wide window

Drawn in [wide.html](../../mockups/app/wide.html) 9 to 12: the Folders and a Folder's top level (9), a code file (10), a document file (11) and an empty Folder (12). Phone: [files.html](../../mockups/app/files.html).

### What changes

| Part | Phone | Wide window (from 48rem) |
|---|---|---|
| Folders list and an open Folder | Two screens: the Folders list, then a tap opens the Folder | One screen. The Folders are a list at the left, one row for each with its name and "Changed 2 hours ago"; the open Folder shows its folders under its name. The Folder at the right is open when the window opens, the first one, so the right side is never empty |
| A file | Opens in place of the list, with Back to its Folder | Opens at the right; the Folders list stays at the left with the file's Folder marked |
| A code file | The text scrolls sideways for a long line | The viewer takes the whole right side, so an ordinary line shows whole. A line longer than the viewer still scrolls sideways and the line numbers stay |
| A document | The rendered page fills the width | The page keeps a reading width of `70ch` at the left of the right side; the name and the Changed line are not held to it |
| An empty Folder | The card with Back to Folders | The same card, held to a width of at most 28rem |
| Layout | One column | A wrapping flex row: the Folders `flex: 0 1 15rem`, the open side `flex: 1 1 24rem`, inside the window's margin of `clamp(1rem, 3vw, 2rem)` |
| Bottom bar | Home, Chat, Notifications | The same, as on every wide screen. Files is an option on Home, not in the bar |

Below 48rem the window is the phone's, with the two screens and no list beside the Folder.

### What does not change

| Part | Same on the wide window |
|---|---|
| Calls | The same four tools: `forms_git_repository_list` and `forms_git_commit_log` for the Folders list, `forms_git_directory_list` for the folders and files, `forms_git_file_read` for a file and the README, `forms_git_commit_log` for the Changed line. The list beside the Folder asks for nothing the phone does not: the open Folder's list is the call that fills both the tree and the right side |
| Words | Folders, Folder, file, "Changed 2 hours ago by Agent One". Never repository, branch, commit, diff or merge request |
| Viewers | Chosen by the file's `extension` and `encoding`, as in the table above: code highlighted with line numbers, Markdown and other text documents rendered as a page |
| What a file shows | Its current text and the one Changed line. No history, no diff |
| Read only | No write, delete or upload |
| Who sees Files | Only an agency that mounts the git module |

### Left open

| Question | Why it is open |
|---|---|
| Back to Folders on a wide empty Folder | The Folders list is already at the left of the card, so whether the act is still wanted there is not decided |
