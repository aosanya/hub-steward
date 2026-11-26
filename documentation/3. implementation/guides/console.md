# The console

A guide to `code/console` for someone about to change it. The console is the agency manager's and designer's web app: React 18, React Router 6 and Vite, with Vitest for tests. It calls the Wakala API server and holds no data of its own.

## Run it

```sh
cd code/console
npm ci
npm run dev
```

`npm run dev` is Vite. `npm run typecheck` is `tsc --noEmit`, and `npm run build` runs it before `vite build` (`package.json`). Inside `code/console`, `make run` starts the dev server on port 5170 with `--strictPort` and first kills whatever holds the port; `make restart` and `make logs` start it in the background and follow its log (`Makefile`).

## Where the API is

- `public/config.json` holds `wakala`, `mcp` and `template`. `src/wakala/config.ts` fetches `/config.json` with `cache: "no-store"` once and shares the answer.
- In the dev server `vite.config.ts` serves its own same-origin `/config.json` and proxies `/auth`, `/instances`, `/services` and `/mcp` to `WAKALA_URL` (default `http://localhost:8082`).
- `src/wakala/rest.ts` is the REST side: sign-in, session check, list hubs, import a hub. `src/api.ts` has the small `get`, `post`, `put` helpers.
- `src/wakala/mcp.ts` is the tool side. `callTool(hubId, tool, args)` adds `instance_id`, caches read tools for a short time, and clears the cache after any other tool.

## Layout under `src`

| Folder | What it holds |
|---|---|
| `App.tsx` | The routes. `/h/:hubId` is the `Frame`; inside it, `:page` is a `PageView` |
| `entry/` | Sign-in, the list of hubs, create a hub |
| `shell/` | The frame: menu, chat column, `useConsole()` context, labels |
| `pages/` | The screens. `views/` has one view per menu page; `models/`, `workflows/`, `agent/`, `publish/`, `review/` and others hold what those screens use |
| `data/` | What the screens read and write: page modules in `data/pages/`, the menu, features, chat logic |
| `wakala/` | The API clients above |
| `ui/` | Shared components; import them from `ui/index.ts` |
| `journeys/` | Walk tests that drive several screens in a row |
| `i18n.tsx` | `I18nProvider`, `useI18n()` and the six languages |

## How a page gets its data

`PageView` picks `views[page]` from `pages/views.ts`; a page with no view, or one listed in `hiddenPages`, falls back to `SpecPage`. A view reads the hub from `useConsole()` (`shell/context.ts`).

A data page is a `PageModule` (`data/types.ts`): a `spec`, a `rows(hubId, query)` function and optional `actions`. `data/registry.ts` maps page ids to modules. Modules call tools with `callTool`; a change that needs approval goes through `proposeWrite` in `data/pages/groups.ts`, which calls `agency_propose_write`.

Inviting by member code (`inviteUser` in `data/pages/users.ts`) looks the code up with `actor_get_screen_name_by_code`. A member with no display name is still found and the proposal is named by the code; a code the hub does not know is refused with "no member has that code". A refused action shows its reason after "The change could not be sent." in the Invite form, through `failureOf` in `pages/spec/sendAction.ts`.

The Publish page (`pages/publish/publishData.ts`) enables Publish when the open draft has an approved goal, objective, role or profile change since the last version, or when the hub has no published version at all (`isReady`). The server decides what counts as a change: `PublishAgency` in wakala-api refuses with "no changes detected since last publication" only when the draft's content hash equals one already published, so a first publish always goes through. When Publish is off, `whyNotReady` names the reason under the title: there is no open draft, or nothing counted has changed since version N; edits the page cannot count, such as module switches, are said not to count. A refusal from the server shows as "Nothing has changed since the last published version." (`draft.noChanges`).

The Users page (Users in the menu, "Waiting for approval" at the top of the page) lists two kinds of join request. Group-level requests come from `actor_list_join_requests_for_group`. Agency-level requests, made when a resident taps "Ask to join" in the phone app (`POST /instances/{id}/join`), come from `GET /instances/{id}/join-requests` in `usersWithWaiting` (`data/pages/users.ts`); each row carries `level` `group` or `agency`, and an agency row shows the word `users.theAgency` as its group. A failed read of either list sets `waitingFailed`. Approve and Decline on an agency row call `POST /instances/{id}/join-requests/{userID}/approve` and `/refuse` (`data/pages/joinDecisions.ts`); a reply that is not ok throws and the page shows the refusal. The agency-level reply carries only `user_id`, so a resident is named by the matching person when one exists and by the user id otherwise.

