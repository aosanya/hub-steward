# The farmers agency and the phone app

Roles: see [roles.md](roles.md).

The owner asked twice, on 2026-11-02, that the phone app's screens stop inventing names and draw what the agency has ("most of the functionality is in the agency; use the farmers agency in demo"). This page records what the farmers agency really holds, where the phone app draws each part of it, how the Start page is built, and which names the app uses that the agency does not hold. A gap is listed, never filled.

Sources: `demo/farmers/agency.json` (the agency), `code/app/src` (the live phone app, read only), `documentation/2. design/mockups/app` (the drawings), the backends' `*.operations.json` and `mwanachama-wakala-api/internal/api/http`, and for modules and market tools `mwanachama-backend-agency/models` and `mwanachama-backend-market`. The wakala API itself was not queried: its MCP server answered HTTP 401 in the drawing session. A live `agency_list_my_open_steps` answer would settle the questions marked "live API" below.

Updated 2026-11-02 with the API research of the same day, which read those files and code and not the live API (answers in sections 2 to 5), and with the findings of the auditors who checked the drawings (section 6).

The live app draws Home with Start and Ongoing segments (`tabs.ts:5-12`, `pages/HomePage.tsx:13`, `pages/started/Ongoing.tsx:18`); the drawings show Home with Start, Ongoing and Backlogs as option rows and the bar Home and Chat (decision 118, changed by D154; HS576 changes the app).

## 1. What the farmers agency has

Siaya Farmers' Group (`agency.name`). Modules, all enabled: `comm`, `taskmanager`, `forms`, `market` (their `name` is the same lowercase word). Roles:

| Code | Role | Said in the agency |
|---|---|---|
| R-1 | Group coordinator | "This role is held by a person." Approves each supplier (the template changes under HS626), starts the group order, decides for a silent farmer, adds a Payments row |
| R-2 | Farmer | A member who grows crops |
| R-3 | Supplier | Approved by the group coordinator (the template changes under HS626); posts offers, keeps stock, says yes or no, marks an order paid |
| R-4 | Buyer | Posts his price; says yes or no for himself |
| R-5 | Farmers' agent | "The group's AI role"; speaks to the people who want something |
| R-6 | Suppliers' agent | "The group's AI role"; speaks to the posters |

Workflows and work items (a role and a form name exist only on the Fill a form items, `kind` `fill_form`):

| Workflow | Work items |
|---|---|
| W-1 Pool an input order | WI-1 Collect the farmers' input questions; WI-2 Draft the pooled order; WI-3 Approve and send the order; WI-4 The supplier answers; WI-5 Tell each farmer their share |
| W-2 Produce to a buyer | WI-6 Collect produce and wants; WI-7 Offer the match |
| W-3 Approve a poster | WI-8 Receive the supplier's application; WI-9 Approve or decline the supplier |
| W-4 Buy now | WI-10 Ask the picked poster; WI-11 The poster says yes or no; WI-12 Mark the order paid |
| W-5 Create group order | WI-13 Start the group order (`fill_form`); WI-14 Farmers join and revise; WI-15 Send the order |
| W-6 Find it | WI-16 Choose shops to ask or put up a notice; WI-17 Show each answer as found for you |
| W-7 Sell now | WI-18 The farmer sells at the posted price; WI-19 Ask the buyer once; WI-20 The buyer says yes |
| W-8 Create group sale | WI-21 Start the group sale; WI-22 Farmers join with their bags; WI-23 Send the group sale; WI-24 The buyer says yes |
| W-9 Change my share | WI-25 Change or cancel my share |
| W-10 Join a group | WI-26 Join a group (`fill_form`) |
| W-11 Apply as a supplier | WI-27 Apply as a supplier (`fill_form`) |

