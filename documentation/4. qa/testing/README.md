# Testing

What is tested in Hub Steward, how to run it, and what each run found. The product is an agency platform, so the plan checks agencies in general and uses the Siaya computer lab as its worked example.

| # | Section | About |
|---|---|---|
| 01 | [Test plan](01-test-plan/README.md) | What is tested and how, and the state of each check |
| 02 | [Results](02-results/README.md) | The latest result for each suite (console, phone app, API server), earlier results from the Mwanachama repositories, and what no suite covers |
| 03 | [Screenshots](03-screenshots/README.md) | Pictures of the console, the chat with the model and the phone app from the test runs |

## Run the tests

From the repository root, `make test` runs all three suites. Each one on its own:

```sh
cd code/wakala-api && go vet ./... && go test ./...
cd code/console && npm ci && npm test
cd code/app && npm ci && npm test
```

Once the dependencies are installed, none of them needs a network, a key or a server. The API server copy in this repository has no test files, so `go test` there only checks that it compiles. The console's three Playwright specs in `code/console/e2e` are not part of `npm test` and need their own environment; the [console guide](../../3.%20implementation/guides/console.md) describes it.

## Where the suites stand

Run on 2026-11-04. These are the only results anyone can reproduce from this repository.

| Suite | Result | Page |
|---|---|---|
| Console | 3640 tests in 251 files passed; the build passes | [Console tests](02-results/console-tests.md) |
| Phone app | 1905 tests in 124 files passed; the build passes | [App tests](02-results/app-tests.md) |
| API server | Builds and vets clean; no test files, so nothing was tested | [API server tests](02-results/api-tests.md) |

Both web app suites run against fakes in place of the API. No journey has been run end to end against a server here.

## What no suite covers

The full list, with the reason for each, is under "Not covered" in the [results](02-results/README.md). The ones that matter most:

- No suite calls a model, so the answers, the three-language replies and the "I don't know" case have no recorded run.
- The agent's reply loop is not part of this repository, so its fake-based unit tests are planned and not written.
- Only the Siaya lab's import has a recorded result. The other seven demo agencies have none, and five of them stop at Create Hub because they declare no AI role.
- The phone app has not been run on a device, and WhatsApp is not built.

The hackathon repository's submission folder holds code this repository does not yet carry, and records its own results in its `05-testing` folder.

## Record a result

1. Run the suite once and keep its output.
2. Write the exact command, the date, the counts of passed, failed and skipped, and the first failure lines on the suite's page under `02-results/`.
3. Add or update its row in [results](02-results/README.md) and in the table above.
4. If the run shows something the test plan says is covered, or fails to cover something it lists, change the plan's "Where each check stands" in the same change.

Never record a result you did not run. A test written on purpose to fail until a defect is fixed is called a known open defect on the results page and is counted apart from the passes.
