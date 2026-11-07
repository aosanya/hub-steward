# Municipality risk module import

Run on 2026-11-07 in a cloud container with a native Postgres on `127.0.0.1:54322` (repository migrations applied, no Docker, no hosted project). The API was built from the committed tree at commit bce4144 (a clean export of `code/wakala-api`, because other work in the working tree did not compile at the time) and run on port 8159. The console login was made with `POST /auth/credentials` and a session taken with `POST /auth/signin`.

| Check | Result |
|---|---|
| `demo/municipality.json` against `code/console/public/templates/municipality.json` | identical |
| Mount in the file | module `riskmanager`, enabled, mount key `risks` |
| Roles in the file | R-13 (department head, risk owner) and R-14 (council and mayor's office reader), each with `permissions: ["risk.read"]` |
| Rules in the file | RU-RISK-1 attached to R-13, RU-RISK-2 attached to R-14 |
| `risk.read` in the permissions catalog at HEAD | present, module `riskmanager`, read-only actions (risk list/read/bowtie, threats, consequences, measures, controls, gaps, matches) |
| `POST /instances/import` of `demo/municipality.json` | 201, no errors; created 15 roles, 5 goals, 27 objectives, 33 workflows, 184 work items, 101 workflow objectives, 24 controls, 53 control attachments, 12 modules |
| Draft read back, modules | `riskmanager` present, enabled, mounts `[{"name":"riskmanager","key":"risks"}]` |
| Draft read back, roles | 15; R-13 and R-14 both read back `["risk.read"]` |
| Draft read back, rules | rules arrive as controls: C-23 (RU-RISK-1) attached to role R-13, C-24 (RU-RISK-2) attached to role R-14 |
| `GET /instances/<id>/risks`, `/risks/threats`, `/risks/controls` | 200, `[]` each: the risk module answers on the new agency |
| `npx vitest run src/entry/municipalityRisk.test.ts` | 5 passed |

The Hungarian names of the municipality file are as they are in the file; MUN14 translates the labels.

## Not covered

- The draft was imported but not approved or published. Until a publication exists the module switch treats the agency as ungated, so the answer from the risk routes shows the module is mounted in code, not that the published module list gates it.
- "A department head sees only the risks of their own service" and "the council role reads every risk" were checked as data only (permission `risk.read` on both roles, the two rules attached). No member was seated in R-13 or R-14, no risk was created, and no read was made as such a member. The per-service narrowing is carried by the rule text and the risk owner field; no code enforces it yet.
- This was a trial import into the local database: the agency "Zöldhalom Város Önkormányzata" now exists once in it. A later whole import of the same file creates a second instance with the same name, or conflicts if the name limit per account applies; remove the trial instance first if that happens.
