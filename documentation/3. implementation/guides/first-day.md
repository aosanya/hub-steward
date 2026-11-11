# First day

One hour, in order: install the tools, run the API server, sign in to the console, run the phone app, and make the tests pass. If a step fails, [troubleshooting](troubleshooting.md) names the usual causes.

## 1. Install

| Tool | Version | Needed for |
|---|---|---|
| Go | 1.25 or newer | the Wakala API server |
| Node.js | 22, which CI runs | the console and the phone app |
| Docker | any recent | `make up`, and the local database |
| Supabase CLI | optional | the database that lets members sign in to the phone app by emailed link: local for developers, or a hosted Supabase project |

The Supabase CLI on macOS with Homebrew: `brew install supabase/tap/supabase`. Other systems: the [Supabase CLI guide](https://supabase.com/docs/guides/cli). Developers use the local database, which needs Docker. A hosted project needs the CLI but not Docker; the steps are in [Local database](local-database.md#use-a-hosted-project).

```sh
git clone https://github.com/aosanya/hub-steward.git
cd hub-steward
```

## 2. Run the API server

The console and the phone app both need it. Start it before them.

```sh
cd code/wakala-api
go build -o /tmp/wakala-server ./cmd/server
PORT=8082 WAKALA_ADMIN_TOKEN=choose-a-token WAKALA_SQLITE_PATH=/tmp/wakala.db \
  MEMBER_APP_ORIGINS=http://localhost:5171 /tmp/wakala-server
```

`http://127.0.0.1:8082/healthz` answers `{"status":"ok"}`. The log opens with several warnings about settings that are unset. On a laptop that is expected.

Two settings are worth knowing now:

- `WAKALA_ADMIN_TOKEN` lets you create the first sign-in (next step). Without it no sign-in can be created.
- `AI_MASTER_KEY` turns on the model pages, the Test agent and the review. Without it those calls are refused. A hub's model keys are sealed with it.

## 3. Create a sign-in

A fresh API has no sign-in. In another terminal:

```sh
curl -X POST localhost:8082/auth/credentials \
  -H 'content-type: application/json' -H 'X-Admin-Token: choose-a-token' \
  -d '{"email":"you@example.org","password":"a-password-of-12-or-more"}'
```

It answers `201`. The password must be at least 12 characters.

## 4. Run the console

```sh
cd code/console
npm ci
make run
```

Open `http://localhost:5170`. The console reads the API address from `code/console/public/config.json`, which already says `http://localhost:8082`. Log in with the email and password from step 3. Create Hub imports one of the eight demo agencies from [`demo/`](../../../demo/); start with the Siaya lab. To make the login and import every demo in one go instead, run `sh scripts/local-setup.sh --demos` as [Import a demo agency](import-a-demo-agency.md) shows. [Console](console.md) says how the console is built.

## 5. Run the phone app

```sh
cd code/app
npm ci
make run
```

Open `http://localhost:5171`. Its API address is in `code/app/public/config.json`. Members sign in to the phone app by emailed link, which needs the local database: [Local database](local-database.md). Without it the sign-in screens show but the app cannot sign anyone in. [Phone app](phone-app.md) says how the app is built.

## 6. Run the tests

From the repository root:

```sh
make test
```

It runs `go vet` and `go test` for the API server, then `npm ci` and `npm test` for the console and the phone app. The API server copy has no test files, so `go test` only compiles it. Once the dependencies are installed, none of it needs a network, keys or a server.

## 7. Where to read next

| You want to | Read |
|---|---|
| Know what each agency, role and workflow is | [Requirements: product](../../1.%20requirements/product/README.md) and [user journeys](../../1.%20requirements/user-journeys/README.md) |
| Change the API server | [API server](api-server.md) |
| Change the console | [Console](console.md) |
| Change the phone app | [Phone app](phone-app.md) |
| Write or change a demo agency | [Write an agency](write-an-agency.md) |
| See the pieces and who calls whom | [Architecture](architecture.md) |
| Know what is built and what is not | [What exists](../build/what-exists.md) |
| Fix a translation | [Languages](languages.md) |
| Add a model account | [Run with another model](other-models.md) |
| Open a pull request | [CONTRIBUTING.md](../../../CONTRIBUTING.md) |
