# Rules view in the web app: build plan

Hub issue ISS-246. This page is the plan for the code; the mockup, `mockups/app/backlogs/rules.html`, comes first and is being redrawn, so nothing here is built until the owner has accepted the mockup. Paths below are under `code/app/src` unless they start with another repo name.

## What the owner asked for

A Rules view on the screen of a Hub Steward SWE backlog, beside the issues, listing the rules that bear on that backlog with code, status and tags, and opening one rule with its linked issues and repo files. The mockup goes further than the issue text: the switch reads List | Board | Rules | Decisions | Questions (decisions 171 to 175), and the opened record carries Notes (ISS-271). This plan builds Rules, Decisions and Questions as three choices of one view; Notes are held back (see the risks).

## 1. Where the switch lives and how a choice is added

The List | Board switch is one component, `features/backlogs/board/ViewSwitch.tsx`. It holds `type View = "list" | "board"`, the two items, and `useView()`, which keeps the choice in the `view` search parameter (`list` is written, `board` is the default). It is built on `shared/ui/Segmented.tsx`, which already wraps onto a second line when the pane is narrow (`segmentedFits.test.ts` pins that), so five items fit a phone.

Three screens render it, and each reacts to a choice in its own way:

| Screen | File | What a choice does today |
| --- | --- | --- |
| All issues | `features/backlogs/issue/IssuesPage.tsx` (route `:backlogId`, id `all`) | `chooseView` flips the `view` parameter in place |
| A named backlog | `features/backlogs/issue/IssuesPage.tsx` and `features/backlogs/board/BacklogBoard.tsx` (route `:backlogId/board`) | List navigates to `issuesPath`, Board to `boardPath` |
| A smart backlog (the Sprint 1 screen of the issue) | `features/backlogs/smart/SmartBacklogPage.tsx` (route `:backlogId/smart`) | `chooseView` flips the `view` parameter in place |

The least change:

1. Widen `View` in `ViewSwitch.tsx` to `"list" | "board" | "rules" | "decisions" | "questions"` and add the three items. `ViewSwitch` takes a new optional prop `kinds` (default all three) so a viewer without the permission is given only List and Board (section 6).
2. Rules, Decisions and Questions are not drawn inside the issue screens. They are one new screen, `RulebookPage`, because the issue screens load issues, tint caps and count todos that this view does not need. Each of the three screens above passes an `onChange` that, for `rules`, `decisions` and `questions`, navigates to `rulebookPath(backlogId, kind)`; `list` and `board` behave as today. `useView()` keeps reading only `list` and `board`, so a stale `view=rules` falls back to the board.
3. `RulebookPage` renders the same `ViewSwitch` with its own kind current, so the choice is one tap from any of the five views. `BacklogBoard.tsx` already does this in reverse (`current="board"`, navigating away on a change).

Routes. The backlog routes are declared in one place, `features/backlogs/BacklogsRoutes.tsx`, as `<Route path="..." element={...}/>` rows inside `<NeedsRole>`; a feature folder that adds routes also exports a path constant and a builder (`page/paths.ts` has `backlogPageRoutePath` and `backlogPagePath`; `access/paths.ts` and `smart/paths.ts` follow it). Builders are written on `backlogsHomePath()` from `features/backlogs/shared/paths.ts`, which is `agencyBasePath(openAgencyId())/backlogs`. The groups feature uses the other idiom, `screen("/join")` from `app/screen.ts` in `features/groups/routePaths.ts`; the backlogs feature does not, so the new routes follow the backlogs idiom.

Two new rows, placed before `:backlogId` like the others:

| Pattern | Builder | Screen |
| --- | --- | --- |
| `:backlogId/rulebook` | `rulebookPath(backlogId, kind, statuses)` gives `/backlogs/<id>/rulebook?kind=rule&status=in_force&status=proposed` | the list of one kind |
| `rule/:ruleCode` | `rulePath(code)` gives `/backlogs/rule/R-2` | one rule, decision or question |

The name clash to avoid. In this app a backlog's "rules" already means the filter conditions of a smart backlog: the route `:backlogId/rules` is `EditSmartBacklogScreen`, the folder `features/backlogs/smart/` has `RulesScreen`, `RulesSheet`, `RulesHead`, `rulesDraft.ts`, and the taskmanager tool `taskmanager_backlog_rules_set` sets them. The records of this issue are rules in the other sense. So the new folder is `features/backlogs/rulebook/`, the route segment is `rulebook`, and the words on screen never say "rules" for a smart backlog's conditions. The tool `taskmanager_backlog_rules_list` lists rule records; `taskmanager_backlog_rules_set` and `taskmanager_backlog_rules_count` are the filter ones.

The `all` pseudo-backlog is not a backlog the taskmanager knows, so `GET /backlogs/all/rules` is refused with 400. For `all` the screen calls the instance-wide list instead (section 2).

## 2. How the app calls the hub, and the endpoints the view needs

Two patterns exist.

- `wakalaFetch` (`features/entry/api.ts`) is a plain REST call: it reads `runtimeConfig().wakala`, adds `renewedAuthHeaders()`, sends cookies, and the caller reports a 401 with `reportRefused()`. `features/polls/api.ts` is the template: a path builder `/instances/${openAgencyId()}/voting/polls...`, `wakalaFetch`, `res.json()`, a `text()`/`number()` mapper per field.
- `callTool(hubId, tool, args)` in `shared/wakala/mcp.ts` is the MCP call. It adds `instance_id` from `openAgencyId()`, reuses read results for 10 or 60 seconds (any tool name with `list`, `get`, `check`, `resolve` or `trail` counts as a read), clears them on a write, and throws `McpError`. Every screen under `features/backlogs/` uses this one, and so does `features/groups/api.ts`, which is the template named in the issue: `export const groupTools = {...}` of tool names, a client type, `mcpGroupsClient(hubId = "")`, mappers `groupOf(raw)`, and `itemsOf(reply)`.

The Rules view takes the MCP route, because the whole backlog feature does, because the pinned tool roster test (`features/backlogs/backlogToolNames.test.ts`) already guards it, and because the permission gate in the hub sits in front of both. The REST paths are the same operations under `/instances/{id}/taskmanager`, listed here so a reader can check each tool against the route table.

What the hub offers. `wakala-api/go.mod` pins taskmanager v0.4.0 (the working tree; the committed line still reads v0.2.0, see the risks). v0.3.0 brought every operation below except the overlap read; v0.4.0 added `applies_when`, the overlap read, and 409 for stale writes. The MCP roster `internal/api/http/testdata/mcp_roster/no-mounts.txt` lists all the tool names.

| What the screen does | REST (under `/instances/{id}/taskmanager`) | MCP tool | Arguments |
| --- | --- | --- | --- |
| Rules, decisions or questions that bear on one backlog | `GET /backlogs/{backlogID}/rules`, `/decisions`, `/questions` | `taskmanager_backlog_rules_list`, `taskmanager_backlog_decisions_list`, `taskmanager_backlog_questions_list` | `backlogID`; `status` repeated |
| The same for `all` (every backlog), with a tag choice | `GET /rules` | `taskmanager_rule_list` | `kind` (rule, decision, question); `status` repeated; `tag` repeated (a record must carry every tag given, case ignored) |
| Open one | `GET /rules/{ruleCode}` | `taskmanager_rule_read` | `ruleCode` such as `R-2`, `D-3`, `Q-1`; 404 when unknown |
| The issues that follow it | `GET /rules/{ruleCode}/issues` | `taskmanager_rule_issue_list` | `ruleCode` |
| The files that show it done right | `GET /rules/{ruleCode}/files` | `taskmanager_rule_file_list` | `ruleCode` |
| The rules a decision produced | `GET /rules/{ruleCode}/rules` | `taskmanager_rule_produced_list` | a decision code; 400 for any other kind |
| Rules that bear on one issue (a later link from the issue screen) | `GET /tasks/{taskID}/rules` | `taskmanager_rule_list_for_issue` | `taskID` |
| Pairs that may contradict (not in the first build) | `GET /rules/overlaps` | `taskmanager_rule_overlap_list` | none |

Which statuses each endpoint takes, and what it returns when none is sent:

| Kind | Statuses | Default with none sent | Chips on at first (decision 175) |
| --- | --- | --- | --- |
| rule | `proposed`, `in_force`, `superseded`, `retired` | in force and proposed | In force, Proposed |
| decision | `proposed`, `decided`, `superseded` | decided and proposed | Decided, Proposed |
| question | `open`, `answered`, `dropped` | open | Open |

A status that is not of the kind is refused with 400, so the screen only offers the chips of the kind it shows. An unknown backlog is 400; a backlog the viewer cannot see is 403. A backlog endpoint returns the records carrying at least one tag that an issue inside the backlog carries, case ignored. Questions come P1 first, then by code. `GET /rules` sorts by kind, priority, then number.

Fields of one record (`models/rule.go`, a `RuleRecord`; `read` adds `compatible`):

| Field | Meaning on screen |
| --- | --- |
| `id`, `code` | the code `R-2`, `D-3`, `Q-1` is the row's code and the route key |
| `kind` | rule, decision or question |
| `title` | the row sentence |
| `body` | the reason, shown as Why (`shared/ui/Markdown.tsx` renders it) |
| `status` | the status chip |
| `tags` | the tag chips |
| `applies_when` | a smart-backlog rule set; shown only as plain words, never edited here |
| `supersedes`, `superseded_by` | a code; a superseded row says "Superseded by R-1" |
| `decided_by`, `decided_at` | "Owner · 25 Nov 2026" on a decision |
| `priority` | questions only, P1 to P3 |
| `answered_by` | the decision code that answered a question |
| `created_at`, `updated_at` | not shown in the first build |
| `compatible` (read only) | codes of rules judged compatible |

Issue link (`RuleIssue`): `issue_id`, `issue_code`, `title`, `relation` (`applies_to`, `decided_in`, `broken_by`). Only issues the viewer can see are listed.

File link (`RuleFileLink`): `id`, `rule_id`, `repo`, `path`, `line` (0 is the whole file), `note`, `added_by`, `created_at`, and `missing: true` when the host's path check says the path is gone from main; with no check attached there is no flag, so the screen shows Not found only when `missing` is true.

The wire shape of a list over MCP is not pinned anywhere in this repo. The REST route returns a bare array (`routes/rule_routes_test.go`); every other list tool in the app is read through an `itemsOf` that accepts a bare array, `items` or `tasks` (`features/backlogs/shared/api.ts` and `access/api.ts` each hold one). The new client uses that `itemsOf` and a first red test pins what the hub's roster answers. The overlap read answers `{items, hidden_compatible}`.

Two things the mockup shows that no one operation returns:

- "Why: D-3 ..." on a rule is the decision it came from. A rule has no pointer to its decision. The reachable path is two reads: `rule_issue_list` for the issues with relation `decided_in`, then `rule_list_for_issue` on each, keeping the linked decisions. The first build does that for the issues of the rule only (a handful), and shows no Why row when none is found. If it proves heavy, the fix is a backend field, filed to taskmanager and not worked around further.
- "Settled in ISS-246" on a decision is the same `decided_in` issue list, read straight from `rule_issue_list`.

## 3. Shared parts to reuse, and what not to copy

Reuse, with the file each lives in:

