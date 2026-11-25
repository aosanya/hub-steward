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
