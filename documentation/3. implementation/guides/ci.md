# Continuous integration

`.github/workflows/ci.yml` runs on every push to `main`, `master` and `dev`, and on every pull request into `main` or `master`. `dev` is the branch the backlog agents build on, so a push there runs the same checks as a release branch.

## Jobs

| Job | Steps |
|---|---|
| `wakala-api` | `go vet ./...`, `go test ./...`, `go build ./...` in `code/wakala-api`, with a Postgres service |
| `console` | `npm ci`, `npm test`, `npm run build` in `code/console` |
| `app` | `npm ci`, `npm test`, `npm run build` in `code/app` |
| `local-setup` | `sh scripts/local-setup.test.sh` |

## The Postgres service

Tests that need a real database (the forms landing in the catalog, ledger and ratings, the ward and department fills, insights counts, the voting disclosure, the riskmanager library, and the form-send and step-answer races) read one variable, `DATABASE_URL`, and skip when it is unset or its host is not `127.0.0.1` or `localhost`. Without a database they pass by skipping, which is why the job brings one up.

| Setting | Value |
|---|---|
| Image | `postgres:17`, the major version `code/supabase/config.toml` uses |
| User, password, database | `postgres`, `postgres`, `postgres` |
| Port | `5432` on the runner |
| Readiness | `pg_isready -U postgres`, every 5 seconds, up to 10 tries |
| `DATABASE_URL` | `postgres://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable` |

The user is a superuser because the race tests create and drop a schema of their own and the others create tables in `public`. The local run needed no extension. `FORMS_DATABASE_URL` and `PERMISSIONS_DATABASE_URL` are read by `cmd/server` only, never by a test, so they are not set.

## Before the first push of this file

The workflow file was checked with a YAML parse (`actionlint` was not installed) and the `wakala-api` steps were run locally against a throwaway Postgres 17: `go vet ./...` and `go test ./...` passed with the database tests running instead of skipping. Pushing the file to `dev` starts the first run on GitHub, and every later push to `dev` starts one.
