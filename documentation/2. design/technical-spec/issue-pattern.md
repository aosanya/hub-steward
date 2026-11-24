# Issue pattern

How an issue on the Sprint 1 board is written, so that the repetitive work reads the same in every issue. ISS-194 to ISS-198 already follow it. The decision codes (D1 and up) are the owner's answers on the notes of ISS-174.

## 1. Title

`<Where>: <the outcome in plain words> (D<n>)`

| Part | Rule |
|---|---|
| Where | One of Sibling, Hub, Console, App, IAS, QA, Design, Cleanup |
| Outcome | What is true when the issue is done, in plain words |
| (D<n>) | The decision codes in brackets. A code goes in only when the issue's own text or a note of ISS-174 ties it to the issue. A question still open stays out of the title and in the description |

## 2. Tags

Exactly `sprint 1` (lowercase), `hub-steward-swe` and `permissions`, plus one area tag: agency, hub, console, app, frankfurt-school-ias, and so on. A patch replaces the whole tag list, so the full list is always sent.

## 3. Description

Four labelled parts, in this order. Other facts keep their own label (API, Waits for, Worktree, Open owner question) and sit between Design and Output.

| Label | Holds |
|---|---|
| Decision | The owner's decision and its codes, in one or two sentences |
| Design | The design page and the mockup paths, relative to the repo |
| Output | What the issue leaves behind |
| Done when | The check that says it is finished |

An open owner question stays in the description under its own label until the owner answers it.

## 4. Todos of a build issue

Four todos, in this order. Each has instructions and a description that starts with `Output:` and holds `Done when:`.

| # | Title | Waits on | What it is |
|---|---|---|---|
| 1 | Inventory: <what is listed> | nothing | Where the change goes. A note or a page section. No code change |
| 2 | Red tests: <what they prove> | 1 | Tests that fail for the right reason, run and seen to fail |
| 3 | Build: <what is built> | 2 | The change. The red tests pass |
| 4 | Update the page | 3 | The design page changed in the same commit as the code |

An issue with more than one red or build step numbers them in between; a step that is not one of these (an owner question, a run on QA, a tag and push, a merge) keeps its own title.

## 5. Conversion issues

An issue that converts an agency file or a test file from the records' role fields to record permissions is a conversion issue. The ones of Sprint 1 are the IAS file, the law firm, the municipality, MAIIC, the hub's demo templates, the sibling's hub-demo test files and the wakala-api farmers agency (ISS-161, ISS-166 to ISS-171). They share the wording below. An issue points here and states only what differs: its files, its counts, its holders and its open owner questions.

### 5.1 Todos

The same four todos in every conversion issue, with only the file names differing.

| # | Title | Output | Done when |
|---|---|---|---|
| 1 | Inventory the file: <file> | A table of record, the role that holds it today and the codes it gets (add.*, edit.*, view.*, delete), and the role assignments counted by label, in the repo's documentation/2. design | It covers every record and every role of the file |
| 2 | Red test of the converted file: <file> | A failing test in the repo's tests | It fails because the file still has the role fields and no record permissions |
| 3 | Convert: <file> | The change in the file and its copies | The red test is green |
| 4 | Update the inventory page | The repo's design pages | No page says a record has an Add, Edit, Delete or Viewer role |

The red test asserts: no record has role_id, edit_role_id, delete_role_id or viewer_role_id; each role carries exactly the star codes of the table and names no field; no role has the key powers; the file has no groups or tags key; a copy equals its original. It does not assert that a role which adds also views (D44).

### 5.2 The change

- Part of the record permissions work: decisions D1 and D6, the design page [record-permissions.md](record-permissions.md), the inventory of files [record-permissions-file-inventory.md](record-permissions-file-inventory.md) (ISS-162), and the method of ISS-161.
- A record loses role_id. The role that held it carries the star forms of the record in its permissions list: `record.<code>.add.*`, `.edit.*`, `.view.*` and `record.<code>.delete` (D20, D21, D30, D36). Where edit_role_id, delete_role_id and viewer_role_id are empty, the holder had all four.
- No role names a field, so no field code (ISS-178) is written into a role.
- A role that still carries the key powers is renamed to permissions.
- RACI (D39, D49): one plain accountable role on each step; the responsible, consulted and informed labels and the labels on objectives are dropped. Each issue states its own counts.
- The file carries no group, tag or seat (D24, D35). Groups and tags are made after the publish.
- The scan checks two things about record permissions (D51): a record no role may add to, and a required field that no role holds an add code for. The done-when reads the scan as it stands when the issue starts.
- Done when a red test over the files passes, the files import, the scan finds nothing, and the design pages say who may do what.

### 5.3 Where the working tree is shared

When other sessions have changes in the repo's working tree: run `git worktree list` (and `git status`), touch nothing that is there, work in a new worktree off the repo's main branch on a branch of the issue, merge, then remove the worktree and the branch. A push or a tag needs the owner's yes.
