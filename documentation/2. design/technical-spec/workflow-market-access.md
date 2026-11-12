# Workflow market access

The probe table of HS667: for each market tool, the workflow step it belongs to, the role that step names in the templates, whether the step carries anything the permissions gate could read, and what is missing for the gate to decide. Written on 2026-11-02 by reading the code and the template JSON; no test was run and no code was changed. A cell that the code or the template does not establish says unknown. Decisions behind it: [127][d] (a step names the role that acts), [131][d] (an AI role does what the workflow names it for), [134][d] (reading follows role permissions), [137][d] (what anyone may do is driven by the workflows, and the gate asks them), [138][d] (a role's reach is the steps that name it). Rows are on [the board][board]: HS667 (the gate), HS658 (the red test), HS662 (the template steps), HS612 (group roles), HS680 (group jobs with no step).

## 1. What the gate reads today

- The MCP gate (`mwanachama-wakala-api/internal/api/http/mcp_gate.go`) maps the tool name to its action (a tool missing from the map is refused). A market tool has no scope of its own, so the call is admitted only when its action is among `ActionsAnywhere(subject)`, the actions of every grant the caller holds. It reads no workflow, no agency role and no group. The per-caller tool list (`forRequest` and `hiddenTools` in `mcp_visible.go`) hides the tools by the same test, so a farmer is not shown them either and a change to the gate has to change the list too.
- `resident_grants.go` seeds a resident with forms, comm and actor actions only (`residentActions`). A resident holds no market action, so the gate refuses every market tool: this is the HS658 red test.
- Two more locks sit behind the gate and the table does not remove them. First, `invokeMarketTool` and the REST routes call `instanceMarketMount(role).Authorize`: `coordinatorGated` refuses `market.product.categorise` and `market.offer.regroup` to anyone who is not an owner or an agent, and `agentPermissioned` holds a linked agent to the permission catalogue; REST has its own admission (`mustBeMarketParticipant` through `admittedRole`, in `market_participant.go`), and the REST case of the same test file expects a resident to get 200; I did not run it. Second, the market manager checks its own steps (`DefaultWorkflows()` in the market repo: picker, poster, coordinator, agent). The registry tells it a coordinator is an owner or a seated agent (`UseCoordinators` in `internal/agencies/registry.go`), and nothing in wakala-api calls `UseWorkflows`, so the market never reads the agency's published workflows (`market-mount.md` of wakala-api says the same). A resident Coordinator who passed the gate would still be refused by the manager.
- The nearest thing to what the gate needs exists: `callerOpenSteps` (`caller_open_steps.go`) lists the live version's steps whose `role_id` is a role the caller holds, and skips a step with no `role_id`. `heldRoleKeys` (`caller_roles.go`) takes the role ids of every seat the caller holds whatever its group (HS612).
- A step can hold `kind`, `role_id`, `form_name`, `questions`, `tool` (one string), `tools` (the chat step's list) and `agent_role_id` (`mwanachama-backend-agency/models/workitem.go`). A work item's `action` is not in the blueprint (`spec:"-"`): `workitemstep_impl.go` sets it to the label `ActionOf(kind, form name)` builds when steps are listed ("Fills the Create group order"), and it is not a market action name. `2. design/review/step-kinds.md` records that only the Test agent reads `tool` and a live run reads nothing from it (Q113); I found no reader of it in `mcp_gate.go` or `caller_open_steps.go`.
- The agency's permission catalogue (`mwanachama-backend-agency/models/permissions_catalog.json`) already lists which market actions each permission carries. Twenty of the 51 market actions are in no permission (the second column below). This standing list is what [137][d] says no role keeps.

## 2. What the templates carry

| Template (`demo/`) | Steps | With a `kind` | With a `role_id` | With a `tool` or `tools` | Market module on |
|---|---|---|---|---|---|
| farmers | 27 | 3 (WI-13, WI-26, WI-27) | 3 (WI-13 Group coordinator; WI-26 and WI-27 Farmer) | 0 | yes |
| siaya-lab | 9 | 1 (WI-9) | 1 (Member) | 0 | no: modules comm and taskmanager |
| boda-boda-riders | 18 | 7 | 3 (Rider, Customer, Rider) | 0 | yes |
| the other five (drone, clinical research, electric grid, logistics, mobile money) | 17 to 22 | 0 | 0 | 0 | no market text |

The farmers' template also sits in `mwanachama-wakala-api/internal/api/http/testdata/agencies/farmers/` and `mwanachama-backend-agency/testdata/hub-demo/farmers/`; the three files have the same md5 and the same counts. The lab has no market step at all; its one role-carrying step is Join a group. In the farmers' template the roles tick permissions (Group coordinator: market.browse, market.group_order, market.group_order_send; Farmer: none for the market; Supplier: no list; Buyer: market.browse, market.offer; Farmers' agent: market.browse, market.ask, market.group_order, market.notice; Suppliers' agent: market.browse, market.offer). Those ticks are not steps and the gate of [137][d] does not read them.

The template has none of the workflows the designs name Become a supplier and the group jobs (HS626, HS680). Its nearest are W-11 Apply as a supplier and W-3 Approve a poster. Its role list has no Market manager, Admin or Vice Admin, and its Group coordinator is an agency role, not a group role ([121][d]).

Boda-boda riders: the steps that use the market by their text are W-1 WI-2 and WI-3, W-2 WI-6 (fill_form, Rider), and W-6 WI-13 to WI-15 (the customer picks, the agency sends the ask, the rider's yes_no). Which market tool each calls is unknown, because no step carries one. Its Rider ticks market.browse and market.offer, its Hub Steward market.ask and market.browse.

## 3. The table

Every tool of `mwanachama-backend-market/market.operations.json` (51), by the workflow it belongs to. The workflow names are the farmers' template's (W-4 Buy now, W-5 Create group order, W-6 Find it, W-7 Sell now, W-8 Create group sale, W-10 Join a group); Become a supplier is the designed workflow ([135][d]). Because no step names a tool, the step is read from the step's text and from how the app calls the tool, never from the step itself.

- Role cell: "(role_id)" means the step's `role_id` field, which the open-steps read and so a gate could read; "(text)" means the role appears only in the step's description, which no code reads.
- Called by: the app (`code/app/src`, by folder) and the console (`code/console`), from the non-test source. The Farmers' agent's own calls were not traced. "none found" means no call site in app, console or cmd.
- "Step carries a tool or action?": "No" means no `tool`, no `tools` and no kind on the step; the derived `action` label is not counted. Every step in every template falls under it.

### Becoming and being a supplier

| Tool and its action | Permission that carries it today | Called by (app, console) | Workflow and step | Role the step names | Step carries a tool or action? | Missing for the gate to decide |
|---|---|---|---|---|---|---|
| `market_apply_poster` `market.poster.apply` | market.poster | supply | Become a supplier, Apply (designed, not in the template). Nearest in the template: W-11 Apply as a supplier, WI-27 | Farmer (role_id) | kind only: fill_form, form Apply as a supplier | Which tool the form calls; the Become a supplier workflow itself (HS626); the applicant is named Farmer, so the role that holds the call is the role of every farmer |
| `market_approve_poster` `market.poster.approve` | none | none found | W-3 Approve a poster, WI-9 (designed: Become a supplier, Decide) | Group coordinator (text only); the design names the Market manager ([135][d]) | No | A role_id and a tool on WI-9; the Market manager role and the Become a supplier workflow are not in the template |
| `market_decline_poster` `market.poster.decline` | none | none found | W-3, WI-9 (one step for approve or decline) | as approve_poster | No | as approve_poster; the template does not say whether decline is a separate call or the same step |
| `market_remove_poster` `market.poster.remove` | none | none found | No step | none; the market design says the coordinator, [135][d] moved vetting to the Market manager, removal itself is undecided (roles.md section 6) | - | A step, and the owner's word on who removes |
| `market_set_availability` `market.poster.set_availability` | none | none found | None in the farmers' template. Boda-boda riders: W-2 Rider availability, WI-6, by its title | Rider in boda-boda (role_id) | kind only (boda-boda WI-6) | Whether that form calls this tool: unknown |
| `market_list_posters` `market.poster.list` | market.browse | buy/now, buy/join, buy/orders, buy/wanted, chat/rooms, coordinator/start, market, sell/now, supply | No step names it. A read the screens make in Buy now, Group order, Find it, Sell now and Become a supplier | - | - | A rule for reads (question 1) |

### Offers and stock

| Tool and its action | Permission that carries it today | Called by (app, console) | Workflow and step | Role the step names | Step carries a tool or action? | Missing for the gate to decide |
|---|---|---|---|---|---|---|
| `market_create_offer` `market.offer.create` | market.offer | supply | No step. The Supplier role text says he posts offers (R-3) | Supplier (role description only) | - | A step for posting an offer; the template has no workflow for it |
| `market_update_offer` `market.offer.update` | market.offer | supply | No step, as create_offer | Supplier (role description only) | - | as create_offer |
| `market_regroup_offer` `market.offer.regroup` | none | none found | No step; on the coordinator-only list `coordinatorOnlyMarketActions` (HS659) | none | - | A step that names a role; [137][d] keeps it on the coordinator-only list until one does |
| `market_categorise_product` `market.product.categorise` | market.categorise | none found | No step; on the same list | none | - | as regroup_offer |
| `market_list_kinds` `market.kind.list` | market.browse | none found | No step names it. A read the screens make | - | - | A rule for reads |
| `market_list_offers` `market.offer.list` | market.browse | 12 files under buy, chat, coordinator, market, sell, started, supply | No step names it. A read the screens make, in every journey that shows a price | - | - | A rule for reads |
| `market_set_stock` `market.stock.set` | market.offer | supply/stock | No step. R-3 text: he keeps his own stock | Supplier (role description only) | - | A step |
| `market_get_stock` `market.stock.read` | market.offer | supply/stock | No step names it. A read the screens make | - | - | A rule for reads |

### Buy now and orders

| Tool and its action | Permission that carries it today | Called by (app, console) | Workflow and step | Role the step names | Step carries a tool or action? | Missing for the gate to decide |
|---|---|---|---|---|---|---|
| `market_buy_now` `market.order.create` | none | buy/now, sell/now | W-4 Buy now. Which of WI-10, WI-11, WI-12 creates the order is not said. The app also calls it from Sell now (W-7) | Farmer (text, WI-10: the farmer picks a row) | No | Which step; a role_id; a tool |
| `market_cancel_order` `market.order.cancel` | none | buy/now, buy/orders, sell/now | W-4, a sentence in WI-12: the farmer may cancel at once until the agency adds a cancel workflow. No step of its own. The app also calls it from Sell now | Farmer (text) | No | A Cancel workflow or step; the module's own Cancel workflow is a default in code, not in the template |
| `market_mark_paid` `market.order.mark_paid` | none | supply/orders | W-4, WI-12 | the poster (text); the Supplier role is not named in the step | No | A role_id (Supplier) and a tool |
| `market_get_order` `market.order.read` | none | buy/join, buy/now, buy/orders, supply/orders | No step names it. A read the screens make | - | - | A rule for reads |
| `market_list_orders` `market.order.list` | none | buy/join, buy/orders, sell/now, supply/orders | No step names it. A read the screens make | - | - | A rule for reads |
| `market_order_trail` `market.order.trail` | market.browse | buy/orders | No step names it. A read the screens make | - | - | A rule for reads |

### Find it and Sell now

| Tool and its action | Permission that carries it today | Called by (app, console) | Workflow and step | Role the step names | Step carries a tool or action? | Missing for the gate to decide |
|---|---|---|---|---|---|---|
| `market_create_wanted` `market.request.create` | none | buy/wanted, sell/now | W-6 Find it, WI-16 (the app makes the request, then asks or posts a notice); also W-7 Sell now in the app | Farmer (text) | No | Which step; a tool; a role_id |
| `market_get_request` `market.request.read` | none | none found | No step | - | - | A rule for reads |
| `market_ask` `market.ask.create` | market.ask | buy/wanted, sell/now | W-6 WI-16 (the farmer ticks the posters to ask); W-4 WI-10 (the Farmers' agent asks the picked poster); W-7 WI-19 (the Farmers' agent asks the buyer) | Farmer (text, WI-16); Farmers' agent (text, WI-10 and WI-19) | No | Three steps and two roles use one tool and none carries it. The app's Buy now does not call it, so who calls it at WI-10 is unknown |
| `market_list_asks` `market.ask.list` | market.ask | buy/wanted, chat, chat/rooms, sell/group, sell/now, supply/stock | W-6 WI-17 (show each answer) by effect; the poster also reads asks addressed to him | none named | No | A rule for reads |
| `market_answer_ask` `market.ask.answer` | market.ask_answer | chat | W-4 WI-11 (the poster); W-7 WI-20 (the buyer). W-6: only the workflow text says each asked poster answers for himself | the poster, the buyer (text) | No | role_ids Supplier and Buyer; a tool; one tool serves two roles |
| `market_list_yeses` `market.yes.list` | market.ask | buy/wanted, chat/rooms, sell/now, supply/orders | No step names it. A read the screens make | - | - | A rule for reads |
| `market_withdraw_ask` `market.ask.withdraw` | none | sell/now | No step. The app's Sell now cancel calls it; W-7 has no cancel step | - | - | A step |
| `market_create_notice` `market.notice.create` | market.notice | buy/wanted | W-6 WI-16 (puts up a notice every poster sees) | Farmer (text) | No | A tool; a role_id |
| `market_withdraw_notice` `market.notice.withdraw` | none | buy/wanted | No step | - | - | A step |
| `market_list_notices` `market.notice.list` | market.browse | buy/wanted | No step names it. A read the screens make | - | - | A rule for reads |

### Group order and Group sale

| Tool and its action | Permission that carries it today | Called by (app, console) | Workflow and step | Role the step names | Step carries a tool or action? | Missing for the gate to decide |
|---|---|---|---|---|---|---|
| `market_start_group_order` `market.group_order.start` | market.group_order | coordinator/start, console test blocks | W-5 Create group order, WI-13; W-8 Create group sale, WI-21 | Group coordinator (role_id at WI-13; text at WI-21) | WI-13 kind only: fill_form, form Create group order, 3 questions. WI-21: no | A tool on both steps; a kind and role_id on WI-21; the group the order belongs to (the group order record has none); R-1 is an agency role in the template, while decision 121 makes Coordinator a group role |
| `market_get_group_order_poster` `market.group_order.poster` | market.group_order | coordinator/start | W-5 WI-13 by effect (the order starts from the poster's bulk price) | - | - | A rule for reads |
| `market_list_group_orders` `market.group_order.list` | market.browse | market | No step names it. A read the screens make | - | - | A rule for reads |
| `market_get_group_order` `market.group_order.read` | market.browse | buy/join, buy/orders, chat/rooms, sell/group, supply/groupOrder | No step names it. A read the screens make | - | - | A rule for reads |
| `market_group_order_trail` `market.group_order.trail` | market.browse | none found | No step names it. A read the screens make | - | - | A rule for reads |
| `market_join_group_order` `market.group_order.join` | market.group_order_join | buy/join, sell/group, console test blocks | W-5 WI-14; W-8 WI-22. W-9 WI-25 (change or cancel my share): which tool it uses is unknown | Farmer (text) | No | A tool; a role_id; the group the order sits in |
| `market_ask_revision` `market.group_order.ask_revision` | market.group_order | supply/groupOrder | W-5: the poster asking is mentioned inside WI-14's text; no step of its own | unknown: the text names no role for the poster's ask | No | A step and a role |
| `market_answer_revision` `market.group_order.answer_revision` | none | buy/join, chat/rooms | W-5 WI-14 | Farmer (text) | No | A tool; a role_id |
| `market_promise_group_order` `market.group_order.promise` | market.group_order_promise | console test blocks | No step of W-5 or W-8 names the supplier's answer. W-1 WI-4 (the supplier answers) is the older pooled-order text; W-8 WI-24 (the buyer says yes for the whole sale): whether it is this tool is unknown | unknown | No | A step that names the supplier and the buyer for this tool |
| `market_send_group_order` `market.group_order.send` | market.group_order_send | coordinator/payments, console test blocks | W-5 WI-15; W-8 WI-23 | Group coordinator (text) | No | A tool; a role_id; the group |
| `market_mark_line_paid` `market.group_order.line_paid` | market.group_order | none found | No step. Decision 90 moved payments to a row of the Payments record (HS680) | - | - | A step (HS680) |
| `market_decide_silent_line` `market.group_order.decide_silent_line` | market.group_order | none found | No step. Only W-5's description says the coordinator decides for a quiet farmer (HS680) | Group coordinator (workflow description only) | - | A step (HS680) |
| `market_reopen` `market.group_order.reopen` | none | none found | No step yet (HS706) | - | - | A step (HS706) |
| `market_call_off` `market.group_order.call_off` | market.group_order | none found | No step. A sentence of WI-25 says only the coordinator calls an order off (HS680) | Group coordinator (a clause of WI-25 whose actor is the farmer) | - | A step (HS680) |

### Bidding on a notice

| Tool and its action | Permission that carries it today | Called by (app, console) | Workflow and step | Role the step names | Step carries a tool or action? | Missing for the gate to decide |
|---|---|---|---|---|---|---|
| `market_send_quote` `market.quote.send` | none | none found | None. The module's default Bidding workflow (quoted: poster, drafted: agent, countered: picker, accepted: picker) is in code and not in any template | - | - | A workflow and steps; the Farmers' agent role in the template ticks market.ask, market.notice and market.group_order, and no market.advise |
| `market_list_quotes` `market.quote.list` | market.advise | none found | None. The module's default Bidding workflow (quoted: poster, drafted: agent, countered: picker, accepted: picker) is in code and not in any template | - | - | A workflow and steps; the Farmers' agent role in the template ticks market.ask, market.notice and market.group_order, and no market.advise |
| `market_draft_counter` `market.draft.create` | market.advise | none found | None. The module's default Bidding workflow (quoted: poster, drafted: agent, countered: picker, accepted: picker) is in code and not in any template | - | - | A workflow and steps; the Farmers' agent role in the template ticks market.ask, market.notice and market.group_order, and no market.advise |
| `market_list_drafts` `market.draft.list` | market.advise | none found | None. The module's default Bidding workflow (quoted: poster, drafted: agent, countered: picker, accepted: picker) is in code and not in any template | - | - | A workflow and steps; the Farmers' agent role in the template ticks market.ask, market.notice and market.group_order, and no market.advise |
| `market_send_counter` `market.counter.send` | none | none found | None. The module's default Bidding workflow (quoted: poster, drafted: agent, countered: picker, accepted: picker) is in code and not in any template | - | - | A workflow and steps; the Farmers' agent role in the template ticks market.ask, market.notice and market.group_order, and no market.advise |
| `market_revise_quote` `market.quote.revise` | none | none found | None. The module's default Bidding workflow (quoted: poster, drafted: agent, countered: picker, accepted: picker) is in code and not in any template | - | - | A workflow and steps; the Farmers' agent role in the template ticks market.ask, market.notice and market.group_order, and no market.advise |
| `market_accept_quote` `market.quote.accept` | none | none found | None. The module's default Bidding workflow (quoted: poster, drafted: agent, countered: picker, accepted: picker) is in code and not in any template | - | - | A workflow and steps; the Farmers' agent role in the template ticks market.ask, market.notice and market.group_order, and no market.advise |

Join a group has no market tool, so the table cannot decide it. Its form step names Farmer in the farmers' template (W-10 WI-26) and Member in the lab's (W-5 WI-9) by role_id; the decide step that [126][d] and [137][d] give the Admin is in neither template (HS648). The join routes carry their own check (`agentMayDecideJoinRequests` in `agent_permissions.go`); I did not read it.

## 4. What the table says

- The gate reads no workflow. It admits a market call only when the action is in a grant the caller holds, and a resident holds none.
- Of the 51 tools, 34 have no step in the farmers' template that uses them: 12 reads no step names, 14 writes with no step, the 7 bidding tools (no bidding workflow in any template) and `market_set_availability` (only in boda-boda). The other 17 map to a step by its text or by the app's use.
- No step in any template carries a tool: 0 of the farmers' 27, 0 of the lab's 9, 0 of boda-boda's 18. Three farmers' steps carry a kind and a role_id, and only one of them (WI-13, Start the group order) is a market step. Read by role_id alone, the gate would see that step and nothing else (WI-27 is the application form, WI-26 Join a group).
- Of the 8 tools the red test needs, `market_list_posters`, `market_list_offers` and `market_list_group_orders` are reads no step names, `market_list_asks` is a read that W-6 WI-17 implies, and `market_join_group_order`, `market_buy_now`, `market_ask` and `market_answer_revision` are writes whose steps (W-5 WI-14, W-4, W-6 WI-16 and W-7 WI-19, W-5 WI-14) name the farmer in text only. The gate alone cannot turn the test green with these templates.
- One tool sits on several steps with different roles: `market_ask` on a Farmer step and two Farmers' agent steps, `market_answer_ask` on a poster step and a buyer step, `market_join_group_order` on W-5 and W-8. A group order record has no group (its fields are poster, coordinator, product, price, minimum, terms, state, direction and dates), and the gate's role read ignores groups.

## 5. Open for the owner or the lead

1. A call that has no step. Twelve reads and fourteen writes have none (writes with no home: create_offer, update_offer, set_stock, withdraw_ask, withdraw_notice, remove_poster, regroup_offer, categorise_product, and the group jobs of HS680; cancel_order has only a sentence of WI-12). Does the gate refuse a call that no step uses, which means a step that names the reader for every read, or admit reads to any member of the agency and require a step only for writes ([134][d] says reading follows role permissions)?
2. What a step must carry. The template carries no tool and no action, and 24 of the farmers' 27 steps carry no role_id, which the open-steps read skips. The existing `tool` field is one string that nothing live reads (Q113); W-6 WI-16 uses three tools (create_wanted, ask, create_notice) and W-5 WI-14 two. Is it one tool per step, a list, or a market action name? Whichever it is, HS662 (P2) is a precondition of HS667 (P1), not a follow-up.
3. A step that names a group role, and the Coordinator-only calls. Start and send have a step naming the Group coordinator (WI-13 by role_id, WI-15, WI-21 and WI-23 in text); decide a quiet line, record a payment, call off and reopen have none (HS680), and regroup, categorise and remove a poster have none and no owner. Where does the group of a call come from, given that the group order has no group, `start_group_order` creates it and `heldRoleKeys` ignores the group (HS612)? The market's own coordinator check, which accepts only owners and seated agents, has to change in the same piece of work (HS646), or the gate's yes changes nothing for a farmer who coordinates.
4. How coarse the gate is. "A published step that uses the tool names the caller's role" admits a Buyer to `market_answer_ask` through Sell now whatever ask it is. Is the gate coarse (role and tool), with the market's picker, poster and coordinator check as the second lock, or must the gate check the record against the workflow it was started under? The market stamps a workflow version on an order but, with `UseWorkflows` never supplied, reads none of the agency's workflows. Also for the same piece of work: the designed Become a supplier decides with the Market manager ([135][d]) while W-3 WI-9 says the Group coordinator in text.

## 6. Not established

- Which tool each step calls: the template does not say, so every step-to-tool cell is read from the step's text and the app's call sites.
- Which of W-4 WI-10, WI-11 and WI-12 creates the order that `market_buy_now` makes, and who calls `market_ask` at WI-10 (the app's Buy now does not; the Farmers' agent might).
- Whether W-11 WI-27's form calls `market_apply_poster`, whether boda-boda W-2 WI-6 calls `market_set_availability`, whether W-9 WI-25 (change my share) uses `market_join_group_order`, and which tool the supplier's and the buyer's yes on a group order or sale uses (`market_promise_group_order` or another).
- Whether a published agency in a live database matches the template files; no database was read. Which template the red test's instance publishes (`newAIWalk` was not read).
- The Farmers' agent's own tool calls, and the console beyond its tool names (`console/src/data/blockEndpoint.ts`, `console/e2e/helpers/walk.ts`).
- Which version of the permission catalogue wakala-api builds against; the table reads the agency repo's checkout.

[d]: ../../../../meta-global-ai-hackathon-community-hubs/documentation/1.%20requirements/decisions.md
[board]: ../../../../meta-global-ai-hackathon-community-hubs/documentation/3.%20implementation/todo.md
