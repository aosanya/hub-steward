# Record permissions: the agency files to convert

Inventory for ISS-162. It belongs to the record permissions design of ISS-149 (decisions D1 and D6): a record loses `role_id`, `edit_role_id`, `delete_role_id` and `viewer_role_id`, roles carry `record.<code>.add|edit|delete|view`, and an import that still has the old fields is refused. The files below are converted once.

Read on 2026-11-24 from the working trees of every repo under the container (projects/, the sibling and wakala-api repos, the hub, `dump/`, the mined templates under `developer/documentation/4. qa/agencies`). Nothing was changed outside this page.

| Built | Planned |
|---|---|
| Nothing. This page is the inventory | One conversion issue per repo, section 3 |

## 1. Files that declare records

A file counts when it holds a `records` array whose items have a `code`. All 24 files below set `role_id` on every record. Only the IAS `tender` record sets another field, `delete_role_id`. No file sets `edit_role_id` or `viewer_role_id`.

| # | Repo | File | Records | `role_id` | `edit_role_id` | `delete_role_id` | `viewer_role_id` | Copy of | Converted by |
|---|---|---|---|---|---|---|---|---|---|
| 1 | frankfurt-school-ias | `agency/ias.json` | 29 | 29 | 0 | 1 | 0 | | ISS-161 |
| 2 | frankfurt-school-ias | `agency/ias.en.json` | 29 | 29 | 0 | 1 | 0 | row 1 | ISS-161 |
| 3 | hub-steward-law-firm | `agency/law-firm.json` | 17 | 17 | 0 | 0 | 0 | | ISS-166 |
| 4 | hub-steward-law-firm | `agency/law-firm.en.json` | 17 | 17 | 0 | 0 | 0 | row 3 | ISS-166 |
| 5 | hungarian-municipality | `agency/municipality.en.json` | 3 | 3 | 0 | 0 | 0 | | ISS-167 |
| 6 | hub-steward-malawi-maiic | `agency/maiic.json` | 14 | 14 | 0 | 0 | 0 | | ISS-168 |
| 7 | hub-steward-malawi-maiic | `agency/maiic.en.json` | 14 | 14 | 0 | 0 | 0 | row 6 | ISS-168 |
| 8 | hub-steward-malawi-maiic | `agency/assignment.json` | 8 | 8 | 0 | 0 | 0 | | ISS-168 |
| 9 | hub-steward-malawi-maiic | `agency/assignment.en.json` | 8 | 8 | 0 | 0 | 0 | row 8 | ISS-168 |
| 10 | hub-steward | `demo/farmers/agency.json` | 1 | 1 | 0 | 0 | 0 | | ISS-169 |
| 11 | hub-steward | `code/console/public/templates/farmers.json` | 1 | 1 | 0 | 0 | 0 | row 10 | ISS-169 |
| 12 | hub-steward | `demo/boda-boda-riders/agency.json` | 1 | 1 | 0 | 0 | 0 | | ISS-169 |
| 13 | hub-steward | `code/console/public/templates/boda-boda-riders.json` | 1 | 1 | 0 | 0 | 0 | row 12 | ISS-169 |
| 14 | mwanachama-backend-agency | `testdata/hub-demo/farmers/agency.json` | 1 | 1 | 0 | 0 | 0 | | ISS-170 |
| 15 | mwanachama-backend-agency | `testdata/hub-demo/boda-boda-riders/agency.json` | 1 | 1 | 0 | 0 | 0 | | ISS-170 |
| 16 | mwanachama-wakala-api | `internal/api/http/testdata/agencies/farmers/agency.json` | 1 | 1 | 0 | 0 | 0 | row 14 | ISS-171 |
| 17 | meta-global-ai-hackathon-community-hubs | `submission/demo/farmers/agency.json` | 1 | 1 | 0 | 0 | 0 | row 10 | Not filed, see section 4 |
| 18 | meta-global-ai-hackathon-community-hubs | `submission/code/console/public/templates/farmers.json` | 1 | 1 | 0 | 0 | 0 | row 10 | Not filed, see section 4 |
| 19 | meta-global-ai-hackathon-community-hubs | `submission/demo/boda-boda-riders/agency.json` | 1 | 1 | 0 | 0 | 0 | row 15 | Not filed, see section 4 |
| 20 | meta-global-ai-hackathon-community-hubs | `submission/code/console/public/templates/boda-boda-riders.json` | 1 | 1 | 0 | 0 | 0 | row 15 | Not filed, see section 4 |
| 21 | hub-steward | `code/console/dist/templates/farmers.json` | 1 | 1 | 0 | 0 | 0 | row 10, gitignored build copy | None, rebuilt |
| 22 | hub-steward | `code/console/dist/templates/boda-boda-riders.json` | 1 | 1 | 0 | 0 | 0 | row 12, gitignored build copy | None, rebuilt |
| 23 | meta-global-ai-hackathon-community-hubs | `submission/code/console/dist/templates/farmers.json` | 1 | 1 | 0 | 0 | 0 | row 14, gitignored build copy | None, rebuilt |
| 24 | meta-global-ai-hackathon-community-hubs | `submission/code/console/dist/templates/boda-boda-riders.json` | 1 | 1 | 0 | 0 | 0 | row 15, gitignored build copy | None, rebuilt |

