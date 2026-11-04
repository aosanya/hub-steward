# Troubleshooting

Each entry is a cause found in the repository's code, Makefiles or Docker files, and the fix.

## Starting

**A dev port is already held.**
`make run` in `code/console` or `code/app` first kills whatever holds the port (5170 for the console, 5171 for the phone app), then starts Vite with `--strictPort`. If the port is still held, Vite stops and says so instead of picking another. Set `DEV_PORT` to use a different port: `make run DEV_PORT=5180`.

**The API server port is already held.**
The API listens on `PORT`. Change it, then change the address the apps use (see the next entry).

**`make dev` shows no pages after sign-in.**
`make dev` starts only the console's dev server. Start the API server first ([First day](first-day.md)).

**The API log opens with warnings.**
On a laptop these are expected: the session secret is the public dev one, `WAKALA_ADMIN_TOKEN` is unset, and the launch and shop settings are unset. They say what each setting would turn on. Set `WAKALA_SESSION_SECRET` before anyone else uses the server.

## The apps cannot reach the API

**Every page after sign-in fails.**
The console reads its API address from `code/console/public/config.json` and the phone app from `code/app/public/config.json`; both say `http://localhost:8082`. The console's dev server also proxies to `WAKALA_URL`:

```sh
WAKALA_URL=http://localhost:8099 npm run dev
```

**A built app points at the wrong server.**
Every build of the phone app writes its own `config.json` into `dist/` from `HUBSTEWARD_WAKALA_URL`, replacing the one in `public/`. With the variable unset the address is empty, which suits a server that serves the API on the same origin. `npm run build:demo` stops unless the variable is set.

**The phone app is blocked by the browser.**
The API only answers the origins in `MEMBER_APP_ORIGINS` (`STUDIO_ORIGINS` for the console). For the phone app's dev server set `MEMBER_APP_ORIGINS=http://localhost:5171`; for the container, `http://localhost:8081`.

## Signing in

**No one can sign in on a fresh API.**
A fresh API has no sign-in. With `WAKALA_ADMIN_TOKEN` unset, `POST /auth/credentials` is refused. Set the token and create one ([First day](first-day.md)).

**Creating a sign-in fails on the password.**
The password must be at least 12 characters.

**Members cannot sign in to the phone app.**
Member sign-in is by emailed link and needs the local database. Without `DATABASE_URL` the API uses SQLite and the phone app cannot sign members in. See [Local database](local-database.md).

## Data

**The data is gone after a restart.**
With neither `DATABASE_URL` nor `WAKALA_SQLITE_PATH` the API keeps everything in memory. Set `WAKALA_SQLITE_PATH` to a file.

**The data is gone after a Docker restart.**
The container keeps its SQLite file in the `wakala-data` volume at `/data`. `docker compose down` keeps the volume; `docker compose down -v` deletes it.

## Models

**The Models, Agents and Usage pages fail, or the Test agent and the review say "no AI backend".**
`AI_MASTER_KEY` is unset. Without it the API does not register the AI routes (they answer `404`), and test runs and reviews report `the Test agent has no AI backend: set AI_MASTER_KEY`. Set it and restart. Model keys already stored were sealed with the old value.

## The database

**The API exits with `could not open postgres`.**
`DATABASE_URL` is set but nothing answers. Start the local database (`supabase start --workdir code`, with Docker running) or unset `DATABASE_URL` to use SQLite.

**`supabase start` fails.**
Docker is not running, or the Supabase CLI is not installed ([First day](first-day.md)).

## Create Hub

**Create Hub stops with "The hub has no Hub Steward role, so the agent was not connected."**
The template has no role that may use AI. Five of the eight demo agencies are like that: freight, drone spraying, clinical research, grid utility and mobile money. Use the Siaya lab, the riders or the farmers.

## Tests

**`npm test` cannot find modules.**
Run `npm ci` in `code/console` or `code/app` first. `make test` does it for you.

**`go vet` or `go test` cannot download modules.**
Go fetches modules on the first run, so that run needs a network.

**`go test` passes but runs no tests.**
The API server copy in this repository has no test files. It only checks that the code compiles.
