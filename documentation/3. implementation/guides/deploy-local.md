# Deploy locally in Docker

A separate environment from the one developers run by hand: Postgres with sign-in, the API, the console and the phone app, all in containers under one Docker Compose project, `hubsteward-local`. It touches nothing the Supabase command-line tool or `make up` at the repository root started.

The files are in [deployment/local/](../../../deployment/local/). Docker Compose is the tool for this; Ansible is for configuring remote machines and belongs to a later server deployment.

## Start and stop

```sh
cd deployment/local
make up
make down
```

From the repository root, `make deploy-local` and `make deploy-local-down` run the same two.

`make up` refuses to run unless the checkout is on `master`. It writes `.env` on the first run, with fresh random passwords, a signing secret and an anon key signed with it, then builds and starts everything and prints the addresses. `make down` stops the containers and keeps the data. There is no reset target; the database volume is deleted only by hand. `make logs` and `make ps` show what is running.

## Error log

The API appends every error-level record, including each request that ends in a 5xx, as one JSON line to `deployment/local/logs/api-errors.log` (the container's `WAKALA_ERROR_LOG`). Everything else stays on the container's output, which `make logs` shows. The `.log` files are ignored by git.

## The SWE hub and its todos

When `OWNER_EMAIL` and `OWNER_PASSWORD` are set in `deployment/local/.env`, `make up` ends by running `scripts/seed-swe.sh`:

1. It creates that owner sign-in if it does not exist, with the admin token, and signs in. The password must be at least 12 characters.
2. It imports `hub-steward-swe/agency/agency.json` as the hub "Hub Steward SWE" and publishes it as `v1` on the production channel. A hub with that name already owned by this sign-in is left alone.
3. It mints an API key, runs the `hub-steward-swe` loader over every `todo.md` and `todo_*.md` in every `mwanachama-*` repo and under `projects/`, then revokes the key. A second run creates no issue twice.

The script expects `hub-steward-swe` as a sibling of this repository and the repos in the folder above `projects/`, and needs `go` and `jq`. Missing any of these, or the two settings, it says so and `make up` still succeeds. `SWE_AGENCY_FILE`, `SWE_LOADER_DIR` and `BOARDS_ROOT` point it elsewhere.

Not done by this script: the Product owner group and the Triager's seat in it ([the loader page](../../../../hub-steward-swe/documentation/3.%20implementation/loader.md) says why), and people, groups or forms.

## Addresses

| What | Address | Setting |
|---|---|---|
| Console | <http://localhost:8090> | `CONSOLE_PORT` |
| Phone app | <http://localhost:8091> | `APP_PORT` |
| API | <http://localhost:8092> | `API_PORT` |
| Mail inbox | <http://localhost:8093> | `INBOX_PORT` |
| Sign-in service (Supabase address) | <http://localhost:54421> | `SUPABASE_PORT` |
| Postgres | `localhost:54422` | `DB_PORT` |

The ports differ from the developer stack (8080 to 8082, 54321 to 54324) so both can run at once. Everything listens on 127.0.0.1 only. Change a port in `.env`; the API's allowed origins and the sign-in redirect follow it.

## What runs

| Service | What it does |
|---|---|
| `db` | Supabase Postgres 17 |
| `auth` | Supabase sign-in service; emailed links go to `mail` |
| `rest` | Supabase REST service |
| `supabase-gateway` | nginx sending `/auth/v1/` to `auth` and `/rest/v1/` to `rest`, the one address the API uses as `SHOP_SUPABASE_URL` |
| `mail` | Mailpit, the inbox for sign-in links |
| `migrate` | Runs once: applies `code/supabase/migrations/`, then sets the `wakala_api` password from `.env` in place of the one written in the migration |
| `wakala-api` | The API, on Postgres through `DATABASE_URL` |
| `console`, `app` | Built from `code/console` and `code/app`, served by nginx, which forwards API paths to `wakala-api` |

## Sign in on the phone app

Invite an address with `POST /instances/<hub id>/invitations` on the API, with `{"email": "...", "redirect_to": "http://localhost:8091/sign-in/link"}`. The message arrives in the inbox on port 8093.

## Checked and not checked

Checked on 2026-11-10: the database, sign-in service, REST service, gateway, migration, API and phone app start and report healthy; the four sign-in functions exist; the sign-in service accepts the generated anon key and delivers a sign-in message to the inbox.

Not checked: the console image, which does not build while `code/console/src/ui/RowTools.test.tsx` fails `tsc --noEmit` at line 83; the emailed link followed through the phone app; the API's invitation route against this database.

## Moving to a server

For a remote machine, keep this compose file and add a sibling folder under `deployment/` holding the Ansible playbook that installs Docker, copies the folder and runs `make up`. Replace the `localhost` origins, put TLS in front, and read [Use a hosted project](local-database.md#use-a-hosted-project) before using a hosted database in place of `db`.
