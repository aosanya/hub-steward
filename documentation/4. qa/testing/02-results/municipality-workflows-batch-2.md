# Municipality workflows, batch 2

Workflows W-46 to W-50, W-53 to W-55 and W-57 were added to `demo/municipality.json`, with a walk-through test for each in `code/console/src/journeys/`. The agency now holds 31 workflows and 172 work items.

- Console suite: 3840 passed, 1 failed (`templates.test.ts`, the picker entry has no design yet).
- `go vet ./...` and `go test ./...` in `code/wakala-api` are clean.
- Not exercised: the run against the real API, because sign-in by emailed link is not available in this environment, and the import of the grown agency on a database.
