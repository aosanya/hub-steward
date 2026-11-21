# An agency declares its own Home (ISS-105)

Status: design revised 2026-11-20 after an independent review; uncommitted on branches. Built and tested: the agency backend (section 11), the hub tool `agency_get_home` and the hub file import check of `home`, and the template publish script refusal. Not built: the app, the code-or-name references, the hub import check of `ref`, `step` and `page_of` (section 11).

## The problem in plain words

The phone app's Home is drawn from fixed parts: Start, Ongoing, Backlogs and Files from `app/home/HomeOptions.tsx`, then nine fixed sections (People, Places & Addresses, Issues & Requests, Services & Permits, Assets & Works, Decisions, Staff & Departments, Finance, Settings) from `app/menu/sections.ts` and `sectionHeads.ts`. `sectionsFor` shows none of the sections, Settings included, unless at least one section whose module is on exists, which is why an agency of its own records and workflows has an almost empty Home. The municipality's Home reaches every one of its features. This page lets any agency do the same by declaring its Home in its own file, as a tree, including a page of its own for each row of a record (a project, a matter, a work package).

## 1. What an agency declares

An agency file may carry a top-level `home`: a list of nodes in the order a person should see them. A node is one of three kinds:

- A section: it has `entries`, a list of nodes. Opening it shows its listed nodes as rows. It has no target.
- An entry: it has a `target`. Opening it goes to the target. It has no `entries`.
- A row page: a section with `page_of`. It is not listed. It is what opens when a person taps a row of that record (section 3).

Sections nest, sections and entries mixed, in the declared order. An empty section is valid; it is never shown. Example, three levels deep, with a page per project:

```json
"home": [
  {
    "key": "deliver", "title": "Deliver work", "icon": "folder", "titles": { "sw": "Kazi" },
    "entries": [
      { "key": "projects", "title": "Projects", "roles": ["R-3", "R-4"],
        "target": { "type": "record", "ref": "RC-4" } },
      {
        "key": "project-page", "title": "Project", "page_of": "RC-4",
        "entries": [
          { "key": "days", "title": "Days worked",
            "target": { "type": "record", "ref": "RC-6",
                        "where": [ { "question": "Project", "operator": "is", "value": { "row": "Project title" } } ] } },
          { "key": "report", "title": "Progress report",
            "target": { "type": "workflow", "ref": "W-7", "step": "WI-48", "scope": "row.order" } }
        ]
      }
    ]
  },
  { "key": "mine", "title": "My work", "target": { "type": "start" } },
  { "key": "shared", "title": "Files", "target": { "type": "files" } }
]
```

Fields of a node:

| Field | Required | Meaning |
|---|---|---|
| `key` | yes | The node's handle: letters, digits, hyphen and underscore, at most 60. Unique in the whole declaration. A route carries it. |
| `title` | yes | What the row says, at most 80 characters. |
| `titles` | no | The title in other languages, a map of language code to text, at most 80 characters each. A title is matched on the exact code the app holds (`sw`, `hu`, `zh-Hans`); a blank translation is refused. |
| `icon` | no | The name of one of the app's icons. The app draws a name it does not ship as nothing, so the app checks the name against its own set. Only top-level rows draw a mark today, as `MenuRows` does. |
| `permission` | no | A code of the permission catalogue. The catalogue's codes are module-action sets (`task.read`, `accounting.view`). The agencies' own roles carry no permissions, so a node gated by `permission` shows only to the owner and to people whose role does carry that permission. Use `roles` for agency roles. |
| `roles` | no | A list of the agency's role codes (`R-3`). The node shows to a person who holds at least one of them. The owner always sees it. |
| `entries` | section | The section's nodes. |
| `page_of` | section | A record code. Marks the section as the page of one row of that record. |
| `target` | entry | `{ "type", "ref", "step", "scope", "where" }`, below. |

