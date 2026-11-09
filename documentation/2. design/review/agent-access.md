# Agent access

Status

- Market tools are gated per permission (`market.browse`, `market.offer`): an agent holding only browse is refused approve, answer, mark paid and cancel (closed on 2026-10-29: pinned by `internal/api/http/market_mount_test.go`).
- No tool lets an agent propose a record row, and the agent's limits for it are undrawn (open).
- An agent added without an agency role link is checked by no permissions at all in comm, forms, sources, assets, accounting, voting and tasks mounts (`mwanachama-wakala-api/internal/api/http/agent_permissions.go` `agentPermissioned`; `internal/agencies/member.go` `AddMember` leaves the link empty). Pinned as intended by tests, but decision 39 reads as if every agent is checked. Closed on 2026-10-29, decision 100 (HS305).

Log

## 2026-10-29 14:05 UTC

First run. Read the workflow and test pages, the agency, catalog and forms blueprints and operations, wakala-api's market tools and tests, and the studio and member routes. The market module repo is not checked out, so its side is unread.

## 2026-10-29 18:00 UTC

Rights traced: `agentPermissioned`, `cachedRolePermissions` (cached per tenant and role, no extra read per call), `AddMember`, `GrantAgentRole`. Found the unlinked-agent default. Q87 closed on 2026-10-29, decision 100 (HS305).

## 2026-11-02 15:30 UTC

An agent's reach is its role's permission codes read on each call (`ai_gateway.go` `aiGatewayCaller`), not the workflow step; decision 131 says otherwise. Turned into Q118.

- The only permission naming assetmanager actions is `asset.manage` (`mwanachama-backend-agency/models/permissions_catalog.json` line 65), which bundles list and read with create, update, balance and movement post; no read-only permission and no hold-by-holder read exists in the catalog, and the lab's agency.json has no Assets Keeper role. Turned into Q136. Open.

## 2026-11-05 00:40 UTC

Read the asset permission against decision 25 and 02-member step 4.
