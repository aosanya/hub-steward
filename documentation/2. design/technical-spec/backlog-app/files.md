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
| 2 | Folders list | One row for each Folder: its name and "Changed 2 hours ago". Back goes to Home, which stays chosen in the bottom bar | `forms_git_repository_list` alone |
| 3 | A Folder's top level | The folders and files at the top, then the README text under the list, nothing else. The title is the Folder's name and Back reads Folders and goes to the Folders list | `forms_git_directory_list`, `forms_git_file_read` for the README |
| 4 | A folder inside a folder | The same list one level down; Back, or a breadcrumb of the folder names above | `forms_git_directory_list` |
| 5 | A code file | The name, one line "Changed 2 hours ago by Agent One", then the text highlighted with line numbers | `forms_git_file_read`, `forms_git_commit_log` |
| 6 | A document file | The same name and line, then the text rendered as a page | `forms_git_file_read`, `forms_git_commit_log` |
| 7 | An empty Folder | A Home-style card with its act inside it, never a grey glyph on a blank page. The screens only read, so the act is Back to Folders. The bar is as in 3: Back reads Folders and the title is the Folder's name | `forms_git_directory_list` answering no entries |

The chain of screens is Home > Folders > Folder > folder > file. The Folders list keeps the title Files and its Back reads Home; a Folder's top level shows the Folder's name as its title and its Back reads Folders; inside a folder or a file, Back names the screen above it.

A file shows only its current text and the one line under its name. There is no history list and no diff.

## What each tool takes and gives

Every tool also takes `instance_id`, the agency. Tool names are the module's own declared actions with the `git_` prefix turned into `forms_git_`. The declarations are in `mwanachama-backend-git/git.operations.json`.

| Tool | Takes | Gives | Does not give |
|---|---|---|---|
| `forms_git_repository_list` | nothing else | For each Folder: `id`, `name`, `default_branch` (a name), `default_branch_id`, `last_commit_at` (the time of its latest commit, left out for a Folder with no commit; hub issue ISS-12) | No description, no count of files, no author, no size |
| `forms_git_directory_list` | `branchID`, `path` (empty is the top level) | For each entry directly inside: `name`, `path`, `is_dir`, `size` | No last-changed time and no author for an entry; no content type; what `size` holds for a folder is not verified |
| `forms_git_file_read` | `branchID`, `path` | One file: `id`, `sha`, `path`, `name`, `extension`, `size`, `encoding` (`utf-8` or `base64`), `content` | No content type (the `extension` is the only hint), no last-changed time, no author, no line count |
| `forms_git_commit_log` | `branchID`, optional `path`, optional `limit` | Newest first: `sha`, `author` (a name), `message`, `timestamp` (RFC 3339) | `author` is the name git recorded, not an actor id, so it is not tied to a person in the agency |

The Folder's `default_branch_id` from the list is the `branchID` every other call takes (the name sent is `branchID`, as in `git.operations.json` and as the reference picker already sends it), so no branch is ever chosen or shown.

### Where each line comes from

| Line | Source |
|---|---|
| Folder name | `forms_git_repository_list`, `name` |
| "Changed 2 hours ago" on a Folder | `forms_git_repository_list`, `last_commit_at` of that Folder, in the same call as the names. A Folder with no commit has none and its row has no Changed line. |
| "Changed 2 hours ago by Agent One" on a file | `forms_git_commit_log` with the Folder's `default_branch_id`, the file's `path` and `limit` 1: `timestamp` and `author` |
| README under a Folder's list | The entry in `forms_git_directory_list` named README, then `forms_git_file_read` |

### Gaps

| Gap | What it means for the screens |
|---|---|
| The Folders list time has no author | `last_commit_at` carries the time only, so the row says "Changed 2 hours ago" without "by". The author is in Properties. |
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
| `folders` | `forms_git_repository_list` | nothing else | For each Folder: `id`, `name`, `default_branch_id`, `last_commit_at` (kept as `changedAt`, empty when the hub gives none). A row without a name or without a default branch id is dropped |
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
| Image | A file whose extension the viewer calls an image (png, jpg, jpeg, gif, webp, svg) and that is under the limit comes back with `status` `image` and its `bytes`: the base64 `content` decoded, or, for an svg, which the hub sends as `utf-8` text, the text encoded. The extension is the hub's `extension`, else the one in the name |
| Not text | Any other file whose `encoding` is not `utf-8` comes back as its name, size and a plain reason, "too large" or "not text", with no content |

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
| The Changed call cost | None for the Folders list: the time comes with the list. One `forms_git_commit_log` call for a file's Changed line and for Properties |

