# Contributing to Hub Steward

Thank you for helping. Bug reports, fixes, translations, documentation and new ideas are all welcome.

By contributing you agree that your contribution is licensed under the Apache License 2.0 in [LICENSE](LICENSE). Please read the [Code of Conduct](CODE_OF_CONDUCT.md). To report a security problem, follow [SECURITY.md](SECURITY.md) and do not open a public issue.

## Set up

You need Go 1.25 or newer and Node.js 20 or newer (the tests run on Node 22). Docker is only needed for `make up`.

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

Use the pull request template; it carries the checklist.
