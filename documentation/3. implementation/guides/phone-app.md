# Phone app: a guide for contributors

`code/app` is the member's phone app: React 18, React Router 6 and Vite, with Vitest for tests (`code/app/package.json`). It holds no data. Every screen reads and writes through the Wakala API. For the run commands see the [running guide](../build/02-running-it/README.md); for languages see [languages.md](languages.md).

## Where things are

Everything is under `code/app/src`.

| Folder | What it holds |
|---|---|
| `tabs.ts`, `routes.ts`, `App.tsx` | The two bottom bars, every screen's path, and the route table |
| `agency/` | Which agency is open (`open.ts`) and which modules it has switched on (`modules.ts`) |
| `wakala/` | The API client: runtime address (`config.ts`), token (`token.ts`, `renewal.ts`), the signed-in person (`me.ts`), tool calls (`mcp.ts`) |
| `entry/` | Sign-in, the agency list, the language picker and the words (`words.ts`, `swahili.ts`, `language.ts`) |
| `home/`, `started/`, `pages/` | Do Something, the Start and Ongoing rows, and the page components |
| `chat/`, `inbox/`, `forms/`, `groups/`, `people/` | One folder per feature: its API calls (`api.ts`) and its tests |
| `market/`, `buy/`, `sell/`, `supply/`, `coordinator/` | The market: products and prices, buying, selling, shops' offers and orders, the coordinator's group order and payments |
| `apps/` | The chat-workflow thread screens |
| `backlogs/`, `backlogBoard/`, `backlogPage/`, `backlogManage/`, `backlogAccess/`, `smartBacklog/`, `sendToBacklog/` | The Backlogs screens: the lists and the issue page, the Kanban board, a backlog's page, adding and editing backlogs, who has access, smart backlogs, and selecting issues to send to a backlog |
| `ui/` | The shared components |
| `journeys/` | The walk tests and their test support |

## Routes and tabs