| Need | Part |
| --- | --- |
| Screen frame, back link, bottom bar | `app/Shell.tsx` (`title`, `sub`, `onBack`, `backLabel`, `headEnd`) |
| Loading, failure, empty | `shared/ui/LoadState.tsx`: `LoadingLine`, `LoadFailed`, `EmptyCard`; data through `features/forms/useLoad.ts` keyed on the agency, backlog, kind and statuses |
| The switch | `ViewSwitch` (this plan, section 1) |
| Status chips that toggle | `shared/ui/Chip.tsx` with `onClick` and `pressed`; the same chip the filter bar uses (`features/backlogs/shared/FilterBar.tsx`) |
| Rows | `shared/ui/ListRow.tsx`: `Rows`, `ListRow` with `title`, `code`, `meta`, `status`, `end="›"`, `onClick`; a status word becomes a chip through `statusTone` |
| The Files > Folders look | `features/files/FolderList.tsx` is the model: one `Rows` list, a `start` mark, `end` chevron, no card around each row, `onClick` navigating. The wide window is checked at 1440 x 900 like `features/backlogs/board/wideWindow.test.tsx` and `features/files/wideWindow.test.tsx` |
| One record, Why and linked rows | `features/backlogs/references/ReferencesCard.tsx` is the nearest model: a card of rows, a repo path checked against main, a Not found chip, an issue row that opens the issue screen with `backState(...)` and `issuePath(id)` |
| A body of text | `shared/ui/Markdown.tsx` |
| A section heading | `shared/ui/SectionHeading.tsx`, `shared/ui/Section.tsx` |
| Back to the list | `shared/ui/backTo.ts` (`backState`) |
| The chat about this screen | `features/backlogs/shared/ChatAboutBacklog.tsx`, with `about={{ kind: "backlog", id, name }}` as the other backlog screens do |
| Agency id in keys and paths | `shared/wakala/openAgency.ts` |

Do not copy:

- `IssueCard`, `IssuePills`, `CapTintScope`, `TodoCountScope`, `SelectableIssueRow`, `SendToBacklog` and the selection controls. They belong to issues; a rule row is a `ListRow`.
- `FilterBar` as it stands: its search box is labelled "Search issues" and its tags are issue tags. The Rules view needs only the status chips and, later, a search; it takes a small new `StatusChips` component rather than a parameter on `FilterBar`.
- The smart-backlog vocabulary and files (`RulesHead`, `RulesScreen`, `ruleWords`, `matchWords`, `rulesSheetTitle`): they are about filter conditions.
- The mockup's own CSS. Styles go in one new `rulebook.css` that uses the existing tokens (`app/tokens.css`) and the stylesheet rules of the user's CLAUDE.md: the base size is the one on the root, every font size in `rem`, no pixel font sizes, `font: inherit` on buttons.
- Any copy of a repo file's text. A rule holds a link only (decision 173): the row shows repo, path and `main`, and a Not found chip when `missing` is true.
- A parallel list of files for the Good example: it goes through the Files feature's path builders (`features/files/paths.ts`: `filePath(folderId, path)`), reached through `features/files/index.ts`, never a deep import (the public-surface guard in `layoutRules.test.ts` lists `backlogs`, `files` and `market`). The Files screen addresses a folder by id, and the rule file link holds a repo name, so the folder id is found from the list that `features/files/api.ts` returns (`Folder.name`); when no folder has that name the row has no chevron and no link.

## 4. Words

Two homes exist, and the backlog screens use the second:

- `shared/language/words.ts` is the translated table; `swahili.ts` and `magyar.ts` must carry the same keys with the same `{placeholders}` (`shared/language/placeholders.test.ts` fails on a missing key or a changed placeholder). The sentence a viewer reads in the chrome of the app goes here.
- A feature-local `words.ts` in plain English (`features/backlogs/cards/words.ts`, `features/backlogs/smart/words.ts`, `features/backlogs/shared/access.ts`) holds the sentences of the backlog screens, as `noRoleWords` does. Every backlog screen today is written this way, so `features/backlogs/rulebook/words.ts` follows it and no translation is touched in this change.

The words the screen needs (English, the owner may change any of them when the mockup is accepted):

| Name | Words |
| --- | --- |
| `viewItems` | Rules, Decisions, Questions (beside List and Board) |
| `kindTitle` | Rule, Decision, Question |
| `kindsCount` | `{n} rules`, `{n} decisions`, `{n} questions`, with the one form for 1 |
| `statusWords` | In force, Proposed, Superseded, Retired; Decided; Open, Answered, Dropped |
| `supersededBy` | Superseded by {code} |
| `retiredNoReplacement` | Retired |
| `emptyRules` / `emptyDecisions` / `emptyQuestions` | No rules bear on this backlog yet. / No decisions bear on this backlog yet. / No questions bear on this backlog yet. |
| `noMatch` | Nothing at this status |
| `whyHeading` | Why / Why it is asked |
| `ruleDecidedBy` | Decided by {name}, {date} |
| `goodExample` | Good example |
| `fileMissing` | Not found on main |
| `issuesHeading` | Issues that follow it |
| `producedHeading` | Rules it produced |
| `settledIn` | Settled in |
| `answeredBy` | Answered by |
| `notAnswered` | Not answered yet |
| `replaces` | Replaces {code}. / Replaces nothing. |
| `replacedBy` | Replaced by {code}. / Replaced by nothing. |
| `noAccessWords` | You do not have access to the rules yet. Ask the Product owner. (the same shape as `noRoleWords`) |
| `loadFailedWords` | The rules could not be loaded. / This could not be opened. |

The date uses `dayWithYearWords` in `shared/ui/days.ts`; no new date code. A word with a count or name is a function, as `issuesWords` is, not a placeholder string.

## 5. Tests and the todo list

The pattern the repo asks for, taken from the nearest feature (`features/backlogs/page/`):

- An API test per client with `vi.spyOn(mcp, "callTool")` answering by tool name (`page/pageClient.test.ts`): what is asked, what is mapped, what a refusal does.
- A component test per screen rendered in `MemoryRouter` with the client passed as a prop (`page/backlogPage.test.tsx`, `list/backlogs.test.tsx`); wide-window tests where the mockup has a wide screen (`board/wideWindow.test.tsx`).
- A tool-name test: every tool name in the new folder is in the pinned roster and declared by the pinned taskmanager module. `features/backlogs/backlogToolNames.test.ts` already walks the whole of `features/backlogs` for names whose first segment is `taskmanager`, so the new folder is covered the moment it exists; `list/backlogs.test.tsx` ("calls only tools the task module declares") reads `taskmanager.operations.json` through `shared/testing/taskmanagerModule.ts` and does the same for `taskTools`. The new tools get the second test in their own file.
- A gating test: the permission test of section 6.
- The words test for the feature-local words (no blank word, no word padded with spaces), in the style of `shared/language/placeholders.test.ts`.
- `layoutRules.test.ts` keeps the folder inside the public surface of `backlogs`.