Totals: 24 files, 20 tracked and 4 gitignored build copies. Nine different contents. 154 records in the 24 files, 75 counting each content once: IAS 29, law firm 17, MAIIC 14, assignment 8, municipality 3, and four demo variants of one record each (rows 10, 12, 14 and 15 differ from each other).

The owner's earlier review counted 27 files. This search finds 24, and the four gitignored `dist/` copies need no conversion, so 20 files hold the work. No other file declares records; section 5 lists what was checked and came up empty.

A copy is byte-identical to the row it names, except where section 6 says the demo variants differ.

### What each role gets

Today `role_id` adds a row, and also edits and deletes it and sees every row unless `edit_role_id`, `delete_role_id` or `viewer_role_id` name another role (`RoleOfRowAction` and `callerMaySeeEveryRow`). The conversion gives each record's `role_id` holder all four codes of that record, and gives the role named by `delete_role_id` only the delete code. Every adding role also gets view (D4, D18). The one file with a `delete_role_id` is IAS: Tender Scout holds `tender` and the Practice Director deletes it (ISS-161).

| Repo | Roles that hold records, with their records |
|---|---|
| law firm | Business Development & Intake Manager RC-1, RC-2, RC-5, RC-6, RC-7, RC-8; Records Manager RC-3; Legal Secretary / Docketing Clerk RC-4; Compliance & Ethics Officer RC-9, RC-10; Reporting Officer RC-11; Complaints Handler RC-12; Compliance Officer for Legal Practice RC-13, RC-16, RC-17; Data Protection Lead RC-14; Managing Partner RC-15 |
| municipality | Data and analysis officer RC-1, RC-2; Service contractor liaison RC-3 |
| MAIIC (maiic) | Chief Projects Development Officer RC-1, RC-2, RC-4, RC-7, RC-8, RC-13, RC-14; Credit Risk Department RC-3, RC-5, RC-6; Chief Financial Officer RC-9, RC-10; ESG Officer RC-11; Chief Legal Officer and Company Secretary RC-12 |
| MAIIC (assignment) | Project Manager RC-1, RC-4, RC-8; Team Leader RC-2; Expert Pool Manager RC-3, RC-7; Results and Reporting Officer RC-5; Finance Controller RC-6 |
| demo farmers | Group coordinator RC-1 |
| demo boda boda riders | Rider RC-1 |

### Points the conversion issues carry

| Point | Where | What the issue does |
|---|---|---|
| Roles use the key `powers`, all empty | law-firm (18 roles), MAIIC assignment (17 roles) | The role's JSON key is `permissions` (`models/role.go`), and nothing in the sibling or the hub reads `powers`. The issue renames the key on every role of the file, so the roles that gain codes have a list to hold them |
| Roles already carry catalogue codes | municipality (19 roles), farmers, boda boda riders, IAS | The record codes are appended and the catalogue codes stay |
| Record codes are `RC-n` | Every file but IAS | They fit the format the import keeps (`^[A-Z]{1,2}(-[A-Z]+)?-[0-9]{1,6}$`, see [Record codes in an agency file](agency-import-record-codes.md)), so the permissions are `record.RC-1.add` and so on. A record's code cannot change once it exists, so the issues do not rename them |
| Subject workflows | IAS only (W-1, W-2, W-3, W-4, W-7 have a `subject_record`) | The view rule for a role that holds a step of a subject workflow (D17) matters only in ISS-161. No other file has a `subject_record` |
| Sibling testdata | ISS-170 | ISS-155 removes the fields and refuses a file that has them, and its todos do not name `testdata/hub-demo`, so its tests would fail. ISS-170 must land after ISS-150 and ISS-151 and before ISS-155's build todo is green |

## 2. Where the files live

| Repo | Git remote | Branch read | Notes |
|---|---|---|---|
| projects/hub-steward-frankfurt-school-ias | no origin remote | main | ISS-161 |
| projects/hub-steward-law-firm | no origin remote | main | |
| projects/hungarian-municipality | github.com/aosanya/hungarian-municipality | main | |
| projects/hub-steward-malawi-maiic | no origin remote | main | |
| projects/hub-steward | github.com/aosanya/hub-steward | dev | Working tree not clean on 2026-11-24, other sessions' changes |
| projects/meta-global-ai-hackathon-community-hubs | github.com/aosanya/meta-global-ai-hackathon-community-hubs | main | Finished 2026-11-04, a submitted snapshot |
| mwanachama-backend-agency | github.com/aosanya/mwanachama-backend-agency | master | The sibling the hub takes by tag |
| mwanachama-wakala-api | github.com/aosanya/mwanachama-wakala-api | master | Working tree not clean on 2026-11-24 |

