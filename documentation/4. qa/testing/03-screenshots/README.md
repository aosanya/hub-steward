# Screenshots from the test runs

Taken on 4 November 2026 while running the journeys in [the results](../02-results/README.md): the console and the phone app against a local Supabase database, with the Siaya lab and the Siaya Farmers' Group imported by `scripts/local-setup.sh --demos`, and the Meta model Muse Spark 1.3 set as the hub's model. No key appears in any picture.

## Console

| Picture | What it shows |
|---|---|
| ![Status](01-console-status.png) | The Siaya lab's Status page: four of four ready, with "Model key: Meta Model API · set" |
| ![Goals](02-console-goals.png) | The lab's goals, with the chat column on the right |
| ![Roles](03-console-roles.png) | The lab's roles |
| ![Workflows](04-console-workflows.png) | The lab's workflows |
| ![Model set](05-console-model-set.png) | The Models page: Muse Spark 1.3, its key shown only as "set" |

## Chat with the model

| Picture | What it shows |
|---|---|
| ![Chat answers](06-chat-answers-from-the-hub.png) | On the Goals page the chat calls the hub's goals tool and lists every goal by name |
| ![Chat adds a goal](07-chat-adds-a-goal.png) | The chat adds a goal named in the request, and the goal appears in the list |

The goal named "mj-change test goal" was added by a test run, not part of the demo content.

## Phone app

| Picture | What it shows |
|---|---|
| ![Supplier menu](08-app-supplier-menu.png) | A supplier's Do Something tab in the Farmers' Group: Offers, Asks, Group order, Orders, Your prices, Forms |
| ![Market](09-app-market.png) | The market page |
| ![Member home](10-app-member-home.png) | A member of the Siaya lab after signing in with the emailed link |

## What these pictures do not show

Findings from the same runs are in the results pages. Two matter to anyone repeating the run: on a hub made by the demo import, the Approvals page and the console's Save do not work yet, and the phone app has no assistant for members.
