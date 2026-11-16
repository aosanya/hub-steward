# Phone app: how `src` is organised

Decided on 2026-11-16 with the owner. This page is the strategy and the progress of the move. [phone-app.md](phone-app.md) describes the folders as they are and follows each move in the same change. A folder named in the target layout that does not exist yet is a target, not a fact; the status column below says which is which.

## Why this page exists

`code/app/src` had 775 files in 36 top-level folders, and four ways of grouping sat side by side:

| Grouping | Folders |
|---|---|
| By feature | `backlogs`, `chat`, `files`, `market`, `forms` |
| By layer | `ui`, `wakala`, `storage`, `pages` |
| By role | `coordinator`, `council` |
| By journey | `started`, `steps`, `entry`, `journeys` |

Three things followed from that:

- `pages/` repeated the feature folders. The Market screens were in `pages/market` and its logic in `market/`; the same split held for supply, started, chat, entry, forms and join. One change opened two folders.
- Backlogs were in about ten places: `backlogs`, `backlogAccess`, `backlogBoard`, `backlogManage`, `backlogPage`, `smartBacklog`, `sendToBacklog`, `journeys/backlogs`, `chat/backlogCards` and `assistant/namedBacklog`.
- The market was in five: `market`, `supply`, `buy`, `sell` and `pages/market`.

## The rules

1. **Divide by feature.** A feature is a thing a member sees. Its screens, API calls, helpers, CSS and tests all live in its folder. There is no `pages/` folder.
2. **One folder per feature, however many screens.** All backlog code is in `features/backlogs/`; all market code, buying, selling and supplying, is in `features/market/`.
3. **Inside a big feature, one sub-folder per screen area.** Each holds its own components, helpers, CSS and tests. What two or more areas use goes in the feature's `shared/`.
4. **Three groups at the top.**

   | Group | Holds |
   |---|---|
   | `app/` | The shell: `main.tsx`, `App.tsx`, the route join, `tabs.ts`, `tokens.css`, `app.css`, home and menu |
   | `features/` | One folder per feature |
   | `shared/` | `ui`, `wakala`, `storage` and what every feature uses |

   A feature may import `shared/`. `shared/` never imports a feature, and `app/` is the only place that joins features.
5. **Features meet only at `index.ts`.** Each feature folder has an `index.ts` listing what other features may use. Nothing else is imported from outside the folder. Backlog code that another feature hosts, such as the cards shown in chat, stays in `backlogs/` and is exported.
6. **Each feature owns its routes.** A feature's `routes.tsx` lists its paths and screens and is exported through its `index.ts`. The root route file only joins them, the way `BacklogsRoutes.tsx` and `FilesRoutes.tsx` already do. A feature with screens inside the agency keeps its path definitions in `routePaths.ts`, which imports nothing from a feature, so the root `routes.ts` can read them without an import cycle through the screens (SW483).
7. **Tests sit beside the code they test.** Test support used by one feature stays in that feature; support used by several goes in `shared/`.

## Target layout

```
src/
  app/
    main.tsx  App.tsx  routes.ts  tabs.ts  screen.ts  tokens.css  app.css  test-setup.ts
    home/  menu/
  features/
    backlogs/
      board/  manage/  smart/  access/  page/  issue/  list/  send/  cards/  walks/  shared/  caps/  references/  todos/  todoCounts/
      index.ts  routes.tsx
    market/
      buy/  sell/  supply/  product/  payments/  start/  shared/
      index.ts  routes.tsx
    chat/  assistant/  files/  steps/  started/  forms/  inbox/
    entry/  account/  consent/  people/  groups/  agency/  council/  risks/  apps/
  shared/
    ui/  wakala/  storage/
```

## Where today's folders go

Status is read from `code/app/src` on disk when this page was last written, and from the hub for work still on its way to `dev`: done means the files are on `dev` at the new place, in progress means an agent holds the issue or its commit is not on `dev` yet, open means nobody has started.

