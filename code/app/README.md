# Hub Steward app

The phone app: a mobile-first React shell with a sticky app bar, a bottom tab bar and the small component kit. The tab list is data in `src/tabs.ts`; colours are in `src/tokens.css` (light and dark by `prefers-color-scheme`). `src/wakala` is the MCP client over fetch to wakala-api, copied from the console.

```
npm ci
npm run dev
make run
npm run typecheck
npm test
npm run build
```

`make run` kills whatever holds port 5171 (`DEV_PORT` changes it) and runs the dev server in the foreground. `make restart` does the same in the background, writes the log to `$TMPDIR/hubsteward-app/dev.log`, waits until the app answers and streams the log (Ctrl-C stops the stream, not the server). `make logs` follows that log again.

A sign-in link opens the app at `/sign-in/link` (`src/pages/entry/SignInLinkPage.tsx`): the page hands the link's token to wakala-api with `GET /me`, keeps it in `localStorage` (`src/wakala/token.ts`) and every call carries it as a bearer token. The app also keeps wakala-api's cookie (`wakala_session`), which a password sign-in sets: sign in once with a password, for the walk's agency manager on the console, then open the app. wakala-api must list `http://localhost:5171` in `MEMBER_APP_ORIGINS` so the browser sends the cookie.

Do Something draws its Start segment as one list of rows (`src/home/StartRows.tsx`): the cards in `src/home/cards.ts`, among them a supplier's market cards (Offers, Asks, Group order, Orders), and one row for each workflow step open for the member. A step with a screen of its own, which `src/home/workflowScreens.ts` names, opens that screen. Any other form step opens `src/steps/StepPage.tsx`, which builds the form from the step's questions with the question inputs of the forms page (`src/forms/QuestionInput.tsx`), checks the required answers and sends them, keyed by prompt and as strings, to `POST /instances/{id}/steps/{stepId}/answers` (`src/steps/api.ts` is the one place that call and the list read live). The rows come from `agency_list_my_open_steps` with `available: true`: only the steps the member may act on now, either a step that starts a run or a step waiting on her, which carries that run's `order_id`; the screen of a waiting step is `/steps/<id>?order=<run>`. A refused send is told in plain words: this step is not for your role, or not ready or already sent. A run she has sent shows as a `Sent` row that cannot be opened again: `src/steps/sent.ts` keeps it in the app's memory for the session, for the agency that was open, so it stays listed until the app is reloaded and never shows in another agency. A workflow's first step keeps its own row open, because each send starts a new run: the sent run, named by the `order_id` the send returned, is a separate `Sent` row beside it. The group order's Start step, found by its form name `Create group order`, keeps its own screen; any other step with a product, a price and a quantity opens the generic page. The account items are a drawer opened by the hamburger button in the bar, `src/ui/AccountMenu.tsx`; the page slides left in front of it inside `src/ui/DrawerFrame.tsx`.

`public/config.json` holds the wakala-api address the app calls (`{"wakala":"http://localhost:8082"}`); `npm run build:demo` builds with the address from `HUBSTEWARD_WAKALA_URL`. `node scripts/shoot-screen.mjs <route> <output.png>` photographs one screen at phone size and needs Playwright installed in `../console`.

The top bar (`src/ui/TopBar.tsx`) draws the open agency's name in a small line under the title, on every screen inside an agency. `src/agency/open.ts` holds the name (`openAgencyName`); `InAgency` in `src/pages/entry/OpenAgency.tsx` sets it once `GET /me/agencies` answers, and forgetting the open agency clears it. The three agency-picker screens (Your agencies, Find an agency and an agency's detail) pass `unnamed` to `Shell`, so the bar leaves the name off there, where the list already names every agency. Do Something and Backlogs no longer draw the name as a line of their own.

`config.json` may also carry `agency`, a name the app is limited to. `parseConfig` keeps it as trimmed text, and `listAgencies` in `src/entry/api.ts` keeps only the agencies whose name contains it, ignoring case. With one agency left, the agency list opens it at once. The API still lists all of the account's agencies, and the directory search behind Find an agency is not filtered. `HUBSTEWARD_ONLY_AGENCY` sets the key when the dev server or a build writes `config.json`.

`HUBSTEWARD_PROXY_TO` makes the dev server forward `/auth`, `/me`, `/instances`, `/services`, `/mcp`, `/platform`, `/launch`, `/owner`, `/languages` and `/directory` to that address and drop the `Origin` and `Referer` headers, so the app and its API share one origin and the sign-in cookie needs no cross-origin setup. `make runMunicipality` runs the dev server that way, limited to one agency: `MUNICIPALITY_PORT` (5192), `MUNICIPALITY_API` (`http://127.0.0.1:8092`, the local Docker API) and `MUNICIPALITY_NAME` (`Zöldhalom`) change the port, the API and the name. It kills whatever holds the port first. Sign in on that page with an account that belongs to the agency.
