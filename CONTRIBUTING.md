# Contributing to Hub Steward

Thank you for helping. Bug reports, fixes, translations, documentation and new ideas are all welcome.

By contributing you agree that your contribution is licensed under the Apache License 2.0 in [LICENSE](LICENSE). Please read the [Code of Conduct](CODE_OF_CONDUCT.md). To report a security problem, follow [SECURITY.md](SECURITY.md) and do not open a public issue.

## Set up

You need Go 1.25 or newer and Node.js 22, which CI runs. Docker is only needed for `make up`.

```sh
git clone https://github.com/aosanya/hub-steward.git
cd hub-steward
```

The root `Makefile` wraps the common tasks:

| Command | What it does |
|---|---|
| `make test` | Runs the Go checks and both web apps' tests |
| `make build` | Builds the console and the phone app into each `dist/` |
| `make dev` | Starts the console's development server |
| `make up` | Starts the API server, console and app in Docker |
| `make down` | Stops them |

Or run the pieces yourself:

```sh
cd code/wakala-api && go vet ./... && go test ./...
cd code/console && npm ci && npm test
cd code/app && npm ci && npm test
```

Once the dependencies are installed, the tests need no network, no keys and no server. The bundled API has no Go test files yet, so `go test` checks only that it compiles. See [documentation/3. implementation/](documentation/3.%20implementation/) for how to run the whole stack.

New here? [First day](documentation/3.%20implementation/guides/first-day.md) takes you from install to a passing `make test` in order, and [Troubleshooting](documentation/3.%20implementation/guides/troubleshooting.md) names the usual causes when a step fails.

## Where things go

| You are changing | It lives in | Read first |
|---|---|---|
| The API server: routes, agents, approvals, tools | [code/wakala-api/](code/wakala-api/) | [API server](documentation/3.%20implementation/guides/api-server.md) |
| The console: the manager's and designer's web app | [code/console/](code/console/) | [Console](documentation/3.%20implementation/guides/console.md) |
| The phone app | [code/app/](code/app/) | [Phone app](documentation/3.%20implementation/guides/phone-app.md) |
| A demo agency or the Siaya lab's documents | [demo/](demo/), and the matching copy in `code/console/public/templates/` | [Write an agency](documentation/3.%20implementation/guides/write-an-agency.md) |
| The local database | [code/supabase/](code/supabase/) | [Local database](documentation/3.%20implementation/guides/local-database.md) |
| A translation | `code/console/public/i18n.json`, and `words.ts` and `swahili.ts` in `code/app/src/entry/` | [Languages](documentation/3.%20implementation/guides/languages.md) |
| What the product is for, a user journey | `documentation/1. requirements/` | [Documentation](documentation/README.md) |
| How it is built, a screen drawing | `documentation/2. design/` | [Technical spec](documentation/2.%20design/technical-spec/README.md) |
| How to run or build it, a guide | `documentation/3. implementation/` | [Guides](documentation/3.%20implementation/guides/README.md) |
| A test plan or a recorded result | `documentation/4. qa/` | [Testing](documentation/4.%20qa/testing/README.md) |

## House rules

- **No comments in code.** A name, a type or a smaller function carries the meaning. If something needs explaining, put it in `documentation/`.
- **Font sizes are relative.** Set the base size once on the root (`font-size: 112.5%` on `:root`) and write every other font size in `rem`. Buttons, inputs and selects take `font: inherit`.
- **Reuse before you write.** If a component, helper or module already does the job, use it. Do not add a second copy.
- **Documentation lives in `documentation/`**, in one of the four phase folders: `1. requirements`, `2. design`, `3. implementation`, `4. qa`. Do not add other top-level folders there.
- **No secrets and no real personal data.** The demo people, organisations and numbers are invented; keep it that way.

## Adding or fixing a language

The phone app lists nine languages but has words for English and Swahili only; the console has six. How to add a language or fix a translation is in [documentation/3. implementation/guides/languages.md](documentation/3.%20implementation/guides/languages.md).

## Sending a change

1. Open an issue first for anything larger than a small fix, so we can agree on the shape.
2. Keep each pull request to one change. Say what it changes and why.
3. Add or update tests for behaviour you change. Bug fixes should include a test that fails without the fix.
4. Run `make test` before you push.
5. Update the matching page under `documentation/` in the same pull request.

### Before you open a pull request

The pull request template asks for these. Check each one:

- [ ] `make test` passes.
- [ ] No comments were added to code.
- [ ] Font sizes are `rem`, set from one root size.
- [ ] The documentation under `documentation/` is updated, in the right phase folder.
- [ ] No keys, passwords or real personal data are in the change.

Then say what the change does, why, and how you checked it.