| Today | Goes to | Status | Issue |
|---|---|---|---|
| `backlogBoard` | `backlogs/board` | done | SW432 |
| `backlogManage` | `backlogs/manage` | done | SW435 |
| `smartBacklog` | `backlogs/smart` | done | SW438 |
| `backlogAccess` | `backlogs/access` | done | SW441 |
| `backlogPage` | `backlogs/page` | done | SW444 |
| `sendToBacklog` | `backlogs/send` | done | SW447 |
| the loose files at the top of `backlogs/` | `backlogs/issue`, `backlogs/list`, `backlogs/shared` | done | SW450 |
| `chat/backlogCards`, `journeys/backlogs` | `backlogs/cards`, `backlogs/walks` | done | SW453 |
| `pages/market` | `market/product`, `market/shared` | done | SW459 |
| `buy`, `sell` | `market/buy`, `market/sell` | done | SW462 |
| `supply`, `pages/supply` | `market/supply` | done | SW465 |
| `coordinator/payments`, `coordinator/start` | `market/payments`, `market/start` | done | SW468 |
| `pages/chat`, `pages/forms` | `chat/`, `forms/` | done | SW474 |
| `pages/started`, `pages/entry`, `pages/join` | `started/`, `entry/`, `groups/` | done | SW477 |
| `pages/HomePage`, `pages/NotificationsPage`, `pages/TabPage` | `home/`, `inbox/`, `shared/ui/` (`pages/` is gone) | done | SW480 |
| `ui`, `wakala`, `storage` | `shared/ui`, `shared/wakala`, `shared/storage` | done | SW486 |
| each feature's routes in the root `routes.ts` and `App.tsx` | a `routes.tsx` in each feature | done | SW483 |
| other features' deep imports into `market/` | through `market/index.ts` | done, with the listed exceptions | SW471 |
| other features' deep imports into `backlogs/` | through `backlogs/index.ts` | done, two exceptions | SW456 |
| `shared/` imports of features | none: `Shell`, `TabBar`, `TopBar`, `TabPage` to `app/`, the language to `shared/language`, the open agency to `shared/wakala`, `JoinForm` to `market/shared` | done | SW504 |
| every feature folder (`account`, `agency`, `apps`, `assistant`, `backlogs`, `chat`, `consent`, `council`, `entry`, `files`, `forms`, `groups`, `inbox`, `market`, `people`, `risks`, `started`, `steps`) | `features/` | done | SW489 |
| `home`, `menu`, `tabs.ts`, `routes.ts`, `screen.ts`, `App.tsx`, `main.tsx`, `app.css`, `tokens.css`, `test-setup.ts` and their tests | `app/` | done | SW492 |
| `journeys/` and its test support | stays together | decided, nothing moves | SW495 |
| a test that fails when a rule is broken | `layoutRules.test.ts` | done | SW510 |
| a script that moves a folder and re-points imports | `code/app/scripts/moveFolder.mjs` | done | SW507 |

## Decided

- **`coordinator` (SW468).** Both folders are market screens. `coordinator/payments` is the group-order order cards and payments pages, and `coordinator/start` starts a group order and picks its product, all through `market_*` tools. They are now `market/payments` and `market/start`, and `coordinator/` is gone. `market/start/api.ts` and `startWaiting.ts` also feed home, inbox, steps and started with the member's open steps; lifting that reader out of the market is a later step.
- **`journeys/` (SW495).** The walk tests and their `*.test-support` files stay together in `journeys/` and no file moves. Every walk renders `<App />` or opens an agency and crosses three to six features, so none belongs to one feature, and the support files are shared by several walks (`answerWakala` 7, `inAgency` 5, `chatSteps` 2) and by tests outside `journeys/`. Moving them would rename about 25 files for no feature gain. `journeys/backlogs` was the one exception and went to `backlogs/walks` with SW453.
- **`assistant/namedBacklog.ts` (SW453).** It stays in the assistant. It matches a typed message against backlog names and builds the assistant's own result cards, only the assistant uses it, and it holds no backlog screen logic.
- **`pages/join` (SW477).** It went to `groups/`, not `entry/`: `JoinPage` is built on the groups client (`listJoinableGroups`, `findGroupByCode`, `joinGroup`, `listMyGroups`), and `entry/` is sign-in and agency picking.
- **`council` (SW489).** Named by role, not by feature, but it holds the council's own screens and calls, so it moved to `features/council/` with the rest.
- **The last three pages (SW480).** `HomePage` went to `home/`, `NotificationsPage` to `inbox/`, and `TabPage`, an empty-card screen that `App.tsx` shows for a tab with no screen of its own, to `shared/ui/` beside `Shell` and `TabBar`; SW504 later moved all three to `app/`.
- **The `access` name clash (SW450).** A file `backlogs/access.ts` sat beside the folder `backlogs/access/`, and `BacklogsRoutes` imported `./access/index` to get round it. The file went to `backlogs/shared/access.ts`, so the plain import works again.
- **Imports into the market (SW471).** `features/market/index.ts` lists what other features use, beside `marketRoutes` and `marketStandaloneRoutes`. Pointing every outside import at it made one import cycle of 45 files (the market screens, `app/Shell`, `app/TabBar`, `features/inbox/useNeedsYou`, back to the index). Eight outside files keep a deep import because dropping any one brings the cycle back, found with a module-graph search: `app/TabBar.tsx`, `app/routes.ts` (`market/routePaths`), `app/home/StartRows.tsx`, `features/inbox/useNeedsYou.ts`, `features/inbox/needsYou.ts`, `features/started/api.ts`, `features/started/done.ts` and `features/steps/api.ts`. Rule 5 therefore allows a deep import only where the index would make a cycle, and each such import is listed by name in `src/layoutRules.test.ts`, which guards `market` since SW471. Lifting the open-steps reader and the product-name and unit-word helpers out of the market into a shared home removes the exceptions. The two `vi.mock` calls in `app/home/home.test.tsx` still name the deep modules, because a mock replaces the module the index re-exports.
- **Imports into the backlogs (SW456).** `backlogs/index.ts` now exports what the other features use: the routes, the API client and its types (`Backlog`, `BacklogsClient`, `Issue`, `allIssuesId`, `fetchAll`, `issueOf`, `itemsOf`, `mcpBacklogsClient`, `settled`, `taskTools`), `askMayRead`, `IssueCard`, `markNames`, the paths (`issuePath`, `issuesPath`, `smartBacklogPath`), `CapTintScope`, the chat cards (`BacklogViewCard`, `BacklogSummariesLoader`, `backlogViewKind`) and the smart-rule vocabulary (`FIELD_IDS`, `FieldId`, `fieldSpec`, `fieldSpecs`, `operatorLabel`, `DURATION_UNITS`, `PRIORITIES`). Twenty-eight outside files import it. Two files keep a deep import because the index would make a cycle of 27 files through the backlogs screens, `shared/ui/Shell`, `shared/ui/TabBar` and `inbox`: `inbox/assignedIssues.ts` (`shared/api`) and `home/lastBacklog.ts` (`shared/api`). Both are listed in `layoutRules.test.ts`, which fails when one of them is fixed.
- **`shared/` imports nothing from a feature (SW504).** The 15 imports SW486 found are gone and `layoutRules.test.ts` lists none. `Shell`, `TabBar`, `TopBar` and `TabPage` went to `app/` with their tests (and `AccountMenu.test`, which renders the `TopBar`): they read the inbox, the market's open steps, `tabs` and `routes`, so they are the shell, and `Shell` had to follow because it holds the other two. The language (`language.ts`, `words.ts`, `swahili.ts`, `magyar.ts`) went to `shared/language/` as app-wide state: one stored choice read by fourteen features, `AgeBubble`, `LanguageChoice` and `age`. `features/agency/open.ts` went to `shared/wakala/openAgency.ts`: the open agency id scopes every tool call `shared/wakala/mcp` makes, and 216 files read it; its path helpers moved with it. `JoinForm` went to `features/market/shared/` because only two market screens use it. The `memberId` and `resolveMember` tests moved from `shared/wakala/me.test` to `features/market/supply/member.test.ts`.

