# 02 · What it does

Hub Steward runs an agency, a member organization, from its design to its
daily work. A manager and a designer use the console. Members use the phone
app. AI roles do the routine work and wait for a person where the agency says
so. [Who it serves](../01-who-it-serves/README.md) names the people;
[Demo scope](../03-demo-scope/README.md) says which features the demo shows.

The status column says what is in this repository today. Exists means the
console, the app or the bundled API has it. To be built means the design or
the demo agency declares it and this repository does not run it yet.

## Design the agency

| Feature | What a manager or designer does | Status |
|---|---|---|
| Create from a template | Names the hub, picks a demo agency as the starting point and gets its roles, goals, rules and rooms | Exists |
| Roles, groups and people | Sees who is in the agency, which groups exist, how each group is joined (open or by approval) and which role holds which permission | Exists |
| Workflows and records | Changes a workflow, its steps and its records; adds or removes one; sets how long a waiting step may wait | Exists |
| Chat workflows | Makes a workflow that opens into a chat, boxes the chat in and tests it | Exists |
| Forms | A workflow step sends a form to a role; members answer on the phone. The console has no page that composes a form on its own | Exists as a workflow step |
| Documents | Adds the documents an AI role answers from | Exists |
| Risks | Keeps hazards, threats, consequences and controls for the AI roles | Exists |

## Check and publish

| Feature | What happens | Status |
|---|---|---|
| AI review | AI reviewers read the whole draft, one page per part; each finding gets an answer | Exists |
| Expert stage and Publish block | Expert reviewers sign off, and Publish stops while a finding is open | To be built |
| Test | Scenarios run against a test copy and a report shows which rules held; a stopped run can be given more tokens | Exists |
| Publish | An approved change becomes a new version of the live agency | Exists |

## Run the agency

| Feature | What happens | Status |
|---|---|---|
| Approvals | A guarded change waits in a list; the agency manager approves or declines with one tap; only then does the agency act. The bundled API keeps the draft, each amendment, the decision and the steps taken after approving on the proposal; the console has no log page. [The approval rule](#the-approval-rule) | Exists |
| Chat with the agency's agents | A member writes in a room; the agent replies in a thread in the language the member wrote in | Rooms and threads exist. The loop that reads new room messages and makes an agent reply is not part of this repository; test runs and reviews do call a model |
| Catch up | The inbox shows what is new, then the member's rooms | Exists |
| Join a group | A member asks to join or accepts an invitation; a coordinator lets her in | Exists |
| Answer a form | A member answers a form one question at a time and sees where it went | Exists |
| Send a report | A member sends a report, an idea or a complaint and gets a reference | To be built. The phone app has no report screen ([journey 25](../../user-journeys/25-send-a-report/README.md)) |
| Market and group orders | Where an agency has a market, farmers buy inputs and sell the harvest alone or together; suppliers post prices and fill orders; the coordinator runs the group order | Exists |
| Answers from the agency's documents | An agent finds the passages that answer a question, names the document and section it used, and says so when the documents do not answer | Passage search exists in the bundled API's sources module. No demo agency file switches it on, and the agent that uses it is not part of this repository. The Siaya lab's three-language documents are the demo's |

## Put AI roles to work

| Feature | What happens | Status |
|---|---|---|
| Roles that act through tools | Each AI role holds a role in the agency and can make only the calls that role's permissions allow | Exists |
| Models and AI accounts | The agency holds its model keys, tests each one, and gives each agent its model, limits and instructions | Exists |
| Usage | The manager sees how many tokens were used, for what work and by whom, and can ask why | Exists |
| Operations | A status page shows counts (devices online, AI roles switched on, open alerts) and what needs attention; an activity page lists each agent by name as switched on or off. Neither shows an agent's last action | Exists |

The demo's AI roles are the Hub Steward role (the lab and the riders), Assets
Keeper and Network Watcher (the riders), and the Farmers' agent and the
Suppliers' agent (the farmers)
([user journeys](../../user-journeys/README.md) says what each does).

## The approval rule

A guarded change waits for an approver; the agency says which changes are
guarded. Other actions run without one. An agent never approves its own
draft: the agency manager decides, and in the API deciding a proposal is an
owner permission that refuses a service key. The API records the decision and carries out the write only for
the kinds of change it knows; it does not check that the approver is a
different person from the drafter, so an owner who drafted a change can
approve it.

## Example: the computer lab

The Siaya lab shows the same features in one small agency. Its members reach
Hub Steward in the lab's room; it is declared to answer in the language the
member wrote in: English, Swahili or German. The phone app's own screens show
English or Swahili only, so a member writing in German is meant to get German
answers on English screens. The lab's documents are house rules, a
Wi-Fi guide, booking rules and opening hours, each in all three languages
([the documents](../../../../demo/siaya-lab/README.md)).

### Access requests

A member asks for a seat, a Wi-Fi account or to be set up as a member. The Hub
Steward role drafts the request; the lab manager approves or refuses it with
one tap; only then does the lab act. The lab's agency file switches on only the
comm and task manager modules and declares these as workflows (Access request,
Seat booking).

| Request | What approval does | Status |
|---|---|---|
| A seat | Holds a terminal for a time slot; a slot that clashes with another is refused | Declared as the Seat booking workflow. The asset manager's holds exist in the bundled API, but no demo agency file switches the asset manager on |
| A Wi-Fi account | Opens a task for the manager to create the account | Declared in the lab template |
| Member set-up | At the lab terminal, the member gets a barcode that connects them to the lab's agency | Declared in the lab template; the barcode screen is drawn, not built |

### Network watch

The lab declares a Network watch workflow, run by the Hub Steward role; the
lab declares no Network Watcher role, which is the riders' role. The agent
keeps a picture of the lab's devices: terminals, access points, the router,
servers, solar and battery. When a device goes down or a reading crosses its
limit, it tells the lab manager in the manager's room, once per fault. Which
real source a lab reads from is not settled.

Status: To be built. The digital twin module is a switchable module in the
agency catalog, but the bundled API does not mount it and the readings
simulator is not in this repository.

### The lab's equipment

The lab's equipment is meant to be kept as a register in the asset manager, the
same place seat holds live. In the riders' agency, Assets Keeper registers
assets and records who holds what; the lab declares no such role. How equipment is registered, shown and looked after is still to be designed.

## Planned

- **Member memory.** What each member works on and has asked, so a new manager
  can pick up where the last left off. What it may hold, who sees it and for
  how long is not decided.
- **Issues and votes.** A member raises an issue by filling in a standing form,
  and other members back it with one vote each; votes only put the issues in
  order and the manager decides. Not designed on the phone app's Forms screen.

## What it does not do

- It does not reply privately yet; replies are in the room until the phone app
  has private messages.
- It does not carry out a guarded change before its approver has approved.
- It does not run on WhatsApp. WhatsApp, through Meta's WhatsApp Cloud API, is
  proposed as the next channel.
- The phone app has words only in English and Swahili; its language picker
  lists nine languages and the other seven show English. The console has
  all its words in six: English, German, Swahili, Spanish, French and Chinese
  ([languages](../../../3.%20implementation/guides/languages.md)).

## Open choices

| Choice | State |
|---|---|
| Whether a person without email can sign in to an agency | Open; the German lab's residents are the example |
| Where the manager's approve list and the member's barcode sit in the phone app | Open |
| Which real network source a lab reads from | Open; no simulator is kept in this repository |
| How the lab's equipment is registered, shown and looked after | Open |
