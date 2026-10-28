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

A sign-in link opens the app at `/sign-in/link` (`src/pages/entry/SignInLinkPage.tsx`): the page hands the link's token to wakala-api with `GET /me`, keeps it in `localStorage` (`src/wakala/token.ts`) and every call carries it as a bearer token. The app also keeps wakala-api's cookie (`wakala_session`), which a password sign-in sets: sign in once with a password, for the walk's hub manager on the console, then open the app. wakala-api must list `http://localhost:5171` as an allowed origin so the browser sends the cookie.

Do Something draws its Start segment as one list of rows (`src/home/StartRows.tsx`): the cards in `src/home/cards.ts`, among them a supplier's market cards (Offers, Asks, Group order, Orders), and one row for each workflow step open for the member, whose screen `src/home/workflowScreens.ts` names. The account items are a drawer opened by the hamburger button in the bar, `src/ui/AccountMenu.tsx`; the page slides left in front of it inside `src/ui/DrawerFrame.tsx`.

`public/config.json` holds the wakala-api address the app calls (`{"wakala":"http://localhost:8082"}`); `npm run build:demo` builds with the address from `HUBSTEWARD_WAKALA_URL`. `node scripts/shoot-screen.mjs <route> <output.png>` photographs one screen at phone size and needs Playwright installed in `../console`.
