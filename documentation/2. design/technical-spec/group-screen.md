# Group screen

Design for ISS-177. It follows the owner's decisions D26, D27, D28, D32, D33, D34, D35 and D40 to D42 of 2026-11-24 (ISS-174). The console's screen and header control are built (section 6, ISS-197) and the phone app's part is built (section 7, ISS-198); the hub's part is built by ISS-180 and the hub's routes to disable and enable a group are built by ISS-204 (section 1), while the console's toggle is not built. Two of its choices wait for the owner (section 4).

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

A disabled group (D54) is in none of these states as a choice: it is left out of the list, and a person who was logged in as it falls to state 6 (or state 1 when other groups remain) on their next request, because the hub answers no group. Any group administrator may disable or enable a group (D63); the hub's routes and guard are in [the assumed group of a login session](assumed-group-session.md), section 7. Seats and tags stay, so enabling the group brings it back into the list.

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
| Phone app | Built (ISS-198, section 6): the group screen, the Switch group action in the bar, the no-group screen |
| Console | The group step after sign-in, the group control in the header strip, the no-group screen |
| Hint | Only if the answer is yes: storage and the marking |

## 6. Console (ISS-197)

The console is one Vite app in `code/console`. A hub in the console is an Instance of the hub, so the group is chosen for one hub at a time and read from `GET /instances/{hubId}/my-groups`, `GET .../my-group` and `PUT .../my-group` ([assumed-group-session.md](assumed-group-session.md), section 5). Paths below are under `code/console/src/`.

### 6.1 Where login lands and where the header is built

| What | Where | Today |
|---|---|---|
| Login | `entry/SignIn.tsx` | After a good sign-in it calls `startSession` and navigates to `landingPath(hubs)` |
| The landing path | `entry/Gate.tsx`, `landingPath` | The first hub's home page, `/h/{hubId}/{home}`, or `/create` with no hub. `Gate` does the same after the session is restored from the cookie |
| The session | `session.tsx`, `SessionProvider` | Holds `signedIn` and the hubs of the person. It knows no group |
| The route of a hub | `App.tsx`, `/h/:hubId` | Renders `shell/Frame.tsx`. Every page of a hub is a child of this route, so one guard there covers a sign-in, a restored session, a typed address and a hub chosen in the hub switcher |
| The guard's place | `shell/Frame.tsx`, `Frame` | Finds the hub in the session and renders `Shell`. It is where a person with no assumed group is held back |
| The header | `shell/Strip.tsx`, `Strip`, rendered by `Shell` in `Frame.tsx` | Brand, `HubSwitcher`, breadcrumb, and a `strip-end` holding the language box. The group control goes in `strip-end` before the language box, as `console/status/group-switcher.html` draws it |
| The bare screens | `entry/EntryScreen.tsx` | The frame with sign-out and the language box and no menu, used by the hub list. The group screen and the no-group message use it, because nothing can be opened before a group is assumed |
| Server calls | `wakala/rest.ts`, `rest` | One call to the hub's REST address with the session cookie |
| Styles | `design.css` (`.strip`, `.switch`, `.drop`, `.hub`, `.hubs`, `.eyebrow`, `.tag`) | The switch and its drop already exist for the hub switcher. The group control reuses them |
| Words | `public/i18n.json` | Seven languages, checked by `i18nFiles.test.ts` |

### 6.2 What was built

| File | What it does |
|---|---|
| `data/groups.ts` | `listMyGroups(hubId)` over `GET my-groups` and `assumeGroup(hubId, groupId)` over `PUT my-group`, and `rolesOf` |
| `shell/useAssumedGroup.ts` | Reads the groups of one hub and settles the state: none, pick, or ready. A person with one group is assumed by one `PUT`. A choice naming a group the person does not hold reads as no choice |
| `shell/GroupGate.tsx` | The guard. Shows the loading mark, the failure with Try again, the no-group message, the group screen, or the hub. It is keyed by hub, and the hub below it is remounted when the group changes, so every page reads again under the new group |
| `shell/groupContext.ts` | Hands the groups and the assumed one to the header |
| `entry/GroupPick.tsx` | States 1 and 5: one card for each group with its tags and roles, and Continue |
| `entry/NoGroup.tsx` | State 6: the plain message and Check again |
| `shell/GroupSwitcher.tsx` | States 3 and 4 in the header strip: the group named, and for two or more groups a drop with the current group first and marked, and Use on the others |
| `shell/useDrop.ts` | Open, click-away and Escape for a drop, shared by the hub switcher and the group switcher |
| `entry/useLeave.ts` | Sign out and go to the start page, shared by the hub list and the group screens |
| `shell/Frame.tsx`, `shell/Strip.tsx`, `shell/HubSwitcher.tsx`, `entry/Hubs.tsx` | Put the guard around the hub, the control in `strip-end`, and use the shared hooks |
| `design.css` | `.group-drop`, `.hub.only` and the margin of the switch in the strip |
| `public/i18n.json` | Eleven strings in seven languages |
| `test-setup.ts` | Answers every test with one assumed group, so only the group tests see the other states |