| Item | Role | Form name | Questions |
|---|---|---|---|
| WI-13 | Group coordinator | Create group order | Product (free_text, required); Price a bag (currency, required); Minimum bags (number, required) |
| WI-26 | Farmer | Join a group | Group code (free_text, optional) |
| WI-27 | Farmer | Apply as a supplier | Shop name (required); Area, What you sell (free_text, optional) |
| RC-1 record Payments (W-5, Group coordinator) | | Payment | Select the farmer (single_choice from Farmer, required); Enter the amount paid (currency, required) |

The agency attaches one record, RC-1 Payments (form Payment, held by the Group coordinator), to W-5 Create group order (`records[0]` of `agency.json`: `workflow_id` W-5, `role_id` R-1). Select the farmer reads its list from `Farmer` (`options_from`), the role of that name, so the list is the people who hold the role Farmer, not every actor.

The siaya-lab agency (comm, taskmanager; roles Lab manager, Member, Hub Steward) holds one Fill a form item, WI-9 Join a group, held by the Member, with the same Group code question.

## 2. Where the phone app draws each workflow

Design paths are under `documentation/2. design/mockups/app/`; routes are in `code/app/src/App.tsx`. Tools are the names the app calls; those of `comm_` and `forms_` are the operation's action with dots turned to underscores (`mwanachama-backend-shared/dispatch/tools.go:119`), the market tools carry their own names in `market.operations.json`.

