# The market

Roles: see [roles.md](roles.md).

A market puts the people who post a price in touch with the people who pick one, with an AI between them that finds out only what is not already posted. The farmers' agency uses it to buy inputs and to sell the harvest, and the riders' agency uses it for rides. It is one design with the same pieces everywhere (decisions 66 to 76), and the studio is where an agency's version of it is set up (decision 72).

## The pieces

| | Inputs | Harvest | Rides |
|---|---|---|---|
| Poster, who posts a price and answers asks | A supplier | A buyer | A rider |
| Picker, who chooses among the posts | A farmer | A farmer | A customer |
| Offer, a poster's price for something, with bulk prices | Urea 50 kg bag, 3,800; 20 bags or more, 3,600 | The price a buyer pays for a bag of maize | A fare |
| Ask, one question to one poster | "Can you fill 2 bags by Friday?" | "Will you take 40 bags of maize?" | "Can you take me from the market to Ndori?" |
| Group order, many pickers with one poster | Farmers buy together from one supplier | Farmers sell together to one buyer | Not needed yet; a shared trip would use the same steps |
| Coordinator, who starts and sends group orders, and approver, who approves posters | The group role Coordinator starts and sends; the Market manager approves | The group role Coordinator starts and sends; the Market manager approves | The hub manager |

A request is what a picker wants, in her words. A notice is a request every poster can see. A yes is a poster's answer to an ask: what, how many, for whom, and a date.

## How the rules are set

A rule is a step that waits for a named person's yes (decision 72). Nothing runs on a timer unless a workflow step sets a time limit (decisions 99 and 148), so when a person does not answer and no limit is set the AI does nothing and the person waiting decides (decision 71). An exception to a rule is a step too, said by a named person, and never a rule kept in the module; a gap the workflow cannot say is requested as a workflow feature (decision 144). The steps are the agency's workflows, shown and edited in the studio; an order keeps the version of the workflow it started with, and where no workflow says otherwise a default holds. Whether a workflow change goes through the studio's draft and Publish (decision 58) is Proposed. A publish, or going back to an earlier version, reaches members within 30 seconds, and the Publish page and the workflow form say so in one line (decision 96). The agency's objectives have a page of their own, Objectives, between Goals and Roles: a card for each objective with its goal, the workflow that serves it and the roles responsible, and an objective with no workflow says so. Each workflow's card on the Workflows page lists the objectives it serves and links them to that page (decision 86 (b)).

| Workflow | Step | Who says yes | What happens |
|---|---|---|---|
| Buy now | 1 Asked | the picker taps Buy now | The AI asks the poster she picked, once |
| | 2 Yes | the poster | Yes with a date, or no. On a no she is told and picks another; with no answer nothing happens |
| | 3 Paid | the poster | He marks it paid |
| Cancel | default | the picker | At once; the poster is told and his yes closes. An agency can replace this with its own cancel workflow, which its designer ticks as Cancels an order on the workflow's Workflow tab; a step's When it passes, run lists the ticked workflows and this one (decision 146) |
| Group order | 1 Start | the coordinator | Starts it from a posted bulk price and sets the minimum, which is required; with no poster named it is the only approved poster |
| | 2 Open | the pickers | They join. The poster sees the order and may ask them to revise; each answers yes or no; the coordinator decides each one who stays silent, and the order waits. A revised order goes back to open when the coordinator takes it there, in a step of her own, Take the revised order back to open; Send is offered after it (decision 145, a default taken: the owner may veto) |
| | 3 Send | the coordinator | Says it is ready. Locked below the minimum unless the poster agrees to a smaller amount. The AI asks the poster to fill it; he says yes with a date, or no |
| | 4 Confirmed | | Each picker sees her share, price and date on the order |
| Find it | 1 Wanted | the picker | Says what she wants and chooses: ask shops, or put up a notice |
| | 2 Asked or noticed | the picker | She ticks the posters to ask and each ticked poster gets one message; or the notice goes up for every poster to see |
| | 3 Replies | | Each reply is a row "found for you"; her list shows every poster she asked and the answer: waiting, yes or no |
| | 4 Picked | the picker | She picks a yes and goes on as Buy now or joins a group order |
| Approve a poster | 1 Applies | | The poster gives his name, area and what he sells; the AI drafts the request |
| | 2 Approved | the Market manager | Yes or no; the Market manager can remove a poster later |

The numbers that are rules sit on the order. The coordinator sets the minimum when a group order starts and cannot start without it. A poster sets his own prices, ordinary and bulk. The Group order has no Paid step (decision 145, a default taken: the owner may veto): the coordinator records each farmer's payment as a row of the Payments record for the order (decisions 110 and 111), and can call the order off until it is closed. There is no answer time, no closing time and no timer anywhere.

## How the data is stored