When a node has both `permission` and `roles`, both must hold. A person who holds no agency role sees only nodes with neither. Residents get a Home on the same rule: what they see is decided by the roles `agency_get_my_roles` reports for them.

## 2. Targets

| `type` | `ref` | Opens | Notes |
|---|---|---|---|
| `record` | a record code, such as `RC-4` | The list of the record's rows. Tapping a row opens the row's page (section 3) or, when no section is the page of that record, the generic row page. Add and edit are the generic form. | `where` narrows the list (section 3). Add is offered when the record's `can_add_rows` is true: it is false for a record kept by a workflow step, which is filled by the step. |
| `workflow` | a workflow code, such as `W-7` | The step screen of the person's open item (below). | `step` names one work item code; `scope: "row.order"` is for row pages. |
| `backlog` | the backlog's name or id | The backlog's issue list. | A backlog belongs to the instance's task data, not to the agency file, so the ref cannot be checked at import and does not travel to another instance by id. Prefer the name. |
| `menu` | `<section id>/<item title>` of today's fixed menu, such as `staff/Departments` | That menu item's own screen. | The item shows when its module is on (the item's, else its section's) and, for the people item, its `needs` permission, through one shared check the fixed menu and the declared Home both call. |
| `files` | none | Files. | Shown when Files is mounted. |
| `start` | none | Start, the person's startable steps. | Shown by today's rule: the person holds a workflow. |
| `ongoing` | none | Ongoing, the person's running tasks. | Same rule. |

`start` and `ongoing` exist because the tab bar holds only Home, Chat and Notifications: once an agency declares a Home, today's Start, Ongoing, Backlogs and Files rows are not drawn unless the agency declares them.

