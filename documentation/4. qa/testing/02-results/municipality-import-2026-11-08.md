# Municipality import, 2026-11-08

Run on 2026-11-08 on this laptop. The API was built from a clean copy of commit `42c8ed8` (`git archive`, so no half-edited file of another session could enter) and run on port 8083 against the local database (`127.0.0.1:54322`), never a hosted project. The file imported is `demo/municipality.json` as committed in `42c8ed8` (46 workflows, 262 work items). The console login was made with `POST /auth/credentials` and the admin token, then `POST /auth/signin`.

| Check | Result |
|---|---|
| `POST /instances/import` | 201, with 25 errors in the reply |
| Created | 17 roles, 5 goals, 33 objectives, 46 workflows, 237 work items, 123 workflow objectives, 12 modules, 24 controls, 65 control attachments |
| Draft scope: workflows | 46, names equal to the file's |
| Draft scope: work items | 237 of 262 |
| W-28 (paper, voice or in person) | 6 of 6 steps, each of kind `fill_form` |
| W-19 | 0 of 5 steps |
| W-20 | 0 of 7 steps |
| W-29 | 0 of 6 steps |
| W-31 | 0 of 7 steps |

## The 25 errors

Every one is the same message, for a step of W-19, W-20, W-29 or W-31: `CreateWorkItem: mwanachama agency: invalid work item: a step with a role, a form, a workflow to run, a chat or a link to another step needs a kind`. The cause is in the file: the steps of those four fragments carry a role but no `kind`, no `form_name` and no `questions`, while every step of W-1, W-22 and W-28 has `kind: fill_form` with a form name and questions. The four workflows import as empty shells.

## Also noticed

- 28 imported steps have an empty `kind`: W-2 (8), W-3 (10), W-4 (5) and W-5 (5), the template's own steps, which carry no role either.
- The draft renumbers workflow and step codes on import, so a read-back has to match workflows by name.

## Not covered

Sign-in by emailed link; the forms and catalog list addresses; any run of a step by an agent. The grown file was imported once and nothing was removed from the database afterwards.

Walk fixtures for W-19, W-20, W-29 and W-31 pass in the console because the fake replies do not check `kind`; this run is the first check against the real importer.