## Which viewer opens a file

The viewer is chosen by the file's `extension`, then by `encoding`.

| Viewer | Extensions | Shown as |
|---|---|---|
| Code | go, ts, tsx, js, jsx, json, py, sh, sql, css, html, yaml, yml, toml, xml, mod, sum, makefile, env | Highlighted with line numbers |
| Markdown | md, markdown | Rendered as a page |
| Plain text | txt, log, csv, and any file with no extension whose `encoding` is `utf-8` | The text on a page, no line numbers |
| Image | png, jpg, jpeg, gif, webp, svg | The picture, drawn from the `bytes` the data layer decoded. An svg is drawn as an image, never inserted as markup |
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

Drawn in [files.html](../../mockups/app/files.html) under each phone screen: the Folders and a Folder's top level ([3](../../mockups/app/files.html#s3)), a code file ([5](../../mockups/app/files.html#s5)), a document file ([6](../../mockups/app/files.html#s6)) and an empty Folder ([7](../../mockups/app/files.html#s7)).

The wide window is laid out like a code editor: a tree of the open Folder's files at the left, a strip of tabs over the content in the middle, and the Properties of the selection at the right. The three parts fill the window edge to edge with no margin, no gap and no inner frame, separated only by 1px lines. Corners and scrollbars are square.

### What changes

| Part | Phone | Wide window (from 48rem) |
|---|---|---|
| Folders list and an open Folder | Two screens: the Folders list, then a tap opens the Folder | Files always opens the Folders list first, also when the agency has one Folder; a tap on a row opens that Folder in the window. The window is one screen for the open Folder: the tree at the left starts at that Folder's own name, its folders and files sit directly under it, and a folder expands or collapses when its name or its chevron is tapped. The Folder opens with its top row selected, so the middle shows its description and is never empty. The window itself draws no Folders list |
| Top bar | Back reads Home on the Folders list and Folders on a Folder's top level; the title is Files on the Folders list and the Folder's name below it | The same on the wide window: the Folders list's Back reads Home; the open Folder's Back reads Folders and leads to the Folders list; the title is the open Folder's name, centred on the bar. The chain is Home > Folders > Folder > folder > file. Switching Folder is the back link to the Folders list; nothing else is drawn for it |
| A file | Opens in place of the list, with Back to its Folder | Opens in a tab. The tree keeps the file's folders expanded and the file's row highlighted |
| The Folder's description | The listing of the Folder's folders and files with the README text under it | Clicking the Folder's name row at the top of the tree selects it and shows only its description in the middle: the README text drawn as a rendered page with its title and paragraph, the same viewer as a document. No tab opens and no listing is drawn, because the tree already lists the folders and files; they are browsed in the tree. A Folder with no README shows a plain note, "No description yet" |
| Tabs | None | A strip over the content, one tab for each open file (see Tabs below). With no tab open the strip is an empty bar of the same height, so its line still runs straight into the Properties header |
| Properties | None | A flat list of read-only lines at the right for the selection (see Properties below) |
| A code file | The text scrolls sideways for a long line | The viewer takes the whole content area, so an ordinary line shows whole. A line longer than the viewer still scrolls sideways and the line numbers stay |
| A document | The rendered page fills the width | The page keeps a reading width of `70ch` at the left of the content |
| An empty Folder | The card with Back to Folders | The plain note "No description yet" in the middle, an empty strip, nothing under the Folder's name in the tree, and no Properties. The phone's empty card with Back to Folders is not drawn here |
| The name and the Changed line | Under the name, "Changed 2 hours ago by Agent One" | The name is on the tab and the Changed line is in Properties as Last changed and Changed by. This is the wide window's place for them; the phone keeps its line under the name |
| Layout | One column | A flex row with no margin and no gap, running down to the status bar along the bottom edge of the frame: the tree `flex: 0 1 15rem`, the middle `flex: 1 1 24rem`, Properties `flex: 0 1 15rem` |
| Bottom bar | Home, Chat, Notifications | None. The wide Files window has no bottom bar |
| Status bar | None | One flat strip about `1.5rem` tall along the bottom edge of the frame, full width under the three panes, with a 1px line above it. Empty for now: nothing is shown in it yet |

