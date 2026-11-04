# Import a demo agency and get a login

A runbook for a person or an agent. At the end there is a local console login and the two demo agencies (the Siaya lab and the Siaya Farmers' Group) imported into your own local database. Every command here was run on 4 November 2026 on a Mac with Docker Desktop, Go 1.25 or newer and Node 22.

## Rules

- Local only. Never point `DATABASE_URL` at a hosted or shared database for this.
- Never print, log, paste into chat or commit a key. The `.env` file is ignored by git; `.env.example` is the template.
- Do not stop or remove containers you did not start. Pick free ports; if a port is taken, use another and say so.
- An agent follows the steps in order and checks the expected result before the next step.

## 1. Settings

```sh
cp .env.example .env
```

Leave `.env` for step 3. The values in `.env.example` marked local-only are public defaults: fine for this machine, not for anything reachable from other machines.

## 2. Start the local database

```sh
cd code && supabase start
```

Expected: ends with `Started supabase local development setup` and a list of local URLs. The database is on `127.0.0.1:54322`, the sign-in service on `127.0.0.1:54321`, the mail inbox on `http://127.0.0.1:54324`. The first run downloads about ten images.

Copy the anon key into `.env` without printing it elsewhere:

```sh
supabase status -o env | grep '^ANON_KEY=' | cut -d= -f2- | tr -d '"'
```

Put that value after `CATALOG_SUPABASE_ANON_KEY=` in `.env`.

## 3. Start the API

Without Docker, from a folder that has no other `.env`:

```sh
cd code/wakala-api && go build -o /tmp/hubsteward-api ./cmd/server
mkdir -p /tmp/hubsteward-run && cd /tmp/hubsteward-run
env -i PATH="$PATH" PORT=8082 \
  WAKALA_ADMIN_TOKEN=local-admin-token \
  WAKALA_SESSION_SECRET=local-only-session-secret-change-before-sharing \
  AI_MASTER_KEY=local-only-master-key-change-me0 \
  MEMBER_APP_ORIGINS=http://localhost:3001 \
  DATABASE_URL='postgresql://wakala_api:wakala_local@127.0.0.1:54322/postgres?sslmode=disable' \
  CATALOG_SUPABASE_URL=http://127.0.0.1:54321 \
  CATALOG_SUPABASE_ANON_KEY="<the anon key from step 2>" \
  /tmp/hubsteward-api
```

Or with Docker, from the repository root: `docker compose up --build`.

Expected: `curl http://127.0.0.1:8082/healthz` answers `{"status":"ok"}`. Without `DATABASE_URL` the server stops at once and says so; that is correct.

## 4. Create the login and import the agencies

From the repository root:

```sh
API_URL=http://127.0.0.1:8082 \
WAKALA_ADMIN_TOKEN=local-admin-token \
LOCAL_EMAIL=judge@example.com \
LOCAL_PASSWORD='choose a password of 8 or more characters' \
sh scripts/local-setup.sh --demos
```

Expected output, one line per step:

```
made the console login judge@example.com        (or: console login already there: ...)
registered the hub-steward service              (or: service hub-steward already registered)
imported demo hub: Siaya lab                    (or: demo hub already there: Siaya lab)
imported demo hub: Siaya Farmers' Group
console: http://localhost:3000  log in with judge@example.com and the password ...
```

The script is safe to run again: a second run creates nothing twice.

Check it worked:

```sh
curl -s -c /tmp/hs.jar -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8082/auth/signin \
  -H 'Content-Type: application/json' \
  -d '{"email":"judge@example.com","password":"<the password>"}'
curl -s -b /tmp/hs.jar http://127.0.0.1:8082/instances
```

Expected: `201`, then a list with both hubs.

## 5. Open the console

With Docker the console is at `http://localhost:3000`. Without it:

```sh
cd code/console && npm ci
WAKALA_URL=http://localhost:8082 npm run dev
```

Open `http://localhost:5173` (use `localhost`, not `127.0.0.1`) and press Log in with the email and password from step 4. The hub list shows both hubs.

## What you will see, and what you will not

- Saving a change files an approval; the change appears once someone presses Approve. Nothing is lost.
- The imports build each hub's structure: roles, goals, objectives, workflows, controls. They create no people, groups or forms.
- Chat answers need a model. Without one the chat says no model is ready. To add a Meta key safely, see `scripts/local-setup.sh --model` in the README: put the key in your own `.env`, never in chat.
- The phone app's emailed sign-in link needs the local Supabase from step 2. Invite a member with `sh scripts/local-setup.sh --invite=member@example.com` and read the email in the inbox at `http://127.0.0.1:54324`.

## If something fails

| What you see | Cause and fix |
|---|---|
| The API exits with `DATABASE_URL is not set` | Set it as in step 3. There is no in-memory default. |
| `POST /auth/credentials` answers 404 | `WAKALA_ADMIN_TOKEN` is not set on the API, or the header value is wrong. |
| Create Hub says `Hub Steward is not available on this server yet` | The service is not registered. Run the script in step 4; it registers it. |
| Models or Operations say `unknown tool ai_list_accounts` | `AI_MASTER_KEY` is missing or not 16, 24 or 32 characters. |
| An invitation answers 503 `member sign-in is not configured` | `CATALOG_SUPABASE_URL` or `CATALOG_SUPABASE_ANON_KEY` is missing. |
| Port already in use | Pick another with `PORT=...` and `API_URL=...`; do not stop the other program. |