| Record | What it holds | Written by | Seen by |
|---|---|---|---|
| Poster | Name, area, what he posts, who approved him | The AI drafts, the Market manager approves | Everyone in the agency |
| Offer | The poster's own words for the product and unit, the price, bulk prices (a minimum and a price each), and the product the AI grouped it under | The poster | Everyone; the latest is the live one |
| Request | What the picker wants in her words, the amount, needed by | The picker, with the AI | The picker, the coordinator |
| Ask | One poster asked, the question, the answer (waiting, yes or no) | The AI, when the picker ticks a poster or picks an offer | The picker, the poster asked, the coordinator |
| Notice | What is wanted, how much, needed by | The AI, for the picker | Every poster; stays until the picker takes it down |
| Yes | What, how many, for whom, the date and a note | The poster | The poster (his open yeses in one list), the picker, the coordinator; open until delivered or called off |
| Order | Picker, poster, product, amount, the price as it was when she tapped, the workflow version, the state, the paid mark | The AI, from her tap and his yes | The picker, the poster, the coordinator |
| Group order | Poster, product, terms (price and minimum) and every revised version of them, the workflow version, the state | The coordinator starts it; the AI keeps it | The coordinator sees all; the poster sees names and amounts and no contact; a picker sees her own line, the total, the minimum and the count |
| Line | One picker's amount in a group order, her answer to the current terms (waiting, yes or no), the coordinator's decision for a silent one, her paid mark | The picker, the coordinator | As the group order |
| Private stock list | A poster's own count for each product | The poster | The poster only; shown to him beside an ask and never used to answer for him |
| Trail | Who did what and when, on every order | The system | The picker for her own, the coordinator for all |

An order and a group order keep their own copy of the terms they started with, so a later change to a poster's page never changes an order already made; a poster who wants different terms asks the pickers to revise, and each answer is kept against the version it was given to (decisions 69 and 70). A yes is kept as a record, and the system never works out a poster's stock: he is trusted to be in charge of it (decision 73).

Before this design an order was a shape in the agent's code, the chat threads and the coordinator's approval, and a form kept one send per person that a resend overwrote (decisions 41 and 45). That could not hold a price kept with an order, a line with its answer to each version of the terms, a yes that stays open until delivery, or a step that waits for a named person. The records above are therefore new declared objects in the agency's own database, in a module of their own, `mwanachama-backend-market`, mounted per agency in wakala-api the way the task manager's are (decision 79). The chat carries the conversation and the records carry the facts, so a screen never reads state out of a sentence. The platform has to run declared steps, not only describe them (the gap "anything that executes declared steps").

## Running a group order in the app

Journey 18 draws it in `app/18-run-a-group-order/` and the app builds it (HS371, HS372, HS373, HS511); the decisions are in [decisions.md](../../../../meta-global-ai-hackathon-community-hubs/documentation/1.%20requirements/decisions.md).

- What waits: `agency_get_my_roles` gives the caller's membership and the role her seat holds, and `agency_list_my_open_steps` lists the workflow steps of the roles she holds (decision 112). Each such step with a form is a waiting step on the Notifications page (D155, which replaced the Home card); a member who holds none sees none, and Start is not offered while a buy group order is open or revising. An order she has started is a row in Started, which opens it (decision 115, which replaced the Apps tab of decision 113). The owner's Home also listed each open or revising order and opened its page; Home now holds only Start, Ongoing and Backlogs (D155), so where that list sits is not yet redrawn.
- Start: the form is the step's own questions. The poster comes from `market_get_group_order_poster`, which gives the order's own poster, else the only approved one; with several approved the form asks which, and with none it says so. Start calls `market_start_group_order` and opens the order page.
- The order page shows the terms, the bags so far against the minimum and a Manage payments row. Send the order shows only to the agency owner and only while the order is open, a revised order being open again once the coordinator has taken it back (decision 145), and then the page says Sent. Send is not locked below the minimum yet: the module and the app ask only for an open order and the owner.
- Payments are rows of the agency's Payments record, each added with the order's `order_id`, so Manage payments lists one order's rows, three at a time with Show more (decision 110). A saved row is not edited: a correction is a replacing row with `replaces`, the old row stays as history and the new row carries a "Corrected on" note (decision 111). The same answers saved again within 60 seconds are refused with a 409 and the form says so. A role that adds rows sees every row; a farmer sees only the rows that name her and has no Add a payment.
- Called off: `market_call_off` moves the order to `cancelled`, and wakala-api raises `group_order_called_off` for the coordinator and each farmer with a line, except whoever called it off. The row on the Notifications page reads "The <product> group order was called off" and opens the order. Starting an order raises no notice to the poster, which decision 69 asks for.

The backend side is in the agency repo's [workflow-records.md](../../../../../mwanachama-backend-agency/documentation/2.%20design/workflow-records.md) and the market repo's [market.md](../../../../../mwanachama-backend-market/documentation/2.%20design/market.md).

## Named markets

