# Report files

`forms_results_files` lists the report files stored for a form, so a member who may publish a report can pick one instead of typing its path and version. Both arguments are required: `instance_id` and `form_id`.

| Operation | Reads / writes | Who | REST | MCP |
|---|---|---|---|---|
| List a form's report files | reads the stored versions of each report file of one form | a member whose role holds `report.publish` | Exists | Exists: `forms_results_files`, action `forms.results.files` |

## Where the list comes from

The list comes from the agency's git repository named "reports", on its default branch, in the folder named by the form id. One item is returned for each version of each file in that folder:

| Field | Meaning |
|---|---|
| `name` | The file's name |
| `path` | The file's path in the repository |
| `version` | The commit sha of that version |
| `committed_at` | When that version was committed |

Items come newest first, at most 200. The answer is an empty list, not an error, when the repository or the folder is missing or the form is not the agency's.

## Why a tool of its own

The `forms_git_*` tools serve only owner and agent roles. The role holder is a resident, so none of them was open to them. This tool is gated by `forms.results.files`, which the `report.publish` permission carries, and takes the caller from the session.

## On the phone

The step page shows each item as a row with the name, the first 7 characters of the version and the date. Tapping a row selects it, and Publish sends its `path` and full `version` to `forms_results_publish`. With nothing stored the page says "No report file is stored for this step yet." and offers no Publish. A member without `report.publish` sees nothing.

## Not built

How a report file gets into the "reports" folder of a form is not built. Someone with git access, an owner or an agent, commits it.

Code: `code/wakala-api/internal/api/http/results_files.go`; the phone side is `app/src/features/steps/PublishReport.tsx` and `publishApi.ts`.
