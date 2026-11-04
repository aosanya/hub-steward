# 01 · Overview

Hub Steward runs an agency: a member organization with roles, groups, workflows, forms, rules and documents. Designers shape the agency in the console and publish it. Members use it on the phone app. AI roles do part of the work, and each acts only through tools the agency declares and its role is permitted to call. The platform is Mwanachama; Hub Steward reads and writes it only through those tools.

```
 Console (designers, managers)     Phone app (members)
        │ REST + MCP                      │ REST + MCP
        ▼                                 ▼
 ┌────────────────── Mwanachama API (one per deployment) ──────────────────┐
 │ membership check: every call is scoped to one agency the caller is in   │
 ├────────┬────────┬───────────┬────────┬───────────┬────────┬─────────────┤
 │ agency │ chat   │ forms,    │ tasks, │ documents │ assets │ market,     │
 │ roles, │ rooms, │ reports,  │ appro- │ with      │        │ group       │
 │ groups,│ threads│ inbox     │ vals   │ sources   │        │ orders      │
 │ rules  │        │           │        │           │        │             │
 └────────┴────────┴───────────┴────────┴───────────┴────────┴─────────────┘
        ▲                    ▲
        │ tool calls         │ model calls through the agency's AI gateway
   AI roles of the agency    Model provider (the one the agency's AI account names)
```

Which modules an agency has depends on its published definition. A farmers' group switches on the market and group orders; the demo lab switches on comm and tasks, and its seat holds wait on a module the bundled API does not mount yet (see the lab below).

## The parts

| Part | What it is | State |
|---|---|---|
| Mwanachama API | Go service in `code/wakala-api` mounting Mwanachama's modules per agency, with sign-in, membership, approvals, an AI gateway and an MCP endpoint | Exists |
| Console | Web app in `code/console` for managers and designers: people, groups, agents, models, documents, workflows, review, tests, approvals, usage | Exists |
| Phone app | Mobile-first web app in `code/app`: chat in rooms and threads, inbox, forms, groups, market. The member's side; the code folder is `code/app` | Exists; image built, not hosted. Reports have no screen yet |
| Agencies | Each agency's roles, goals, responsibilities, rules and workflows in one file; eight synthetic ones are in `demo/` | Exist |
| AI roles | Agents the agency has, such as Hub Steward, Assets Keeper, Farmers' agent, Suppliers' agent. Each has its own model, limits and instructions | Roles, limits, instructions and the service key exist in the API. The loop that notices a message and replies is not in this repository ([the agent](../03-the-agent/README.md), [hub keys](../hub-keys.md)); enforcement of responsibilities when an agent acts is undecided |

## Principles

- **Build only what is missing**, inside the Mwanachama module it belongs to, so every agency gets a better platform and not a fork.
- **The agent holds no data.** It reads and changes everything through tool calls.
- **Requests are drafts** until the people the agency names approve them.
- **One agency, one boundary.** Every call names an agency; a caller who is not a member is answered as if the agency did not exist.
- **An agent is a role.** What it may do is what its role's permissions allow, nothing more.

## For example, the Siaya computer lab

The lab (`demo/siaya-lab`) has three roles: Lab manager, Member and Hub Steward. Its file declares comm and the task manager.

| Piece of the lab | Module | State |
|---|---|---|
| Chat in the lab's room | Comm | Exists; switched on in the lab's file |
| Seat, Wi-Fi and set-up drafts waiting for the manager | Task manager | Exists; switched on in the lab's file |
| The lab's documents | Sources | Module exists in the bundled API; not switched on in the lab's file |
| Seat holds on terminals | A bookings module | To be built; the bundled API has none |

```
 Phone app (chat)             Hub Steward agent              Model provider
 member · manager   <──────>  (TO BE BUILT)         <──────> through the agency's
        │                     reads new messages,            AI gateway
        │                     decides, calls tools
        │                            │ MCP over HTTPS, service key
        ▼                            ▼
 ┌────────────────── Mwanachama API ───────────────────────────────────────┐
 │ agency │ chat    │ documents    │ tasks             │ planned: bookings  │
 │ roles, │ rooms,  │ passages     │ drafts, Wi-Fi     │                    │
 │ rules  │ threads │ with sources │ account tasks     │                    │
 └─────────────────────────────────────────────────────────────────────────┘
```

Members ask in the lab's room; the agent answers from the lab's documents and drafts a seat hold, a Wi-Fi account task or a member set-up for the lab manager to approve. The Hub Steward agent in this picture is the design: its loop is not in this repository, only the roles, rooms, tools and keys it stands on. The same shape serves another agency with other roles and tools.
