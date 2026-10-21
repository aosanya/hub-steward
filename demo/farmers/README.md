# Siaya Farmers' Group

The Siaya Farmers' Group is the agricultural ministry of Siaya County, written as
an agency template for Mwanachama-Wakala, with the farmers around the planned Siaya hub as the people
it serves. It is one of the eight synthetic demo agencies
([demo index](../README.md)), the one the market and group-order journeys run
in; unlike the Siaya computer lab it has no documents, and everything in it is
invented. It holds nine roles. Seven are held by people: the Group
coordinator, the Farmer, the Supplier and the Buyer, and the ministry's three
officers, the Extension officer, the Veterinary officer and the Agriculture
director. Two are AI roles, the Farmers' agent, which speaks to the people who
want something, and the Suppliers' agent, which speaks to the posters. It has
four goals, eight objectives with a RACI for each, 22 rules, and 30 workflows:
the 11 market and group workflows (Pool an input order, Produce to a buyer,
Approve a poster, Buy now, Create group order, Find it, Sell now, Create group
sale, Change my share, Join a group and Apply as a supplier) and the 19 of the
ministry's own, listed below.

[agency.json](agency.json) imports with `POST /instances/import`. It switches
on comm, taskmanager, forms and market and links each to the objectives that
use it: comm to all eight, forms and taskmanager to O-1 and O-5 to O-8, market
to O-4. The hub is planned, not open, every person is synthetic, and the
template sets no prices, fees or amounts. The ministry's workflows are written
from how county agriculture departments generally work; Siaya's own forms,
fees and officers' titles are not checked.

The file names the agency Siaya Farmers' Group, as the journeys and the demo
index do. Publishing finds the live agency by that
name, so the name changes in the file and on the live agency in one step, not
before.

## The ministry's workflows

Each one has an officer who says yes. The agents take the request and tell the
farmer the answer, and never decide it (RU-18).

| Code | Workflow | Objective | Starts with | Says yes |
| --- | --- | --- | --- | --- |
| W-12 | Ask for a field visit | O-5 | Farmer's form | Extension officer |
| W-13 | Report a crop pest or disease | O-5 | Farmer's form | Extension officer |
| W-14 | Sign up for a training day | O-5 | Farmer's form | Extension officer |
| W-15 | Request a soil test | O-5 | Farmers' agent | Extension officer |
| W-16 | Issue a seasonal advisory | O-5 | Extension officer | Agriculture director |
| W-17 | Submit a field report | O-5 | Extension officer's form | No one; the director reads it |
| W-18 | Register as a farmer | O-6 | Farmer's form | Extension officer |
| W-19 | Register my plot | O-6 | Farmer's form | Extension officer |
| W-20 | Register my livestock | O-6 | Farmer's form | Veterinary officer |
| W-21 | Register a fish pond or boat | O-6 | Farmers' agent | Extension officer |
| W-22 | Register a farmer group or cooperative | O-6 | Group coordinator's form | Agriculture director |
| W-23 | Report a sick animal | O-7 | Farmer's form | Veterinary officer |
| W-24 | Book a vaccination day | O-7 | Farmers' agent | Veterinary officer |
| W-25 | Request an animal movement permit | O-7 | Farmer's form | Veterinary officer |
| W-26 | Request a produce inspection | O-7 | Farmers' agent | Extension officer |
| W-27 | Apply for subsidised inputs | O-8 | Farmer's form | Agriculture director |
| W-28 | Book a county tractor | O-8 | Farmers' agent | Extension officer |
| W-29 | Report a loss and apply for relief | O-8 | Farmer's form | Agriculture director |
| W-30 | Raise a complaint about an input supplier | O-8 | Farmers' agent | Agriculture director |

Twelve start with a Fill a form step. The ten held by the Farmer show as plain
rows on the Start tab of Do Something, as Join a group and Apply as a supplier
do; the other two are the Group coordinator's and the Extension officer's. The
other seven start with the Farmers' agent taking the request in a thread, or,
for the seasonal advisory, with the Extension officer's draft, and have no row
on Start. A hub shows the new rows only after this template is published to its
agency again.

## Join a group and Apply as a supplier

Join a group (W-10) and Apply as a supplier (W-11) are workflows of one Fill a
form step each, held by the Farmer role. The phone app reads a member's open
steps (`agency_list_my_open_steps`) and shows each one it has a screen for as a
plain row, with no icon, on the Start tab of Do Something. A step stays on Start
while she holds its role, and while her request or application waits for a
decision, Ongoing shows a row for it too. Join a group asks one optional
question, Group code. Apply as a supplier asks Shop name, which is required,
then Area and What you sell, which are not. Approve a poster (W-3) stays the
group coordinator's decision on an application. A hub shows the two rows only
after this template is published to its agency again.

## What the people's roles hold

The Group coordinator and the Farmer each hold `group.join` (finding a group,
joining it by code or from the list, and answering an invitation) and
`chat.archive` (archiving a chat thread for herself and bringing it back). The
Group coordinator also holds `notification.read`, the market permissions she
needs (`market.browse`, `market.group_order`, `market.group_order_send`), and
nothing else. The Extension officer, the Veterinary officer and the Agriculture
director each hold `chat.archive` and `notification.read` and nothing else; what
they decide is a step of a workflow, not a permission. No agent role holds
`group.join`, because joining adds the caller to a group's rooms and forms. A
agency's role gets these permissions only after
this template is published to its agency again.

## The role the agents act as

The Hub Steward agents reach an agency as one service the agency's owner links to one
role of this template: the Farmers' agent. Once linked, Mwanachama lets the
agents make only the calls that role's permissions allow, so the role holds the
permissions they need: `ai.use` (the model, through the AI backend), chat
(`chat.post`, `chat.thread`), forms (`form.compose`, `form.send`,
`form.answers.read`), documents (`document.search`, `document.read`), the lists
of rooms and members (`group.read`, `member.read`) and the market
(`market.browse`, `market.ask`, `market.group_order`, `market.notice`). Every
agent runs under the same service, and the console gives every hub the same
rooms, so the role carries the permissions of all of them; narrow the list in
`agency.json` for a hub whose agents do less. The Suppliers' agent holds a
shorter list: no forms, and `market.offer` where the Farmers' agent has
`market.ask`, `market.group_order` and `market.notice`. Proposing a write for an
owner to approve, listing proposals and amending one need no permission.
