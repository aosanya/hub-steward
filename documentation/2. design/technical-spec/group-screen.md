# Group screen

Design for ISS-177. It follows the owner's decisions D26, D27, D28, D32, D33, D34 and D35 of 2026-11-24 (ISS-174). Nothing here is built, and three of its choices wait for the owner (section 4).

A person acts with only the roles of the group they have assumed, and that group's tags decide which rows they reach. A person who has not assumed a group reaches no rows. Groups and their tags are created after publish. This page is the screen that lets a person with several groups assume one.

The drawings are [the phone app](../mockups/app/home/group.html), [the console sign-in step](../mockups/console/entry/group.html) and [the console header](../mockups/console/status/group-switcher.html).

## 1. The states

| # | State | What the person sees | Open point |
|---|---|---|---|
| 1 | Several groups, last choice remembered | One row or card for each group, with its roles and its tags. The group used last comes first, is drawn selected and carries Last used. One tap on a group assumes it and opens the hub. | Whether the choice is remembered |
| 2 | Several groups, nothing remembered | The same list with nothing selected. The first login, and every login if the choice is not remembered. | Whether the choice is remembered |
| 3 | One group | No screen. The hub opens on its first page with that group assumed, and the header names it. | Whether a person with one group skips the screen |
| 4 | Several groups, signed in | The header names the assumed group and offers a switch: Switch group in the phone app's bar, a control beside the language box in the console's header strip. | |
| 5 | Switching | The list again, with the assumed group first and marked Current. One tap on another group assumes it and returns to the page the person was on. | |
| 6 | No group | A plain message that names the hub administrator and asks the person to ask them for a group, and a Check again button. No other page opens. | What the person sees when no group is assigned |

The switch is drawn only for a person with two or more groups. The screen has no menu and no tab bar, because nothing can be opened before a group is assumed.

## 2. Where the assumed group lives

| Question | Design |
|---|---|
| Where the app and console keep it | With the sign-in session, in the browser tab, beside the token that `code/app/src/shared/wakala/token.ts` keeps. Signing out forgets it |
| How the hub reads it | The client sends the assumed group's id on every request. The hub checks that the caller holds a seat in that group (D34), then takes the group's roles for the permission check and the group's tags for the row check (D28). A request with no group, or a group the caller does not hold, reaches no rows (D32) |
| Where the remembered choice lives | Not decided. It is read only when the answer to the first open question is yes |

## 3. What the screen reads

`actor_list_my_groups` lists the person's groups. It does not return a group's tags or the person's roles in it, because neither exists yet: tags and groups are created after publish (D24, D35). The screen needs one list call that returns, for each group, its name, its tags and the roles the person holds in it.

## 4. Open points, to be asked

The three questions of todo 1 of ISS-177 are not answered. The drawings and this page show the recommended answer and mark each in the mockups as "Open, to be asked".

| Question | Recommended | If the answer is different |
|---|---|---|
| Does a person with a single group skip the screen? | Yes: state 3 | Every login shows the list, with one entry |
| Is the last choice remembered between logins? | Yes, preselected and still shown: state 1 | State 2 is the only screen |
| What does a person with no group see? | A plain message naming the hub administrator: state 6 | To be drawn |

Further points the drawings force, not yet put to the owner:

- Whether a person with no group reaches any page at all, or only the message (state 6 draws only the message).
- Whether a switch counts as a choice, so the new group becomes the remembered one.
- Whether the header names the group of a person with one group (state 3 draws it).
- Which person the message names: the hub administrator (state 6) or the owner, and what the hub does when no one holds that role.
- Where the remembered choice is stored: with the browser, or with the person on the hub.

## 5. Build issues

None is filed. When the three answers are in, the work splits as follows.

| Part | Work |
|---|---|
| Hub | A list call returning each group with its tags and the person's roles in it; the assumed group's id read on every request, with the seat check of section 2 |
| Phone app | The group screen, the Switch group action in the bar, the no-group screen |
| Console | The group step after sign-in, the group control in the header strip, the no-group screen |
| Remembered choice | Storage and the preselect, only if the answer is yes |
