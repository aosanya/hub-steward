# Tag management

Design for ISS-176 (TD-6018, TD-6019). It follows the owner's decisions D19 to D35 on ISS-174. The stores and routes of section 6 are built (ISS-187), and so is the tag-management permission (ISS-202, D60); the screens are not. Q3 is answered by D53 and Q2 by D60. Q1 is still open, so it is shown as `Open, to be asked` and the mockup draws the recommended option.

| Built | Planned |
|---|---|
| The tag and group tag stores, the system tag `all`, and the routes to list, create, rename, delete, give and take off a tag (ISS-187), and the `tag.manage` permission that guards create, rename and delete (ISS-202). See [Tags](../../3.%20implementation/guides/tags.md) | The screens, the row tags (ISS-186) and the rest of section 6 |

Drawn in [people/tags.html](../mockups/console/people/tags.html) (9 screens), [people/group-detail.html](../mockups/console/people/group-detail.html) (screens 8 to 12) and [entry/group-pick.html](../mockups/console/entry/group-pick.html) (3 screens). The screens are the console's list page and detail page: one folded card for each item, a search, one primary button, and an empty state that is a card with its button inside. The screen where a person picks the group to assume is designed on [Group screen](group-screen.md).

## 1. What is decided

| # | Decision | Source |
|---|---|---|
| 1 | The system tag `all` always exists and reaches every row; the field codes of a role still limit what is seen | D23 |
| 2 | Every other tag is created and managed after publish; the agency file carries no tag | D24 |
| 3 | A group carries tags and roles; a person is put in groups | D25, D33 |
| 4 | A row takes the tags of the group the person has assumed at the moment it is added; afterwards only someone holding the add code of that record adds a further tag | D26, D27 |
| 5 | A person reaches a row when the row and the assumed group share at least one tag | D28 |
| 6 | A person with no assumed group, or whose group has no tag, reaches no rows | D32 |
| 7 | A role seat names the person, the role and the group; groups are created after publish, so an imported seat has no group until an administrator sets it up | D34, D35 |
| 8 | A person who assumes a group acts with only that group's roles | D33 |
| 9 | Any group administrator may give `all` to a group, with or without other tags | D48 |
| 10 | A tag cannot be deleted while any row or group carries it | D53 |

## 2. The three questions, answered

| # | Question | Owner's answer, 2026-11-24 | Drawn |
|---|---|---|---|
| Q1 | Where the tag list lives | Open, to be asked: user management, group management, or both | Group management. Tags are a tab of Groups, beside the Groups list (mockup screens 1 and 2). A tag exists to be given to a group, and a group card shows its tags (group-detail screens 8 to 10), so one page owns the list and no second list can drift. Users does not get a tag page: a person reaches tags only through a group |
| Q2 | Who may create or rename a tag | Answered, D60: creating, renaming and deleting a tag needs its own permission that a role can carry, separate from group administration. Built as `tag.manage` (ISS-202) | Only a role that carries a tag-management permission. A person without it sees the list and counts and no Create a tag button, no Rename, no Delete (screen 9). Other roles are not given it by default |
| Q3 | What deleting a tag does to the rows that carry it | Answered, D53: a tag cannot be deleted while any row or group carries it | Deleting is refused while a group or a row still carries the tag; the refusal names the count (screen 6). Only a tag nothing carries can be deleted (screen 7). `all` can never be deleted or renamed (screen 8) |

Why the answer to Q3 is the safe one: a row that loses its only tag is reachable only through `all` (D27), so a delete that cleared tags would hide rows from every group at once. Refusing keeps that from happening by a click. The cost is that a person must take the tag off its groups first; the tag page lists them.

## 3. The screens

