# Group screen

Design for ISS-177. It follows the owner's decisions D26, D27, D28, D32, D33, D34, D35 and D40 to D42 of 2026-11-24 (ISS-174). Nothing here is built, and two of its choices wait for the owner (section 4).

A person acts with only the roles of the group they have assumed, and that group's tags decide which rows they reach. The roles come only from the seats the person holds in that group (D42). A person who has not assumed a group reaches no rows. Groups and their tags are created after publish ([tag management](tag-management.md)). This page is the screen that lets a person with several groups assume one.

The assumed group belongs to one login session, not to the person (D40). Each login asks again, nothing is remembered between logins, and a phone and a laptop may act as different groups at once.

The drawings are [the phone app](../mockups/app/home/group.html), [the console's group screen](../mockups/console/entry/group-pick.html) and [the console header](../mockups/console/status/group-switcher.html).

## 1. The states

| # | State | What the person sees | Open point |
|---|---|---|---|
| 1 | Several groups | One row or card for each group, with its roles and its tags. Nothing is selected. One tap on a group assumes it for this login and opens the hub | |
| 2 | Several groups, with a hint | The same list with the group used last time marked. A hint only: the person still taps a group | Whether the screen hints at all |
| 3 | One group | No screen. The hub opens on its first page with that group assumed, and the header names it | Whether a person with one group skips the screen |
| 4 | Several groups, signed in | The header names the assumed group and offers a switch: Switch group in the phone app's bar, a control beside the language box in the console's header strip | |
| 5 | Switching | The list again, with the assumed group first and marked Current. One tap on another group assumes it and returns to the page the person was on. The first group's roles stop counting at once | |
| 6 | No group | A plain message that names the hub administrator, and a Check again button. No other page opens | Whom the message names |
| 7 | A group with no tag | The card says No tag, because the person would reach no rows in it (D32). Drawn in the console's group screen, screen 3 | |

The switch is drawn only for a person with two or more groups. The screen has no menu and no tab bar, because nothing can be opened before a group is assumed.

An API key or an AI agent account never meets this screen. Its key session starts with no group and the agent assumes one of its own groups through the same routes a person uses (D57), with that group's roles and tags.

## 2. Where the assumed group lives

| Question | Design |
|---|---|
| What names the group | The login session names only the person (D40). The hub keeps the choice keyed by session and Instance, and drops it when the session ends. D40 marks this mechanism as to be confirmed |
| How the hub reads it | On each request the hub looks up the session's choice, checks that the caller holds a seat in that group (D34), then takes the group's seats for the permission check and the group's tags for the row check (D28). A session with no choice, or a choice the caller no longer holds, reaches no rows (D32) |
| A key or an agent | The group is a field of the key, set by an administrator. The hub reads it in place of the session's choice |
| The hint | If screen 2 is kept, the app and console keep the last group's id in the browser. It is never read by the hub |

## 3. What the screen reads

`actor_list_my_groups` lists the person's groups. It does not return a group's tags or the person's roles in it, because neither exists yet: tags and groups are created after publish (D24, D35). The screen needs one list call that returns, for each group, its name, its tags and the roles the person holds in it, and one call that sets the session's group.

## 4. Open points, to be asked

The three questions of todo 1 of ISS-177 are not answered. The drawings and this page show the recommended answer and mark each point in the mockups as "Open, to be asked". D40 settles that the choice is not remembered between logins, so the second question is now whether the screen hints at the last group.

| Question | Recommended | If the answer is different |
|---|---|---|
| Does a person with a single group skip the screen? | Yes: state 3 | Every login shows the list, with one entry |
| Is the last choice remembered between logins? | No, by D40; at most a hint (state 2). Screen 1 is drawn as the base | Whether the hint is worth showing |
| What does a person with no group see? | A plain message naming the hub administrator: state 6 | To be drawn |

Further points the drawings force, not yet put to the owner:

- Whom the no-group message names: the hub administrator (drawn) or the owner, and what the hub does when no one holds that role.
- Whether a person with no group reaches any page at all, or only the message (state 6 draws only the message).
- Whether the header names the group of a person with one group (state 3 draws it).
- Where the hint is kept, if there is one: with the browser (drawn) or with the person on the hub, which D40 argues against.
- How an administrator sets a key's group, and what happens to a key whose group is deleted. That is the key page's design, not this screen's.

## 5. Build issues

None is filed. When the answers are in, the work splits as follows.

| Part | Work |
|---|---|
| Hub | A list call returning each group with its tags and the person's roles in it; a call that sets the session's group; the session's group read on every request with the seat check of section 2; a group field on a key |
| Phone app | The group screen, the Switch group action in the bar, the no-group screen |
| Console | The group step after sign-in, the group control in the header strip, the no-group screen |
| Hint | Only if the answer is yes: storage and the marking |

## 6. App

Planned for ISS-198. All paths are under `code/app/src/`. The phone app talks to the hub for these screens over the HTTP routes of [the assumed group of a login session](assumed-group-session.md) (`GET my-groups`, `GET my-group`, `PUT my-group`), not over MCP: `actor_list_my_groups` returns only an id and a name, and no MCP tool assumes a group.

| What | Where it is today | Change |
|---|---|---|
| Login landing | `app/App.tsx`: sign-in goes to `/agencies` (`features/entry/AgenciesPage.tsx`), which opens `agencyHomePath` for a single agency or on a tap. Everything of an agency sits under the route `/a/:agencyId` wrapped in `InAgency` and `ConsentGate` | A `GroupGate` (`features/groups/GroupGate.tsx`) wraps those two, so the group is settled before consent and before any page reads a row. It checks `GET my-groups` once for each agency, then lets the page through, shows the group list, or shows the no-group message |
| The bar | `app/TopBar.tsx`, drawn by `app/Shell.tsx` for every screen. The agency name comes from `shared/wakala/openAgency.ts` (`openAgencyName`, `subscribeAgencyName`) | `TopBar` reads the assumed group from a new store and writes `Agency · Group` in the agency line. A top-level bar (no back link) of a person with two or more groups also draws Switch group beside the menu button |
| Where the session is read | `shared/wakala/me.ts` (`checkSession`, `endSession`), `features/entry/SessionGate.tsx`, `features/account/signOut.ts`. The hub keeps the choice for the session, so the app keeps only a copy in memory | New `shared/wakala/assumedGroup.ts`: the assumed group's id and name and the number of groups, kept for the open agency and never written to storage (D40). `signOut` clears it |
| The calls | `features/entry/api.ts` (`wakalaFetch`, the injectable `entryClient`), the pattern of `features/groups/api.ts` | New `features/groups/assumedApi.ts`: `readMyGroups` and `assumeGroup` behind an injectable client |
| The screens | none | `features/groups/GroupList.tsx` (the shared rows), `ChooseGroupPage.tsx`, `SwitchGroupPage.tsx` at `/a/:agencyId/group` (`groupsPaths.switchGroup` in `features/groups/routePaths.ts`) and `NoGroupPage.tsx` |
| Words | `shared/language/words.ts`, `swahili.ts`, `magyar.ts` | New `group*` keys in the three files the app has |
| The one-group case | none | The gate assumes the only group itself (D45) and shows no screen |

Choices made while planning, each with its alternative:

- The gate lets the request through when the hub does not answer 200, so an older hub or a dropped connection does not lock the app. The hub decides which rows a group reaches (see section 2).
- Tapping a group in the Switch group screen returns to the page the person was on, as state 5 says. The drawing's back label reads Home.
- The list shows the roles of each group as its second line and draws no tags, because `GET my-groups` returns `id`, `name` and `roles` only (section 3).
- The no-group message names the hub administrator by role, not by a person: no app or hub route tells a person with no seat who holds that role.