| Workflow | Design | Live app | Tools |
|---|---|---|---|
| W-1 | None named. The agency's objective note puts the input question in a form and the answer in a thread: `06-forms/forms.html`, `answer.html`; `04-chat/farm-room.html` | `/forms`, `/forms/:id`; `/chat/:roomId/:threadId`. WI-2 to WI-4: none found | `forms_form_list_waiting`, `forms_question_list`, `forms_answer_submit`, `comm_chat_thread_list`, `comm_chat_message_list` |
| W-2 | None named. The agency's note puts the match in a thread: `04-chat/farm-room.html` | `/chat/:roomId/:threadId`. The match itself: none found | `comm_chat_message_list`, `comm_chat_message_post` |
| W-3 | `14-supply-inputs/step-01-applies-and-is-approved.html` screens 4 and 5 (the Inbox notice, the supplier approved). The Market manager's decision: none drawn | Inbox shows the `supplier_approved` event (`pages/InboxPage.tsx:22`). The deciding screen: none found | `comm_notification_list`. `market_approve_poster` and `market_decline_poster` exist; the app calls neither |
| W-4 | `13-buy-inputs/step-02-buys-now.html`; supplier side `14-supply-inputs/step-03-answers-an-ask.html`, `step-05-marks-an-order-paid.html` | `/apps/buy`, `/market/:productId/buy/:offerId`, `/market/orders/:orderId`, `/my-orders`; supplier `/asks`, `/asks/:askId`, `/orders`, `/orders/:orderId` | `market_buy_now`, `market_ask`, `market_get_order`, `market_cancel_order`, `market_list_asks`, `market_answer_ask`, `market_list_yeses`, `market_list_orders`, `market_mark_paid` |
| W-5 | `18-run-a-group-order/step-01` to `step-04` (step 04 screens 2 to 4: the order page is titled with its product and holds Manage payments under a Records heading); farmer `13-buy-inputs/step-03-joins-a-group-order.html`; supplier `14-supply-inputs/step-04-sees-a-group-order.html` | `/start/:stepId`, `/coordinator/orders/:orderId` (titled Group order, Manage payments among the details, `coordinator/payments/PaymentsPages.tsx:40-80`), `.../payments`, `.../payments/new`, `.../payments/:rowId/correct`; `/market/:productId/group-orders/:id` and `/join`; `/group-orders`, `/group-orders/:orderId`, `/revise`. Deciding for a silent farmer: none found | `agency_list_my_open_steps`, `market_get_group_order_poster`, `market_list_posters`, `market_start_group_order`, `market_get_group_order`, `market_join_group_order`, `market_answer_revision`, `market_ask_revision`, `market_send_group_order`, `agency_list_live_records`, `agency_list_live_record_rows`, `agency_add_live_record_row`, `agency_get_my_roles`, `actor_list_actors`. `market_decide_silent_line` exists; no screen calls it. `market_group_order_trail` exists; no screen calls it (the app reads `market_order_trail` for a Buy now order only, `buy/orders/api.ts:151`) |
| W-6 | `13-buy-inputs/step-04-finds-something-not-listed.html`; `04-chat/farm-room.html` screens 2 and 3 | `/buy/wanted`, `/buy/wanted/:requestId/ask`, `/buy/wanted/:requestId`, `/buy/notices/:noticeId` | `market_create_wanted`, `market_ask`, `market_list_asks`, `market_list_yeses`, `market_create_notice`, `market_list_notices`, `market_withdraw_notice` |
| W-7 | `16-sell-the-harvest/step-01-sees-prices-and-sells-now.html`, `step-03-buyer-posts-a-price-and-answers.html` | `/apps/sell`, `/sell`, `/sell/:productId`, `/sell/:productId/now/:offerId`, `/sell/sale/:saleId`; buyer `/sell/asks`, `/sell/asks/:askId` | `market_list_offers`, `market_buy_now`, `market_ask`, `market_create_wanted`, `market_withdraw_ask`, `market_cancel_order`, `market_list_asks`, `market_answer_ask` |
| W-8 | `16-sell-the-harvest/step-02-sells-together.html` (a farmer joins). Start, send, the buyer's yes: none drawn | `/sell/group/:orderId`. Start, send, the buyer's yes on the whole: none found | `market_get_group_order`, `market_join_group_order` |
| W-9 | `13-buy-inputs/step-03-joins-a-group-order.html` screen 5 (her Join form with a Take out button) | `/market/:productId/group-orders/:id/join` opens with her bags filled in (`buy/join/JoinPage.tsx:19`). Take out or cancel a share: none found | `market_join_group_order` ("Add or change the caller's line"; it refuses a quantity that is not positive, `mwanachama-backend-market/group.go:181-187`). Take out has no tool: `market_leave_group_order` is in no operations file, and the drawing's note says so (`_generator/pages_j13_step3.py`); HS580 |
| W-10 | `02-do-something/join-group.html` screens 1 to 4 (journey 22); `05-inbox/inbox.html` screens 3 and 4 | `/join` (title "Join Group", `pages/join/JoinPage.tsx:97`) | `actor_list_joinable_groups`, `actor_find_group_by_code`, `actor_join_group`, `actor_list_my_join_requests`, `actor_list_my_groups`, `actor_list_my_invitations`, `actor_accept_invitation` |
| W-11 | `14-supply-inputs/step-01-applies-and-is-approved.html` screens 1 to 5 | `/supply/apply` (title "Apply as a supplier", or "Your application" once sent, `pages/supply/ApplyPage.tsx:42`) | `market_apply_poster` (name, area, posts), `market_list_posters`, `actor_list_group_leaders` |

For W-10 and W-11 the agency's step only names the row: `agency_list_my_open_steps` gives the form name; the work is done by the `actor_` and `market_` tools above, not by submitting the step's questions.

## 3. How the Start page is built

The drawing is `02-do-something/do-something.html` (Start, Ongoing, lab, supplier, menu). The live source is the old Home; its parts carry over.

Start (live: `pages/HomePage.tsx:9-25`):

