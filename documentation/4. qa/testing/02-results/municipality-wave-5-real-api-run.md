# Municipality agency: whole-file import, cloud run 5

Date: 2026-11-07. Native Postgres 16 on 127.0.0.1:54322 with a stand-in `auth` schema (kept outside the repo), the migration applied, API built from `code/wakala-api` and run on port 8161, signed in with the local console login (`POST /auth/credentials`, `POST /auth/signin`, both 201).

- `POST /instances/import` of `demo/municipality.json`: 201, created 5 goals, 28 objectives, 16 roles, 34 workflows, 190 work items, 102 workflow objectives, 24 controls, 56 control attachments.
- Read back from the draft: `/workflows` 34, `/work-items` 190, `/roles` 16. The importer renumbers workflow codes in order; the chat-risk workflow (W-65 in the file) reads back with its six steps.
- `GET /instances/{id}/risks` answers 200.
- `go vet ./...` and `go test ./...` in `code/wakala-api` have no failure. Console: 3861 passed, 1 failed (`templates.test.ts`, the picker entry still without a design).
- Emailed-link sign-in was not exercised (no auth service or inbox).

## After wave 2

`POST /instances/import` of the grown file: 201, 30 objectives, 17 roles, 36 workflows, 202 work items, 104 workflow objectives; read back from the draft 36 workflows, 202 work items, 17 roles. `go vet ./...` and `go test ./...` clean; console 3885 passed, 1 failed (`templates.test.ts`, MUN68).

## After wave 3

Import of the grown file: 201; read back from the draft 38 workflows, 214 work items, 17 roles. `go vet ./...` and `go test ./...` clean; console 3899 passed, 1 failed (`templates.test.ts`, MUN68).

## After wave 4

Import of the grown file: 201; read back from the draft 39 workflows, 220 work items. `go vet ./...` and `go test ./...` clean; console 3906 passed, 1 failed (`templates.test.ts`, MUN68).
