# Front end

Status
- Installed app: the worker caches built files only, navigations are network first with the shell as fallback and no timeout, and a deploy re-downloads the whole precache (`mwanachama-frontend-member/pwa/worker.ts`, `pwa/plugin.ts`). Turned into performance 59. Open, build work.
- studio `people/members.html`: the Invite a user button (screens 1 and 4) has no page behind it and the Filled by lines name no invitation tool, though the API has batch check and send. Turned into Q122.

- The studio has no route for workflows, test, records or publish; workflow words appear only in the chat components (open; `mwanachama-wakala-studio/app/routes.ts`).
- The member app has no route for Manage payments or the Records pages (open; `mwanachama-frontend-member/app/routes.ts`).

Log
- The built Add payment form (`mwanachama-frontend-member/app/routes/payment-new.tsx`) reads the record's list name only as a yes or no and fills the picker from all actors; see `app-gaps.md` entry 57 and `performance.md` entry 41. Open.

## 2026-10-29 14:05 UTC

First run. Read the workflow and test pages, the agency, catalog and forms blueprints and operations, wakala-api's market tools and tests, and the studio and member routes. The market module repo is not checked out, so its side is unread.

- The member app draws no post attachment: no file under `mwanachama-frontend-member/app` handles `attachment_kind`, yet the farm room draws a group order card. Open; turned into Q88 for the card's state (parked 2026-10-29, revisit 9 Nov).

## 2026-10-29 18:35 UTC

Looked for attachment handling in the member app; none.

## 2026-11-02 22:35 UTC

Still true: the studio `app/routes.ts` has no workflows, test, records or publish route (only `agency-published`). `mwanachama-frontend-shared` is the Flutter design kernel with no workflow or wakala code, so it holds nothing to trace.

## 2026-11-03 03:00 UTC
Checked the Invite a user button against the API.

## 2026-11-04 02:40 UTC

Read the member app's payments api and form. One bullet added.

## 2026-11-04 22:40 UTC

Read the member app's order card (`chat/share-offer.ts`): state is parsed from English chat text and the whole thread is replayed per render (cheap at room scale, a few hundred messages). Opened app-gaps 61, turned into Q135. No code changed since the last run.

## 2026-11-06 UTC

Read the install and offline code (worker, plugin, register, useOnline, outbox). Nothing in the design page set changed since the last run.