| Part | How it is made | Where |
|---|---|---|
| Open steps | `agency_list_my_open_steps` returns each live step whose role the caller holds (`mwanachama-wakala-api/internal/api/http/caller_open_steps.go:68,91-93`). The app keeps those with `kind` `fill_form` and at least one question | `coordinator/start/api.ts:37,79-82` |
| A step's row | Named by its `form_name`, only when `form_name` has a screen: Join a group at `/join`, Apply as a supplier at `/supply/apply` | `home/StartRows.tsx:22-25`, `home/workflowScreens.ts:8-11` |
| Create group order | Not a row: a "Waiting on you" card for the Group coordinator, only while no live buy group order exists and the step asks free_text, currency and number | `coordinator/start/Waiting.tsx:12-16`, `coordinator/start/api.ts:39-41,74-78` |
| The app's own cards | Farmers: Buy inputs, Sell harvest, Forms. Supplier: Offers, Asks, Group order, Orders, Your prices, Forms. Lab: none. No workflow of a live agency carries these names (section 5, question 1). Decision 123 draws Buy inputs and Sell harvest as chat workflows of the agency (`studio/agency/workflow-chat.html`), so this row becomes the agency's once HS640 and HS644 are built | `home/cards.ts:19-23` |
| Module filter | A card shows only while its module is on: Forms needs `forms`, every other card needs `market`; unreadable modules show every card. The read is `agency_list_modules` with no arguments, while the operation takes a `draft_id`; a reply with an empty `items` list gives `modules: []` and drops every card that needs a module. Unverified: it needs the live API | `home/cards.ts:25-41`, `agency/modules.ts:20,23-33`; `mwanachama-backend-agency/agency.operations.json:1033-1056` |
| Icons | None on a row today: a workflow and a step carry no icon key. Decision 123 adds one mark, the chat icon before the name of a chat workflow's row, which comes from the workflow's type and not from an icon key (HS644, HS645). A module and a mount do (`ModuleIcons`, 16 keys; market `wheat`, forms `file`, comm `chat`), and the app reads none (`agency/modules.ts:13-16` reads code and name) | `mwanachama-backend-agency/models/module.go:44-48`, `models/modules_catalog.json` |
| Which set | An approved poster gets the supplier set, everyone else the farmers' set | `supply/SupplierHome.tsx:20-26` |
| Order | Cards first, then steps, no path twice | `home/StartRows.tsx:82` |

Ongoing (live: `started/api.ts`, `pages/started/Ongoing.tsx`). She is identified by `GET /me` (`wakala/me.ts:10`).

| Row | Tools | Words | Opens |
|---|---|---|---|
| A group order she started | `market_list_group_orders`, `market_list_offers` (product name); live means direction buy, state open or revising, and she is the coordinator | workflow "Create group order", state Open or Revising (`:13,:17-19,:36-48`; `coordinator/start/api.ts:65`) | `/coordinator/orders/:id` |
| A group order she joined | the same, and she has a line | workflow "Group order" (`:14,:50-56`) | `/my-orders/group/:id` |
| A request to join | `actor_list_my_join_requests`, pending only; names from `actor_list_joinable_groups`, `actor_list_my_groups` | workflow "Join a group", state Requested (`:20,:60-75`) | `/join` |
| A supplier application | `market_list_posters`, her record with status pending | workflow "Apply as a supplier", state Asked, title her shop (`:21,:77-81`) | `/supply/apply` |

A row reads the title, then "workflow · state" (`Ongoing.tsx:43`). The page fails when the read itself fails, or when no row loaded and a source failed (`Ongoing.tsx:22,26`; `started/api.ts:112-115`). The empty card in the live app is "Nothing ongoing yet" with "Go to Start" (`Ongoing.tsx:29-33`); the owner has not confirmed the wording.

The group order's page (decision 119; drawn in `18-run-a-group-order/step-04-sends-the-order.html` screens 2 to 4, with the payments list in `step-03-manages-payments.html` screen 1):

| Part | Drawn | Live app | Source |
|---|---|---|---|
| Title | The product, Urea 50kg, with the form's name, Create group order, as the one sub line | Group order | `pages_j18_run_a_group_order.py` `order_page`; `coordinator/payments/PaymentsPages.tsx:39-80` |
| Terms and bags | First, two rows | The same two rows | the same |
| Records | A Records heading, then the row Manage payments with the number added; the payments list's back link reads the product | No heading; Manage payments is the third row among the details | the same; `agency.json` `records[0]` attaches RC-1 Payments to W-5 |
| Send the order | A button, only while the order is open | The same | the same |

Questions that pick a person (decision 119; the kit function `field_search`):

