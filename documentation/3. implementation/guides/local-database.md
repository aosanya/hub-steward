# Local database

A Postgres and sign-in service for the API. Developers use a local one, run in Docker with the Supabase command-line tool. A hosted Supabase project works the same way and is the choice for a shared or online setup: see [Use a hosted project](#use-a-hosted-project). Use either to try member sign-in by emailed link. Without one the API uses SQLite and the phone app cannot sign members in.

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

## Use a hosted project

Create a project at [supabase.com](https://supabase.com) and use it in place of the local one. The API needs the same three settings either way: `DATABASE_URL`, `SHOP_SUPABASE_URL` and `SHOP_SUPABASE_ANON_KEY`.

1. Link the project and apply the migration, from the repository root:

   ```sh
   supabase login
   supabase link --project-ref <project ref> --workdir code
   supabase db push --workdir code
   ```

2. Change the role's password before anything connects. `code/supabase/migrations/20261104000000_identity.sql` creates `wakala_api` with the password `wakala_local`, which is written in this repository and is only safe on your own machine. In the project's SQL editor run:

   ```sql
   ALTER ROLE wakala_api PASSWORD '<a long random password>';
   ```

3. Set the three variables from the project's settings:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the project's connection string, with user `wakala_api` and the new password |
   | `SHOP_SUPABASE_URL` | `https://<project ref>.supabase.co` |
   | `SHOP_SUPABASE_ANON_KEY` | the project's anon key |
   | `MEMBER_APP_ORIGINS` | the address the phone app is served from |

4. In the project's Auth settings, add the phone app's sign-in address (`<app address>/sign-in/link`) to the allowed redirect URLs and set up how the project sends mail. `code/supabase/config.toml` holds the local settings only; it does not configure a hosted project.

Keep the anon key and the password out of git. Use a separate project for tests and demos, not one that holds real members.

## Checked and not checked

Checked on 2026-11-04: the migration is applied, the `wakala_api` role signs in with the password above, the four functions exist, and the sign-in service and inbox answer.

Not checked: the API running against this database, and an emailed link end to end. The hosted steps are written from the migration, the API's settings and Supabase's command-line tool; they have not been run against a hosted project.

The password and demo keys are for this machine only.