| Screen | Where | What it shows |
|---|---|---|
| Groups with a tab bar | Groups, tab Groups | The built list, with a tab bar above it. The only change to the built page |
| The Tags tab | Groups, tab Tags | One folded card for each tag, a search, the primary button Create a tag. `all` shows a System tag in place of Edit. An opened card shows its groups and its row count |
| Create a tag | Tags tab | A form with one required Name |
| One tag | Tag page | The groups that carry it, with their member counts, and for each record the number of rows that carry it. Rename and Delete in the title row's Actions menu |
| Rename | Tag page | The name field filled in. Rows and groups keep the tag |
| Delete refused | Tag page | A line under the title row: the tag was not deleted and what still carries it |
| An unused tag | Tag page | Both cards empty; Delete is allowed |
| The system tag | Tag page | Groups that carry `all`; no Rename, no Delete |
| Without the permission | Tags tab | The list and counts only |
| A group's tags and roles | Group detail | A Tags card (each tag, its row count, Take off, Give a tag) and a Roles card (each role and who holds it in this group). A group with no tag shows an empty card that says its members reach no rows. The Group card carries a Group enabled switch beside Change join mode and a Status line, Enabled or Disabled, read from `GET /disabled-groups`; the card of each group on the Groups list shows the same Status line. Switching it off calls `POST /groups/{groupID}/disable` and on calls `POST /groups/{groupID}/enable`, then the page reads `GET /disabled-groups` again. A person the route refuses sees a line at the top saying the group was not changed, and the switch stays where it was. A disabled group keeps its tags and seats (D54; routes in [the assumed group of a login session](assumed-group-session.md), section 7). Drawn in group-detail screens 1, 8, 11 and 12 and groups screens 2 and 4 |
| The group picker | After sign-in | One card for each group the person is in, with its tags and the roles held in it; an empty card for a person in no group; a card marked No tag. The screen itself is ISS-177. The routes it calls, the list of groups and the choice, are in [the assumed group of a login session](assumed-group-session.md) and the [API guide](../../3.%20implementation/guides/api-server.md) |

## 4. The data it keeps

| Thing | Fields | Rule |
|---|---|---|
| Tag | id, instance, name, system | Name is unique in the Instance and is the tag's only definition. `all` is created with the Instance and has `system` set. A row and a group hold the tag's id, so a rename moves nothing |
| Group tag | group id, tag id | A group may carry any number of tags, `all` included. Giving a tag a second time changes nothing |
| Row tag | row id, tag id | Written when the row is added, from the assumed group's tags. Added to afterwards by add only (D27). Never removed by this page |

All of it lives in the Instance's database, written after publish, and none of it is in the publication or the agency file (D24).

## 5. The permissions that guard it

| Action | Guard | Status |
|---|---|---|
| See the Tags tab and counts | Whoever may see Groups | Not asked; follows Groups |
| Create, rename, delete a tag | The permission `tag.manage`, carried by a role. The owner passes; a seated agent or a resident needs a role that carries it and is refused with 403 naming it | Built (ISS-202, D60) |
| Give a tag to a group, take one off, list tags | The same guard as group administration (D48): `tagsAsAdministrator`, the owner of the Instance. `tag.manage` does not open them | Built so |
| Add a tag to a row | The add code of that record, `record.<code>.add` | Decided (D27); not done on this page |

## 6. The issues it needs

To be filed after the owner has read this page; none exists yet.

| Work | Where |
|---|---|
| The tag and group tag stores, with `all` created with the Instance | Hub. Built (ISS-187) |
| The row tag store | Hub and its sibling (ISS-186). The delete check reads it through `agencies.WithTagRowCounter` |
| Routes to create, rename, delete, list, give and take off a tag, refusing a delete that a group or row still carries | Hub. Built (ISS-187). Tools for the agent are not built |
| The tag-management permission in the permission catalogue | Sibling and hub. Built (ISS-202): the entry is in the sibling, the guard in the hub |
| The Tags tab, the tag page and the group's Tags and Roles cards | Console |
| Rows take the assumed group's tags when added | Hub; with the record-permissions row check of [Record permissions](record-permissions.md) |
| The group picker at login | ISS-177 |
| The cleanup that tags existing rows so test data stays reachable | ISS-175 |

## 7. Not decided here