## 3. The conversion issues

One repo, one agent. Each is in the Backlog at In Coming, tagged sprint 1, permissions, hub-steward-swe and its repo, and waits for ISS-155 and ISS-156 as ISS-161 does (ISS-170 for the order in section 1).

| Issue | Repo | Files | Records |
|---|---|---|---|
| ISS-161 | frankfurt-school-ias | rows 1, 2 | 29 |
| ISS-166 | hub-steward-law-firm | rows 3, 4 | 17 |
| ISS-167 | hungarian-municipality | row 5 | 3 |
| ISS-168 | hub-steward-malawi-maiic | rows 6 to 9 | 22 |
| ISS-169 | hub-steward | rows 10 to 13 | 1 and 1 |
| ISS-170 | mwanachama-backend-agency | rows 14, 15 | 1 and 1 |
| ISS-171 | mwanachama-wakala-api | row 16 | 1 |

ISS-161 was filed before this inventory and is not changed by it.

## 4. Not filed: the hackathon submission

Rows 17 to 20 (and the build copies 23 and 24) are in the finished hackathon repo's `submission/` folder, a snapshot of what was submitted. Whether to convert it or leave it frozen is the owner's decision. Left as it is, an import of those files is refused after ISS-155; the live demo templates are the hub's own (rows 10 to 13).

## 5. Checked and found without records

| Place | Files | Result |
|---|---|---|
| `developer/documentation/4. qa/agencies` mined templates (agency.json of the 11 archetypes) and their modules | 1,887 JSON files | No `records` array in an agency file; `records_git.json` and the `custody.json` of the archived agencies hold a module's own records, not an agency's |
| `dump/` | all JSON | No file with a role field |
| `projects/research/agencies` | 8 agency.json | No `records` array; `role_id` is on steps and roles, which stay under D12 |
| `mwanachama-fundraising/search/*/proposed-agency` | 53 agency.json | No `records` array; same use of `role_id` |
| `projects/hungarian-municipality/agency/municipality.json` | 1 | The Hungarian original has no `records` array; only the English copy has 3 |
| `projects/hub-steward-swe/agency` | 1 | No `records` array |
| `mwanachama-wakala-api/internal/api/http/testdata/agencies` | siaya-lab, law-firm, municipality, party-mobilization, software-venture, international-advisory-services | No `records` array |
| `mwanachama-backend-agency/agency.agency.json`, `agency.blueprint.json`, `agency.operations.json`, `mwanachama-backend-ai`, `mwanachama-backend-sources/spec/examples`, `mwanachama-backend-workspace/spec/examples` | | The model and its operations, not an agency file; ISS-155 changes the sibling's |

## 6. Differences between copies, reported and left alone

| Difference | Detail |
|---|---|
| municipality | `municipality.json` has no records and `municipality.en.json` has 3 (the repo's README says the two are the same agency) |
| farmers | The hub's `demo/` and `public/templates` files (and the hackathon copies) differ from the sibling's and wakala-api's file by one sentence of text |
| boda boda riders | The hub's file and the sibling's `testdata/hub-demo` file differ by 125 lines (the sibling has a goal G-4 and one more role, 8 roles against 7); the hackathon copies equal the sibling's file |

None of the conversion issues brings these copies in line.

## 7. The hub's demo templates (ISS-169)

Rows 10 to 13. Each file declares one record, and that record sets `role_id` only: `edit_role_id`, `delete_role_id` and `viewer_role_id` are empty, so the holder had all four actions. The two public copies equal their `demo/` file.

| File | Record | Held today by | Becomes | Role assignments on objectives |
|---|---|---|---|---|
| `demo/farmers/agency.json`, `code/console/public/templates/farmers.json` | RC-1 Payments | Group coordinator | `payments`, with `record.payments.add.*`, `.edit.*`, `.view.*` and `record.payments.delete` carried by Group coordinator | 41 on 8 objectives: 8 accountable, 17 responsible, 12 consulted, 4 informed |
| `demo/boda-boda-riders/agency.json`, `code/console/public/templates/boda-boda-riders.json` | RC-1 Paid rides | Rider | `paid_rides`, with `record.paid_rides.add.*`, `.edit.*`, `.view.*` and `record.paid_rides.delete` carried by Rider | 18 on 5 objectives: 5 accountable, 6 responsible, 1 consulted, 6 informed |

Neither file has a `groups`, `tags` or `seats` key. No role of either file has the key `powers`. The role assignments are dropped in the conversion (D39, D49), and the records take readable codes (D58). The gitignored `code/console/dist/templates` copies are rebuilt, not edited.
