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
| `ui/` | The shared components |
| `journeys/` | The walk tests and their test support |

## Routes and tabs

- `tabs.ts` defines two bottom bars (decisions 66 to 68 of hub-steward-swe). The home bar is Home, Chat and Do Something (the Inbox button is gone: Home is the inbox, decision 78 of hub-steward-swe); the Do Something bar is Home, Start, Ongoing and Backlogs. `TabBar` picks the bar from the path with `inDoSomething`: the segments `do-something`, `ongoing` and `backlogs`, the screens a Start or Ongoing row opens (`join`, `start`, `steps`, `market`, `forms`) and the older top-level screens (`/asks`, `/orders`, `/offers`, `/prices`, `/stock`, `/group-orders`, `/coordinator`, `/supply`, `/sell`, `/buy`, `/my-orders`, `/apps`). A screen opened from a row keeps the second bar and marks the side the person came from, Start or Ongoing (`rememberSide`, `sideReached`); its back button uses `doSomethingBackPath()`, which goes to that side, and Start when none was reached. A tab's path is `/a/<agency id>/<segment>` (`tabPathIn`).
- Backlogs shows only when the agency has the `taskmanager` module. The first read of the agency's modules is remembered for the session, so later screens show the tab at once; until the first read comes back the three other tabs keep a quarter of the bar each (`.tabs.reserve`), and a failed read, or modules that came back unread, leaves three tabs.
- The Chat list is one row for every group the signed-in person belongs to (`actor_list_my_groups`), the way WhatsApp lists its chats: the group's name, the newest message and its time, the unread count, newest activity first. A group nobody has written in yet is still listed, last and by name, with "No messages yet"; tapping it opens the empty threads page, which offers Start a thread. A group whose thread list could not be read is left out, and the tab says it could not be loaded only when every group failed (`chat/api.ts` `roomsOf`, `pages/chat/ChatPage.tsx`).
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