| Point | Why it is not decided |
|---|---|
| The three questions of section 2 | Q2 and Q3 answered; Q1 is still to be asked |
| Who may give a tag to a group or take one off | The recommended answer is the same permission as Create a tag, but the owner has not been asked; it may belong to group management instead |
| Taking a tag off a group that rows still carry | Allowed in the drawing, with the row count shown; the rows keep the tag and the group's members stop reaching them. Not asked |
| Who may see the Tags tab | Drawn as whoever may see Groups |
| Where a group is given its roles | The Roles card shows them; D33 and D34 do not say which page gives them |
| Whether `all` may be given to any group | Decided, D48: any group administrator may, with or without other tags. The route has no special case for `all` |

## 8. The permission, found and named (ISS-202, D60)

The owner decided (D60) that creating, renaming and deleting a tag needs a permission of its own, separate from group administration, and that giving a tag to a group stays with any group administrator (D48). This section records what was found and the name proposed.

| Thing | Where it is today |
|---|---|
| The permission catalogue | `models/permissions_catalog.json` of the sibling `mwanachama-backend-agency`, read through `agencymodels.PermissionCatalog()` and `LookupPermission`. Each entry has a `code`, a `name`, `locked`, an optional `module` and the `actions` it carries. The role page and `agency_list_permissions` list this catalogue; a role holds codes, and `permissionsAllow` turns held codes into allowed actions |
| How a route checks a code | `admittedHoldingAction` (`group_role_access.go`) for a resident, `callerHoldsAction` (`mcp_tools_audit.go`) for a seated agent, and the owner always passes. A refusal is `permissionRefusal`, which wraps `dispatch.ErrForbidden` and names the permission, so the route answers 403 |
| The stand-in guard (replaced for create, rename and delete by `tagsAsManager`) | `tagsAsAdministrator` in `internal/api/http/tag_routes.go` calls `groupRolesAsOwner`: the owner only, a seated agent gets 403 and a resident gets 404. Every tag route goes through it |

Proposed and recorded here:

| Item | Value |
|---|---|
| Permission code | `tag.manage`. The catalogue names its permissions as a singular noun and a verb (`group.manage`, `backlog.manage`, `board.manage`, `asset.manage`), so the plural of the issue's example, `tags.manage`, is not used |
| Permission name | Create, rename and delete a tag |
| Actions it carries | `instance.tag.create`, `instance.tag.rename`, `instance.tag.delete`. They are named as `instance.mount.list` is: the hub serves them itself, so no operations file of a service declares them |
| Not carried | Giving a tag to a group and taking one off, and listing tags. They keep the guard of group administration (D48) |
| Held by default | No role. The owner passes every check, as for every other code |

Where the catalogue entry lives: the catalogue is in the sibling, which the hub imports at a tag. The entry is a one-line change in the sibling's `permissions_catalog.json` (with a row in its `role-permissions.md`), so the hub takes it with the next sibling release and its `go.mod` bump. A hub that still pins an older sibling has no `tag.manage` to give a role, and only the owner administers tags there.

Built (ISS-202): `tagsAsManager` in `tag_routes.go` guards the create, rename and delete routes with the three actions; `tagsAsAdministrator` stays on the list, give and take routes. A person with no seat in the Instance still gets 404.

## 9. Where rows are counted for the delete check (ISS-233, D53)

| Thing | Where it is today |
|---|---|
| The hook | `agencies.WithTagRowCounter` in `internal/agencies/tags.go` sets `registry.tagRows`. `DeleteTag` calls it through `rowsCarrying`, which answers 0 when no counter is set, and does so before the transaction that counts the groups and deletes |
| The wiring | `cmd/server/main.go` builds the shared registry and the account router without it, so no running server counts rows |
| Where rows are listed | The sibling's `ListRecordRows(ctx, draftID, RecordRowFilter{Tags: ...})` reads one draft. `draftsOfEveryPublication` in `record_rows.go` names the draft of every publication; the lineage and owner readers already walk them the same way |
| Retired and replaced rows | `IncludeRetired` and `IncludeReturned` bring in the rows a Delete workflow retired and the rows a replacing row corrected, so the count covers current and history rows |
| What is built | `apihttp.TagRowCounter` counts, over every publication's draft, the rows carrying the tag id, and main and the account router plug it in. The count runs inside the delete transaction through the registry, so the groups and the delete share one transaction and the row count is read after it begins |