Not in the vocabulary yet, because the app has no screen for them: `tasks` (a task-manager project's tasks), `team` (an actor group), `budget`, `bills` and `reports` scoped to a row. They are named here so an agency that needs them waits on the app and not on this declaration; the work is app screens that take a project or group as a parameter, then one more target type each, which is a blueprint change. Until then the matching rows of any such Home are not declarable.

### One rule for a workflow entry

A `workflow` entry shows to a person whose role, in the published definition, holds the workflow's first step, or holds the named `step`. It does not depend on whether work is waiting, so a row does not come and go. Opening it:

- with a `step`, lists the person's open items of that step, and a single one opens at once;
- with no `step`, lists the person's open items of that workflow, as Start rows do today;
- with nothing waiting, opens the start screen when the step is a first step, and otherwise an empty card that says nothing is waiting;
- a workflow that opens in chat goes to chat, and a form step goes to `/steps/:id`, as today.

`agency_get_home` joins `target_name` by workflow code and step code, never by name matching.

## 3. A page for each row of a record

A section with `page_of: "<record code>"` is the page of one row of that record. It is not listed in its parent. Rules:

- One section per record code in a declaration. A page may sit anywhere in the tree and may hold further sections and other row pages.
- A `record` entry for that code opens the list; tapping a row opens the page for that row. The page's first card is the row's own facts (its answers), then the page's listed nodes as rows. A page counts as one level.
- Inside a page, a value may be `{ "row": "<question prompt>" }` in place of a literal: the answer of that question in the tapped row. It is accepted in a `where` value. The nearest enclosing page is the row.
- `where` is a list of at most 5 `{ "question", "operator", "value" }`, every one of which must hold; operators are the live rows tool's: `is`, `is_not`, `contains`, `more_than`, `less_than`, `on_or_before`, `on_or_after`. Add inside a narrowed list prefills the `is` answers.
- A `workflow` target with `scope: "row.order"` opens only that row's own run: the row's `order_id` matches the open item's `order_id`. It is allowed only inside a row page and needs a `step` or a workflow with runs.
- Row placeholders are not checked against the record's questions at import; a prompt the record does not have draws an empty list.

## 4. Who sees what

The app decides, with what it reads once: `agency_get_my_roles` (the person's `permissions` and `roles`, with codes), the modules, the person's open steps, the visible backlogs and whether Files is mounted. One hook, `useMyPermissions`, reads `agency_get_my_roles` once and fails closed. Home draws after the reads settle; if a read fails it shows a retry line, so a node is not dropped silently.

- A node is shown when its `permission` and `roles` hold (section 1; the owner holds every role and permission).
- An entry is shown when its target is shown (section 2).
- A listed section is shown only when at least one listed node under it is shown, at any depth. A row page is never listed.
- Nothing says "not available yet": a declared Home does not draw the fixed menu's unbuilt rows.

## 5. Titles

The app shows `titles[<its language code>]` when the node has it and a non-empty text, and `title` otherwise, whatever the language: the picker offers nine codes, `en`, `sw`, `hu`, `de`, `es` and `fr` have word tables, and a title is matched on the exact code. An empty `titles` text is refused at import and, if one arrives, is treated as missing. Home's own label is the app's word "Home" in the person's language (`homeTab.label`), never declared; the Back label at the top level of a section is that word.

## 5b. The shape on the wire

`agency_get_home` is an MCP tool only, with no REST route, and answers `{ "entries": [ node ] }`. A node is the file's own shape, with the target nested, plus three fields the hub adds on a workflow entry:

```json
{ "entries": [ {
  "key": "report", "title": "Progress report", "titles": { "sw": "Ripoti" }, "icon": "folder",
  "permission": "task.read", "roles": ["R-3"],
  "target": { "type": "workflow", "ref": "W-7", "step": "WI-48", "scope": "row.order" },
  "target_name": "Progress", "workflow_id": "…", "step_id": "…"
} ] }
```

A section has `entries` (and `page_of` on a row page) and no `target`. A record target carries `where` inside `target`: `[ { "question", "operator", "value": "text" | { "row": "prompt" } } ]`. Every field but `key` and `title` is left out when empty. `target_name` is the workflow's name, also when a step is named. `workflow_id` and `step_id` are the ids the open steps of `agency_list_my_open_steps` carry, so the app matches by id and never by name.

The hub drops, before answering: a `record` or `workflow` entry whose target the published version does not hold, a workflow entry whose named `step` is gone, a row page whose record is gone, and a listed section left with nothing, so the app never draws an empty section from a dropped target. A section the app empties by permissions it hides itself.

## 6. Where it lives

1. The agency file's `home` is the declaration. It nests.
2. In the agency backend each node is one row of the draft-scoped object `home_entry`, with `parent_id`, `ordinality` and the fields above. `agency_list_home_entries` reads a draft's rows, `agency_create_home_entry` adds one row, and `agency_set_home` replaces a draft's whole Home with a nested one, which is also the tool for the console and the agency creator. There is no per-row change or remove. File import, the hub's file import, fork from a draft, publish and fork from a publication all carry the rows. The publication's document holds `home` nested, as written. Home changes reach phones only on publish.
3. A file without `home` imports as before. A hub that does not know `home` ignores it silently; the hub built on this sibling does not.
4. The hub serves the published declaration with `agency_get_home`, action `instance.home.read`, in the self-service actions (every seated person and resident may call it), in the tool roster pin. It returns the nested nodes of the latest published version, drops a `record` or `workflow` node whose target that version no longer holds, and returns an empty list when there is no published version or no `home`, so the app can tell an empty declaration from a failure.
5. The hub's own file import (`POST /instances/import`) validates the whole `home`, with `roles` checked against the file's own roles, before it writes anything: a broken `home` refuses the file. The agency-template publish script refuses a file that carries `home` until it can write it.
6. The sibling's tag that carries `home_entry` is cut only after the owner's yes. Until then the hub requires the sibling by a local workspace in tests and by a pseudo-version once committed. The version that decides which permission codes exist is the sibling's: a file that names a permission an older sibling does not know is refused whole.

## 7. Limits and order

A declaration is at most 5 levels deep (Home's rows are level 1), a section holds at most 40 nodes, a declaration at most 300, a `ref` or `step` at most 200 characters. Order is the declared order, among sections and entries alike.

## 8. What the import refuses

A file is refused whole, no half kept, when it breaks a limit, repeats a key, gives a node both `entries` and `target`, names an unknown target type, leaves out a `ref` the target needs, names a permission outside the catalogue, names a role the file does not hold, puts `step` on a non-workflow target, `where` on a non-record target, `scope` outside a row page, `page_of` on an entry, or two row pages for one record.

## 9. A target that is gone

A `record` or `workflow` target the published version no longer holds is dropped by the hub. A `backlog`, `menu` or `files` target that does not exist for this person is dropped by the app. A section left with nothing is hidden. The Issue scan does not report a dangling `ref`; codes are kept through fork and import but a record created later in a draft takes the next free code, so a `ref` written before creation can point at the wrong thing. A deep link to a section key that is hidden or unknown goes to Home.

## 10. What the app draws

- While the declaration loads Home draws the Needs-you strip and a loading line, never the fixed Home. A section key that is unknown or hidden goes to Home (replace). Home's Needs-you strip is drawn with a declaration, with an empty one (today's Home) and with every node hidden. Every row, entry or section, ends in `›`.
- Default icons, for a top-level row without `icon`: a section a folder, `record` a document, `workflow` a play mark, `backlog` a list, `menu` the icon of its fixed section, `files` a folder, `start` a play mark, `ongoing` a clock. Nested rows draw no mark, as the fixed section pages do.
- The components are `AgencyHome` (the Home block, in `app/home/AgencyHome.tsx`, in place of `HomeOptions` and `MenuRows`), `HomeSectionPage` (`app/home/HomeSectionPage.tsx`) and `HomeRecordRows` (`app/home/HomeRecordRows.tsx`, the generic list, page, add and edit of a declared record).
- The fallback: Home is today's Home (Needs-you strip, `HomeOptions`, `MenuRows`) only when the hub returns an empty list. If the call fails, Home shows a failure line with retry and not the fixed Home, so an agency is not shown one Home and then another. The municipality declares nothing and is untouched.
- With a declaration Home is the Needs-you strip and then one row per shown top-level node. A declaration all of whose nodes are hidden for this person shows the strip and an empty card.
- A section opens `/a/{agency}/home/{key}`: its shown nodes as rows, in order. Back goes to the parent section, or Home from a top-level one, taken from the declaration, so it works from a deep link.
- Routes carry the key of the node they open, so they survive a refresh and a link. A section: `/a/{agency}/home/{key}`. A record entry: `/a/{agency}/home/{entryKey}/records/{code}`, where `{entryKey}` is the key of that record entry, top level or not; the entry, found by its key, supplies the `where`, so two entries on one record with different conditions are two lists, and a refresh keeps them. Add is `.../new` and edit `.../{rowId}/edit`; Add prefills the `is` conditions of the entry. A row page: `/a/{agency}/home/{pageKey}/row/{rowId}`; a section inside a page keeps the row: `/a/{agency}/home/{sectionKey}/row/{rowId}`; a record entry inside a page is `.../home/{entryKey}/records/{code}?row={rowId}`, where `row` is the tapped row its `{ "row": … }` values read. A deep link to a `page_of` key without `/row/{rowId}` goes to Home.
- Back: from a section, to its parent section or Home, taken from the declaration. From a record list, to the entry's parent section, or to the row page when `?row` is present. From a row page, to the first shown record entry of its record, and to Home when there is none. From a section inside a page, to its parent with the row kept.
- A record's list title is the first non-empty answer of the row, then the record's name and the row's position (`Projects 3`). The empty card says "Nothing here yet." A record with no questions shows an empty list and no Add.
- The generic record screens read the record's questions from `agency_list_live_records`: the first question is the row's title, the next two its meta line, all of them are on the page, `Status` and `Neighbourhood` are no longer special. The declared path takes the record code as written. It does not go through the fixed code-to-name map the app keeps for the municipality's three registers (`RC-1`, `RC-2`, `RC-3`), because that map would hide Add and mix rows in any other agency whose record has one of those codes.
- Answer types in the add form: `free_text` a text field; `number` and `currency` a number field; `date` and `time` their fields; `yes_no` Yes and No; `single_choice` and `multi_select` choices from the options (a multi-select answer is kept joined with a semicolon and a space); `options_from` `members` a people picker. Not supported at first: `photo`, `file`, `time_range`, `address`. A row page shows their stored answer as text, the add form leaves them out, and Add is not offered for a record that has one of them required.
- A workflow entry shows when the person's open items (`agency_list_my_open_steps`, not the `available` list, which holds only work waiting) include one with the entry's `workflow_id` and, when a step is named, its `step_id`: that list holds every step of a role the person holds, so the row does not come and go. Opening: one waiting item opens it at once, several list, none waiting opens the start screen when the step is a first step and otherwise an empty card "Nothing is waiting."
- When the Home call fails, Home shows "Home could not be loaded." with a Retry button (the app's `LoadFailed` line), not the fixed Home. When the permissions read fails, Home shows "Your permissions could not be read." with Retry and draws no gated node. Both lines are drawn under the Needs-you strip.
- A workflow entry, a backlog entry, a menu entry, a files entry, Start and Ongoing go where today's screens go.

## 11. Built so far, and what is left

Built (uncommitted, in worktrees):

- Agency backend (`mwanachama-backend-agency`): the `home_entry` object, the nested declaration in import, fork, publish and fork from a publication, `agency_create_home_entry`, `agency_list_home_entries`, `agency_set_home`; see its `documentation/2. design/home-entries.md`.
- Hub: `agency_get_home` (`instance.home.read`, self-service, in the roster pin), the whole-file check of `home` in `POST /instances/import` including `roles`, and the writing of the rows.
- The template publish script refuses a file that declares a `home`.

Not built:

- The app: `AgencyHome`, `HomeSectionPage`, `HomeRecordRows`, `useMyPermissions`, the routes above, the answer-type mapping and the fix that keeps the declared record path out of the `RC-1`, `RC-2`, `RC-3` name map.
- Code or name references (below).
- The hub import check of `ref`, `step` and `page_of` against the file: the file's form-step records take derived codes, so the check waits on code-or-name.

### Decided, not built: codes are not stable

Every reference in a `home` is by code today, but a republish through the template script mints new codes for roles, workflows, steps and records, and records derived from form steps take the next free code. Decision: `ref` (for `record` and `workflow`), `step`, `page_of` and `roles` accept a code or a name, matched on the code first. A name that matches nothing or more than one part is refused at import. The names of the parts a Home names must be unique. A `backlog` ref is a name, never an id, because a file cannot hold an id the platform mints later. Until this is built an agency that republishes by that script must not declare a `home`; the script refuses it.

### Accepted limits of the first version

Scoped tasks, team, budget, bills and reports targets; one workflow chosen per row; `scope: "row.order"` matching only the rows made by the workflow's own run; group-by; a record entry that also holds children; one adding role per record; row placeholders and `step` codes are not checked against the record or workflow at import.

Agency backend (`mwanachama-backend-agency`, worktree, uncommitted): see its `documentation/2. design/home-entries.md`. The hub tool, the hub import, the publish script refusal and the app are not built.

## 12. Not decided here

- Editing a single row in the console. `agency_set_home` replaces a draft's whole Home.
- The `tasks`, `team`, `budget`, `bills` and `reports` targets: they wait on app screens (section 2).
- Any one agency's own list of entries: each is its own issue and waits on this one.
