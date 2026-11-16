# Menu live harness

The live Menu specs under `code/console/e2e/menu-live/` run against the real QA stack, not against drawings. They all use one helper, `code/console/e2e/menu-live/helpers/live.ts`, which signs a person in, posts data to the QA hub, shoots the phone app and cleans up after itself.

## Ports

| What | Port |
|---|---|
| Hub API | 8183 |
| Phone app | 5181 |
| Console | 5180 |

Port 8082 is the owner's own hub and is never a target. The QA stack is never restarted from a helper; if it is down, the step is recorded as blocked.

## Helper functions

- `signIn(page, who)` signs the person in once and reuses the session. The cookie is read from `/tmp/hubsteward-qa/<who>.cookies` or from the process, and only a missing or dead session triggers a real sign-in with `/tmp/hubsteward-qa/<who>.password`, because five failed sign-ins lock an email for 15 minutes with a 429. It then sets the session cookie, opens the picked agency, accepts the consent screen if it appears and waits until the app's fetches have been quiet for half a second.
- `person(who)` returns the cookie and the picked agency for that person.
- `agencyNamed(name)` chooses the agency by name. It is needed when a person holds several agencies; own14 holds 05-mounts and Zöldhalom Town Council. With no name the first agency is used.
- `post(who, tool, args)` calls a hub MCP tool with `tools/call` on API 8183 as that person, with the agency id filled in.
- `seedJourney(journey, who = own14)` returns a `Journey` whose `prefix` is the journey name. `named(item)` gives `<journey> <item>`, so every record a journey makes is recognisable. `post(tool, args, undo)` posts as the journey's person and remembers the undo call.
- `cleanup(journey)` replays the remembered undos in reverse order.
- `shootLive(page, journey, step)` saves `03-screenshots/menu-live/<journey>/<NN>-<step>.png` under this folder, numbering from 01 and clearing the old pictures of the journey at the start of a run.

## Running

```
cd code/console && E2E_BASE_URL=http://127.0.0.1:5181 npx playwright test e2e/menu-live/smoke-live.spec.ts
```

The npm script `e2e:menu-live` runs the whole `menu-live` folder with the same base URL.

## Smoke spec

`00-smoke` in `smoke-live.spec.ts` signs in as own14 on Zöldhalom Town Council, raises one `00-smoke smoke record` with `forms_catalog_raised_item_raise`, opens Home, shoots it and removes the record with `forms_catalog_raised_item_remove`. A removed record still shows in `forms_catalog_raised_item_list_mine`, so removal is checked in `forms_catalog_removal_list_mine`.

Evidence for the issue that added the spec is in [MUN951](../../3.%20implementation/todo/MUN951-menu-live-harness/README.md).
