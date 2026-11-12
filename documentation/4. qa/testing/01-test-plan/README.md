# 01 · Test plan

## Mwanachama changes

In the Mwanachama platform's own repositories, every change passes that
module's suite before it lands: `go build ./...`, `go vet ./...` and
`go test ./...` against an in-memory SQLite database, and a change to the
Mwanachama API also adds a self-test scenario that drives the real router as
real callers, including one who is not a member of the agency. That is the
practice there, not what this repository holds.

This repository has the console suite and the phone app suite, and its API
server copy is only built and vetted: `make test` runs `go vet` and `go test`
on it. On 2026-11-12 the repo holds 541 `_test.go` files; the run of
2026-11-04 found none, so it only built and vetted the code. There is no
`make self-test`. See [Results](../02-results/README.md)
and [API server tests](../02-results/api-tests.md).

## The agency

| Test | Checks |
|---|---|
| Import | Each of the eight demo agencies imports with no errors |
| Roles and permissions | A role does only what its permissions allow; a caller who is not a member of the agency is answered as if it did not exist |
| Design, review, test, publish | A draft passes the reviewers and its scenarios before an approved change is published |
| Member app journeys | The journeys in the user journeys index run on the phone app against the API |

## The agents

An agent acts only through declared tools and does nothing that needs approval until it is approved. These checks hold for any agency; the lab is the worked example for the ones that name it.

| Test | Checks |
|---|---|
| Offline unit tests | Planned: the agent's reply loop, with the model and Mwanachama replaced by fakes, running with no network. The loop is not part of this repository |
| Answers | A question in each language the agency writes in gets a reply in that language naming the right document; a question the documents do not answer gets "I don't know". In the lab: English, Swahili and German, against its four documents, each of which exists in all three. The phone app's own screens have words in English and Swahili only; German is in its language picker but shows English |
| Approval | A request becomes a draft; nothing is done before approval. In the lab: a seat request is a draft, no seat is held before approval, and a clashing slot is refused |
| Boundary | An agent's key cannot reach a second agency |

### Where each check stands

| Test | State |
|---|---|
| Import | Siaya lab only: 0 errors, recorded in the earlier Mwanachama results. The other seven agencies have no recorded import. Five templates stop at Create Hub with no Hub Steward role |
| Roles and permissions | Not run here. The console and app suites check what screens show for a role against fakes; no test runs against the API server, which the run of 2026-11-04 found without test files (541 `_test.go` files on 2026-11-12) |
| Design, review, test, publish | Console pages for review, test and publish are covered in the console suite against fakes. Three Playwright specs exist in `code/console/e2e` and were not run |
| Member app journeys | The phone app suite passes with fakes in place of the API. No journey was run against a server, and form answering has unit tests only |
| Offline unit tests | Not run: planned, because the loop they test is not in this repository |
| Answers | No recorded run; needs a real model and the lab's documents |
| Approval | Not run. No test drafts a request, holds a seat or refuses a clashing slot |
| Boundary | Not run here. Only the earlier Mwanachama results include a stranger refused |

What was run and what was not is in [Results](../02-results/README.md).

## The demo

A walk-through on the hosted demo, as a member and as the manager. It covers the features [Demo scope](../../../1.%20requirements/product/03-demo-scope/README.md) lists. For the lab agency those are answers and access requests.

[Results](../02-results/README.md) lists only results from real runs.
