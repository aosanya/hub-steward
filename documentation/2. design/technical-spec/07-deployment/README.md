# 07 · Deployment

## The demo

| Part | Where |
|---|---|
| Mwanachama API | The platform server the console and the phone app call; its roles, approvals, tools, AI gateway and service keys run inside it. The loop that answers in a room is not in this repository ([the agent](../03-the-agent/README.md)) |
| Console | A static web app in `code/console`, built with `npm run build` and served by any web server |
| Phone app | A static web app in `code/app`, built with `npm run build` and served by any web server |
| The demo agencies | Each imported into the API from one agency file under `demo/`, the Siaya lab among them ([guide](../../../3.%20implementation/guides/load-demo-agencies.md)) |

## A real agency

A real agency needs a server for the Mwanachama API and a place to serve the console and the app. An agency that must keep working through a power cut or a dropped connection also needs its own server for an open-weights model, in place of a hosted one. How Hub Steward switches between a hosted model and the agency's own model is not designed yet. For example, the Siaya lab is that case: it must keep working through a power cut or a dropped connection.

## Settings Hub Steward needs

| Setting | For |
|---|---|
| Mwanachama API address | The MCP endpoint |
| The service key | Reaching the one agency ([hub keys](../hub-keys.md)) |
| `AI_MASTER_KEY` on the API | Sealing the agency's model keys in its database. The model key itself is an AI account set on the console's Models page, not a setting of the agent |
| The agency and its rooms | Where to listen and reply |

Keys are given to the service through its environment and are never
committed.

On the Mwanachama API itself, one setting matters to repeating work: how
often the schedule sweep runs (every five minutes by default; it can be
turned off). An agency relying on a weekly reminder or a monthly check needs it
left on.

An agency's published definition also decides which modules it runs: each module is switched on or off in the definition. For example, the demo lab's file declares comm and the task manager, so its chat and its drafts for approval have modules behind them; the documents module and the asset manager are not switched on in it.