An agency can run more than one market and names each one: Inputs, Harvest, Rides (decision 80). Each name is its own mount of the market module with its own tables, so a poster, offer, order and workflow version belongs to the market it was made in, and the module's objects carry no market id. Wakala-api already mounts the catalog module by name this way. An agency with one market is the ordinary case: the demo's farmers' group and the riders' agency each run one. Decision 67 holds, the harvest sold on the same page in reverse, unless the owner splits the farmers' group in two; the farmers' template then names both. The words an agency uses for a poster and a unit are not settled. The same holds for every module (HS271 lists which can be mounted by name).

## What the AI does

It asks, tells, drafts and records. It never says yes for a person (decision 73). It sends nothing when a posted price answers, asks only the poster a picker picked or ticked and only once, and does not nudge or fall back when someone is silent (decisions 66 and 71). The AI job that talks to posters holds no picker's thread and cannot open an order, because a poster's reply is outside text it cannot trust (decision 76).

## Assumed, not asked

- A wrong product grouping is corrected by asking the chat (decision 136); the console has no Products page.
- A notice stays until the picker takes it down.
- A poster may post several bulk prices; a group order starts from one of them, and a different one is another order.
- A poster's yes carries a date and a free note, such as where to collect; there is no Collected step.
- Every order keeps a trail and a picker sees her own.

## What this replaces

- Decision 42: the closing time, and the supplier seeing no tally before close.
- The Farmer journey's pooled order drafted by the AI from separate requests and approved before it goes to the supplier (HS70, HS102, HS108): in the market the coordinator starts a group order and farmers join it.
- The Supplier journey's single price form on every order (steps 1 and 2).
- The Buyer journey's matching of a listing to a want (HS71): the harvest is sold on the same page in reverse.
- The Dispatcher choosing the rider and its five-minute fallback (Rider steps 3 and 4, Customer step 2).
- The single Farmers' coordinator role: two AI jobs.

The journeys are not rewritten until the owner says so; the contradictions are listed for them when the new journeys are drawn.

## Testing an agency

A designer can test an agency before publishing it (decision 78). A Test button on the draft runs the test scenarios in a sandbox copy of the draft; the tests are multiple scenarios, such as "farmer 1 orders 2 bags", "the shop never answers" or "sending below the minimum". An AI agent, the Test agent, plays the people in each scenario, the agency's own agents respond, and the designer reads what transpired: every step, who acted, what the agency recorded. Each of the agency's rules is shown as held or not tested yet. Testing never publishes and never reaches real members, messages or the demo database; the Test agent acts only inside the sandbox, and decision 73 (an agent never says yes for a person) still holds for real orders. An order in a test keeps the workflow version it started with. Each wait in a test is acted out at once: the Test agent answers for the person and no time passes in the run, and the run view shows each wait as acted out (decision 101). A scenario can say the person did not answer, which tests a time limit set in the workflow (decision 99). A scenario follows one path through one workflow and its blocks are that workflow's steps, each with one actor (decision 84); the designer fills the Add a scenario form or asks the chat to add one from a workflow, and Save records it. The pages are `studio/agency/test.html` and `studio/agency/test-scenario.html` (a scenario's own page with its Scenario, Actors and Blocks tabs, and the Add and Edit forms), steps of journey 15; the rows are HS260, HS261, HS267, HS286 and HS290.

## Where it is drawn and built

The console draws no page for suppliers, products or group orders (decision 136). The Market manager's approval of a supplier is a step on the phone (journey 14), and the coordinator's Start, Send, Mark paid and Call off are drawn in the app in journey 18 and described above. Not drawn because no decision says it: what the order looks like after the shop agrees to the smaller amount and the farmers are asked again, and whether Send waits for those answers.

Drawn in this folder: the studio's `studio/agency/objectives.html`, `studio/agency/workflows.html` and `studio/agency/test.html` (it has no market pages, decision 136) and the farmers' agency data behind its Goals, Roles and Agents pages; the app per journey (`app/13-buy-inputs/`, `14-supply-inputs/`, `16-sell-the-harvest/`, `18-run-a-group-order/`), with the base pages the journeys use drawn from the member app's own design (`app/01-entry/`, `02-do-something/`, `06-forms/`, `04-chat/`, `05-inbox/`). Built, by the board's rows (HS209 to HS261): the records in a new `mwanachama-backend-market`, the workflow steps in the agency backend, the mount in wakala-api, the agents and the studio in `submission/code`, and the phone app in `submission/code/app` (decision 77).

## Rows to settle with the owner

These existing rows are reworded or dropped only when the owner agrees: HS104 and HS105 (a rider's availability and minutes, now on the rider's fare page and his yes); HS75, HS110, HS111, HS100, HS74, HS134, HS73, HS80, HS81, HS149 and HS150 (reworded); HS70, HS88, HS101, HS102 and HS108 are done rows whose code the new agents retire.