| Question | Drawn | Live app |
|---|---|---|
| Supplier, the first question of Create group order when several suppliers are approved | A searchable dropdown, closed with one chosen, then open with the search text typed (`18-run-a-group-order/step-02-fills-the-form.html` screens 2 and 4) | Chips: `ui/ChipPicker.tsx`, used at `coordinator/start/StartPages.tsx:40` |
| Select the farmer, on the Payment form of RC-1 | The same, the list being the people who hold the role Farmer (`options_from`); four names are drawn (`step-03-manages-payments.html` screens 2 and 8) | The shared `Select`, a native list with no search: `ui/Select.tsx`, used at `coordinator/payments/PaymentsPages.tsx:194` |

## 4. Names the phone app uses that the agency does not hold

| Name | Comes from | The agency instead |
|---|---|---|
| Buy inputs | `home/cards.ts:8`; `App.tsx:88`; its prompts What is on sale, Something not listed, My orders (`apps/thread/marketSource.ts:5-7`) | W-4 Buy now, W-6 Find it; a live agency carries no workflow of this name. Decision 123: a chat workflow of the agency (HS640) |
| Sell harvest | `home/cards.ts:9`; `App.tsx:89`; a second label at `/sell` (`sell/now/routes.tsx:9`) | W-7 Sell now, W-8 Create group sale. "Sell harvest" is a workflow only in a wakala-api test fixture (`mwanachama-wakala-api/internal/testruns/sellharvest_fixture_test.go:173`) and in the console e2e plan (HS448). Decision 123: a chat workflow of the agency (HS640) |
| Forms | `home/cards.ts:7`; replaced by the forms module's `name` when the agency has it (`cards.ts:43-44`) | A module `forms` (name is lowercase `forms`), a record form Payment; no workflow named Forms |
| Group order, as a row | `home/cards.ts:15`; `started/api.ts:20-23` | W-5 is Create group order; joining is WI-14 Farmers join and revise |
| Offers, Asks, Orders, Your prices | `home/cards.ts:13,14,16,10` | The market module's records (offers, asks, orders); no workflow |
| Open, Revising, Requested, Asked | `started/api.ts:25-30`: market group-order states, a join request's state, a poster's status | No workflow state words |
| Waiting on you, Asks waiting | `coordinator/start/Waiting.tsx:15`; `sell/buyer/BuyerHome.tsx:28` | None |
| Join Group (page title) | `pages/join/JoinPage.tsx:97`; the sitemap label | The step's form name is Join a group |
| Supplier and Buyer as the app tells them apart | The market poster record and its status (`supply/api.ts:101,164`), not the agency roles; only the Group coordinator is read from the roles (`agency_get_my_roles`, `people/api.ts:6`) | Roles R-3 Supplier, R-4 Buyer |
| Start, Ongoing, the drawer | Owner, decisions 118 and 154 | None |
| Records (heading), the product as the order page's title | Owner, decision 119; `pages_j18_run_a_group_order.py` | The record is named Payments (RC-1), its form Payment |
| Manage payments | `coordinator/payments/PaymentsPages.tsx` (title and row) | The record RC-1 is named Payments, its form Payment |

## 5. Open questions for the owner

Status on 2026-11-02: answered, partly answered or still open, with the source of what is known. "Live API" means the answer needs the wakala API, whose MCP server answered 401. Questions 1 to 8 are those of the first draft of this page; 9 to 13 came with the redesign.

