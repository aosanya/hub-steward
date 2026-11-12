# Technical spec

How Hub Steward runs an agency on Mwanachama, with the Siaya computer lab as the worked example. Tables mark rows **Exists** or **To be built**.

| # | Section | About |
|---|---|---|
| 01 | [Overview](01-overview/README.md) | Parts and principles; the lab as an example |
| 02 | [Mwanachama modules](02-mwanachama-modules/README.md) | What each module gives an agency's roles |
| 03 | [The agent](03-the-agent/README.md) | An AI role's loop, calls and rules; the lab's features |
| 04 | [Tools and APIs](04-tools-and-apis/README.md) | Calls an agency's AI roles and its manager use |
| 05 | Not used | |
| 06 | [Data and privacy](06-data-and-privacy/README.md) | Where an agency's data lives; who can reach it |
| 07 | [Deployment](07-deployment/README.md) | Where the demo runs; its settings |
| 08 | [Console design](../mockups/console/README.md) | The console's screens |
| 09 | [Backlog app](backlog-app/README.md) | The phone app's Backlogs, Chat and assistant screens; [mockups](../mockups/app/index.html) |
|  | [Roles](roles.md) | What a role is and which roles exist |
|  | [Market](market.md) | The market design: workflows, data and the group order |
|  | [Market mount](market-mount.md) | Markets an agency mounts by name |
|  | [Workflow market access](workflow-market-access.md) | For each market tool, the workflow step it belongs to |
|  | [App and agency trace](app-agency-trace.md) | The farmers' agency and the phone app's screens |
|  | [Agency review](agency-review.md) | Review an agency: one AI reviewer for each part of the draft |
|  | [Test sign-off](test-signoff.md) | Test before a publish: the data trail and the Publish warning |
|  | [Risk tools](risk-tools.md) | What is built for Hub Steward's risk answers, and what is left |
|  | [Console list pages](console-list-pages.md) | How a console page that lists named things looks |
|  | [Gaps](gaps.md) | What Mwanachama already does, and what is missing |
|  | [Hub keys](hub-keys.md) | How the agent gets into each agency |
|  | [Start: each member's own steps](do-something-own-steps.md) | Which steps a member sees, and what a send does |
|  | [Creation journey](creation-journey.md) | How one agency gets made: the cast of roles and the stages |

## The phone app's top bar

Inside an agency, the phone app's top bar shows the agency's name in a small line under the screen title, so a member with several agencies can tell which one is open. The agency-picker screens leave it off. An app can also be limited to one agency by name, which is how a single agency is shown on its own. The files and settings are in the [app's README](../../../code/app/README.md).
