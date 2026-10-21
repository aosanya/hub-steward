# Siaya lab: the example lab agency

The example lab among the eight demo agencies in [demo](..): a community
computer lab planned for Siaya, Kenya. The other seven agencies, from riders
and farmers to a utility and a clinical research organization, show what else
the same platform runs. This folder is the only one with documents, which
Hub Steward answers from in the demo. The lab is not open yet, so
every document is synthetic: the hours, the seat count, the network names and
the limits are illustrative values chosen for the demo, not the lab's decided
rules.

Each document exists in English, Swahili and German, so one set serves the
German lab named as the next site as well as Siaya's members, who are expected
to write in Swahili or English. Hub Steward answers in the language a member
writes in. The Swahili and German versions are translations of the English and
still need review by native speakers.

| Document | English | Kiswahili | Deutsch |
|----------|---------|-----------|---------|
| House rules | [en](en/house-rules.md) | [sw](sw/house-rules.md) | [de](de/house-rules.md) |
| Wi-Fi guide | [en](en/wifi-guide.md) | [sw](sw/wifi-guide.md) | [de](de/wifi-guide.md) |
| Booking rules | [en](en/booking-rules.md) | [sw](sw/booking-rules.md) | [de](de/booking-rules.md) |
| Opening hours | [en](en/opening-hours.md) | [sw](sw/opening-hours.md) | [de](de/opening-hours.md) |

## The lab as an agency

[agency.json](agency.json) is the same lab as an agency template for
Mwanachama-Wakala: the lab manager, member and Hub Steward roles, four goals
(access, fair seats, answers from these documents, a working network), who is
accountable and responsible for each, the rules above, and the workflows Hub
Steward drafts and the lab manager approves. It imports with
`POST /instances/import` and is as illustrative as the documents it is drawn
from.

## What the documents promise that is not built

The documents describe a lab that works end to end. This repository does not
yet do all of it:

- **Network watch.** The Wi-Fi guide says Hub Steward can see whether the lab's
  network has a problem, and the template has the goal "The lab's network
  works" and workflow W-4. The template switches on only comm and task manager,
  and the digital twin is not mounted in the bundled API, so no alert has a live
  source.
- **A message when a seat is confirmed.** The booking rules say the member gets
  one. Approving a request records the decision and sends no message.
- **The barcode at the lab terminal.** The house rules and the Wi-Fi guide have
  the member receive it there (the Swahili files say the reception computer).
  No screen, tool or image call for it is in this repository.
- **The seat itself.** The template does not switch on the asset manager, which
  holds the seats.

## Join a group

Join a group (W-5) is a workflow of one Fill a form step held by the Member
role, under the objective that turns a request into a set-up member. The phone
app reads a member's open steps (`agency_list_my_open_steps`) and shows each one
it has a screen for as a plain row, with no icon, on the Start tab of Do
Something. The step stays on Start while she holds its role, and while her
request waits for a decision, Ongoing shows a row for it too. The step asks one
optional question, Group code. The lab shows the row only after this template is
published to its agency again.

## What the people's roles hold

The Lab manager and the Member each hold `group.join` (finding a group, joining
it by code or from the list, and answering an invitation), `chat.archive`
(archiving a chat thread for herself and bringing it back) and `mount.list`
(seeing the agency's modules). Hub Steward holds none of them. An agency's role gets
these permissions only after this template is published to its agency again.

## The role the agents act as

The Hub Steward agents reach an agency as one service the agency's owner links to one
role of this template: Hub Steward. Once linked, Mwanachama lets the agents
make only the calls that role's permissions allow, so the role holds the permissions
they need: `ai.use` (the model, through the AI backend), chat (`chat.post`,
`chat.thread`), forms (`form.compose`, `form.send`, `form.answers.read`),
documents (`document.search`, `document.read`), the lists of rooms and
members (`group.read`, `member.read`) and `risk.read` (reading a risk register,
which the lab does not switch on). Every agent runs under the same
service, and the console gives every hub the same rooms, so the role carries
the permissions of all of them; narrow the list in `agency.json` for a hub whose
agents do less. Proposing a write for an owner to approve, listing proposals
and amending one need no permission.
