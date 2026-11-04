# Hub Steward

A platform for running a member organization, called an agency. A manager or designer sets up the agency in the console: its groups, roles, workflows, forms, rules and documents. They review it, test it with scenarios and publish approved changes. Members use the agency on the phone app: chat rooms, an inbox, forms, reports, groups and a market. AI roles work beside the people. Each acts only through declared, permission-checked tools and waits for approval where the agency says so. The agents call a model through an OpenAI-compatible, Anthropic or Gemini account. No default model is built in: each hub adds its accounts on the console's Models page and sets its own default.

The demo holds eight synthetic agencies. One is a community computer lab in Siaya, Kenya, used as the worked example: members ask Hub Steward in chat, in English, Swahili or German, about the lab's rules and Wi-Fi, and it drafts access requests (a seat, a Wi-Fi account, member set-up with a barcode) for the lab manager to approve with one tap. The others are boda-boda riders, farmers, a clinical research organization, an electric grid utility, a logistics company, a mobile money operator and a crop-spraying drone service.

## What is in this repo

| Folder | What it holds |
|---|---|
| [code/wakala-api/](code/wakala-api/) | The Wakala API server both apps talk to, with its agents, approvals and tools |
| [code/console/](code/console/) | The console: the manager's and designer's web app, for building, reviewing, testing and running an agency |
| [code/app/](code/app/) | The phone app |
| [code/supabase/](code/supabase/) | Configuration and migration for the local Supabase database |
| [demo/](demo/) | The eight demo agencies, including the Siaya lab and its documents in three languages, all synthetic |
| [documentation/](documentation/) | Requirements, design, implementation and QA |

## Before you start

You need Go 1.25 or newer for the Wakala API server and Node.js 22, which is what CI runs, for the console and the app. The console and the app show their sign-in screens without a server. Every page after sign-in needs the API server at the address in their `config.json`.

Docker is needed for `make up` and for the local database. The Supabase database is optional: without it the API keeps its data in SQLite and the phone app cannot sign members in by emailed link. Developers run it locally with the Supabase command-line tool, which runs the database in Docker; a hosted Supabase project needs the tool but not Docker. On macOS with Homebrew:

```sh
brew install supabase/tap/supabase
supabase --version
```

Other systems: see the [Supabase CLI guide](https://supabase.com/docs/guides/cli).

## Run it

Two steps, in this order. The first is optional.

### 1. Supabase database (optional)

To try member sign-in by emailed link, the API needs a Supabase database. Developers run one locally; a hosted Supabase project works too and suits a shared or online setup (see below).

Local: start Postgres and the sign-in service before the API server. Run this from the repository root:

```sh
supabase start --workdir code
supabase status
supabase stop --workdir code
```

The first start pulls several images and applies `code/supabase/migrations/`, which creates the `wakala_api` role and the four sign-in functions the API calls. Give the API these settings, with the anon key from `supabase status`: in `.env` for `make up`, in a `.env` in the directory you start the server from, or exported in the shell that starts it:

```sh
DATABASE_URL=postgresql://wakala_api:wakala_local@127.0.0.1:54322/postgres?sslmode=disable
SHOP_SUPABASE_URL=http://127.0.0.1:54321
SHOP_SUPABASE_ANON_KEY=<the anon key>
MEMBER_APP_ORIGINS=http://localhost:8081
```

Sign-in emails arrive in the local inbox at `http://127.0.0.1:54324`. The password and demo keys are for this machine only. [documentation/3. implementation/guides/local-database.md](documentation/3.%20implementation/guides/local-database.md) has the rest, including what is checked and what is not.

Hosted: create a project at [supabase.com](https://supabase.com), run `supabase link --project-ref <ref> --workdir code` and `supabase db push --workdir code`, then change the `wakala_api` password, because the migration sets one that is written in this repository. Set the same three variables from the project's settings, with `SHOP_SUPABASE_URL` as `https://<ref>.supabase.co`, and add the phone app's sign-in address to the project's allowed redirect URLs. The steps are in the local database guide. They have not been run against a hosted project.

Skip this step to use SQLite. The phone app then cannot sign members in.

### 2. The Wakala API server

Start it before the console and the phone app, which both need it.

```sh
cd code/wakala-api
go build -o /tmp/wakala-server ./cmd/server
PORT=8082 WAKALA_SQLITE_PATH=/tmp/wakala.db /tmp/wakala-server
```

`http://127.0.0.1:8082/healthz` answers `{"status":"ok"}`. The server keeps its data in SQLite unless `DATABASE_URL` is set, and the optional modules stay off until their settings are given. The variables are in [.env.example](.env.example).

To run the API server, the console and the phone app together in Docker, copy `.env.example` to `.env` and run `make up`. The API is on port 8082, the console on 8080 and the phone app on 8081. `make down` stops them.

[documentation/3. implementation/build/02-running-it](documentation/3.%20implementation/build/02-running-it/README.md) has the same steps in full.

## Test and build

```sh
cd code/wakala-api
go build ./...
go vet ./...
go test ./...
```

```sh
cd code/console
npm ci
npm test
npm run build
```

```sh
cd code/app
npm ci
npm test
npm run build
```

Each web app build writes static files to `dist/` that any web server can serve. The API server copy in this repository has no test files, so `go test` only compiles it. Once the dependencies are installed, the tests need no network, no keys and no server.

## Makefile

The root `Makefile` wraps the commands above. Run it from the repository root.

| Target | What it does |
|---|---|
| `make test` | `go vet` and `go test` for the API server, then `npm ci` and `npm test` for the console and the phone app |
| `make build` | `npm ci` and `npm run build` for the console and the phone app. It does not build the API server; use `go build` for that |
| `make dev` | Starts the console's dev server. It does not start the API server |
| `make up` | `docker compose up --build -d`: the API server on 8082, the console on 8080 and the phone app on 8081 |
| `make down` | `docker compose down` |

Inside `code/console` or `code/app`, `make run` starts that app's dev server on its own port, 5170 for the console and 5171 for the phone app, and frees the port first if something holds it.

## Look at the apps

```sh
cd code/console
npm ci
npm run dev
```

Open the address Vite prints. Signing in or creating a hub calls the API server, which `npm run dev` reaches at `http://localhost:8082`. To use another address:

```sh
WAKALA_URL=https://your-server.example npm run dev
```

The phone app is the same: `cd code/app && npm ci && npm run dev`. Its server address is `code/app/public/config.json`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Licence

Apache License 2.0. See [LICENSE](LICENSE). The dependencies are listed in the `go.mod` file of `code/wakala-api` and the `package-lock.json` files. The demo organisations, people, numbers and addresses are invented. Meta, Muse Spark and Muse Image are named in [TRADEMARKS.md](TRADEMARKS.md).