The General view (`pages/spec/generalSheet.tsx`, the row in `pages/spec/generalListing.tsx`) has a "Listing" row in the Hub card under Default language: a switch "Listed in search" with the line "Residents can find a listed hub by name or place when they search." "Save changes" saves it together with Joining and Default language. General reads the state with `GET /instances/{id}` (field `listed`) in `data/pages/general.ts`, and the page action `listing` sends `PUT /instances/{id}/listing` with `{"listed": bool}` directly, not through an approval proposal, so no "Pending approval" line shows. When the read fails the row is hidden. The route (`setListing` in wakala-api `directory_routes.go`) accepts any member of the agency; the resident search `GET /directory?q=` returns only listed agencies that match by name or place, or the one agency when `q` is its id (ISS-18).

## The menu and what hides pages

`data/menu.ts` lists every page once in `entries`: `id`, `icon`, `section`, `kinds` and optional `children` and `managersOnly`. A page shows when its `kinds` include the hub's kind (`lab`, `farmers`, `riders` or `other`, from `kindOf` in `data/hubKind.ts`; a kind text that names none of the first three, or no kind, is `other`, which lists the `lab` pages plus Objectives and has no kind chip on Your hubs or in the header, hub question Q-27), it is not in `hiddenPages`, and the viewer is not a staff seat on a `managersOnly` page. A staff seat is the role `agent` (`data/seat.ts`). An entry may name the `permission` that opens it (`consent` names `consent.publish`); a caller who is neither the owner nor a staff seat and holds permissions (`holdsOnlyPermissions` in `data/seat.ts`) sees only the entries whose permission they hold, lands on that page (`homePageOf`), is sent back to it from any other page by `Frame`, and gets no chat column and no model, draft or badge reads they would be refused. Each label is the key `menu.<id>` (`data/menu.ts`, `shell/labels.ts`).

`data/features.ts` holds one switch, `measuresOn = false`, which removes every tool with "measure" in its name.

## Languages

The console speaks `en`, `de`, `sw`, `es`, `fr` and `zh` (`i18n.tsx`). Words come from `public/i18n.json`; `t(key)` falls back to English, then to the key itself. `src/i18nFiles.test.ts` fails when:

- a language is missing or out of order;
- an English key is missing or empty in another language;
- a value is still English, except names and one-word cognates in German, Spanish and French;
- another language has a key English lacks;
- source code calls `t("literal")` for a key that is missing in any language.

## Tests

Vitest runs in jsdom (`vite.config.ts`). `src/app/test-setup.ts` clears `localStorage` before each test and points the runtime config at `https://wakala.test`.

```sh
npm test
npx vitest run src/data/menu.test.ts
npx vitest run -t "part of a test name"
```

Tests sit beside the file they check. Walk tests in `src/journeys/` mock `callTool` and click through several pages (`changeRule.walk.test.tsx`). The Playwright specs in `e2e/` are excluded from `npm test`. They need `E2E_API_URL`, `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_SERVER_LOG` and `E2E_SHOTS_DIR` (`e2e/helpers/env.ts`), and run against `E2E_BASE_URL` (default `http://localhost:5190`, `playwright.config.ts`).

## Add a page

1. Add an entry to `entries` in `data/menu.ts`, with its `kinds`.
2. Add a `PageModule` in `data/pages/<id>.ts` and register it in `data/registry.ts`. If the table `SpecPage` draws is enough, stop here.
3. Otherwise write `pages/views/<Name>View.tsx` and add it to `views` in `pages/views.ts`.
4. Add `menu.<id>` and every other key you call with `t(...)` to `public/i18n.json` in all six languages.
5. Write tests next to the files, then run `npm test` and `npm run build`.
6. Update the matching journey and mockup pages under `documentation/` in the same change.

## Reuse before you write

`ui/index.ts` exports the shared parts: `Button`, `Card`, `DataTable`, `Detail`, `Empty`, `Field`, `FilterBar`, `Notice`, `Tabs`, `Toggle` and more. Look there before writing a second copy.

## Font sizes

`design.css` sets `font-size:112.5%` once on `:root` and `1rem` on `body`; sizes elsewhere are in `rem`. Do the same in any CSS you touch, and let buttons and inputs inherit.

The workflow editor (`data/pages/workflowDesign.ts`, `saveDesign`) sends `agency_update_work_item` for every step the page holds, with every column the step was read with carried over except what the agency owns. A step that writes no row reads back `row_record` and `row_action` as empty text, and `row_action` is an enum the tool refuses when it is empty, so `carriedFrom` leaves both out while they are empty and sends them back unchanged on a step that writes a row.

## Common mistakes

- A new `t("key")` with the key in only some languages: `i18nFiles.test.ts` fails.
- A page in `entries` with no `kinds` match for the hub you are testing: it does not show.
- Calling a tool with `fetch` in a screen instead of `callTool`: the read cache and the sign-out on a 401 (`wakala/mcp.ts`) are skipped.
- Running e2e specs without the `E2E_*` variables: `env.ts` throws and names the missing one.
