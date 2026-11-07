# What exists

A one-line status per area. The dated history is in [CHANGELOG.md](../../../CHANGELOG.md).

| Area | Where | Status |
|---|---|---|
| Console | `code/console` | Built. React app for an agency's manager and designer: sign-in, create a hub, approvals, people, groups, agents, models, documents, workflows, review, tests, usage. Six interface languages. Every page after sign-in needs the API |
| Phone app | `code/app` | Built. Mobile-first React app for an agency's members: Home, chat with the agents, market, group orders, forms, inbox, groups, harvest sale |
| Bundled API | `code/wakala-api` | Built, trimmed copy of the Mwanachama API server. Go, SQLite by default, port 8082 in the container. Mounts the custody, digitaltwin and engage modules beside voting, each under `/instances/{instanceID}/<module>` |
| Demo agencies | `demo/` | Built. Nine synthetic agencies (eight `agency.json` folders and `municipality.json`), listed below, plus the Siaya lab's documents in English, Swahili and German |

## Demo agencies

The product runs any member organization; these nine are templates to try it on. All are synthetic.

| Folder | The agency |
|---|---|
| `siaya-lab` | A community computer lab, the example for seats, network management and member set-up. The only one with documents, in three languages |
| `boda-boda-riders` | The riders' group around the planned Siaya hub |
| `farmers` | The Siaya agricultural ministry and the farmers it serves: group orders, prices, harvest sale |
| `clinical-research-organization` | A clinical research organization |
| `electric-grid-utility` | An electric grid utility |
| `logistics-freight-company` | A freight logistics company |
| `mobile-money-operator` | A mobile money operator |
| `agricultural-drone-crop-spraying-service` | A drone crop-spraying service |
| `municipality.json` | An invented Hungarian town council, in Hungarian; a single file with a copy in `code/console/public/templates/` |

## Harvest sale

The console and the app carry a harvest sale in two jobs. The Suppliers' agent asks the one buyer a farmer picked, once, and holds no farmer threads. The Farmers' agent tells the farmer once that the buyer said yes or no. Neither answers for anyone. The buyer's yes is the market's own record, kept with its date and note. Silence changes nothing. The older produce matcher is gone: a farmer sees buyers' posted prices and picks one.

## Not built

- The loop that reads new messages in a room and replies as the Hub Steward role is not in this repository; the API holds the AI role, its instructions, permissions and model accounts.
- The Farmers' agent keeps which answers it has told in memory, so a restart tells a farmer her answered asks once more.
- Nothing calls the "tell the farmer" step on a timer yet.
- Dated gaps for each user journey are listed at the end of that journey's page in [user journeys](../../1.%20requirements/user-journeys/README.md).