Below 48rem the window is the phone's: one Folder or file at a time with a back arrow, and no tree, no tab strip and no Properties (all three are left out, not stacked).

### The tree

| Rule | Detail |
|---|---|
| Top row | The open Folder's own name, a plain bold small uppercase label with no chevron and no "Folders" label above it. Clicking it selects the Folder, highlights it flat and shows the Folder's description with no tab. The name comes from `forms_git_repository_list` |
| Rows below | The Folder's folders and files directly under it, folders before files, each one compact line about 1.375rem tall in `.8125rem` text: a chevron column of about `.75rem` (empty for a file), a `1rem` icon and the name. Each level is indented by about `.75rem`, with a faint vertical line down the indent of an expanded folder |
| Expanding | A tap on a folder's name or on its chevron expands or collapses it and opens nothing. Expanding calls `forms_git_directory_list` for that one folder; the tree never asks for more than the folders the person expanded. The answer is kept while the app is open |
| No Changed line | The time of the selection is in Properties, so the tree makes no `forms_git_commit_log` call for each row |
| The open file | Its row is highlighted flat across the width and the folders above it are expanded |
| Tapping | Tapping a file opens it in a tab. Tapping a folder expands or collapses it, like its chevron, and opens no tab. Tapping the top row opens no tab: it shows the Folder's description |
| Which Folder | The Folder the person tapped in the Folders list, which `forms_git_repository_list` fills. Switching to another Folder is the back link to the Folders list; nothing else is drawn for it |

### Tabs

| Rule | Detail |
|---|---|
| What a tab is | One open file: its name and an x. A plain link with a button beside it, in one flat strip along the top of the content; the active tab is joined to the content and the others are quieter |
| Opening | A tap on a file in the tree opens it in a new tab at the right end, or focuses its tab if it is already open. A folder never opens a tab: tapping it only expands or collapses it, so the strip holds only files |
| Closing | The x closes that tab and its right neighbour becomes active, or its left neighbour if it was the last. Closing the last tab shows the Folder's description over an empty strip |
| How many | No limit. No tab is closed to make room for another; when the strip is full it scrolls sideways |
| Left out | No drag, no split, no pinned tabs, no preview tabs, no dropdown, no other button |
| Where they exist | Only on the wide window. The phone shows one file at a time with a back arrow |
| Where they live | The list of open tabs and the active one live in the app and are not saved on the server. The app starts again from the Folders list when it is opened |
| The Folder itself | Opens no tab; clicking its name row shows its description. A Folder with nothing in it also opens no tab, and neither does a folder inside it |

### Properties

One flat list of read-only lines for the selection, which is the highlighted tree row and the active tab. No buttons. Only what the git tools can fill is shown.

| Line | Folder or folder | File | Filled by |
|---|---|---|---|
| Name | yes | yes | `name` from `forms_git_repository_list` (a Folder) or `forms_git_directory_list` (an entry) |
| Path | yes, a Folder's own is `/` | yes | `path` from `forms_git_directory_list` or `forms_git_file_read` |
| Kind | no | yes | A plain word the app chooses from `extension`; the module gives no content type |
| Size | no | yes | `size` from `forms_git_directory_list`, or from `forms_git_file_read` once the file is read |
| Items | yes | no | The number of entries in `forms_git_directory_list`, counted by the app, folders and files together |
| Last changed | yes | yes | `forms_git_commit_log` with the Folder's `default_branch_id` (sent as `branchID`), the `path` and `limit` 1: `timestamp` |
| Changed by | yes | yes | The same call: `author`, a name the committer set, not an actor |

What each call does not give: `forms_git_directory_list` has no last-changed time and no author for an entry, and what `size` holds for a folder is not verified; `forms_git_file_read` has no content type, no last-changed time and no author; `forms_git_commit_log` gives `author` as a name, not an actor id.

Not shown, because no tool gives it or the design leaves it out: permissions, owner, created date, commit ids, and a history list (decision 6: no history).

