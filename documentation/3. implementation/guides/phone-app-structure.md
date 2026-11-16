# Phone app: how `src` is organised

Decided on 2026-11-16 with the owner. This page is the strategy; [phone-app.md](phone-app.md) still describes the folders as they are today and moves to this layout as the work lands. Until then, a folder named here that does not exist yet is a target, not a fact.

## Why this page exists

`code/app/src` has 775 files in 36 top-level folders, and four ways of grouping sit side by side:

| Grouping | Folders |
|---|---|
| By feature | `backlogs`, `chat`, `files`, `market`, `forms` |
| By layer | `ui`, `wakala`, `storage`, `pages` |
| By role | `coordinator`, `council` |
| By journey | `started`, `steps`, `entry`, `journeys` |

Three things follow from that:

- `pages/` repeats the feature folders. The Market screens are in `pages/market` and its logic in `market/`; the same split holds for supply, started, chat, entry, forms and join. One change opens two folders.
- Backlogs are in about ten places: `backlogs`, `backlogAccess`, `backlogBoard`, `backlogManage`, `backlogPage`, `smartBacklog`, `sendToBacklog`, `journeys/backlogs`, `chat/backlogCards` and `assistant/namedBacklog`.
- The market is in five: `market`, `supply`, `buy`, `sell` and `pages/market`.

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
6. **Each feature owns its routes.** A feature's `routes.tsx` lists its paths and screens and is exported through its `index.ts`. The root route file only joins them, the way `BacklogsRoutes.tsx` and `FilesRoutes.tsx` already do.
7. **Tests sit beside the code they test.** Test support used by one feature stays in that feature; support used by several goes in `shared/`.

## Target layout

```
src/
  app/
    main.tsx  App.tsx  routes.ts  tabs.ts  tokens.css  app.css
    home/  menu/
  features/
    backlogs/
      board/  manage/  smart/  access/  issue/  send/  shared/
      index.ts  routes.tsx
    market/
      buy/  sell/  supply/  product/  shared/
      index.ts  routes.tsx
    chat/  assistant/  files/  steps/  started/  forms/  inbox/
    entry/  account/  consent/  people/  groups/  agency/  council/  risks/  apps/
  shared/
    ui/  wakala/  storage/
```

## Where today's folders go

| Today | Goes to |
|---|---|
| `backlogs`, `backlogAccess`, `backlogBoard`, `backlogManage`, `backlogPage`, `smartBacklog`, `sendToBacklog`, `journeys/backlogs`, `chat/backlogCards` | `features/backlogs/`, one sub-folder per screen area |
| `market`, `buy`, `sell`, `supply`, `pages/market`, `pages/supply` | `features/market/` |
| `pages/chat`, `pages/forms`, `pages/started`, `pages/entry`, `pages/join` | the feature folder of the same name |
| `ui`, `wakala`, `storage` | `shared/` |
| `home`, `menu`, `tabs.ts`, `routes.ts`, `App.tsx`, `main.tsx`, the CSS tokens | `app/` |
| every other feature folder | `features/`, unchanged inside |

## Still to settle

Each is decided when its folder is reached, and the answer is written here.

- `coordinator`: decided on 2026-11-16 (SW468). Both folders are market screens: `coordinator/payments` is the group-order order cards and payments pages, and `coordinator/start` starts a group order and picks its product, all through `market_*` tools. They are now `market/payments` and `market/start`, and `coordinator/` is gone. `market/start/api.ts` and `startWaiting.ts` also feed home, inbox, steps and started with the member's open steps; lifting that reader out of the market is a later step.
- `council`: named by role, not by feature; still to settle when its folder is reached.
- `journeys/`: the walk tests and their `*.test-support` files span features. They will either stay together under one folder or each move to the feature it walks.
- `assistant/namedBacklog.ts`: it belongs to the assistant or to `backlogs`.
- A barrel is not added to a feature that nothing outside imports.

## How the move is done

- One feature at a time, backlogs first, then market, then `pages/`, then the top-level groups.
- Each step is a move with import updates and nothing else, and `npm run typecheck` and `npm test` pass before the next step starts.
- The step that moves a folder updates [phone-app.md](phone-app.md) in the same change.
- A new file goes into its feature on the day it is written, even before that feature has been moved.