- **The shell (SW492).** `main.tsx`, `App.tsx`, `routes.ts`, `screen.ts`, `tabs.ts`, `app.css`, `tokens.css`, `test-setup.ts`, `home/` and `menu/` are in `src/app/`, with the tests that sat beside them. `index.html` loads `/src/app/main.tsx` and `vite.config.ts` loads `./src/app/test-setup.ts`. Three root tests were placed by what they read: `layoutRules.test.ts` stays at the top of `src` because it reads the whole source tree, `demoConfig.test.ts` stays because it scans the whole source tree and tests `demoConfig.ts` outside `src`, and `backlogToolNames.test.ts` went to `features/backlogs/` because it reads only that folder.

## Still to settle

- A barrel is not added to a feature that nothing outside imports.

## How the move is done

The recipe the agents followed, one issue each:

1. One detached worktree per issue, made off `dev`: `git worktree add --detach <path> dev`, with `code/app/node_modules` linked in from the main tree. Nothing is pulled, fetched or pushed from it, and the main tree is not touched.
2. The change is a rename plus import fixes and nothing else: `git mv`, every import, CSS import, `vi.mock` path and path string updated, no behaviour changed, no comments in code.
3. `npm run typecheck` and `npm test` pass in the worktree. A test that fails only with "timed out in 5000ms" while other agents run is re-run on its own, and the Log says so.
4. The folder table in [phone-app.md](phone-app.md) is updated in the same commit.
5. The agent writes a Log entry as each step finishes and moves the card to Done.
6. The lead checks the commit, the Log and the card, then cherry-picks the commit onto `dev`. Commits made before an earlier move landed conflict on import lines and on the folder table. In the moved folder's own files the agent's side is kept, since its relative paths are right; everywhere else `dev`'s side is kept and the old folder names are re-pointed with a script that works out each relative path from the file's own place. The folder table is merged by hand. Typecheck must be clean before the pick is committed.
7. When the commit is on `dev`, the worktree is removed.

A move that rewrites imports across many files, like the market index, is applied last, on the final tree, because every earlier or later move would conflict with it.

The moves are made in this order: backlogs, market, `pages/`, then the top-level groups. A new file goes into its feature on the day it is written, even before that feature has been moved.

From `code/app`, `node scripts/moveFolder.mjs <from> <to>` (paths under `src`) moves a folder and re-points every relative import, CSS import and `vi.mock` path; `--dry` lists the changes first. It prints every path string it cannot rewrite as `check by hand`: fix those, then run typecheck and the moved folder's tests.