The dash rule: a line whose call fails or has no answer shows a dash. A Folder with no entries has no log to answer Last changed and Changed by, so they would show a dash; Properties are left out on an empty Folder in the drawing (12).

### What does not change

| Part | Same on the wide window |
|---|---|
| Calls | The same four tools: `forms_git_repository_list` for the Folders, `forms_git_directory_list` for the folders and files, `forms_git_file_read` for a file and the README, `forms_git_commit_log` for the Changed line, now in Properties and only for the selection |
| Words | Folders, Folder, file, "Changed 2 hours ago by Agent One". Never repository, branch, commit, diff or merge request |
| Viewers | Chosen by the file's `extension` and `encoding`, as in the table above: code highlighted with line numbers, Markdown and other text documents rendered as a page |
| What a file shows | Its current text and the Properties above. No history, no diff |
| Read only | No write, delete or upload |
| Who sees Files | Only an agency that mounts the git module |

### Left open

| Question | Why it is open |
|---|---|
| Back to Folders on a wide empty Folder | The wide window draws the note "No description yet" and not the phone's empty card, since the top bar's back link already leads to the Folders list; whether it also wants the card is not decided |
| Reaching Chat and Notifications | How a member reaches Chat and Notifications from the wide Files window is not drawn |

## The viewer

Source: hub issue ISS-4, built in `code/app/src/files/viewer/`. Read only.

### Interface

| Part | Where | What it does |
|---|---|---|
| `FileViewer({ name, extension, text, size, bytes?, reason? })` | `FileViewer.tsx` | Shows one file. `text` null means the name, size and reason note |
| `viewerFor(name, extension?)` | `viewerFor.ts` | Returns `markdown`, `code`, `text`, `image` or `none` |
| `languageFor(name, extension?)` | `viewerFor.ts` | The language the code viewer colours with |
| `extensionTable`, `languageOf` | `extensions.ts` | The one table of extensions |

The groups in `extensionTable`:

| Group | Holds |
|---|---|
| code | Every extension in `languageOf`: go, mod, sum, ts, tsx, js, jsx, mjs, cjs, rb, json, yaml, yml, toml, sh, env, py, rs, java, kt, swift, c, h, cpp, css, html, xml, sql |
| markdown | md, markdown, mdx |
| text | txt, log, csv |
| image | png, jpg, jpeg, gif, webp, svg |
| names | `dockerfile` and `makefile`, matched on the whole file name |

An unknown or missing extension with text is plain text.

### What each viewer shows

| Viewer | Shows |
|---|---|
| Code | Numbered lines, one row per line with a sticky number. A long line scrolls sideways inside the block only, so it never moves the page. Monospace in the root-relative rem size, colours from the app tokens |
| Markdown page | Headings, lists, links, tables, quotes and fenced code, built as React elements by a hand-written parser. Raw HTML is never executed and shows as text. Only http, https and mailto links open, in a new window with `rel="noopener noreferrer"`. An image in Markdown shows its alt text only |
| Plain text | A `pre` |
| Image | The picture from `bytes` through a data URL in an `img`, with its name. An svg is never inlined |
| Withheld | The name, the size (`formatSize`: B, KB, MB, GB) and one sentence, never the bytes. "This file is too large to show.", "This file is not text, so it is not shown.", or "This image could not be shown." |

### Dependencies and limits

| Question | Answer |
|---|---|
| Added dependencies | None. An own single-pass tokenizer (`highlight.ts`: a keyword table per language, strings, comments including block comments, Go raw strings and Python triple quotes, numbers, function names) and an own Markdown parser (`MarkdownPage.tsx`) |
| Why not highlight.js or marked with DOMPurify | The app has none of them, and the owner wants it small with no executed HTML |
| Swapping later | Replace `CodeBlock` and `MarkdownPage` only |
| Code limits | A small highlighter, not a grammar: no nested template-string expressions, no regex literals, keywords by heuristic. A language outside the table shows as plain numbered lines |
| Markdown limits | No footnotes, task-list checkboxes, reference-style links, autolinks or HTML |

### Images

`forms_git_file_read` gives `encoding` (`base64` for a non-text file) and `content` (the bytes as base64), so the tool can return image bytes. Not verified against a live hub.

