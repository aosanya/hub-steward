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
|  | [Hub keys](hub-keys.md) | How the agent gets into each agency |
|  | [Do Something: each member's own steps](do-something-own-steps.md) | Which steps a member sees, and what a send does |

## The phone app's top bar

Inside an agency, the phone app's top bar shows the agency's name in a small line under the screen title, so a member with several agencies can tell which one is open. The agency-picker screens leave it off. An app can also be limited to one agency by name, which is how a single agency is shown on its own. The files and settings are in the [app's README](../../../code/app/README.md).
