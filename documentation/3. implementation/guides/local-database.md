# Local database

A local Postgres and sign-in service for the API, run in Docker with the Supabase command-line tool. Use it to try member sign-in by emailed link. Without it the API uses SQLite and the phone app cannot sign members in.

## Start and stop

```sh
supabase start --workdir code
supabase status
supabase stop --workdir code
```

The first start pulls several images. It applies `code/supabase/migrations/`, which creates the `wakala_api` role and the four sign-in functions the API calls.

## Point the API at it

Set these in `.env`, from `supabase status`:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://wakala_api:wakala_local@127.0.0.1:54322/postgres?sslmode=disable` |
| `SHOP_SUPABASE_URL` | `http://127.0.0.1:54321` |
| `SHOP_SUPABASE_ANON_KEY` | the anon key `supabase status` prints |
| `MEMBER_APP_ORIGINS` | `http://localhost:8081`, or `http://localhost:5171` for `npm run dev` |

From a container, use `host.docker.internal` in place of `127.0.0.1`. On Linux the service also needs `extra_hosts: ["host.docker.internal:host-gateway"]`.

## Sign in on the phone app

Invite an address with `POST /instances/<hub id>/invitations` on the API, with `{"email": "...", "redirect_to": "http://localhost:8081/sign-in/link"}`. The message arrives in the local inbox at <http://127.0.0.1:54324>; its link signs you in.

## Checked and not checked

Checked on 2026-11-04: the migration is applied, the `wakala_api` role signs in with the password above, the four functions exist, and the sign-in service and inbox answer.

Not checked: the API running against this database, and an emailed link end to end.

The password and demo keys are for this machine only.