Source: hub issue ISS-9. The hub encodes a file as `base64` when it holds a null byte or is not valid UTF-8 and as `utf-8` otherwise (`code/wakala-api/modules/git/git_impl_blobcache.go`), so a png, jpg, gif or webp arrives as `base64` and an svg arrives as `utf-8` text. The data layer (`code/app/src/files/api.ts`) answers any of them under the 1 MiB limit with `status` `image` and `bytes`; `FilePage` and `WideContent` hand `bytes` and `extension` to `FileViewer`, which draws an `img` from a `data:` URL, so an svg with a script element shows as a picture and no script element reaches the page. An image over the limit stays withheld "too large", and a binary that is not an image stays withheld "not text". Not verified against a live hub.

### Tests

88 tests across 5 files in `code/app/src/files/viewer/` at the time of writing, run with `cd code/app && npx vitest run src/files/viewer`. They cover .md, .go, .json, .txt, .png with and without bytes, a binary file and a too-large file withheld, a long line, and a script tag in Markdown.

Not verified: a real browser render at phone width and the sideways scroll (jsdom has no layout).

## Built

### Screens

| Screen | What it is |
|---|---|
| Files on Home | One more option beside Start, Ongoing and Backlogs, drawn only when the agency mounts git (`HomeOptions.tsx`) |
| Folders list | One row per Folder with its name and when it last changed (`FoldersPage`) |
| A Folder's top level | Folders first, then files, then the README text under the list (`FolderPage`) |
| A folder inside a folder | The same screen at a path; Back reads the parent's name |
| The empty Folder | The empty card with Back to Folders |
| A file | The name in the bar, the Changed line, then the viewer from `files/viewer` chosen by extension (`FilePage`); an image shows as a picture |
| The wide window | Tree at the left, tab strip over the content in the middle, Properties panel at the right, an empty status bar along the bottom and no bottom bar (`WideFiles` with `FileTree`, `TabStrip`, `PropertiesPanel`, `WideContent`) |

### Data layer and tab state

Every screen reads through `FilesClient` in `files/api.ts` and nothing else. Open tabs live in the app only (`openTabs.ts`, held in `WideFiles` state) and are not saved on the server, so a reload starts again from the Folders list. There is no limit on open tabs (`openTabs.ts` keeps only the list and the active path).

### Decisions the spec does not pin

| Point | What was built |
|---|---|
| Back on a wide window | Reads Folders and leads to `/files`, which draws the Folders list on the phone and on the wide window, also for one Folder; the list's Back leads to Home |
| Tapping a folder in the tree | Expands or collapses it, by its name or its chevron, and opens no tab; the address `?path=` of a folder only expands it |
| Guide lines | Each row under an expanded folder carries a `wf-guide` element: a 1px `var(--line)` vertical line per level, drawn from the chevron's centre as in wide.html |
| Icons and sizes | Row, tree and tab icons carry the class `fi` and take the accent colour; a file's size is the row's last element, at the right end |
| Markdown page | The page is a `card`; inside the wide window the card is transparent so the content sits flat on the surface, as in wide.html 11 |
| Focusing a tab | Re-reads the file |

### Not verified

Not run against a live hub with the git module mounted; every check used a fake `FilesClient` (jsdom tests and one browser render).

Rendered in headless Chrome against a fake `FilesClient` from a throwaway Vite page outside the repo, and compared by eye with the matching drawing rendered the same way (files.html 3 and 6 on a phone frame, wide.html 9 to 12 at 1500 x 700). The six differences found in the first pass are gone: row icons are the accent brown, a file's size sits at the right end of its row, the tree and Properties panes are tinted with 1px lines between the panes and between the Properties lines, tabs carry a file icon and the active tab a 0.125rem accent line, the tree draws its guide lines, and a Markdown page is a card with bullets.

The drawings use the app's root font size of 90% (`tokens.css`, decision 169): `files.html` sets it on its root, and its phone frame is 27rem wide, about 390px, the width of a phone. Still differs from the drawings: a tab's close mark is the character x where the drawings draw a close icon; the phone card keeps the app's soft shadow where the drawings show a flatter one; the page text size is 1rem where the drawings use the content size token. Not checked: a long line scrolling sideways, an image, more than 8 tabs, narrow-to-wide resizing, dark mode.