Each step below is small enough for one agent in one sitting. A "red" step is a test written first that fails; the build step after it makes it green. Every step ends with `npm run typecheck` clean and its own test file green; one full `npm test` run happens once, at the end (the repo's own rule: one suite per merge batch). No step writes a comment in the code.

| No. | Step | Output | Where |
| --- | --- | --- | --- |
| 0 | The owner accepts the redrawn mockup, including whether the switch carries Rules, Decisions and Questions or only Rules, and whether Notes are in this build | A decision recorded on ISS-246; nothing below starts before it | the issue |
| 1 | Red: the status choices of each kind | `statuses.test.ts` fails: rule offers four, decision three, question three; the first-on set is In force and Proposed, Decided and Proposed, Open | `features/backlogs/rulebook/statuses.test.ts` |
| 2 | Build: the statuses | `statuses.ts` with `kindStatuses`, `firstOn` | `features/backlogs/rulebook/statuses.ts` |
| 3 | Red: the record mapper | `api.test.ts` fails: a raw record maps to `Rule` with code, title, body, status, tags, `supersededBy`, `decidedBy`, `decidedAt`, priority, `answeredBy`; missing fields become empty text, never `undefined` | `features/backlogs/rulebook/api.test.ts` |
| 4 | Build: types and mappers | `types.ts` (`Rule`, `RuleIssue`, `RuleFile`, `RuleKind`, `RulebookClient`) and `ruleOf`, `issueOf`, `fileOf` | `features/backlogs/rulebook/types.ts`, `api.ts` |
| 5 | Red: the backlog list call | the test fails until `list` calls `taskmanager_backlog_rules_list`, `_decisions_list` or `_questions_list` by kind with `backlogID` and the repeated `status` | `api.test.ts` |
| 6 | Red: the `all` call | the test fails until `list("all", ...)` calls `taskmanager_rule_list` with `kind`, `status`, and never a backlog id | `api.test.ts` |
| 7 | Build: the list client | `rulebookTools` (names), `mcpRulebookClient.list`, `itemsOf` reuse from `shared/api` | `api.ts` |
| 8 | Red: read one, its issues and its files | the test fails until `read`, `issues` and `files` call `taskmanager_rule_read`, `_rule_issue_list`, `_rule_file_list` with `ruleCode`; `missing` is true only when the wire says true | `api.test.ts` |
| 9 | Build: the record clients | `mcpRulebookClient.read`, `.issues`, `.files`, `.produced` | `api.ts` |
| 10 | Red: the Why and Settled-in reads | the test fails until `decisionOf(code)` returns the decided-in issue codes, and `whyOf(code)` returns the linked decision found through those issues, or nothing | `api.test.ts` |
| 11 | Build: the Why read | `whyOf`, `settledIn` in the client | `api.ts` |
| 12 | Red: the tool names are real | the test fails until every `rulebookTools` name is declared in `taskmanager.operations.json` of the pinned module | `features/backlogs/rulebook/tools.test.ts` |
| 13 | Red: the permission pre-check | `mayReadRules` is true for a reply listing `rule.read`, true for a reply with no `permissions` array (as `mayReadIn` is), false for a list without it | `features/backlogs/rulebook/access.test.ts` |
| 14 | Build: the pre-check | `access.ts` with `readRulesPermission = "rule.read"`, `mayReadRulesIn(reply)`, `askMayReadRules` over `callTool("", backlogTools.myRoles)` | `features/backlogs/rulebook/access.ts` |
| 15 | Red: the words | `words.test.ts` fails on a blank or padded word and on a count with no plural form | `features/backlogs/rulebook/words.test.ts` |
| 16 | Build: the words | `words.ts` with the table of section 4 | `features/backlogs/rulebook/words.ts` |
| 17 | Red: the switch grows | `viewSwitch.test.tsx` fails: five items by default; with `kinds={[]}` two; `useView()` still answers only list or board for `view=rules` | `features/backlogs/board/viewSwitch.test.tsx` |
| 18 | Build: the switch | `View`, the items and the `kinds` prop in `ViewSwitch.tsx`; `board/index.ts` unchanged in its exports | `features/backlogs/board/ViewSwitch.tsx` |
| 19 | Red: the paths | `paths.test.ts` fails: `rulebookPath("b1","rule",["in_force"])` and `rulePath("R-2")` build the routes of section 1 on the agency base | `features/backlogs/rulebook/paths.test.ts` |
| 20 | Build: the paths | `paths.ts` with `rulebookRoutePath`, `ruleRoutePath`, `rulebookPath`, `rulePath` | `features/backlogs/rulebook/paths.ts` |
| 21 | Red: the status chips | `statusChips.test.tsx` fails: chips of the kind, the first-on set pressed, a tap flips one, none pressed gives the empty line | `features/backlogs/rulebook/statusChips.test.tsx` |
| 22 | Build: the chips | `StatusChips.tsx` on `shared/ui/Chip.tsx` | `features/backlogs/rulebook/StatusChips.tsx` |
| 23 | Red: the list screen, phone | `rulebookPage.test.tsx` fails: the switch with the kind pressed; the count; a row with code, title, status, tag and a chevron; a superseded row says Superseded by R-1; a retired row says Retired; loading, failed, empty; a tap opens `rulePath` | `features/backlogs/rulebook/rulebookPage.test.tsx` |
| 24 | Build: the row | `RuleRow.tsx` on `ListRow` | `features/backlogs/rulebook/RuleRow.tsx` |
| 25 | Build: the list screen | `RulebookPage.tsx` with Shell, `ChatAboutBacklog`, `ViewSwitch`, `StatusChips`, `Rows`, `useLoad` keyed on agency, backlog, kind, statuses | `features/backlogs/rulebook/RulebookPage.tsx` |
| 26 | Red: the record screen, phone | `recordPage.test.tsx` fails for a rule (Status, Tags, Why, Good example with a Not found chip when missing, Issues that follow it), for a decision (decided by and when, Rules it produced, Settled in) and for a question (priority, Answered by or Not answered yet); the back link returns to the kind it came from | `features/backlogs/rulebook/recordPage.test.tsx` |
| 27 | Build: the parts of a record | `RecordFiles.tsx` (the Good example rows, modelled on `ReferencesCard`), `RecordIssues.tsx` (issue rows to `issuePath` with `backState`) | `features/backlogs/rulebook/RecordFiles.tsx`, `RecordIssues.tsx` |
| 28 | Build: the record screen | `RecordPage.tsx`, kind-aware, on Shell with `onBack` to `rulebookPath` | `features/backlogs/rulebook/RecordPage.tsx` |
| 29 | Red: the wide window | `rulebookWide.test.tsx` fails at 1440 x 900: list rows show the status and tag beside the title; a record has what and why on the left, issues and files on the right | `features/backlogs/rulebook/rulebookWide.test.tsx` |
| 30 | Build: the style | `rulebook.css`, base size from the root, `rem` only, `font: inherit` on buttons | `features/backlogs/rulebook/rulebook.css` |
| 31 | Red: the gate | `rulebookGate.test.tsx` fails: with `rule.read` the three choices are on the three switches; without it only List and Board, and a typed rulebook URL shows `noAccessWords` and makes no list call; an owner (every code) sees all; a failed list with the permission shows `LoadFailed`, not the no-access card | `features/backlogs/rulebook/rulebookGate.test.tsx` |
| 32 | Build: the gate | `NeedsRulePermission.tsx` (the shape of `shared/NeedsRole.tsx`) and the `kinds` prop passed from each switch caller | `features/backlogs/rulebook/NeedsRulePermission.tsx` |
| 33 | Red: the three callers | tests fail: on All issues, a named backlog and a smart backlog, choosing Rules navigates to the rulebook path of that backlog (`all` for All issues); List and Board behave as before | `features/backlogs/issue/`, `board/`, `smart/` test files, one case each |
| 34 | Build: wire the three callers | `onChange` branches in `IssuesPage.tsx`, `BacklogBoard.tsx`, `SmartBacklogPage.tsx` | those three files |
| 35 | Build: the routes | the two rows in `BacklogsRoutes.tsx`, before `:backlogId`; `rulebook/index.ts` exports the paths and the page; `backlogs/index.ts` re-exports only what another feature needs | `features/backlogs/BacklogsRoutes.tsx`, `rulebook/index.ts` |
| 36 | Red: the route table | `BacklogsRoutes` renders the rulebook for `/backlogs/b1/rulebook?kind=decision`, and a record for `/backlogs/rule/D-3`, and `:backlogId/rules` is still the smart editor | `features/backlogs/rulebook/rulebookRoutes.test.tsx` |
| 37 | The whole check, once | `npm run typecheck` and one `npm test` green, including `layoutRules.test.ts`, `backlogToolNames.test.ts` and the placeholder tests | `code/app` |
| 38 | Design files in step | the design page and mockup match what was built; `mockups/app/backlogs/rules.html` marked with the built path; the story board of the backlogs gets one row | `documentation/2. design/`, the mockup |
| 39 | One walk | a walk on the live app: open Sprint 1, pick Rules, open R-2, follow an issue and a file; the result in `documentation/4. qa/walk-records/` and a last-run note (the walk is run once, after the last component merges) | `documentation/4. qa/walk-records/` |

Not in the first build, each its own issue when the owner asks: the overlap read screen, adding or changing a rule or decision, answering a question, linking an issue, and the Notes of the mockup.

## 6. Access

Three layers decide what a viewer sees, outer to inner.

1. The app gate. The whole Backlogs area is behind `features/backlogs/shared/NeedsRole.tsx`, which asks `agency_get_my_roles` for the viewer's permission codes and requires `task.read` (`shared/access.ts`: `readPermission`, `mayReadIn`, `noRoleWords`). The owner holds every code; a reply with no `permissions` array counts as allowed. The Rules view adds a second, narrower ask of the same reply: `rule.read` (step 14). It is one catalogue permission, "Read rules, decisions and questions", module `taskmanager`, in `mwanachama-backend-agency/models/permissions_catalog.json`, and it carries exactly the ten read actions the screen calls: `taskmanager.rule.read`, `list`, `issue_list`, `list_for_issue`, `file_list`, `produced_list`, `overlap_list`, and `taskmanager.backlog.rules_list`, `decisions_list`, `questions_list`. Writing is `rule.edit` and is not needed by this build.
2. The hub's permission check. `internal/api/http/group_role_access.go` refuses a tool whose action the viewer's roles do not carry, owner and operator excepted. One exception matters here: a resident or agent whose assumed group holds backlog access reaches every action of `backlogReadActions`, which includes the ten rule reads, without holding `rule.read` (`taskPermissioned`, tested in `backlog_access_rules_test.go`). So the permission list alone can say "no" to someone the hub would let in.
3. The module check. `requireRuleAccess` in `mwanachama-backend-taskmanager/rule_access.go`: reading a rule needs Can see on at least one backlog. A backlog endpoint needs Can see on that backlog, else 403. The rule list itself is not split by backlog: anyone with Can see anywhere reads every rule, and a backlog endpoint only narrows it by tag. The issues of a rule hide the ones the viewer cannot see. Questions asked on a Can see group are read; writes are 403.

What the viewer sees:

| Viewer | Switch | Typed rulebook address |
| --- | --- | --- |
| Owner, or a role with `rule.read` | List, Board, Rules, Decisions, Questions | the list and the records |
| No `rule.read`, a role that can read the backlogs | List and Board only; no dead choice | one card with `noAccessWords`, no list call made |
| No `task.read` | the Backlogs area shows the existing `noRoleWords` card | the same |
| Has `rule.read` but Can see on no backlog | the choices show | the list call is refused by the module; the screen says it could not be loaded, with the Try again button |
| Has Can see on the backlog but a record's issue is in a backlog they cannot see | the record opens | that issue is absent from its list |

Decision for the gate: the app decides with the permission list (cheap, one read already held for the Backlogs gate) and does not parse a refusal's text. A refusal after a "yes" is a load failure with Try again. The case of an assumed group that reaches the tools without the permission is shown in the open questions; the safe default is that the view stays hidden for them until `rule.read` is given.

## 7. Risks and open questions

- The mockup is being redrawn and goes past the issue text: five switch choices, a Why row, Settled in, and Notes with kinds Contradiction, Compatible and Question, a Resolve button, and a Rule judge. Step 0 settles the count of choices before code starts.
- Notes have no backend. taskmanager v0.4.0 has no operation to write or list notes on a rule, and no resolve; the only judgement stored is the Compatible pair (`rule_compatible_add` and `_remove`, which are REST routes `POST` and `DELETE /rules/{ruleCode}/compatible/{otherCode}` and are not in the MCP roster). Notes need a taskmanager release first; this plan builds the view without them.
- "Rules" means two things in this app (smart backlog conditions and rule records). A copy of a smart-backlog word or route onto the new screen would send the viewer to the wrong editor; the folder, route segment and words are chosen apart for that reason, and step 36 pins that `:backlogId/rules` is still the smart editor.
- The sibling pin is not committed. `code/wakala-api/go.mod` in the working tree reads taskmanager v0.4.0 and agency v0.4.4, but the committed line reads v0.2.0 and `testdata/mcp_roster/no-mounts.txt` is also modified. Until that change is committed and pushed to every clone, a clone has no rule tools and the new screen fails with unknown tool. Check `origin/main..HEAD` for `code/wakala-api` before relying on it, and do not start step 5 on a tree that does not list `taskmanager_backlog_rules_list` in the roster.
- The wire shape of the list tools over MCP is assumed (bare array or `items`). Step 5 pins it against what the hub answers; a mismatch is fixed in `itemsOf`, not in the screens.
- The Why row costs one read per issue of the rule. A rule linked to many issues makes the record slow; the cap is the issues the rule has, and a backend field is the fix if it hurts.
- A rule's file link holds a repo name; the Files feature opens a folder by id. If a repo has no Files folder of that name, the Good example row has no link. The `missing` flag is absent when the host has no path check attached, so "Not found" is never shown on a guess.
- The assumed-group bypass (section 6, layer 2) means a viewer may read rules without `rule.read`; the app hides the choices from them. Open question for the owner: show the choices to anyone the hub lets through, or keep them behind the permission. The default here is the permission.
- Scope. The issue limits the view to the Hub Steward SWE backlogs. The switch is shared code, so every backlog that shows List | Board would show the choices once built. Either the choices are limited to that agency by the same permission (the other agencies' roles do not carry `rule.read` until given it), or a flag per agency is added. The permission is the plan; the owner confirms.
- Five items on a phone: `Segmented` wraps to a second line by design; the mockup shows them on one. The redrawn mockup decides whether wrapping is accepted.
- The `all` view returns every rule to anyone with Can see on any backlog, not only the rules of backlogs they can see (the module does not split rules by backlog). That is the module's rule, not the app's; this is noted so the screen is not described as private.
- Test cost. Steps 23 to 33 each render a screen; keep fixtures in one `rulebookFixture.tsx` as `features/files/filesFixture.tsx` does, and run the full suite once.

## What was built (first build)

Steps 17 to 36 are built; step 37 is the full check at the end, steps 38 and 39 (design files, one walk) follow. Everything is under `code/app/src/features/backlogs/`. Notes are not in this build, so no Notes row is drawn.

| Part | Files |
| --- | --- |
| Switch and callers | `board/ViewSwitch.tsx` takes `mayReadRules`; `issue/IssuesPage.tsx`, `board/BacklogBoard.tsx` and `smart/SmartBacklogPage.tsx` pass the real answer from `rulebook/useMayReadRules.ts` and, on Rules, Decisions or Questions, navigate to `rulebookPath` through `rulebook/viewChoice.ts` (`useOpenRulebook`). List and Board go where they went. |
| Status choices | `rulebook/statuses.ts` (`chipOrder`: the chips that start on first, then the rest), `rulebook/StatusChips.tsx`, `rulebook/ruleStatus.ts` (label, tone, priority tone) |
| List screen | `rulebook/RulebookPage.tsx` with `RulesTable.tsx` and `RuleMarks.tsx`; the statuses live in local state, started from the `status` parameters of the address that belong to the kind, else `firstOn` |
| Record screen | `rulebook/RecordPage.tsx`, `RecordReferences.tsx`, `LinkedCard.tsx`, `CodeRow.tsx`; `mcpRulebookClient.open` now also returns `answer`, the decision that answered a question |
| Routes | `BacklogsRoutes.tsx` mounts `RulebookPage` on `:backlogId/rulebook` and `RecordPage` on `rule/:ruleCode`; `RulebookPlaceholder` is gone; `rulebook/rulebookRoutes.test.tsx` replaces the placeholder test and pins that `:backlogId/rules` is still the smart editor |
| Style | `rulebook/rulebook.css`: rem only, no base size, one `min-width: 48rem` block; the wide record reuses `issue/issueWide.css` (`issue-wide`, `issue-main`, `issue-side`) |

Where the build differs from the mockup:

- The list is one table, not a card per rule (owner feedback on the live wide view): a header row Code, Title, Status, Tags, one row per rule with a hairline between rows and no margins, the chevron at the row end, and the whole row tappable. The table takes the shared look of `app/home/homeWindow.css` (`home-rec`, imported by `RulesTable.tsx`); `rulebook.css` adds only the phone stacking and the wide reset. The title is a real link named by code and title, so a row has a role and a name and opens in a new tab; a click anywhere else on the row navigates too. The status chip and the tag chips are the shared `Chip` and `TextChip` inside the shared `issue-tags` strip. On a phone the header is hidden and each row stacks Status and Tags under the Title. A question's priority chip sits in its Status cell. The mockup `rules.html` still draws rows with a chevron and chips under the title: the Book agent's lane changes it to the table.
- The chosen statuses are written into the address (`rulebookPath` with `status` parameters, replacing the entry), so Back from a record keeps a Superseded or Retired choice. Turning every chip off asks nothing and shows Nothing at this status; that empty choice is not written to the address.
- A decision's Decided row reads Decided by the name and, when there is one, the date: `decided_at`, else `created_at`, else no date (the live hub gives `decided_by` alone).
- The search box is built (owner request after the first draft): the shared `SearchBox` inside the shared `FilterBar`, which takes a new optional `label` (default Search issues) so the list reads Search rules, Search decisions or Search questions, with the count beside it. Every typed word must appear in the code, title, body or tags of a loaded record, ignoring case (`rulebook/search.ts`); it narrows within the chosen status chips and asks the hub nothing. The text is kept in the `q` parameter of the address next to the statuses, so Back from a record returns to it; a switch to another view starts without it. A search that fits nothing says Nothing matches the search. The words are feature-local in `rulebook/words.ts`; the rulebook words are not registered in `shared/language`, so no Swahili or Hungarian entry exists to add.
- The record screen is the issue screen's two columns: Details (Status, Decided, Priority, Tags) and Why on the left; References, Rules it produced and Settled in on the right. Why holds the body, and for a rule the decision it came from as a chevron row. References is one closed single-line card holding the file links and the linked issues (for a decision, without the issues it was decided in, which have their own Settled in card). The mockup's separate Good example and Issues that follow it headings are one References card. A file opens in Files only when a folder carries the repo's name; a missing file shows Not found on main and has no chevron.
- A question's Answered by card shows the answering decision's code and title; when that decision cannot be read it shows the code alone.
- The back link returns to the list it came from (the list passes `backState`), else to the rulebook of All issues for the kind of the record.
- The access gate is `guardedRulebook` plus `useMayReadRules`, not a `NeedsRulePermission` component: a viewer without `rule.read` gets one no-access card on a typed address and no list call. `mayReadRulesIn` fails closed (an undefined, empty, null, string or error reply means no), unlike `mayReadIn` of the Backlogs gate, by the owner's decision.
- The client refuses a status that does not belong to the kind before any hub call; the failed answer carries no message and the screens show the words of `rulebook/words.ts`; only a 403 or the word forbidden is forbidden, and an unknown backlog is missing.
- Smart backlogs: Rules, Decisions and Questions on a smart backlog ask `taskmanager_backlog_rules_list` with the smart backlog's id; whether the hub answers for that id is not checked here and belongs to the walk.

## Notes (second build)

Status: blocked until the hub runs taskmanager v0.5.0 and agency with note actions.

Hub issue ISS-246, with ISS-271 for the notes. Mockup: `mockups/app/backlogs/rules.html`, section 12 (The Notes of a rule), accepted by the owner. This section plans the Notes row on an opened record, the Notes list inside it, the Resolve form and the Related picker, and the small marker on the issue screen. Sections 1 to 7 above stay as the first build. Paths are under `code/app/src` unless they start with another repo name. Nothing here is built, and no step starts until the block above is lifted.

### N1. What the hub offers

The backend is the working tree of the notes version, `mwanachama-backend-taskmanager/.claude/worktrees/agent-ac267a63df4ea04c9`, one commit past v0.4.0 (`814de4e`, with `models/rule_note.go` and three operations in `taskmanager.operations.json`). It is not tagged yet; the plan assumes the tag will be v0.5.0, and todo step N1 checks that.

| What the screen does | REST (under `/instances/{id}/taskmanager`) | MCP tool | Arguments |
| --- | --- | --- | --- |
| Add a note to a rule, decision or question | `POST /rules/{ruleCode}/notes`, 201 | `taskmanager_rule_note_add` | `ruleCode`; `text` (required); `kind` (note, contradiction, compatible, question; note when left out); `source` (person, worker, judge; person when left out); `related_codes` (at most 20); `links` |
| List notes | `GET /rules/notes` and `GET /rules/{ruleCode}/notes` | `taskmanager_rule_note_list` (the per-record route is `"tool": false`, so the tool is the first route with `rule`) | `rule` (a code; 404 when unknown), `kind` (repeat for several), `state` (open or resolved), `related` (a code), `since` (RFC 3339, strictly newer), `limit` (1 to 200, default 200, keeps the newest) |
| Resolve an open contradiction | `PUT /rules/notes/{noteID}/resolve` | `taskmanager_rule_note_resolve` | `noteID`; `resolution` (words, at most 4000); `resolved_by_code` (a rule or decision code) |

Also changed: `taskmanager_rule_read` now carries `notes` (the latest 50, oldest first) and `note_count`. The first screen load of the Notes row can use them and skip a list call; the list tool reads the rest.

A note (`RuleNote`): `id`, `rule_id`, `rule_code`, `kind`, `source`, `state` (only a contradiction has one: open or resolved), `text`, `related_codes`, `links`, `author_id`, `created_at`, and for a resolved contradiction `resolved_at`, `resolved_by`, `resolution`, `resolved_by_code`. Nothing in a note ever changes except that one resolve.

Error cases the client must tell apart:

| Call | Status | Meaning | What the screen says |
| --- | --- | --- | --- |
| add | 400 | unknown kind or source, blank text, text over 4000 characters, more than 20 related codes, or the record's own code among them | the text stays in the field; the field's own limit line |
| add | 404 | the rule, or a related code, does not exist; nothing saved | "That record is no longer there." |
| add | 403 | the viewer lacks Can see | the failure line of the Log |
| resolve | 400 | the note is not a contradiction, or `resolved_by_code` is a question | "Only an open contradiction can be resolved." |
| resolve | 404 | unknown note or unknown settling code | "That is no longer there." |
| resolve | 409 | already resolved (somebody was first) | "Already resolved." and the list reloads |
| resolve | 403 | the viewer lacks Can move | "You need Can move on a backlog to resolve this." |
| list | 400 / 404 | bad kind, state, since or limit / unknown `rule` | the load failure line |

Not in the notes version, so not planned: edit or delete of a note, a count of open contradictions per rule, and a batch read of notes for several rules. The issue marker (N8) is built on the one read that exists.

### N2. What the issue Log gives, and what is reused

`features/backlogs/issue/IssueLog.tsx` is a collapsible `Card` titled Log, closed at first, with `flush`. It loads with `useLoad(() => client.notes(issueId), key)` where the key holds the agency, the issue and a `version` counter; Add bumps the counter to reload. Each entry shows the author's name (`listPeople` and `listAgents` give a `Names` map; an unknown id is not shown as an id), a Person or Worker chip, `noteTime` (`22 Nov, 09:10`), the text split into paragraphs, and its links (`linkOf` makes a link of a trailing `http` word). The footer carries one button, Add a note, which opens a `TextArea`, with Cancel and Add. A failure shows "The note could not be added." and keeps the text. An empty Log says "Nothing logged yet." The client is `NotesClient` in `shared/api.ts` (`mcpNotesClient`, tools `taskmanager_task_note_list` and `_add`, answers mapped by `noteOf` in `shared/issueNotes.ts`).

Reuse, not copy (rule: always use shared components):

| Part | Reuse as is | New |
| --- | --- | --- |
| `Card` collapsible, `flush`, footer; `Button`; `TextArea`; `Chip` | yes | |
| `loadNames` (people and agents into `Names`) and `noNames` | extract from `IssueLog.tsx` into `features/backlogs/shared/noteNames.ts`, imported by both | the extraction is its own step |
| `Links` (the link list of an entry) and `Entry`'s by-line | extract `NoteLinks` and `NoteByline` into `features/backlogs/shared/NoteParts.tsx`, imported by both | the extraction is its own step |
| `linkOf`, `noteTime` | import from `shared/issueNotes.ts` | |
| `issueLog.css` (`log-entry`, `log-by`, `log-links`, `log-none`, `log-add`) | import the same classes; the notes screen adds only `note-state` and the Resolve form | |
| `useLoad`, the `version` counter, the failure line, the empty line | the same pattern | |
| `NotesClient` and `noteOf` | no: a rule's note has a `kind` of four values, a `source`, a `state` and codes, which `IssueNote` has no place for | `RuleNote`, `RuleNotesClient`, `ruleNoteOf` in `features/backlogs/rulebook/notes/` |

The `kind` field is the one name that means two things: an issue note's `kind` is person or worker; a rule note's `kind` is note, contradiction, compatible or question, and the person or worker idea is `source` (plus judge). The mapper keeps them apart, and the Worker and Judge chips read `source`.

### N3. The client: typed answers

New folder `features/backlogs/rulebook/notes/`. Types (`types.ts`):

- `NoteKind = "note" | "contradiction" | "compatible" | "question"`; `NoteSource = "person" | "worker" | "judge"`; `NoteState = "open" | "resolved"`.
- `RuleNote = { id; ruleCode; kind; source; state?: NoteState; text; related: string[]; links: string[]; author; at; resolvedAt; resolvedBy; resolution; resolvedByCode }`. `ruleNoteOf(raw)` maps the wire; an unknown kind reads as `note`, an unknown source as `person`, a missing `related_codes` as an empty list (the same care as `noteOf`).
- `NewNote = { text: string; kind: NoteKind; related: string[]; links?: string[] }`.

Answers reuse the rulebook `Answer<T>` (ready, missing, forbidden, no_access, failed) and add the two states these calls need that the first build did not:

- `AddAnswer = Answer<RuleNote> | { state: "invalid"; message: string }` for a 400.
- `ResolveAnswer = Answer<RuleNote> | { state: "invalid"; message: string } | { state: "already_resolved" }` for a 400 and a 409.

`failureOf` in `rulebook/answers.ts` today reads forbidden and not-found words only; the notes client wraps it with a `noteFailureOf` that also reads 400 and 409 (by the same text match on the refusal, as `forbiddenText` does), and the existing union is not widened, so no switch in the first build changes.

`RuleNotesClient` (`types.ts`), `mcpRuleNotesClient(hubId = "")` (`api.ts`), tools in `tools.ts` as `ruleNoteTools`:

| Method | Calls | Answer |
| --- | --- | --- |
| `list(code, options?)` | `taskmanager_rule_note_list` with `{ rule: code }`, plus `kind` (a list) and `state` when given; `itemsOf` as everywhere | `Answer<RuleNote[]>`, oldest first as the hub sends them |
| `add(code, note)` | `taskmanager_rule_note_add` with `{ ruleCode: code, text, kind, source: "person", related_codes, links }`; trims the text | `AddAnswer` |
| `resolve(noteId, resolution, settledBy)` | `taskmanager_rule_note_resolve` with `{ noteID, resolution, resolved_by_code }` | `ResolveAnswer` |
| `openContradictions()` | `taskmanager_rule_note_list` with `{ kind: ["contradiction"], state: "open" }`, no `rule` | `Answer<RuleNote[]>` (used by the issue marker, N8) |

`guardedRuleNotes(client, ask)` wraps all four in the existing `rule.read` pre-check (the shape of `guardedRulebook`), so a viewer without it gets `no_access` and no call is made. `callTool` keeps read results for ten or sixty seconds and clears them when a write goes through, so Add and Resolve show on the next read without a manual refresh, and the issue marker and the Notes list share one cached read.

### N4. The Notes row and the Notes list screen

Where: the opened record of `RecordPage.tsx` (steps 26 to 28 above) already has a Notes row (`Notes ⌄`) in the mockup. This build gives it its body. It is a collapsible `Card` titled Notes, `flush`, closed at first, exactly like the Log; the route `rule/:ruleCode?notes=open` opens it (used by the issue marker, N8). The Notes list is the card's content; there is no separate route, as the issue Log has none, and a wide window shows it in the right column under the issues and files.

`features/backlogs/rulebook/notes/RuleNotes.tsx` takes `{ code, client, mayAdd, mayMove }` and loads with `useLoad` keyed `rule-notes:{agency}:{code}:{version}`. States: loading (the card's loading line), failed ("The notes could not be loaded."), empty ("Nothing noted yet."), list. List entries oldest first, newest last. Each entry (`NoteEntry.tsx`):

- by-line: the author's name, a kind chip, for a contradiction a state chip, a Judge chip when `source` is judge or a Worker chip when it is worker (a Person source shows none: the by-line already says who), and the time.
- text in paragraphs; links through `NoteLinks`.
- related codes as tappable pills under the text, each opening `rulePath(code)`; a resolved contradiction shows "Resolution." and its words, then the settling code as a pill.
- Resolve, a text button, under an open contradiction only, when `mayMove`.

Kind chip tones, on the existing `Chip`: Contradiction `danger`, Compatible `success`, Question `waiting`, Note no tone. State chip: Open `danger` with the outline the mockup draws (a `note-state-open` class, border only), Resolved no tone. A kind other than contradiction shows no state. Judge chip: no tone, grey, as the mockup says.

The footer is the Log's pattern, grown: a button Add a note opens the field (`TextArea`), a Kind choice (a `Segmented` of Note, Contradiction, Compatible, Question, Note chosen first), and a Related picker (N6); Cancel and Add. Add is off while the trimmed text is empty or over 4000 characters. After Add the list reloads and the form closes; a failure keeps everything typed and shows the line from the table in N1.

### N5. The Resolve form

Tapping Resolve under an open contradiction replaces the button by a small form in that entry (mockup, second screen of section 12): a `TextArea` labelled Resolution, a Related-style picker labelled Settled by that offers decisions and rules only (a question is refused by the hub, so it is not offered), and Cancel and Resolve. Resolve stays off until both are filled (the mockup says both; the hub treats them as optional, so this is the app's rule, and the owner may relax it). Only one form is open at a time. On success the entry becomes Resolved with the words and the pill, and the list reloads. On 409 the list reloads and shows "Already resolved." On 403 the form stays and shows the Can move sentence. The note's other fields are never editable.

### N6. The Related picker

One picker for Add (any record: rule, decision or question) and for Resolve (decisions and rules). It is `shared/ui/SearchSelect.tsx` or `ReferencePicker.tsx`, whichever `features/backlogs/references/` already uses for its repo picker (todo step N21 reads both and picks the one that fits; no new picker is built). Options come from the list calls the app already makes: `taskmanager_rule_list` with `kind` for each of the three kinds, read once when the picker opens, cached by `callTool`; each option shows the code and the title, and the record's own code is left out (the hub refuses it with 400). Add allows none or several, at most 20 (the hub's cap), the mockup draws one choice with "none"; one is built first, a list is a later change if the owner asks. Chosen codes go to `related_codes`.

### N7. Who sees Add and Resolve

The hub is the only authority: Add needs Can see on a backlog, Resolve needs Can move. The app has no read of the viewer's own level. The issue Log does not learn it either: it shows Add a note to everyone who opens the issue and shows the hub's refusal as "The note could not be added." The access screens read the grants of every group (`taskmanager_backlog_access_list`, `access/api.ts`) for an owner to edit; none answers "what may I do". No operation in the notes version, or in `backlog_list`, returns the viewer's own level.

So the first build does what the Log does:

- Add is shown to every viewer who passed the `rule.read` gate (Can see is the lowest level that opens a rule at all, so everyone who gets here may add).
- Resolve is shown on every open contradiction to the same viewers, and a 403 becomes the Can move sentence above. No level read is invented in the app, and no guess is hidden behind a button that is missing.
- `RuleNotes` takes `mayAdd` and `mayMove` props, both true by default, so the read-only screen of the mockup (third screen of section 12: no Resolve, no add field, no Kind or Related) is one test and one prop away from being real the day a level source exists.

Two open questions for the owner, since they change the mockup:

1. The mockup's read-only screen has no add field. By the hub's rule Add needs only Can see, so everyone who can open the record can add; the read-only screen can only be real if the agency adds a permission for note actions (the permission list the app already holds says "no"). Check the agency note actions when they ship (todo step N2). If there is one, `mayAdd` reads it from `agency_get_my_roles` the way `rule.read` is read in step 14.
2. Hiding Resolve from a person without Can move needs the backend to answer the viewer's level (a `my_level` on each backlog of `backlog_list` is the smallest ask). A request to the taskmanager owner is filed when the owner wants the hidden button; it is not built as several reads in the app.

### N8. The marker on the issue screen

The owner wants, on the ISSUE screen, a line for the rules the issue follows: one line per open contradiction (`R-1 contradicts R-6`), linking to the notes list, and nothing when there is none. The marker is also a reason the issue may be Blocked: an open contradiction on a rule an issue follows now blocks agents' work on that issue (the skills read it; stated by the coordinator, not found in the taskmanager working tree, where nothing reads notes yet), so the marker reads as a reason, not as decoration.

How the screen learns, without slowing it:

1. `taskmanager_rule_list_for_issue` `{ taskID }` answers `linked` (each with `relation` and `rule`), `suggested`, `mentioned` and `questions` (`operations.json`, `list_rules_of_issue`). The marker uses `linked` only: those are the rules the issue follows. The first build already reads this answer for the Why row (`decisionOfIssue`), so it needs a shared `followedCodes(issueId)` in the rulebook client, not a second parser.
2. One call, not one per rule. There is no batch read of notes for several rules (checked: `list_rule_notes` takes a single `rule`, one `related`, and no list of codes). But the read without `rule` returns every open contradiction the viewer may read in one answer: `kind=contradiction&state=open`, up to 200, newest kept. The marker makes that one call, `openContradictions()`, and keeps a rule when its code is in the note's `rule_code` or in its `related_codes` (a contradiction written on R-1 that names R-6 bears on both).
3. If the answer holds exactly 200 notes, it may have been cut. Then, and only then, the marker falls back to one `list(code, { kind: ["contradiction"], state: "open" })` per followed rule, at most 10 rules; a rule beyond ten shows nothing, which is the failure mode of this screen (nothing).
4. Lazy and quiet. The marker is its own component, `IssueRuleMarkers.tsx` in `features/backlogs/issue/`, mounted under the tags of the issue. It starts its two reads in an effect after the issue has rendered, with its own `useLoad`; the issue screen never waits for it and no loading line or spinner is drawn. On any failure, `no_access`, a viewer without `rule.read`, or no followed rules, it renders nothing, and no error is shown or logged to the viewer. If `linked` is empty, the second call is not made. The result is read once per issue open (no refresh timer); it is read again when the viewer returns to the screen, through the `callTool` cache window.
5. Display: for each open contradiction that bears on a followed rule, one chevron row (the `row` of the app, a line and not a card) under the tags of the issue's card, with no second line of text. It names the pair with the rule the issue follows first, then the words contradicts, then the other rule of the note (its `rule_code` or a related code): `R-1 contradicts R-6`, the codes in the issue-code colour. The issue's own red Blocked tag stays and carries the reason; the row adds no chip and no tooltip. Tapping it goes to `rulePath(code)` of the rule the issue follows (the code shown first, never the other rule) with `?notes=open`, so the Notes card is open on the notes list, with `backState` as the issue rows carry, so Back returns to the issue. Several open contradictions give several rows, one per pair, one under the other; none gives no element at all (no empty row, no heading).

A mockup of this line is drawn first (todo step N30), in `mockups/app/issues/issue-rule-marker.html`, under the tags of the issue's card; no code before the owner accepts it.

### N9. Words

Feature-local, English, in `features/backlogs/rulebook/notes/words.ts` (the same home as section 4; no translation table is touched):

| Name | Words |
| --- | --- |
| `notesHeading` | Notes |
| `noNotes` | Nothing noted yet. |
| `notesLoadFailed` | The notes could not be loaded. |
| `kindWords` | Note, Contradiction, Compatible, Question |
| `stateWords` | Open, Resolved |
| `sourceWords` | Judge, Worker (a person has none) |
| `addNote` | Add a note |
| `kindLabel` | Kind |
| `relatedLabel` | Related, optional |
| `relatedNone` | Rule, decision or question: none |
| `addFailed` | The note could not be added. |
| `resolve` | Resolve |
| `resolutionLabel` | Resolution |
| `resolutionHeading` | Resolution. |
| `settledByLabel` | Settled by |
| `settledByNone` | Decision or rule: none |
| `onlyContradiction` | Only an open contradiction can be resolved. |
| `alreadyResolved` | Already resolved. |
| `needsCanMove` | You need Can move on a backlog to resolve this. |
| `recordGone` | That record is no longer there. |
| `tooLong` | A note can hold 4000 characters. |
| `contradicts` | contradicts (the marker row, between its two codes) |

Plain, owner changes any word at step N0. The `Cancel` and `Add` button words are the Log's.

### N10. Tests

- Mapper: `ruleNoteOf` maps every wire field; an unknown kind reads as note; no `related_codes` gives an empty list; a resolved contradiction carries its four resolution fields.
- Client (`vi.spyOn(mcp, "callTool")` answering by tool name, as `page/pageClient.test.ts`): list asks `taskmanager_rule_note_list` with `rule`, repeated `kind` and `state`; add sends `source: "person"`, the trimmed text, `related_codes` and the default kind note; resolve sends `noteID`, `resolution`, `resolved_by_code`; each refusal of N1 gives its typed answer (400 invalid, 404 missing, 409 already_resolved, 403 forbidden).
- Tool names: `ruleNoteTools` all in the pinned roster and in the pinned module's `operations.json` (the walk of `backlogToolNames.test.ts` and `rulebook/tools.test.ts`); fails until the pin is v0.5.0.
- Gate: without `rule.read` the guarded client answers `no_access` and makes no call.
- Words: no blank or padded word, no padded counts.
- Component, phone: the list is oldest first; chips of the kind and tones; the Open state on a contradiction, none on a note; the Judge chip for a judge source; related and settling codes are pills that go to `rulePath`; Resolve appears only under an open contradiction; empty line; failure line.
- Component, Add: off while empty; sends the chosen kind and related; the list reloads on success; a failure keeps the text.
- Component, Resolve: the form opens in place, Resolve off until both fields are filled, the settling picker offers no question, a 409 reloads and says Already resolved, a 403 keeps the form.
- Read-only: with `mayAdd` and `mayMove` false, the third screen of the mockup (no Resolve, no add field).
- Wide: at 1440 by 900 the notes sit in the right column of the record.
- Marker: renders nothing while loading, on failure, with no `rule.read`, with no followed rules (and makes no second call), and with followed rules that have no open contradiction; renders one row per open contradiction that bears on a followed rule, including a rule named only in `related_codes`; makes exactly two calls for any number of followed rules; falls back to per-rule reads when the answer holds 200 notes; a tap goes to the rule with `notes=open`; the issue screen's own content renders first, and a never-resolving marker read leaves the screen usable.
- Notes open from the link: `rule/R-1?notes=open` renders the Notes card open.
- Route and layout: `layoutRules.test.ts` keeps the folder inside the public surface; one `npm run typecheck` and one `npm test` at the end (consolidated, as the first build).

### N11. Todo list (small steps, one per red test and per build step)

Blocked until the hub runs taskmanager v0.5.0 and agency with note actions. Steps N0 to N2 are the unblockers and can be done now; no step from N3 on starts before N1 and N2 are done. Output and where are per step.

| No. | Step | Output | Where |
| --- | --- | --- | --- |
| N0 | The owner answers the two open questions of N7, and whether Resolve needs both fields | A decision recorded on ISS-246 | the hub issue |
| N1 | Check the hub release: taskmanager v0.5.0 is tagged, `code/wakala-api/go.mod` pins it on every clone (`origin/main..HEAD` is empty for `code/wakala-api`), and the MCP roster lists the three note tools | A line on the issue: yes or what is missing | `code/wakala-api/go.mod`, `testdata/mcp_roster/` |
| N2 | Check the agency release: its note actions, and whether a permission code for notes exists in the catalogue | A line on the issue; sets whether `mayAdd` reads a permission | agency repo, `agency_list_permissions` |
| N3 | Red: the notes tool names are real | `tools.test.ts` fails until `ruleNoteTools` names are in the roster and in the module's `operations.json` | `features/backlogs/rulebook/notes/tools.test.ts` |
| N4 | Build: the tool names | `tools.ts` with `ruleNoteTools` | `features/backlogs/rulebook/notes/tools.ts` |
| N5 | Red: the note mapper | `noteMapper.test.ts` fails: wire note to `RuleNote` with every field; unknown kind reads note; missing lists are empty; resolution fields | `features/backlogs/rulebook/notes/noteMapper.test.ts` |
| N6 | Build: types and mapper | `types.ts` (`RuleNote`, `NewNote`, answers, `RuleNotesClient`) and `ruleNoteOf` | `features/backlogs/rulebook/notes/types.ts`, `mappers.ts` |
| N7 | Red: list and add calls | `api.test.ts` fails until `list` and `add` call the tools with the arguments of section N3 and map the answer | `features/backlogs/rulebook/notes/api.test.ts` |
| N8 | Build: list and add | `mcpRuleNotesClient.list` and `.add`; `itemsOf` reused | `features/backlogs/rulebook/notes/api.ts` |
| N9 | Red: resolve, and the refusals | `resolveClient.test.ts` fails: resolve call arguments; 400 invalid, 404 missing, 409 already_resolved, 403 forbidden for add and resolve | `features/backlogs/rulebook/notes/resolveClient.test.ts` |
| N10 | Build: resolve and `noteFailureOf` | `.resolve` and the refusal reader | `features/backlogs/rulebook/notes/api.ts`, `answers.ts` |
| N11 | Red: the guard | the guarded client answers `no_access` without `rule.read` and makes no call | `features/backlogs/rulebook/notes/access.test.ts` |
| N12 | Build: the guard | `guardedRuleNotes` in the shape of `guardedRulebook` | `features/backlogs/rulebook/notes/access.ts` |
| N13 | Red: the words | `words.test.ts` fails on a blank or padded word | `features/backlogs/rulebook/notes/words.test.ts` |
| N14 | Build: the words | `words.ts` with the table of N9 | `features/backlogs/rulebook/notes/words.ts` |
| N15 | Extract: names and entry parts out of the Log | `shared/noteNames.ts` (`loadNames`, `noNames`) and `shared/NoteParts.tsx` (`NoteLinks`, `NoteByline`); `IssueLog.tsx` imports them; the existing `issueLogNames.test.tsx` and `issueLog` tests stay green unchanged | `features/backlogs/shared/`, `features/backlogs/issue/IssueLog.tsx` |
| N16 | Red: one entry | `noteEntry.test.tsx` fails: author, kind chip and tone, state chip on a contradiction only, Judge and Worker chips, related pills, resolution words with the settling pill | `features/backlogs/rulebook/notes/noteEntry.test.tsx` |
| N17 | Build: one entry | `NoteEntry.tsx` and the `note-state` style in `notes.css` (rem only, no new font size rule) | `features/backlogs/rulebook/notes/NoteEntry.tsx`, `notes.css` |
| N18 | Red: the list | `ruleNotes.test.tsx` fails: oldest first, empty line, failure line, Resolve only under an open contradiction | `features/backlogs/rulebook/notes/ruleNotes.test.tsx` |
| N19 | Build: the list and the Notes row | `RuleNotes.tsx` in a collapsible `Card`, closed at first, open when `notes=open` | `features/backlogs/rulebook/notes/RuleNotes.tsx` |
| N20 | Red: the Related picker | `relatedPicker.test.tsx` fails: options are the codes and titles of the three kinds, the record's own code is absent, a choice reports one code, none is allowed; the settling variant offers no question | `features/backlogs/rulebook/notes/relatedPicker.test.tsx` |
| N21 | Build: the Related picker | `RelatedPicker.tsx` on the shared picker chosen in section N6 (read both first) | `features/backlogs/rulebook/notes/RelatedPicker.tsx` |
| N22 | Red: Add | `addNote.test.tsx` fails: off while empty or over 4000 characters, sends kind and related, reloads on success, keeps the text on failure and shows the line for 400 and 404 | `features/backlogs/rulebook/notes/addNote.test.tsx` |
| N23 | Build: Add | the footer, field, Kind choice and picker in `RuleNotes.tsx` (or `AddNote.tsx` if it passes a screenful) | `features/backlogs/rulebook/notes/` |
| N24 | Red: Resolve | `resolveForm.test.tsx` fails: the form opens in place, off until both fields are filled, 409 reloads and says Already resolved, 403 keeps the form with the Can move sentence | `features/backlogs/rulebook/notes/resolveForm.test.tsx` |
| N25 | Build: Resolve | `ResolveForm.tsx` | `features/backlogs/rulebook/notes/ResolveForm.tsx` |
| N26 | Red: read-only | with `mayAdd` and `mayMove` false: no Resolve, no add field | `features/backlogs/rulebook/notes/readOnly.test.tsx` |
| N27 | Build: the two props | `mayAdd` and `mayMove` on `RuleNotes`, true by default; the record screen passes the defaults until N0 and N2 give a source | `RuleNotes.tsx`, `RecordPage.tsx` |
| N28 | Red: the record screen carries the Notes row | `recordPage.test.tsx` gains cases: the Notes row is present for a rule, a decision and a question; `?notes=open` opens it; the wide window puts it in the right column | `features/backlogs/rulebook/recordPage.test.tsx`, `rulebookWide.test.tsx` |
| N29 | Build: mount the row | `RecordPage.tsx` mounts `RuleNotes` with the client from the page's props | `features/backlogs/rulebook/RecordPage.tsx` |
| N30 | Mockup: the issue marker | the chevron row `R-1 contradicts R-6` drawn under the tags of the issue screen: one pair, no marker, resolved, wide, and two pairs; the owner accepts it; the mockup page and design page stay in step | `documentation/2. design/mockups/app/issues/issue-rule-marker.html`, `rules.html` note |
| N31 | Red: followed codes | `followed.test.ts` fails: from a `rule_list_for_issue` answer only `linked` codes are kept; `suggested`, `mentioned` and `questions` are ignored; none gives an empty list | `features/backlogs/rulebook/notes/followed.test.ts` |
| N32 | Build: followed codes | `followedCodes(issueId)` shared with the Why row's reader | `features/backlogs/rulebook/api.ts` |
| N33 | Red: the open-contradiction read | `openContradictions.test.ts` fails: one call without `rule`, `kind` contradiction, `state` open; a rule matches by `rule_code` or by `related_codes`; a full 200 falls back to one call per rule, at most 10 | `features/backlogs/rulebook/notes/openContradictions.test.ts` |
| N34 | Build: the open-contradiction read | `openContradictionsFor(codes)` in the notes client | `features/backlogs/rulebook/notes/api.ts` |
| N35 | Red: the marker | `issueRuleMarkers.test.tsx` fails: nothing while loading, on failure, with no `rule.read`, with no followed rules (no second call) or with none open; one row per open contradiction, reading `<followed code> contradicts <other code>`, with no chip, no second line and no tooltip; two calls at most; a tap goes to the followed rule with `notes=open` and back state; a never-resolving read leaves the issue screen usable | `features/backlogs/issue/issueRuleMarkers.test.tsx` |
| N36 | Build: the marker | `IssueRuleMarkers.tsx`, own `useLoad`, no spinner, no error line; mounted under the tags in `IssuePage.tsx`; each row is the app's `row` with the `contradicts` string, no chip and no tooltip | `features/backlogs/issue/IssueRuleMarkers.tsx`, `IssuePage.tsx` |
| N37 | Red: issue screen unchanged without it | the existing issue tests stay green with the marker's client answering nothing; the issue screen renders with the marker's read rejected | `features/backlogs/issue/issueRuleMarkers.test.tsx` |
| N38 | The whole check, once | `npm run typecheck` and one `npm test` green, including `layoutRules.test.ts`, `backlogToolNames.test.ts` and the placeholder tests | `code/app` |
| N39 | Design files in step | design page and `rules.html` marked with the built path; the notes shown as built; the story board of the backlogs gets one row | `documentation/2. design/` |
| N40 | One walk | one walk on the live app after the last component merges: open R-1, add a contradiction naming R-6, see the marker on an issue that follows R-1, follow it to the Notes, resolve it with D-1, see the marker go; the result in `documentation/4. qa/walk-records/` and a last-run note | `documentation/4. qa/` |

### N12. Risks for the notes build

- The release is not there. The notes version is an untagged commit past v0.4.0 and the agency note actions are not shipped; every step from N3 on fails with unknown tool on a hub that has not got them. N1 and N2 are the gate.
- The read-only screen of the mockup cannot be real from data (N7). It is built behind props and tested, and left unwired.
- Truncation: the global open-contradiction read keeps the newest 200. The fallback in N8 covers it up to ten followed rules; a hub with more than 200 open contradictions is a problem the notes screen itself would show first.
- A viewer sees the contradictions of every rule the hub lets them read, including rules of backlogs they cannot see (rules are not split by backlog, section 6). The marker names only rules the issue itself follows, so this does not widen what the issue screen shows.
- The claim that an open contradiction blocks agents' work on an issue lives in the agency's skills, not in the taskmanager version read for this plan. If the blocking rule changes, only the issue's Blocked tag changes; the row stays.
- A note's `source` judge is written by the AI judge with the person's session; the Judge chip is a display of that field and is not proof of anything.

## Book screen

Hub issue ISS-245. The issue was written for the Flutter app; the owner's app is the web app (`code/app`), so the Book is a web app screen. The mockup is `mockups/app/backlogs/book.html`, redrawn as one list. The screen, its client and its words are built in `features/backlogs/book/`; the owner's answers are recorded in B11 and the shape below follows what was built and decided. Paths are under `code/app/src` unless they start with another repo name. Sections 1 to 7 above and the Notes build are not changed by this section; the Book reads no note and draws no marker.

### B1. What the Book is

One screen: the in-force rules of every backlog, as one list, oldest first, read like a white paper in one reading column. The owner's words: "just list the rules in a nice way, oldest first", "easy to read like a white paper". The two answers that fix the scope:

- It is reached from a Book button on the Rules list (the Rules choice of a backlog, beside the Rules, Decisions and Questions choices). There is no Home menu row and no menu entry.
- It shows all in-force rules across backlogs, not those of the backlog the viewer came from. It shows no notes and no markers: in-force rules only.

No chapters, no per-backlog order and no tags (`new-developer-book-needs.md`, owner answers: "list the rules oldest first; there is no per-backlog setting yet"). The reader is a new developer or a new AI agent, who must be able to read and follow every rule, so the page holds the reason, not only the rule.

Where the mockup places it. `shared/app-nav.js` lists `backlogs/book.html` ("Book") beside `backlogs/rules.html` ("Rules") under the Backlogs menu, but that menu is the index of mockup pages, not a menu of the app. The page itself draws a bar with `data-back="Backlogs"` and `data-title="Book"` and no entry point, so the mockup does not say how the Book is reached; the owner's answer above does, and todo BK1 draws it.

### B2. Route, path and the entry button

| Part | Decision |
| --- | --- |
| Folder | `features/backlogs/book/`, beside `rulebook/` and importing the rulebook client only through `../rulebook` (`index.ts`); it never imports from `rulebook/notes` |
| Route | one row in `features/backlogs/BacklogsRoutes.tsx`, `<Route path={bookRoutePath} element={...}/>` with `bookRoutePath = "book"`, placed before `:backlogId` like the other static rows, inside the existing `<NeedsRole>`. There is no route wrapper such as `NeedsRulePermission`: the gate is `guardedRulebook` plus `useMayReadRules`, and each page shows `noAccessWords`. Separately, `"book"` is in `notBacklogs` of `app/home/lastBacklog.ts`, so opening the Book is never remembered as the last-opened backlog |
| Path | `bookPath()` in `book/paths.ts`, on `backlogsHomePath()`: `/a/<agency>/backlogs/book` |
| Entry | a Book button in `rulebook/RulebookPage.tsx`, beside the `p.sub.count` line, shown on the Rules choice only (not Decisions or Questions), on every backlog and on All issues. It is a shared `Button` with an `onClick` that calls `navigate(bookPath(), backState(...))` of the Rules list, because the shared `Button` has no `state` prop |
| Back | the Shell back goes to the Rules list the viewer came from; with no state it goes to the Backlogs list, labelled Backlogs as the mockup's bar is |
| Not added | a Home menu row, an entry in the tab bar, a button on Decisions or Questions, `ChatAboutBacklog` (the Book is not about one backlog, and the owner asks for the minimum) |

A backlog whose id is the word `book` would now be hidden by the static row. Backlog ids are generated, not typed, so this is noted and not guarded. The segment `book` is chosen apart from `rulebook` and from the smart backlog's `:backlogId/rules`, for the name clash described in section 1.

### B3. The calls, and how many

The Book makes no call of its own: it reuses `mcpRulebookClient` (`rulebook/api.ts`) and the Files client. All tools are already in the roster the first build pins.

| When | Call | Count |
| --- | --- | --- |
| first | the permission pre-check, `agency_get_my_roles` through `guardedRulebook` (`rulebook/access.ts`), one read the Backlogs gate already holds in the `callTool` cache | 1 (usually cached) |
| first | `taskmanager_rule_list` with `{ kind: "rule", status: ["in_force"] }` and no `tag`, no backlog id. This is what `list("all", "rule", { statuses: ["in_force"] })` already sends for the pseudo-backlog `all` (`allIssuesId`); the module pages internally, so there is no `limit` to send | 1 |
| lazily, per rule | `taskmanager_rule_issue_list` `{ ruleCode }` for "Came from" | 1 per rule |
| lazily, per rule | `taskmanager_rule_file_list` `{ ruleCode }` for "Done right in" | 1 per rule |
| lazily, once | `forms_git_repository_list` through `mcpFilesClient.folders()` (`features/files/api.ts`, reached through `features/files/index.ts`), made by the one hook `useFileTarget` (B4), to turn a repo name into a Files folder | 1 |

For 25 rules that is 1 + 25 + 25 + 1 = 52 calls, plus the pre-check when it is not cached (53). There is no batch read: `rule_issue_list` and `rule_file_list` take one `ruleCode`, `rule_read` carries neither, and `taskmanager_task_batch` is about issues. So the plan does not try to batch; it makes them lazy and bounded:

1. The screen renders from the one list call. Title, date, contents and every rule's text appear at once; only the refs line of each rule (Came from, Done right in) is filled afterwards.
2. A generic queue, `runLimited(items, limit, run, signal)` in `shared/wakala/runLimited.ts`, runs the jobs in the order given, at most `limit` at a time, goes on when one fails and starts none after the signal is aborted. The only thing the Book holds is `useRefs` (`book/useRefs.ts`), which calls it with four and reads each rule's two reads together, in document order. The top of the page therefore fills first, the rest trickles in behind the reader, and nothing waits for the whole set. No spinner is drawn; a rule whose refs have not arrived shows only its text.
3. One rule's refs failing, or being refused, leaves that rule without a refs line; it never fails the Book. Only a failed list call shows the failure card with Try again.
4. `callTool` keeps read results for 10 or 60 seconds, so going to a file and Back reads nothing again inside that window.
5. If 52 calls proves slow on the live hub, the fix is one taskmanager read that returns each in-force rule with its issues and files, filed to taskmanager as its own issue. It is not worked around in the app.

Sort. The module orders `GET /rules` by kind, priority, then code number, and a rule has no priority, so a plain list is by code number. "Oldest first" is by `created_at` (`models/rule.go`, `RuleRecord.CreatedAt`), then code number for equal times (the owner's answer, B11). `ruleOf` maps `created_at` to `createdAt` on `Rule` (todos BK3, BK4) and the Book sorts with it (`inBook` in `book/bookRules.ts`, BK5, BK6). The server order is not relied on.

### B4. The layout

Taken from `book.html`, one `article` in one column, the same on the phone and at 1440 x 900 (the mockup's second state only widens the window, not the page):

| Part | Content | Words and source |
| --- | --- | --- |
| Title | `h1` "Best practices" | `bookTitle` |
| Date read | "Read on 25 November 2026", the day the viewer opened the screen, local time, not a stored date. Taken once on mount and kept while the screen is open | `readOnWords(date)`; a new `longDayWords(date: Date)` in `shared/ui/days.ts` because `dayWithYearWords` writes "Wednesday, 25 Nov 2026"; it is `date.toLocaleDateString('en-GB', {day:'numeric', month:'long', year:'numeric'})`, with no month table |
| Contents | the mockup has one: an `ol` of every rule as code and title, each a link to its rule on the page. A tap scrolls to the rule (`scrollIntoView`, `preventDefault`, no history entry, so Back still leaves the Book); the `href` is the in-page anchor `#book-R-1` so the link can be copied | `rule.code`, `rule.title` |
| A rule | `h3` with the code (the `.issue-code` class of `features/backlogs/shared/backlogs.css`, not `.icode`) and the title; the reason below it as text from `rule.body` through `shared/ui/Markdown.tsx` (a rule with no body shows the title only, no empty paragraph); then one refs line | `rule.title`, `rule.body` |
| Refs line | "Came from ISS-169 and ISS-218. Done right in code/app/src/tokens.css." Either sentence is left out when it has nothing; with neither, no line | `cameFromWords`, `doneRightInWords`, `joinWords` ("A", "A and B", "A, B and C"), new code in `book/words.ts` that joins any list, text or links |
| Came from | the issues of `rule_issue_list` whose relation is `decided_in`, shown by their code, each a link to the issue screen (`issuePath(id)` with `backState` to the Book, passing the Book's screen title `bookButton` as the back label, so the issue screen's back reads "Book"). `applies_to` and `broken_by` are not shown: the Book says where a rule came from, not what it governs or what broke it. An issue the viewer cannot see is absent from the hub's answer and so from the line | `RuleIssue.code`, `.id`, `.relation` |
| Done right in | the file links of `rule_file_list`, in the order added: the path as the link text | `RuleFile.path` |

What the owner asked about the file link: "a plain link that opens the file on main". How the link is built from repo and path. The hub stores a repo name and a path, not a URL (`RuleFileLink`: `repo`, `path`, `line`, `note`, `missing`); the app has no builder of an outside address. The link is therefore the app's own Files screen:

1. The Book takes the link as a `FileTarget` prop (`book/fileTarget.ts`): a function from a `RuleFile` to a path or `undefined`. The default, `noFileTarget`, returns `undefined`, so a file is plain text unless a target is given. There is no `book/fileLink.ts`.
2. One hook, `useFileTarget`, fills the prop. It is extracted from the folder lookup that `rulebook/RecordReferences.tsx` already makes, so the record screen and the Book share it and nothing is copied. `mcpFilesClient.folders()` lists the repositories as `Folder` (`id`, `name`, `branchId`), one read for the whole Book.
3. The folder whose `name` equals the file's `repo` is the target; `filePath(folder.id, path)` from `features/files/paths.ts` gives `/a/<agency>/files/<folderId>/file?path=<path>` (path encoded). The Files screen opens a folder at its default branch, which is main, so the link carries no branch and opens the file on main. It is a router `Link` with `backState` to the Book, not an external anchor.
4. The Files screens `FilePage` and `WideFiles` gained `backTo` support (`useBackTo`, `useBackLabel`; test `features/files/fileBackTo.test.tsx`), so Back from the file returns to the Book and is labelled Book; with no state it still goes to the folder.
5. No folder of that name, a refused or failed repository read (the viewer may hold `rule.read` without a Files read, or the agency may not mount git), or `missing: true` on the link: the path is shown as plain text, with no link and no chip. The paper never carries a link that leads nowhere and does not carry a "Not found" mark; the owner may ask for one.
6. `line` is not used: the Files screen has no line anchor today. A link with a line opens the whole file.

### B5. What never appears

| Never | How it is kept out |
| --- | --- |
| A proposed, superseded or retired rule | the call sends `status: ["in_force"]` and the screen filters again on `status === "in_force"`, so a hub answer that held one would still not show it (todo BK5) |
| A decision or a question | `kind: "rule"` in the call, and a second filter on `kind` |
| A note, a Notes row, an Open contradiction marker, a Judge or Worker chip | the Book imports nothing from `rulebook/notes` and calls no note tool; a test reads the folder for both (BK28) |
| Status chips, tag chips, a status word, "Superseded by", "Replaces", the Why decision row | the Book draws a rule as title, reason and refs line only |
| A rule's applies-when, priority, decided-by, ids | not mapped into the page |
| A backlog switch, a filter bar, a search box, the chat button | not part of the paper |

### B6. Words

Feature-local and English, in `features/backlogs/book/words.ts`, the home of section 4. No translation table is touched.

| Name | Words |
| --- | --- |
| `bookButton` | Book |
| `bookTitle` | Best practices |
| `readOnWords(date)` | Read on 25 November 2026 |
| `contentsLabel` | Contents (the accessible name of the contents list; no visible heading, as the mockup has none) |
| `cameFromWords` | Came from (followed by the linked codes and a full stop: Came from ISS-169 and ISS-218.) |
| `doneRightInWords` | Done right in (followed by the paths and a full stop: Done right in code/app/src/tokens.css.) |
| `emptyWords` | No rules are in force yet. |
| `loadFailedWords` | The Book could not be loaded. |
| `noAccessWords` | the no-access card: the same sentence as the rulebook gate's `noAccessWords` of section 4, kept in `book/words.ts` |

"Came from" and "Done right in" are built from links, so the sentence is made of parts, not of one string; `joinWords` (new code in `book/words.ts`) joins any list the one way, text or links. A word with a count or name is a function, as `issuesWords` is. The owner may change any word at BK0.

### B7. Permission

The Book is behind `rule.read`, the permission of section 6, with no new permission code. The pre-check (`askMayReadRules` over `agency_get_my_roles`) runs before any read, in the same `guardedRulebook` wrapper the Rules list uses, so a viewer without it gets the no-access card and no list call is made. There is no route wrapper (no `NeedsRulePermission`): the gate is `guardedRulebook` plus `useMayReadRules`, and each page shows `noAccessWords`, so a typed `/backlogs/book` is gated like a typed rulebook address, and the Book button is not drawn on a Rules list the viewer cannot open anyway.

The calls need only what section 6 lists for `rule.read`: `taskmanager.rule.list`, `issue_list` and `file_list`. The Files read (`forms.git.repository.list`) is a different permission and a different module: without it the Book still opens and shows every file path as plain text. A viewer with `rule.read` and Can see on any backlog reads every rule, so the Book shows rules of backlogs the viewer cannot see (the module does not split rules by backlog, section 6 layer 3); that is what the owner asked ("all in-force rules across backlogs") and it is not described as private. Issues of a backlog the viewer cannot see are absent from "Came from".

### B8. Print

The owner named no print behaviour; a white paper is the natural thing to print, so the plan gives the least that works and builds no Print button (the browser's own print is used):

- `@media print` in `book/book.css` hides the Shell bar, the tab bar and the back link and sets the page background to white, so the printout is the article alone. The links print as their text (the codes and paths already read as text, so no URL is appended).
- Because the refs are filled in by a queue (B3), a print before the queue has finished would lack some refs lines. The queue starts as soon as the list is there and runs the whole document, not only what is on screen, so in practice it has finished before a person prints; the plan does not wait on `beforeprint` (the event cannot wait for a read). If the owner wants a guaranteed full printout, the single taskmanager read of B3 step 5 removes the problem.
- Font sizes are `rem` from the root only, `font: inherit` on buttons, no pixel size, in line with the stylesheet rule in CLAUDE.md; `book.css` is a new small file, slim, using `app/tokens.css`. The reading column is `max-width: 40rem` with `line-height: 1.6`, as the mockup draws it, centred in the wide window. The mockup's own inline CSS is not copied.

### B9. Tests

The pattern is the first build's (section 5): a client test per call with `vi.spyOn(mcp, "callTool")` answering by tool name, a component test per screen in `MemoryRouter` with the client as a prop, a words test, a wide-window test at 1440 x 900, one full run at the end. Fixtures go in `rulebook/rulebookFixture.tsx` (extended) or one `book/bookFixture.tsx`.

- Mapper: `createdAt` is mapped from `created_at`, and empty when absent.
- Order and filter: oldest first by `createdAt`, code number for equal times; only `kind` rule and `status` in_force survive a hub answer that also holds a proposed, a superseded, a retired and a decision.
- List call: exactly one `taskmanager_rule_list` with `kind` rule and `status` in_force and nothing else; no backlog id; with no `rule.read`, no call.
- Refs: `decided_in` issues only; file links with `missing`; one rule's refused read gives no refs and no failure of the Book.
- Queue: `runLimited` (`shared/wakala/runLimited.test.ts`) never runs more than the limit at once, starts in order, goes on after a failed job and starts none after abort; `useRefs` (`book/useRefs.test.tsx`) reads at most four rules at once in document order, 25 rules make exactly 25 reads of each kind, a throwing read leaves that rule without refs, and no read starts after unmount.
- Files back: `features/files/fileBackTo.test.tsx` shows that `FilePage` and `WideFiles` go back to where the viewer came from and say so, and still go to the folder with no state.
- File target: `useFileTarget` gives `filePath(folder.id, path)` for a folder named as the repo; no folder, a refused repository read or git not mounted give `undefined`; the Book shows a link for a target and plain text for none or for `missing: true`; with no `fileTarget` prop every file is plain text.
- Words: no blank or padded word; `joinWords` for one, two and three; the long date reads "25 November 2026".
- Screen, phone: title, the date read (fake timers), one contents entry per rule in order, each rule with code, title, reason and refs line; nothing for a rule with no body or no refs; loading, empty and failed with Try again; a contents tap scrolls to the rule and adds no history entry; Came from goes to `issuePath` with back state; the file link goes to the Files file screen with back state.
- Never: no status chip, tag chip, note, marker, chat button, switch or search in the Book; the folder imports nothing from `rulebook/notes` and holds no `taskmanager_` tool literal of its own.
- Screen, wide: at 1440 x 900 one `article`, one column no wider than 40rem.
- Style: `book.css` holds no pixel font size and holds an `@media print` block.
- Entry button: the Rules choice shows Book and goes to `bookPath()`; Decisions and Questions do not; it follows the gate.
- Gate and route: `/backlogs/book` without `rule.read` shows the no-access card and makes no list call; `/backlogs/book` does not open the issues screen and `/backlogs/b1` still does.
- `layoutRules.test.ts` keeps the folder inside the public surface of `backlogs` and the Files import through `features/files/index.ts`.

### B10. Todo list (small steps, one per red test and per build step)

Needs from the first build, all present in the working tree at the time of writing (`rulebook/types.ts`, `api.ts`, `access.ts`, `mappers.ts`, `RulebookPage.tsx`) except the gate and the route table: the client (steps 3 to 9), the pre-check (13, 14), the page that takes the button (25) and the gate (31, 32). Check them at BK2. Every step ends with `npm run typecheck` clean and its own test file green; one full `npm test` at BK29. No step writes a comment in the code.

| No. | Step | Output | Where |
| --- | --- | --- | --- |
| BK0 | The owner accepts the redrawn Book: one list oldest first, the contents list, the refs line wording, a missing file as plain text, the Book button on the Rules list only (answered, B11) | A decision recorded on ISS-245; nothing below starts before it | the hub issue |
| BK1 | Mockup: draw the Book button on the Rules list (phone and wide) and fix the captions of `book.html`: "Filled by" becomes the in-force list of all backlogs plus the per-rule issue and file reads, the "a real Book holds the rules of one backlog" sentence goes, a line says it is reached from the Rules list | The two mockup pages in step with the owner's answers | `documentation/2. design/mockups/app/backlogs/book.html`, `rules.html` (check `git status` first: another agent edits design files) |
| BK2 | Check the first build the Book stands on: client, pre-check, `RulebookPage`, gate and `rulebook` index exports exist; `taskmanager_rule_list`, `_rule_issue_list`, `_rule_file_list` are in the pinned roster | A line on the issue: yes, or which step is missing | `code/app/src/features/backlogs/rulebook`, `code/wakala-api/internal/api/http/testdata/mcp_roster/` |
| BK3 | Red: the record mapper keeps the creation time | a test fails: `ruleOf` maps `created_at` to `createdAt`, and to empty text when absent | `features/backlogs/rulebook/api.test.ts` |
| BK4 | Build: `createdAt` | `createdAt` on `Rule` and in `ruleOf`; the shared fixture gains the field | `features/backlogs/rulebook/types.ts`, `mappers.ts`, `rulebookFixture.tsx` |
| BK5 | Red: what the Book keeps and its order | `bookRules.test.ts` fails: a hub answer with a proposed, a superseded, a retired rule and a decision gives only the in-force rules; order by `createdAt`, then code number | `features/backlogs/book/bookRules.test.ts` |
| BK6 | Build: the Book's rules | `bookRules.ts` with `inBook(rules)` | `features/backlogs/book/bookRules.ts` |
| BK7 | Red: the list call | `bookClient.test.ts` fails: one `taskmanager_rule_list` with `kind` rule and `status` in_force, no backlog id, no tag; no call when the pre-check says no | `features/backlogs/book/bookClient.test.ts` |
| BK8 | Red: the refs of one rule | `bookClient.test.ts` fails: `refs(code)` returns the `decided_in` issue codes and ids and the file links with `missing`; a refused read gives no refs and no throw | `features/backlogs/book/bookClient.test.ts` |
| BK9 | Build: the Book client | `bookClient.ts`: `rules()` over `RulebookClient.list("all", "rule", ...)` plus `inBook`, and `refs(code)` over `issues` and `files` | `features/backlogs/book/bookClient.ts` |
| BK10 | Red: the queue | `runLimited.test.ts` and `useRefs.test.tsx` fail: at most four rules at once, document order, 25 rules give 25 issue reads and 25 file reads, a failed rule does not stop the others, nothing starts after unmount | `shared/wakala/runLimited.test.ts`, `features/backlogs/book/useRefs.test.tsx` |
| BK11 | Build: the queue and its hook | the generic `runLimited` in `shared/wakala/runLimited.ts`; only `useRefs.ts` is in the Book | `shared/wakala/runLimited.ts`, `features/backlogs/book/useRefs.ts` |
| BK12 | Red: the file target and the files back | the `useFileTarget` test fails: a folder named as the repo gives `filePath(folder.id, path)`; no folder, a refused or failed repository read, or git not mounted give `undefined` (plain text); one repository read for many files. `fileBackTo.test.tsx` fails: `FilePage` and `WideFiles` go back to the Book and say Book | the hook's own test file, `features/files/fileBackTo.test.tsx` |
| BK13 | Build: the file target and the files back | `fileTarget.ts` with the `FileTarget` type and `noFileTarget`; `useFileTarget` extracted from `rulebook/RecordReferences.tsx` over `mcpFilesClient.folders()` and `filePath` through `features/files/index.ts`; `backTo` support in `FilePage` and `WideFiles`. No `book/fileLink.ts` | `features/backlogs/book/fileTarget.ts`, `features/backlogs/rulebook/RecordReferences.tsx`, `features/files/FilePage.tsx`, `features/files/WideFiles.tsx` |
| BK14 | Red: the words | `words.test.ts` fails: no blank or padded word; `joinWords` for one, two and three; "Read on 25 November 2026" | `features/backlogs/book/words.test.ts` |
| BK15 | Build: the words and the long date | `words.ts` with the table of B6; `longDayWords(date)` in `shared/ui/days.ts` with its test beside it | `features/backlogs/book/words.ts`, `shared/ui/days.ts` |
| BK16 | Red: the paths | `paths.test.ts` fails: `bookPath()` is `/a/<agency>/backlogs/book` and `bookRoutePath` is `book` | `features/backlogs/book/paths.test.ts` |
| BK17 | Build: the paths | `paths.ts` | `features/backlogs/book/paths.ts` |
| BK18 | Red: the screen, phone | `bookPage.test.tsx` fails: the title, the date read, the contents in order, each rule with code, title, reason and refs line, the missing-body and no-refs cases, loading, empty, failed with Try again, contents tap scrolls without a history entry, Came from and file links with back state, no status, tag, note, marker, switch or chat | `features/backlogs/book/bookPage.test.tsx` |
| BK19 | Build: the rule and the contents | `BookRule.tsx` (heading, reason, refs line) and `BookContents.tsx` | `features/backlogs/book/BookRule.tsx`, `BookContents.tsx` |
| BK20 | Build: the screen | `BookPage.tsx` on Shell with `onBack` to the Rules list or the Backlogs list, `useLoad` keyed on the agency, the one article, `useRefs` started once the list is there, the `fileTarget` prop passed to each rule | `features/backlogs/book/BookPage.tsx` |
| BK21 | Red: the style | `bookCss.test.ts` fails: no pixel font size in `book.css`, an `@media print` block that hides the bar, the tab bar and the back link | `features/backlogs/book/bookCss.test.ts` |
| BK22 | Build: the style | `book.css`: reading column of 40rem, `line-height: 1.6`, print block, `rem` only | `features/backlogs/book/book.css` |
| BK23 | Red: the wide window | `bookWide.test.tsx` fails at 1440 x 900: one article, one column no wider than 40rem, contents above the rules | `features/backlogs/book/bookWide.test.tsx` |
| BK24 | Red: the entry button | `rulebookPage.test.tsx` gains cases: the Rules choice shows Book going to `bookPath()` with back state; Decisions and Questions do not; a viewer without `rule.read` has no Rules list and so no button | `features/backlogs/rulebook/rulebookPage.test.tsx` |
| BK25 | Build: the entry button | the Book button in `RulebookPage.tsx` beside the `p.sub.count` line on the Rules choice only: a shared `Button` whose `onClick` calls `navigate(bookPath(), backState(...))` | `features/backlogs/rulebook/RulebookPage.tsx` |
| BK26 | Red: the gate and the route | `bookRoutes.test.tsx` fails: `/backlogs/book` without `rule.read` shows the no-access card and makes no list call; with it the Book opens; it does not open the issues screen; `/backlogs/b1` still does | `features/backlogs/book/bookRoutes.test.tsx` |
| BK27 | Build: the route | the `book` row in `BacklogsRoutes.tsx` before `:backlogId`, with no wrapper (the gate is `guardedRulebook` plus `useMayReadRules`, each page shows `noAccessWords`); `"book"` added to `notBacklogs` in `app/home/lastBacklog.ts`; `book/index.ts` exports the page and the path | `features/backlogs/BacklogsRoutes.tsx`, `features/backlogs/book/index.ts` |
| BK28 | Red: the Book stays clean | `bookClean.test.ts` fails if any file in `features/backlogs/book` imports from `rulebook/notes` or holds a `taskmanager_` tool literal of its own | `features/backlogs/book/bookClean.test.ts` |
| BK29 | The whole check, once | `npm run typecheck` and one `npm test` green, including `layoutRules.test.ts`, `backlogToolNames.test.ts` and the placeholder tests | `code/app` |
| BK30 | Design files in step | `book.html` and `rules.html` marked with the built path; this page and the story board of the backlogs get one row for the Book | `documentation/2. design/` |
| BK31 | One walk, once, after the last component merges | on the live app: open a backlog, Rules, tap Book, read the in-force rules oldest first, follow a Came from issue and a Done right in file and come back; the result in `documentation/4. qa/walk-records/` and a last-run note | `documentation/4. qa/walk-records/` |

### B11. Risks and open questions

- Owner answers recorded: oldest means `created_at`, then code number; a file is shown as a link to the Files screen when a folder matches the repo name, else as plain text; "Came from" lists `decided_in` issues only; the Book button is on the Rules list only.
- Oldest first means creation time here. If the owner later means the date a rule was decided or came into force, the field and the sort change (BK3 to BK6); decisions carry `decided_at` but a rule record does not always.
- 52 calls for 25 rules is bounded and quiet, not cheap. B3 step 5 names the fix (one backend read); the plan does not build around it.
- The Book button shows on the Rules choice only, as answered. If the owner wants it on Decisions and Questions too, one condition changes (BK24, BK25).
- A missing file, or a file with no matching folder, is shown as plain text with no mark. The first build's record screen shows a Not found chip; the paper deliberately does not.
- "Came from" is the `decided_in` issues of a rule. A rule linked only with `applies_to` has no Came from sentence. If that reads as a gap, the owner may ask for `applies_to` too, as a separate sentence.
- A rule body is Markdown (section 2). A body with its own headings would sit inside the rule's section on the paper; rule bodies are one reason paragraph so far, so this is noted and not handled.
- The in-force set depends on rules being loaded: the baseline rules of `projects/hub-steward-swe/documentation/1. requirements/baseline-rules.md` are candidates and nothing in that page is loaded into the store until the owner confirms. A Book with no rule in force shows the empty line.
- The sibling pin risk of section 7 applies unchanged: on a clone whose `code/wakala-api` does not list the rule tools, the Book fails with unknown tool and shows the failure card.
- No external web address of a repo exists in the hub, so a rule's file opens in the app's own Files screen, not on a code host. If the owner wants a code-host link, the repository record needs a remote address first.
