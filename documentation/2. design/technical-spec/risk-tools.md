# Risk tools for Hub Steward (HS97)

Hub Steward, the lab's agent, answers the risk owner's questions in the manager's room. This page is what is built for it and what is left, row HS97 and decisions 39 and 7.

## What is built

| Piece | Where |
|---|---|
| The permission `risk.read` carries the six questions (threats, consequences, preventive measures, mitigating measures, what relies on a control, gaps) and the reads that find their subject (`risk.list`, `risk.read`, `risk.bowtie`, `control.list`, `control.read`). No write | `mwanachama-backend-agency/models/permissions_catalog.json`; described in that repo's `documentation/2. design/role-permissions.md` |
| The lab's Hub Steward role holds `risk.read`. The boda-boda riders' Hub Steward and the farmers' agent do not: the risk page of another hub is not theirs to open | `demo/siaya-lab/agency.json`, bundled byte for byte at `code/console/public/templates/siaya-lab.json` |
| A call outside the role's permissions is refused | The role check of decision 39 in wakala-api: a linked agent's tool call is allowed when an action of one of its role's permissions names it |

## How it is tested

The test that read the risk manager's operations file and the agency's permissions catalogue and applied the role check to the lab's Hub Steward (`risk_tools_test.go`) is not in this repo; what it checked is the table above: the six questions and the finding reads are allowed, every non-GET operation is refused, no other permission reaches the risk manager, and the other hubs' agents are refused the six questions. In the agency repo `risk_permissions_test.go` pins the permission's exact actions and fails if any unlocked permission carries a risk manager write.

No test here calls a real model or a mounted route.

## What is left

1. The mount, HS95: wakala-api serves none of the risk manager's routes or tools, so the permission names actions nothing answers yet. It waits on the owner's go-ahead (Q69).
2. Drafting the work that closes the gaps (journey step 7). The draft goes through `agency_propose_write`, and wakala-api applies an approved proposal only for the kinds it has an applier for. A kind that raises `riskmanager.action.create` with the owner and the due date is written with the mount, so that nothing is recorded before the manager approves (decision 7).
3. HS89's open decisions still decide who else is checked: residents and plain members, `/catalog` and `/reports`.