Tests: `shell/GroupGate.test.tsx` for the four states and `data/groups.test.ts` for the two calls.

### 6.3 Choices the console makes

| Point | Choice |
|---|---|
| Hint of the last group | Not built. The list is plain, as the open question in section 4 recommends. Nothing is kept in the browser |
| Whom the no-group message names | The hub administrator only. What happens when no one holds that role is still open |
| Profile | The console has no profile page, so the no-group screen offers sign-out, the language box and Check again, as `console/entry/group-pick.html` screen 2 draws it. A profile link waits for a profile page |
| Tags | The list call returns no tags yet (section 3). A card shows tags when the answer carries a `tags` list, and No tag only when that list is present and empty. Without the field the card names no tag and no warning |
| A group already assumed | A person who reloads the console inside one login keeps the group the hub holds for the session and sees no screen. A choice that names a group the person no longer holds is treated as no choice |
| One group | The console assumes it with one `PUT` and opens the page. A person whose session already holds it makes no `PUT` |
| A failed call | The reading of the groups shows the failure and a retry. The console does not open a page it could not guard. A failed switch keeps the current group and shows the failure |
| Switching | One tap on another group assumes it and shows the same page again under the new group. A refused switch keeps the current group and says so inside the drop |
| An owner with no seat | The owner of a hub is checked like anyone else (D42), so an owner who holds no seat in a group meets the no-group message. This follows the design and is not an exception made in the console |

## 7. App (ISS-198)

Built in ISS-198. All paths are under `code/app/src/`. The phone app talks to the hub for these screens over the HTTP routes of [the assumed group of a login session](assumed-group-session.md) (`GET my-groups`, `GET my-group`, `PUT my-group`), not over MCP: `actor_list_my_groups` returns only an id and a name, and no MCP tool assumes a group.

| What | Where it is | What it does |
|---|---|---|
| Login landing | `app/App.tsx`: sign-in goes to `/agencies` (`features/entry/AgenciesPage.tsx`), which opens the hub's home. Everything of a hub sits under `/a/:agencyId`, wrapped in `InAgency`, then `GroupGate`, then `ConsentGate` | `features/groups/GroupGate.tsx` reads `GET my-groups` once for each hub and each login. The group is settled before consent and before any page reads a row. A session that already has a group, as the hub reports it, passes with no screen. One group is assumed by the gate itself, with no screen (D45). Several groups show `GroupList` under Choose a group. No group shows `NoGroupPage` (D46) |
| The bar | `app/TopBar.tsx`, drawn by `app/Shell.tsx` for every screen | Names the group after the hub, as `Hub · Group`. A top-level bar (no back button, with the menu) of a person with two or more groups also draws the Switch group link beside the menu button, to `/a/:agencyId/group` |
| The group held in the app | `shared/wakala/assumedGroup.ts` | The assumed group's id and name, the hub it is for and the number of groups, in memory only and never in storage (D40). `endSession` in `shared/wakala/me.ts` clears it, so sign-out and an ended session both do |
| The calls | `features/groups/assumedApi.ts`, the pattern of `features/entry/api.ts`, injectable with `provideAssumedGroupsClient` | `read(hubId)` is `GET my-groups`, `assume(hubId, groupId)` is `PUT my-group`. `keepGroup` in `features/groups/keepGroup.ts` assumes, keeps the group and drops the cached reads of the group before |
| The screens | `features/groups/`: `GroupList.tsx` (the rows shared by both lists), `SwitchGroupPage.tsx` at `/a/:agencyId/group` (`groupsPaths.switchGroup`), `NoGroupPage.tsx` | The list draws one row for each group with its roles; the current group is first, marked Current and pressed, in the Switch group screen only. One tap assumes the group; a tap on the current group only goes back. A refusal says so and stays on the list |
| Words | `shared/language/words.ts`, `swahili.ts`, `magyar.ts` | The `group*` keys, in the three files the app has |

Choices made while building, each with its alternative:

- The gate lets the request through when the hub does not answer 200, so an older hub or a dropped connection does not lock the app. The hub decides which rows a group reaches (see section 2).
- Tapping a group in the Switch group screen returns to the page the person was on, as state 5 says. The drawing's back label reads Home.
- The list shows the roles of each group as its second line and draws no tags, because `GET my-groups` returns `id`, `name` and `roles` only (section 3).
- The no-group message names the hub administrator by role, not by a person: no app or hub route tells a person with no seat who holds that role.
- The No group screen holds Check again, My profile and Sign out as three buttons in one card, and nothing else opens (D46).
- The gate reads the hub once for each hub while the app is open, and again after a reload, when the hub answers with the session's own choice. A group is therefore asked for only once for each login session.
- Two open points of section 4 are not built: the list draws no hint of the group used last time (state 2), and the no-group message names the role, not a person.