- `tabs.ts` defines two bottom bars (decisions 66 to 68 of hub-steward-swe). The home bar is Home, Chat and Do Something (the Inbox button is gone: Home is the inbox, decision 78 of hub-steward-swe); the Do Something bar is Home, Start, Ongoing and Backlogs. `TabBar` picks the bar from the path with `inDoSomething`: the segments `do-something`, `ongoing` and `backlogs`, the screens a Start or Ongoing row opens (`join`, `start`, `steps`, `market`, `forms`) and the older top-level screens (`/asks`, `/orders`, `/offers`, `/prices`, `/stock`, `/group-orders`, `/coordinator`, `/supply`, `/sell`, `/buy`, `/my-orders`, `/apps`). A screen opened from a row keeps the second bar and marks the side the person came from, Start or Ongoing (`rememberSide`, `sideReached`); its back button uses `doSomethingBackPath()`, which goes to that side, and Start when none was reached. A tab's path is `/a/<agency id>/<segment>` (`tabPathIn`).
- Each tab carries an `icon` (an `IconName` of `ui/Icon.tsx`), not a text glyph: Home is a house, Chat a message bubble, Do Something a four-square grid, Start a play triangle, Ongoing a clock and Backlogs a list. `Icon` draws a 24 by 24 line icon in `currentColor` at `1.5rem` (the `.icon` rule in `app.css`), so the chosen tab takes the accent colour and the others the muted text colour; add a drawing to its `shapes` table to add a name.
- Backlogs shows only when the agency has the `taskmanager` module. The first read of the agency's modules is remembered for the session, so later screens show the tab at once; until the first read comes back the three other tabs keep a quarter of the bar each (`.tabs.reserve`), and a failed read, or modules that came back unread, leaves three tabs.
- The Chat list is one row for every group the signed-in person belongs to (`actor_list_my_groups`), the way WhatsApp lists its chats: the group's name, the newest message and its time, the unread count, newest activity first. A group nobody has written in yet is still listed, last and by name, with "No messages yet"; tapping it opens the empty threads page, which offers Start a thread. A group whose thread list could not be read is left out, and the tab says it could not be loaded only when every group failed (`chat/api.ts` `roomsOf`, `pages/chat/ChatPage.tsx`).
- A group's room has the three-part bar: the Chat back label at the left, the group's name centred, the menu at the right. The thread's name is a plain pill under the bar. The threads sit in one collapsible Card headed "Threads · N", open at first, whose rows are the same thread rows the threads page uses (`chat/rooms/ThreadRows.tsx`). The threads page has the same bar with the room's name as the back label; with no threads it shows the empty card with Start a thread inside it. The writing box stays pinned at the bottom, at the standard content size (`chat/rooms/RoomThreadPage.tsx`, `RoomThreadsPage.tsx`).
- The assistant page (`src/assistant`) has a Chat | Results tab strip. What the model reads through `taskmanager_task_list`, `taskmanager_task_pending` and `taskmanager_task_read` is kept as typed lists (`results.ts`, one for every call, newest first), not drawn in the chat: the chat shows an entry row for each list (title and count), and the Results tab shows the list the dropdown has chosen as shared issue rows in a Card. Tapping an entry selects exactly that list; new data puts a dot on the Results tab while Chat shows; a list longer than fifty rows has Show more, and a list the tool cut says how many of the total it holds.
- The assistant page answers one message at a time. While an answer is pending the assistant side shows three pulsing dots (still dots when the person prefers reduced motion) with Looking it up and, when a tool runs, its step in plain words (`stepWords` in `assistant/api.ts`). The writing box clears at once and keeps the cursor, and the send button stays enabled: a message written meanwhile is added to the conversation as a bubble marked Queued, with a remove cross until it is sent, and is sent on its own, in order, with the conversation so far when the answer arrives (`assistant/queue.ts`, mirroring the console chat's queue: its words Queued and Remove from the queue). A request that fails or takes over 60 seconds pauses the queue and shows That did not work. Try again. with a Try again button; the rest stay queued. Leaving the page keeps nothing queued. The Chat list pins the assistant as its first row, and Join a group is a button after the last row, in the empty card when there are no groups.
- An open chat hides the bottom bar (decision 50): the thread, the list of threads on top of it and an ask opened from it pass `tabless` to `Shell`; the list of chats keeps the bar. An agency's old `/started` address, with or without the agency, goes to Ongoing.
- The home screen is `/a/<agency id>/home` and is the inbox: `pages/InboxPage.tsx` is mounted there with the heading Home, and the unread and waiting count sits on the Home button of the home bar. The old `/inbox` and `/a/<agency id>/inbox` redirect to it (`retiredInboxRoute`) and keep their query string and router state. When the notifications or invitations read fails because the agency has no comm module (a tool-level answer, not a server error or a lost connection), Home shows its calm empty card; only a real outage (a server 5xx, a lost connection, a refusal) shows the failure with Try again (`inbox/outage.ts`). An agency's address, a sign-in and choosing an agency all land there. Start is `/do-something` and Ongoing is `/ongoing`; the backlog screens are mounted under `/backlogs/*` by `BacklogsRoutes`. A back button that means Do Something uses `doSomethingBackPath()` (or `doSomethingPath()` for Start itself), never `"/"`, which is the home screen.
- Every unread notification row on Home has a checkbox (`SelectableRow` in `ui/ListRow.tsx`; invitations and read rows get a blank space of the same width so the rows line up). Ticking one changes the bar's Mark all read to Mark read, which marks only the ticked rows through `markIdsRead` in `inbox/useNotifications.ts`; unticking them all brings Mark all read back, and the ticks drop when a row stops being unread. Tapping a row still opens it; the box only selects.
- `routes.ts` builds the path of 14 agency screens from one definition each: `screen("/market/:productId")`. Call `routes.product.path({ productId })`; never write the string by hand. `pattern` is `/a/:agencyId` plus the path, and `retired` is the old path without the agency.
- `App.tsx` registers each `pattern` inside the `/a/:agencyId` block, and registers every `retired` path as a redirect to the open agency (`ToOpenAgencyScreen`), or to `/agencies` when none is open.
- Many screens are not in `routes.ts` yet: `App.tsx` declares `/buy/wanted`, `/my-orders`, `/sell/...`, `/asks`, `/offers`, `/orders`, `/coordinator/...` and `/group-orders` as plain paths outside the agency block.
- The open agency lives in memory and in `sessionStorage` under `hubsteward.openAgency` (`agency/open.ts`).

## Talking to the API

- **Address.** `wakala/config.ts` fetches `/config.json` once. `public/config.json` holds `{"wakala":"http://localhost:8082"}`. With no file the app uses the same origin and `/mcp`.
- **Builds.** `demoConfig.ts` writes `config.json` into `dist/` from `HUBSTEWARD_WAKALA_URL` (`vite.config.ts`). `npm run build:demo` stops when the variable is unset (`scripts/build-demo.mjs`).
- **Token.** The bearer token is kept in `localStorage` under `hubsteward.token`. `authHeaders()` returns `Authorization: Bearer ...`, and `renewal.ts` swaps an expiring token by posting to `/auth/refresh`.
- **Calls.** Features call `callTool(hubId, tool, args)` in `wakala/mcp.ts`. It adds `instance_id` from the open agency. Reads are reused for 10 or 60 seconds, and any other call clears them.
- **Clients.** A feature's `api.ts` defines a client type and a live client. `forms/context.tsx` shows the pattern: a provider and a hook, so a test hands the screen a fake client.

## Languages

- The picker lists nine languages (`languages` in `entry/words.ts`), but only English (`words.ts`) and Kiswahili (`swahili.ts`) have words. Any other code falls back to English (`wordsFor` in `entry/language.ts`).
- The choice is kept in `localStorage` under `hub.language`.
- Not all text goes through the words yet: `pages/forms/FormsPage.tsx` writes "Closes this week" in the component. Put new text in `words.ts`, and add its Kiswahili to `swahili.ts`, whose type is `Words`.

## Tests

- Run all with `npm test` (`vitest run`), or one file with `npx vitest run src/routes.test.tsx`. The environment is jsdom, and `src/test-setup.ts` points the runtime address at `https://wakala.test`. There are 124 test files.
- `routes.test.tsx` checks that every path is built from its definition and keeps its retired path.
- `journeys/*.walk.test.tsx` (nine files) render `<App />` in a `MemoryRouter` and walk a journey screen by screen. `journeys/inAgency.test-support.tsx` has `stubWakala` (it stubs `fetch` and records each tool call), `everyCallNames` (every call names the open agency) and the farmers' and riders' agencies.
- A bug fix needs a test that fails without it (see [CONTRIBUTING.md](../../../CONTRIBUTING.md)).

## Add a screen

1. Add the API call to the feature's `api.ts` with `callTool`, behind its client type.
2. Add `name: screen("/path/:id")` to `routes` in `routes.ts`. `allScreens` picks it up, so its retired redirect is registered for you.
3. Write the page under `pages/<area>/`, wrapped in `Shell` (`title`, `onBack`, `action`, or `tabless` to hide the tab bar).
4. Add `<Route path={routes.name.pattern} element={...} />` inside the agency block in `App.tsx`.
5. Link to it with `routes.name.path({ id })`, and add a row to the table in `routes.test.tsx`.
6. Add the text to `words.ts` and `swahili.ts`, write a test, and update the matching journey page.

## Reuse these

Use `ui/` before writing markup: `Shell` (with `TopBar`, `ScreenHead`, `TabBar` and the account `DrawerFrame`), `LoadState` (`EmptyCard`, `LoadingLine`, `LoadFailed`), `Button`, `Card`, `Chip`, `ListRow` and `Rows`, `Segmented`, `Field`, `ChoiceRow`, `SearchSelect`, `SectionHeading`, `JoinForm` and `ProductRows`. Do not add a second copy.

`Card` is the one card surface. `<Card>` alone is the plain card and `<Card empty>` the centred empty one. `<Card title="...">` adds a header row with the title; add `collapsible` to make the header a button with a chevron (`aria-expanded`, Enter and Space toggle) and `defaultOpen={false}` to start closed. The content sits in a body below the header, so a footer can be added later without changing callers. In a chat thread, put a card in a `rm-slot` wrapper for its width and side, never a second copy of the surface.

## Look and feel in the code

- The root is `font-size: 112.5%` (`tokens.css`) and the body is `1rem`. Every font size in `app.css` is in `rem`; there are none in pixels.
- Touch targets are at least `3rem` high (`.bar`, `.btn`, `.input`, `.tab` in `app.css`), and list rows `3.5rem`.
- The top bar is sticky, and back is a plain `‹`. An empty list is a `Card empty` with a sentence, not a blank page.
- No comments in code. Put an explanation in `documentation/`.

## Common mistakes

- Writing an agency path by hand. It breaks when the path changes: use `routes.x.path()`.
- Calling `fetch` for data. Use `callTool`, so the call names the open agency and the cache clears on a write.
- Hard-coding text in a component, so it never reaches the Kiswahili words.
- Testing against the live client. Pass a fake client or use `stubWakala`.
- Forgetting that the app has no server of its own: with no API at the address in `config.json`, every page after sign-in fails.

## Issues on the Backlogs screens

- One row draws an issue everywhere: `backlogs/IssueRow.tsx`. The code (the first word of the title when it looks like an id, `DEV-009`) is in the accent colour, the title is plain text at `--content` (one number in `tokens.css` for body text on these screens), two lines of title at most. Under the title an interactive row (lists, board cards, Waits on, Waited on by) shows the lighter line (`IssueLine` in `backlogs/IssueTitle.tsx`): one grey line with the repo and the backlog, and a Blocked chip only on an issue that is blocked; the repo is named once, by its last path segment (`projects/x` reads `x`), and the backlog is left out when it reads the same. A static row (the top of an issue's page) keeps every tag as a pill (`IssueTags`). Variants are by prop: interactive or static, with or without a chevron.
- The repo, the backlog and the Blocked chip on a row are filters on the rows and cards of the lists that have a filter (All issues, a backlog's list, the board): tapping one adds the tag, tapping a chosen one removes it, and neither opens the issue. Ready is no longer drawn on a row, so it is not a tap-to-filter chip. In the issue page's top and in Waits on / Waited on by the tags are plain pills.
- The list and the board share one pinned filter bar (`backlogs/FilterBar.tsx`, sticky under the header): the search field (`ui/SearchBox.tsx`), the count and the chosen tags. Every typed word must appear in the code, the title or a tag, case-insensitive, together with the tag filter, kept in the address as `q`. The count reads `12 of 1661 issues` while narrowed.
- An issue's page: header `‹ All issues`, the code in the middle; the static row, the description as markdown (`ui/Markdown.tsx`, no library) in a card, Waits on and Waited on by as rows of one card, and the loader's `Read from` lines apart under Source.
- The header (`ui/TopBar.tsx`) is three parts when a screen passes a back label: the label at the left, the title centred, the menu at the right.

## Smart backlogs, Select and send, and who may edit

- **Two kinds of backlog.** A backlog with steps holds issues and shows a board. A smart backlog has no steps and no issues of its own: it is a saved set of rules, and what it lists is whatever the rules match now, narrowed to what the caller can see. The Backlogs screen lists both; a smart one has a Smart pill and only its count (`backlogs/BacklogsPage.tsx`). Add a backlog asks first, in a bottom sheet (`ui/Sheet.tsx`), Backlog with steps or Smart backlog.
- **The rules screen** (`smartBacklog/RulesScreen.tsx`): a name, Match all or any, one row for each rule (field, operator, value, remove), Add a rule, a live count of the issues that match, and Create. The nine fields and their operators are in `smartBacklog/fields.ts` (Tag, Mark, Backlog, Step, Priority, Title, Description, Waits on, Last changed); there is no limit. The routes are `new/smart`, `:id/smart` and `:id/rules` under the Backlogs path (`smartBacklog/paths.ts`), and the calls are `smartTools` in `smartBacklog/api.ts`.
- **Opening one** (`smartBacklog/SmartBacklogPage.tsx`): the rules read back, the count and the issues, with no List or Board switch; a person who may manage backlogs sees Edit rules. A smart backlog that matches nothing is an empty card with Edit rules inside it. Saving the same rules twice is refused with a 409, and the screen links to the backlog that has them.
- **Select and send** (`sendToBacklog/`): Select in the top bar of a list, of the Kanban board and of a smart backlog's list turns the rows into rows with a tick, with a count in the title, All and Cancel; a Send to backlog bar opens a sheet of the backlogs with steps the person may move into (the `level` on `taskmanager_backlog_list`; edit counts as move), and each issue goes to the target's first step through `taskmanager_task_move_to_step`. It stops at the first refusal and says how many went through; a successful send reloads the list. An opened issue has a Send to backlog button for the one issue. The tick box is `SelectionBox` in `ui/ListRow.tsx`. There is no Undo.
- **Three access levels** (`backlogAccess/`): the Access screen shows Can see, Can move and Can edit for each group, each including the one before, and a cross that takes a group's access away; there is no No access segment. The Product owner group is fixed at Can edit, and a smart backlog offers only Can see and Can edit. Can edit gives the Backlog manager role (`backlog_manager`), as Can see gives Backlog member and Can move gives Backlog worker.
- **Tools** (all `taskmanager_` plus the name): `backlog_create` takes `steps` or `rules`, `backlog_rules_set` changes a smart backlog's rules, `backlog_rules_count` counts what rules match without saving, and `backlog_list` carries `kind`, `rules`, `level` and, for a smart backlog, `issues` as the live count.
- **Being built:** Save as smart backlog from a filter, which opens the rules screen filled with the chosen tags and search (take-up-19).
- The design is in the hub-steward-swe repo: `documentation/2. design/smart-backlogs.md`, and what was built in its `documentation/3. implementation/smart-backlogs.md`.
