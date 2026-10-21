# 03 · Demo scope

The demo shows Hub Steward running agencies. It holds eight synthetic agencies
([demo](../../../../demo/)); the Siaya computer lab is the featured scenario
and the rest show that the same platform fits other organizations. Every
person, organization, number and address is invented.

## The agencies

| Agency | What it is | Role in the demo |
|---|---|---|
| Siaya lab | A community computer lab planned for Siaya, Kenya. Roles: Lab manager, Member, Hub Steward. Modules: comm, task manager. Its documents exist in English, Swahili and German | Featured scenario |
| Farmers | The Siaya Farmers' Group, the county's agricultural ministry serving the farmers around the hub, as one agency: group orders, suppliers, buyers, harvest sales | Market and group-order journeys |
| Boda-boda riders | The riders' group around the hub: ride requests, rider availability, assets, network watch, picking a rider. Roles: Hub manager, Member, Rider, Customer, Dispatcher, Hub Steward, Assets Keeper, Network Watcher. Modules: comm, task manager, forms, digital twin, market | Template only; the only demo agency that declares Assets Keeper and Network Watcher |
| Clinical research organization | A contract research organization running sponsor-outsourced trials | Template only |
| Electric grid utility | An electric power utility: generation, transmission, distribution, reliability | Template only |
| Logistics freight company | A freight company: warehouse, fleet, customs, customer service | Template only |
| Mobile money operator | A mobile money operator | Template only |
| Drone crop-spraying service | A commercial drone operator spraying farms under contract | Template only |

A template-only agency has roles, goals, rules and workflows that import into a
hub and can be reviewed and tested in the console. The demo does not walk its
members through the phone app. Creating a hub from five of them (freight, drone
spraying, clinical research, grid utility, mobile money) stops at the second
step, because none has a role that may use AI. Only the Siaya lab's import has a
recorded result ([Results](../../../4.%20qa/testing/02-results/README.md)).

## What the demo shows

| Feature | The demo shows | State |
|---|---|---|
| Design and publish | An agency manager creates a hub from a template, changes a workflow, reviews the draft with the AI reviewers, tests it with scenarios and publishes the approved change | Exists; the expert stage and the Publish block are To be built |
| Run the agency | A member signs in on the phone app, finds a group, reads the inbox and answers a form | Exists |
| Send a report | A member sends a report, an idea or a complaint and gets a reference | To be built: the phone app has no report screen |
| Approvals | An AI role drafts a request; the agency manager approves it with one tap; only then does the agency act ([the approval rule](../02-what-it-does/README.md#the-approval-rule)) | Exists |
| AI roles and their cost | The manager sets an agent's model, limits and instructions and sees what it used | Exists |
| Market and group orders | A farmer buys inputs and sells the harvest with others; a supplier fills the order; the coordinator sends it | Exists |
| The lab's answers | A member asks in the lab's room in English, Swahili or German, and the Hub Steward role replies in a thread in the same language and cites the document | The documents and passage search exist; the agent that replies in a room is not part of this repository |
| The lab's seat | A member asks for a seat, the lab manager approves, and the seat is held | Declared as a workflow. The bundled API has the asset manager's holds, but the lab's file does not switch the asset manager on |
| The lab's network watch | A device in the lab goes offline and the lab manager's room is told | To be built: the digital twin is not mounted and there is no readings simulator |
| Member memory | Hub Steward recalls what a member worked on | Planned (stretch) |
| Issues and votes | A member raises an issue from the chat, another says "me too", and the manager lists open issues, most-backed first | Planned (stretch) |

[What it does](../02-what-it-does/README.md) gives the state of each feature in
more detail.

## Screens

- The console: Status, Approvals, People, Groups, Agents, Models, Usage,
  Workflows, Review, Test and Publish.
- The phone app: Home, chat in the agency's rooms, Inbox, Forms, Groups, and
  the market and group orders for the farmers.
- The lab's room as a member and as the lab manager, and the manager's list of
  drafts to approve.

## What the demo is not

- Not a running organization: every agency is a scenario and every member is
  synthetic.
- Not a WhatsApp integration: that is the proposed next channel.
- Not the German lab: it is named as the next site only.
