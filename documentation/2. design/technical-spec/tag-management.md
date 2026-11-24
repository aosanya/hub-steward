# Tag management

Design for ISS-176 (TD-6018, TD-6019). It follows the owner's decisions D19 to D35 on ISS-174. Nothing here is built yet. The owner answered the three questions of TD-6017 on 2026-11-24 and took the recommended option each time, so each is recorded below as answered and the mockup draws it.

| Built | Planned |
|---|---|
| Nothing. Groups exist, tags do not | The screens and data below, and the build issues of section 6 |

Drawn in [people/tags.html](../mockups/console/people/tags.html) (9 screens), [people/group-detail.html](../mockups/console/people/group-detail.html) (screens 8 to 10) and [entry/group-pick.html](../mockups/console/entry/group-pick.html) (3 screens). The screens are the console's list page and detail page: one folded card for each item, a search, one primary button, and an empty state that is a card with its button inside. The screen where a person picks the group to assume is designed on [Group screen](group-screen.md).

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

## 2. The three questions, answered

| # | Question | Owner's answer, 2026-11-24 | Drawn |
|---|---|---|---|
| Q1 | Where the tag list lives | Group management only | Group management. Tags are a tab of Groups, beside the Groups list (mockup screens 1 and 2). A tag exists to be given to a group, and a group card shows its tags (group-detail screens 8 to 10), so one page owns the list and no second list can drift. Users does not get a tag page: a person reaches tags only through a group |
| Q2 | Who may create or rename a tag | Only a role that carries a tag-management permission | Only a role that carries a tag-management permission. A person without it sees the list and counts and no Create a tag button, no Rename, no Delete (screen 9). Other roles are not given it by default |
| Q3 | What deleting a tag does to the rows that carry it | Refused while anything carries it | Deleting is refused while a group or a row still carries the tag; the refusal names the count (screen 6). Only a tag nothing carries can be deleted (screen 7). `all` can never be deleted or renamed (screen 8) |

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
| A group's tags and roles | Group detail | A Tags card (each tag, its row count, Take off, Give a tag) and a Roles card (each role and who holds it in this group). A group with no tag shows an empty card that says its members reach no rows |
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
| Create, rename, delete a tag | A tag-management permission carried by a role | Answered (Q2). The code name is not chosen |
| Give a tag to a group, take one off | The same permission, drawn so | Not asked, see section 7 |
| Add a tag to a row | The add code of that record, `record.<code>.add` | Decided (D27); not done on this page |

## 6. The issues it needs

To be filed after the owner has read this page; none exists yet.

| Work | Where |
|---|---|
| The tag, group tag and row tag stores, with `all` created with the Instance | Hub and its sibling |
| Tools to create, rename, delete, list, give and take off a tag, refusing a delete that a group or row still carries | Hub |
| The tag-management permission in the permission catalogue | Sibling and hub |
| The Tags tab, the tag page and the group's Tags and Roles cards | Console |
| Rows take the assumed group's tags when added | Hub; with the record-permissions row check of [Record permissions](record-permissions.md) |
| The group picker at login | ISS-177 |
| The cleanup that tags existing rows so test data stays reachable | ISS-175 |

## 7. Not decided here

| Point | Why it is not decided |
|---|---|
| The three questions of section 2 | Answered 2026-11-24 |
| Who may give a tag to a group or take one off | The recommended answer is the same permission as Create a tag, but the owner has not been asked; it may belong to group management instead |
| Taking a tag off a group that rows still carry | Allowed in the drawing, with the row count shown; the rows keep the tag and the group's members stop reaching them. Not asked |
| Who may see the Tags tab | Drawn as whoever may see Groups |
| Where a group is given its roles | The Roles card shows them; D33 and D34 do not say which page gives them |
| The name and code of the tag-management permission | Depends on Q2 |
| Whether `all` may be given to any group | D23 says it reaches every row; who may give it is not said |
