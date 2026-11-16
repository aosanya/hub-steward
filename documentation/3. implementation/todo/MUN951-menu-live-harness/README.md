# MUN951 Menu live 0: harness that signs in, posts data to the QA hub and cleans up

## Request

A harness for the live Menu specs: one helper that signs a person in to the QA stack, posts data to the QA hub as that person, shoots the phone app and cleans up what it posted, proved by a smoke spec.

## What changed

`code/console/e2e/menu-live/helpers/live.ts` already held `signIn`, `post`, `seedJourney`, `cleanup` and `shootLive` from the earlier menu-live commits c3689361, 86312118 and a624998c. Only the smoke spec `code/console/e2e/menu-live/smoke-live.spec.ts` and its screenshot were added, in commit e9dc2b69.

## Proof

- The smoke spec passes, 1 passed, against API 8183 and the phone app on 5181.
- The screenshot is `documentation/4. qa/testing/03-screenshots/menu-live/00-smoke/01-home.png`.
- The phone app bundle served on 5181 contains the Menu section rows.

## More

The helper is described in [the menu live harness page](../../../4.%20qa/testing/menu-live-harness.md).
