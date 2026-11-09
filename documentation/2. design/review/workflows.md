# Workflows

Status

- A workflow has no per-order version in the agency module: `workflow` and `work_item` carry no version, only `agency_publication.version` holds a whole document, so "the version an order keeps" lives in the market module, which is not checked out (open; `mwanachama-backend-agency/agency.blueprint.json`).
- Orders under way against a new version have no drawn outcome (closed on 2026-10-29, decision 91).
- The drawn Records tab is a third tab beside the two tabs of decision 87 (closed on 2026-10-29, decision 90).
- Two tools named in the captions do not exist: `agency_list_default_workflows`, `agency_remove_workflow`; `agency_delete_workflow` exists and cascades to work items (open; `mwanachama-backend-agency/agency.operations.json`).
- "Can be called off by the Group coordinator, at any step" gives a Farmer no way out of a group order (closed on 2026-10-29, decision 92; the Supplier-approves cancel is Q77).

- The Add a workflow form carries no objective field ("the objectives it serves are set on the Objectives page"), yet a workflow with no objective is a blocking error on Publish (`mwanachama-backend-agency/issue_impl.go` `checkWorkflowObjectives`); the hub manager who adds a workflow meets the refusal only at Publish or Review. Screen note to draw: a line under the form saying it cannot be published until an objective serves it, or an Objective picker (open; can simply be drawn; `studio/agency/workflow-edit.html` screen 1).

Log

## 2026-10-29 14:05 UTC

First run. Read the workflow and test pages, the agency, catalog and forms blueprints and operations, wakala-api's market tools and tests, and the studio and member routes. The market module repo is not checked out, so its side is unread.

## 2026-10-31 11:00 UTC

Checked the Add a workflow form against the new scan rule; one drawing gap.