| # | Question | Status | What is known | Source |
|---|---|---|---|---|
| 1 | Decision 118 quotes the owner: "we have Create Group Order and Sell Harvest in the api". `agency.json` has Create group order (W-5) but no Sell harvest. Does the published farmers agency differ from the file? | Partly answered | A live agency carries Create group order as W-5 with WI-13, and no Sell harvest or Buy inputs workflow (the API research of 2026-11-02, from files, not re-checked against the live API). "Sell harvest" exists as the app's own hard-coded card, as a workflow in a wakala-api test fixture and in the console e2e plan only. Still open: what the owner meant, and what the published agency holds (live API) | `demo/farmers/agency.json` `workflows`; `code/app/src/home/cards.ts:9`; `mwanachama-wakala-api/internal/testruns/sellharvest_fixture_test.go:173`; HS448 in `documentation/3. implementation/todo.md`; decision 118 |
| 2 | Buy inputs and Sell harvest are the app's own cards. Keep them as rows, or name the rows by the agency's workflows (Buy now, Find it, Sell now, Create group sale)? | Still open | Neither is a workflow of a live agency, so keeping them keeps the app's own cards. Naming rows by the workflows is not a rename: the app keeps only Fill a form steps that have a question, and `agency.json` has those only for WI-13, WI-26 and WI-27 | `code/app/src/coordinator/start/api.ts:37,79-82`; section 1; decision 118; HS576 |
| 3 | The Forms row is named by the module's `name`; in `agency.json` that is `forms`, so the row would read "forms". Is the module's name set to Forms in the live agency? | Answered 2026-11-02 for the coordinator's read (farmer half not run) | No. On 2026-11-02 the coordinator read the live Siaya Farmers' Group (agency `c6720349-5799-4137-9831-c343623812c8`) with a draft id: in both of its open drafts the module `forms` has `name` "forms", lowercase, as in `agency.json`. The app's own call carries no draft id and gets no module at all (question 11), so today the row is not drawn; once it is, it would read "forms". Read as the coordinator only, from the shell, read-only calls; the farmer half was not run (it needs the Supabase keys from the keychain) | `mwanachama-backend-agency/models/modules_catalog.json`; `agency.json` `modules`; `home/cards.ts:43-44`; HS607 |
| 4 | A farmer who joined a group order sees a row named Group order, which is no workflow of the agency. Name it Create group order (the workflow), or keep it? | Still open | The word is the app's (`started/api.ts:20-23`). The workflow's name is not read: `agency_list_my_open_steps` does not carry it yet, and `workflowName` stays empty until it does | `code/app/src/started/api.ts:20-23`; HS563; HS567 |
| 5 | Does a begun step stay in Start? | Partly answered | The code says yes: the API lists a step for as long as she holds its role and nothing in `StartRows.tsx` removes it, so the Ongoing row is added besides it. The owner has not said; HS576 builds as the code is | `mwanachama-wakala-api/internal/api/http/caller_open_steps.go:68,91-93`; `code/app/src/home/StartRows.tsx`; HS576 |
| 6 | W-3: the Market manager's approve or decline has no phone screen, though `market_approve_poster` and `market_decline_poster` exist. Draw it, or leave it to the studio? | Still open | Both tools exist and the app calls neither; the Inbox shows only the approved notice | `mwanachama-backend-market/market.operations.json:55,82`; `code/app/src/pages/InboxPage.tsx:22` |
| 7 | Work items with no phone screen: W-5 deciding for a silent farmer, W-8 start and send of a group sale, W-9 take out of a share. Draw them, or leave them out of the phone app? | Partly answered | W-9 Take out: the market has no tool, so it needs the owner or the backend (HS580). W-5 deciding for a silent farmer: `market_decide_silent_line` exists and no screen calls it. W-8 start and send: still open | `mwanachama-backend-market/market.operations.json:1136`; `group.go:181-187`; section 2; HS580 |
| 8 | The farmers README still says five roles and two workflows; `agency.json` holds six roles and eleven. Its owner should bring the README up to date. | Still open | README lines 4 to 7 say five roles and two workflows; `agency.json` holds six roles and eleven workflows | `demo/farmers/README.md:4-7`; `demo/farmers/agency.json` |
| 9 | Does the searchable dropdown apply to every question that picks a person, or only the Supplier and Select the farmer? | Still open | Only these two are drawn. Select the farmer is the one question in `agency.json` that reads its list from a role (`options_from`); the Supplier is the app's own question, its choices the market's approved posters | decision 119; `agency.json` `records[0]`; `pages_j18_run_a_group_order.py`; HS579 |
| 10 | Does any other record of any workflow go under Records on its workflow's page, as Manage payments does? | Still open | `agency.json` holds one record, RC-1 Payments on W-5 | decision 119; `agency.json` `records`; HS576 |
| 11 | Is the live agency's module read empty, which would hide the app's cards? | Answered 2026-11-02, coordinator half only: yes, empty (farmer half not run) | On 2026-11-02, signed in as the coordinator (`POST /auth/signin`, session cookie) and calling `agency_list_modules` on `http://localhost:8082/mcp` with `instance_id` `c6720349-5799-4137-9831-c343623812c8` and no `draft_id`, as `modules.ts` does: HTTP 200, text "Found 0.", `items` of length 0. So `modules` is `[]` and every card that needs a module is dropped. With a draft id the same call answers: the draft "Imported from Siaya Farmers' Group" (`70e77abc-6a11-4c80-b2a6-8e4586295749`) gives 13 items, `forms` with `name` "forms" and `enabled` false, and no `market`; the draft "Initial draft" (`ab4a8a7e-063c-428f-8caf-7a2bf2459dd4`) gives 15 items, `forms` and `market` (`name` "market") both `enabled` false, and only `auth` and `actor` enabled. `modulesOf` keeps only `enabled` true, so a draft id would not bring the Forms or market cards back either. Drafts listed with `agency_list_drafts`. The farmer's call was not run (it needs the Supabase keys from the keychain): whether a farmer's read fails, and so shows every card, is still unverified | `code/app/src/agency/modules.ts:27,31`; `home/cards.ts:38-41`; `mwanachama-backend-agency/agency.operations.json:1033-1056`; HS576; HS607 |
| 12 | Decisions 80 and 113 hold sentences the facts above no longer match. Correct them? | Still open (the owner's rows, untouched) | 80 says of a module's or mount's icon "the agency's data carries none (HS271)": a module and a mount carry an icon key, a workflow and a step carry none. 113 says "nothing on the page is written in the app": the app's own cards are | `documentation/1. requirements/decisions.md` rows 80, 113 and 118; `mwanachama-backend-agency/models/module.go:44-48`; HS576 |
| 13 | Take out of a share has no tool, and the app draws no group-order trail. New market tool, or leave both out of the phone app? | Still open | Section 6 | HS580 |

## 6. Findings of the auditors, 2026-11-02

The auditors checked each drawing against `agency.json`, `code/app/src` and the operations files.

| Finding | Where | What follows |
|---|---|---|
| The "Closed" revision screens of 13 step 3 and of 04-chat/farm-room are removed: no source supports them | `pages_j13_step3.py` (`step_03` draws five screens: landing, join, revision, confirmed, reopened); `pages_chat_farm.py` (four screens: landing, asking for something not listed, who she asked, the shop asks to revise) | Nothing; a screen comes back when a source names the state |
| The trade-room "After answering" screen is removed | `pages_chat_trade.py` (two screens: the Suppliers' room and the buyers' room, each with Answer the ask) | The same |
| The group-order trail of 13 step 5 is removed. `market_group_order_trail` exists and the app calls none; it reads `market_order_trail` for a Buy now order only | `pages_j13_step5.py` (`one_order_screen` note); `mwanachama-backend-market/market.operations.json:906-911`; `code/app/src/buy/orders/api.ts:151` | HS580 |
| `market_leave_group_order` is not a tool. Change my share maps to `market_join_group_order`; Take out (W-9, WI-25) has no tool | `pages_j13_step3.py` (`reopened_screen` and its note); `mwanachama-backend-market/group.go:181-187`; `agency.json` W-9 | HS580 |
| Chat tool names are `comm_chat_*` with underscores, never `comm.chat_*` | `pages_chat_*.py`; the rule is the one cited in section 2 (`mwanachama-backend-shared/dispatch/tools.go:119`) | No caption in the generator carries a dotted `comm.` name any more; HS568 still lists them as open |
