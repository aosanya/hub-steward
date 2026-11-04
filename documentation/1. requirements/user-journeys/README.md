# User journeys

What each kind of user does in an agency, step by step, and what happens in response. The journeys apply to any agency run on Hub Steward. The examples are set in a community tech hub in Siaya, Kenya, with a group of boda boda riders and a group of farmers. Two agencies carry most of them: the farmers' group, for buying inputs together and selling the harvest, and the computer lab, for seats, Wi-Fi accounts, member set-up and network alerts. The demo holds eight synthetic agencies in all (the lab, boda boda riders, farmers, a clinical research organisation, an electric grid utility, a logistics company, a mobile money operator and a crop-spraying drone service). Every person and organisation in the examples is invented.

Each journey is one README: a short story, numbered steps and what the screen shows. Drawn screens for a journey are in [2. design/mockups/journeys](../../2.%20design/mockups/journeys/). Journey 26 has none drawn, and the mockup folders of the retired journeys 07 and 15 are still there. The numbers 03, 04 and 17 are not used.

## Words used here

- **Agency:** the organisation the console manages. The console calls it a hub where its screens say so (Create Hub, the hub switcher).
- **Agency manager:** the person who runs it. The demo agencies use their own words: Lab manager in the lab, Hub manager in the riders' agency, Group coordinator in the farmers' group.
- **Member:** the generic word for a person in an agency. Farmer, rider and resident are an agency's own word for one.
- **Agent:** an AI role on an agency. The console and the journeys also say AI role.
- **Console and phone app:** the manager's web app and the member's phone app.

| Journey | What the user comes to do |
|---|---|
| [Agency manager](01-hub-manager/README.md) | Starts an agency from a template, approves what its agents draft, and sees what every AI role is doing. The lab's seat, Wi-Fi and network alerts are the example. |
| [Agency member](02-member/README.md) | Gets answers and access in an agency without waiting for the one manager. The lab's seat and Wi-Fi are the example. |
| [Farmer](05-farmer/README.md) | Buys inputs together with other farmers and finds a buyer for the harvest. |
| [Supplier](06-supplier/README.md) | Receives one order from many farmers instead of many small ones. |
| [Buyer](07-buyer/README.md) | Finds produce that matches what they want to buy. Retired: the buyer now posts a price and answers in [Sell the harvest](16-sell-the-harvest/README.md). |
| [Risk owner](08-risk-owner/README.md) | Knows what could go wrong with the agency's AI roles, what stands in the way, and which safeguards are proven. |
| [Model key](09-model-key/README.md) | Gives the agency's agents a model key and checks that it works. |
| [AI accounts](10-ai-accounts/README.md) | Holds several AI accounts and knows each one works and what it has used. |
| [AI roles](11-ai-roles/README.md) | Sets the model, limits and instructions of each agent the agency has. |
| [Run the agency](12-run-the-agency/README.md) | Sees who is in the agency and who runs what, changes how people join, and publishes approved changes. |
| [Buy inputs](13-buy-inputs/README.md) | Buys farm inputs from the shops she picks, alone or together with other farmers. |
| [Supply inputs](14-supply-inputs/README.md) | Sets prices, answers the farmers' asks and fills their orders. |
| [Run the market](15-run-the-market/README.md) | Runs the farmers' market for the group. Retired: the work moved to journeys 14 and 18 on the phone, and 19 and 20 in the console. |
| [Sell the harvest](16-sell-the-harvest/README.md) | Sells the harvest to a buyer, alone or together with other farmers. |
| [Run a group order](18-run-a-group-order/README.md) | Starts the farmers' group order, records the payments and sends the order. |
| [Change a workflow or a control](19-change-a-rule/README.md) | Changes how the agency works: a workflow, its steps and its records. |
| [Test an agency](20-test-an-agency/README.md) | Proves the agency's rules work by running scenarios against a test copy before publishing. |
| [Sign in and choose an agency](21-sign-in-and-choose-an-agency/README.md) | Signs in with an emailed link and goes into one of her agencies. |
| [Join a group](22-join-a-group/README.md) | Asks to join a group, or accepts an invitation, and finds its room. |
| [Catch up](23-catch-up/README.md) | Sees what is new in her agency: the Inbox first, then her rooms. |
| [Answer a form](24-answer-a-form/README.md) | Answers a form her group sent, one question at a time, and sees where it went. |
| [Send a report](25-send-a-report/README.md) | Sends a report, an idea or a complaint and gets a reference. |
| [Design an agency](26-design-an-agency/README.md) | Takes a draft through AI and expert review, answering every finding before publishing. Not built: only the AI review exists, as journey 27. |
| [Review an agency](27-review-an-agency/README.md) | Runs AI reviewers over the whole draft and reads their findings, one page per part. |
| [Design a chat workflow](28-design-a-chat-workflow/README.md) | Makes a workflow that opens into a chat, boxes the chat in and tests it. |
| [See where the tokens go](29-see-ai-use/README.md) | Sees how many tokens the agency's models used, for what work, and by whom. |

## The AI roles

An agency attaches the AI roles it needs. Three of the eight demo agencies declare AI roles, as below. The other five (the clinical research organisation, the electric grid utility, the logistics company, the mobile money operator and the crop-spraying drone service) declare none: their roles are all people.

| Role | Works for | Declared in | What it does |
|---|---|---|---|
| Hub Steward | Members and the manager | The lab, the riders | Answers from the agency's documents, drafts requests such as a seat or a Wi-Fi account for approval. The lab, the worked example, declares only this role and has it watch the lab's network too |
| Dispatcher | Customers | The riders | Asks only the rider the customer picked, once, and tells the customer his answer |
| Assets Keeper | The manager and members | The riders | Registers assets and records who holds what |
| Network Watcher | The manager | The riders | Reads the network state of the agency's devices and tells the manager when one goes to fault. No live source is mounted in this repository |
| Farmers' agent | Farmers | The farmers | Looks at posted prices first, asks only the poster a farmer picked, and never says yes for a person |
| Suppliers' agent | Suppliers | The farmers | Helps a supplier post offers and keep his stock list, and carries the one question a farmer picked him for |

Every AI role acts only through tools that are declared and permission-checked, so each action is one a person could take and audit.
