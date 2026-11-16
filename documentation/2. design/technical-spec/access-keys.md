# Access keys page

The console page where a person makes, sees and revokes the keys they use as the password of a git clone. Drawn for ISS-100, part of ISS-86. The drawing is [`settings/access-keys.html`](../mockups/console/settings/access-keys.html) in the console mockups, four screens. How a key is made today and why this page is the gap is on [Git key today](../git-key-today.md); the sign-in rule for the git route is on [Git over HTTP for the hub](../git-remote.md).

## Where it is reached from

Settings > Access keys, the third row of the Settings group after General and Models, route `#/settings/access-keys`, in every agency's menu. It sits in the open hub because the clone line it shows is for that hub's repository. The keys themselves are the person's, not the hub's: the list is the same in every hub the person opens. Make a key is a second page, Settings / Access keys / Make a key. The phone app has no screen for keys.

As built in the console (`pages/keys/AccessKeysPage.tsx`), Make a key is not a second page: the Name field and Make key sit on the Access keys page above the list, the new key appears under them with its Copy button, and the menu id is `access-keys`, the last row of Settings.

## Screens

| # | Screen | What is on it |
|---|---|---|
| 1 | Access keys, two keys | A table of Name and Made on, a Revoke button at the right end of each row, and the one accent button Make a key at the right end of the title row. |
| 2 | Access keys, none yet | An empty-state card with one sentence and Make a key inside it. |
| 3 | Make a key, the name typed | One field, Name, and the buttons Make key and Cancel. |
| 4 | Make a key, after Make key | The notice "The key desktop was made.", the key with a Copy button, the words "It will not be shown again.", the line `git clone http://<host>/git/<agency>/hub-steward-flutter-app.git` and "When git asks for a password, paste the key.", then Done, which goes back to the list. |

The key is read-only text with a Copy button. It is shown on screen 4 only; the list never has it, because the API returns it once. A revoked key is not in the list. Nothing else is on the page: no last-used, scope, expiry or count column, no confirmation before Revoke.

## Routes it calls

| Action | Route | Needs | Result used |
|---|---|---|---|
| Open Access keys | `GET /auth/api-keys` | The `wakala_session` cookie the console already holds from `POST /auth/signin` (`credentials: "include"` in `code/console/src/wakala/rest.ts`) | `id`, `name`, `created_at` of each key; a key with `revoked_at` is left out |
| Make key | `POST /auth/api-keys` with `{"name": "<Name>"}` | The same cookie | 201 with `token` (`wak_<id>.<secret>`), shown once on screen 4 |
| Revoke | `DELETE /auth/api-keys/{keyID}` | The same cookie | 204; the row leaves the list. A second revoke answers 404. |

A name must be 1 to 200 bytes (400 otherwise) and a person may hold 100 live keys (409 otherwise); the page shows the API's message under the field. No new route is needed.

## The clone line

`http://<host>/git/<agency>/<repository>.git` as in [Git over HTTP for the hub](../git-remote.md): `<host>` is the address the console reaches the API on, `<agency>` is the open hub's instance id and `<repository>` is the repository's name. The drawing shows the Hub Steward SWE hub (instance `6b5149a7-da75-4493-a5a0-2ffe550cdae7`) and its `hub-steward-flutter-app` repository. The page shows one line for one repository; how a hub with several repositories chooses is not drawn.

## Words

The page says key and Access keys, the word the issue uses, and not "API key" (the route's name) or "token" (the reply's field). The console already uses "key" for the model key on Models.

## Open questions

These are the questions on [Git key today](../git-key-today.md) as they apply to the drawing, each with its recommendation. The drawing follows the recommendations.

1. Where do keys live, console only or also the phone app? Recommendation: console only. The phone app's members signed in by magic link hold no cookie and cannot make a key.
2. Is the key shown once, with the clone line beside it? Recommendation: yes, as drawn on screen 4.
3. A last-used time? Recommendation: not first. It needs a new column written on every request.
4. A key scoped to one repository? Recommendation: no. The role in the agency already decides read and write.
5. A key that expires? Recommendation: no for the first release.
6. Is the cap of 100 live keys per person enough? Recommendation: yes.
7. Do revoked keys stay in the list? Recommendation: hide them, as drawn; the rows stay and the route still returns `revoked_at`.
8. May an owner see and revoke an agent's key? Recommendation: yes, later, as the same page filtered by the agency, not a second page.
9. Should the page sit under Settings of a hub, as drawn, or on the page before a hub is open, since the keys are the person's? Recommendation: under Settings, because the clone line belongs to a hub.
