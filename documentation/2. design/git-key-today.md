# Git key today

How a person or an agent gets a `wak_` key at this moment, and what is missing before a person can use it as the Basic password in [Git over HTTP for the hub](git-remote.md). It answers that page's open question 2 with what exists. Part of ISS-86. Everything below was tried against a throwaway copy built from `dev` at `72608dc0` (a clean `git archive` of `code/wakala-api`, sqlite file, own port, no `.env`), which was stopped and deleted afterwards. The owner's hubs were not touched.

## How a key is made today

| Who | Request | Needs | Result |
|---|---|---|---|
| A person, for themselves | `POST /auth/api-keys` with `{"name":"laptop"}` | The `wakala_session` cookie. A Bearer key or a project sign-in token is refused with 401 `not signed in`, so a leaked key cannot mint another. | 201 with `id`, `name`, `created_at` and `token` (`wak_<id>.<secret>`). The key acts as that person everywhere that person has a role. |
| An owner, for an agent of one agency | `POST /instances/{instanceID}/api-keys` with `{"name":"coding agent"}` | The cookie, and the caller is an owner of that agency. An agent is refused with 403; a stranger gets 404. | 201 with `id`, `name`, `instance_id`, `role: "agent"`, `created_at`, `token`. The key is its own member of that agency only. |
| The host's operator, for a service | `POST /auth/service-keys` | The admin token. Not for people. | Not used by git. |

The cookie comes from `POST /auth/signin` with an email and password. That password sign-in is created by the host with `POST /auth/credentials` and the admin token; neither the console nor the phone app calls that route. A member who signs in to the phone app by magic link holds a project sign-in token and no cookie, so they cannot call either mint route.

The only caller of the mint route in the repository is `deployment/local/scripts/seed-swe.sh`, which signs in, mints a key named `loader`, runs the loader and revokes the key.

## What was tried

| Step | Result |
|---|---|
| Sign in as a test person (credential created with the admin token, then `POST /auth/signin`) | 201, cookie set, valid for 30 days |
| `POST /auth/api-keys` with no cookie | 401 `not signed in` |
| `POST /auth/api-keys` `{"name":"laptop"}` with the cookie | 201, `wak_<uuid>.<32 characters>` returned once |
| `GET /auth/api-keys` | 200, the key with `id`, `name`, `created_at`; no token |
| MCP `initialize` on `/mcp` with `Authorization: Bearer wak_...` | 200, server `mwanachama-wakala` answers |
| The same with the key as the Basic password (`anyone:wak_...`) | 401 `authentication required`, challenge is `Bearer` only. `/mcp` does not read Basic; the git route is the one that does. |
| `POST /auth/api-keys` with the key as Bearer | 401 `not signed in` |
| `DELETE /auth/api-keys/{id}` with the cookie | 204 |
| The same MCP call with the revoked key | 401 `authentication required` at once, on this one process |
| `DELETE` the same id again | 404 `not found` |
| `GET /auth/api-keys` after | The key is still listed, now with `revoked_at` |
| A second person revokes or lists the first person's key | 404 and an empty list: a key is visible only to whoever minted it |
| An owner mints a per-agency key on a new agency | 201, `role: "agent"`. As Bearer it lists that agency; `GET /instances/{id}/forms-git/repositories` answers 200 with `[]`. It cannot mint (401). |
| A name of 300 characters | 400 `name is too long` (limit 200 bytes); an empty name 400 |
| A person mints until refused | 100 keys, then 409 `this account already holds 100 live API keys; revoke one before minting another` |
| `GET /git/<agency>/<repository>.git/info/refs` on the copy | 404 for everyone, with and without a key. The line `mux.Handle(gitRoutePrefix, d.GitRouteAuth(d.GitRoute()))` is not in `router.go` at `dev` HEAD; it sits uncommitted in the shared working tree. So the git route could not be exercised live. Its sign-in is covered by the Go tests in `git_route_auth_test.go`. |

