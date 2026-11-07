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

## Run 6 (cloud, 2026-11-07)

Import of the grown file after W-22 and W-39 were merged: 201; 41 workflows, 231 work items, 17 roles, 33 objectives, 110 workflow objectives, 65 control attachments. Read back from the draft with `?draft_id=`: 41 workflows, 231 work items, 17 roles; the step count of every workflow equals the agency file, W-22 reads back with 5 steps and W-39 with 6. The login was made with `POST /auth/credentials` and a session taken with `POST /auth/signin`, not an emailed link. The console walk harness passes for W-22 and W-39. Postgres-backed tests for the ward fill, the withdrawal fan-out, the voting and insights minimum and the department routing pass on the native database.