## What a person sees and where

| Place | Screen for keys |
|---|---|
| Console (`code/console`) | None. No page, menu entry or string mentions an API key. |
| Phone app (`code/app`) | None. The Account section has Profile, Language and Sign out. |
| Flutter app (`projects/hub-steward-app-flutter`) | None. `lib/main.dart` is a 122-line starter. |
| Documentation | `git-over-http.md` states there is no screen and a key is made with the routes. |

What the routes return for a key, and what they do not:

| Property | Today |
|---|---|
| Shown once | Yes. The token is only in the 201 reply; the list never has it and the secret is stored as a SHA-256 digest. A lost key is made again. |
| Name | Required, 1 to 200 bytes, free text, returned in the list. Two keys may share a name. |
| Created | `created_at` is returned. |
| Last used | Not stored. The key row has no such column, so nothing can show it. |
| Scope per repository | None. A personal key is the person; a per-agency key is one agency's agent. |
| Expiry | None. A key lives until revoked. |
| How many | 100 live keys per person, counted across personal and per-agency keys the person minted. Revoked keys do not count. |
| Revoking | `DELETE /auth/api-keys/{id}` with the cookie, by whoever minted it. Revoked keys stay in the list, with `revoked_at`, for ever. Another API process may keep accepting the key for up to 5 seconds (`backends.md`). |
| Listing | `GET /auth/api-keys` returns personal and per-agency keys together; a per-agency key has `instance_id`. |

## Gap list against the design page

| Gap | Blocks a person from using git | Filed |
|---|---|---|
| No screen anywhere to make, see or revoke a key. A person must run `curl` with a session cookie they have to extract from a browser. | Yes | Issue below |
| The token is shown once, in the mint reply only. That fits git, as long as whatever shows it also shows the `git clone` line and a copy control, so it is not lost. | Part of the screen | Same issue |
| A member who signed in to the phone app by magic link cannot mint, because the mint routes read the cookie only. | Only if keys live in the phone app | Open question 1 |
| No name beyond the one label at minting; no last-used. | No: a person can tell keys apart by name and revoke by creation time | Not filed |
| No scope per repository. | No: role in the agency already limits what a key may clone or push (decision 3 of the design) | Not filed |
| No expiry. | No: a person revokes by hand | Not filed |
| `/mcp` does not read Basic. | No: the git route does, per the design | Not filed |
| The git route is not mounted at `dev` HEAD (one uncommitted line in `router.go`). | Yes, but it belongs to ISS-89 | Not filed here |

## Questions for the owner, with a recommendation

1. Where do keys live: console only, or also the phone app? Recommendation: console only. A person who clones a repository is an owner or a developer who already has a password sign-in and a cookie there; the phone app's members signed in by magic link cannot mint anyway, and giving them a way means changing the cookie rule.
2. Should a key be shown once, as now? Recommendation: yes, with the clone line shown beside it.
3. Should a key have a last-used time? Recommendation: not first. It needs a new column written on every request; the name and revoke already cover a lost laptop.
4. Should a key be scoped to one repository? Recommendation: no. The role in the agency already decides read and write, and a per-repository scope is a second place to forget.
5. Should a key expire? Recommendation: no, for the first release. A person with many machines would find an expiry a second thing to remember.
6. Is the cap of 100 live keys enough for git? Recommendation: yes. It counts keys per person, not per machine, and 100 is far above any real use.
7. Should revoked keys stay in the list? Recommendation: hide them on the screen and keep the rows, since the route already returns `revoked_at`.
8. Should an owner be able to see and revoke an agent's key from the agency? Recommendation: yes, but it is the same page filtered by the agency, not a second page, and it can follow the first screen.

## Issue filed

ISS-100, in the `git-per-repo-sqlite` backlog at To do: a console page to make, see and revoke access keys. It assumes question 1 is answered console only; if the owner answers otherwise, the issue's where changes and nothing else.
