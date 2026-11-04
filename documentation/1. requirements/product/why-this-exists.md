# Why this exists

## The problem

Community computer labs and tech hubs, the organizations Hub Steward was first written for, usually run on one or two overstretched managers. The same questions arrive every day. Access and approvals are granted by hand. Rules live in a document or in a manager's head, and nobody checks that the work follows them. When a manager leaves, most of what they knew leaves with them. The demo also holds agencies of other kinds, such as a farmers' group, a riders' association, a clinic and a utility, to show the same platform running them.

Labs also work under hard conditions. A group in a rural county such as Siaya, Kenya, has to keep working through a power cut or a dropped connection, and its members may write in Swahili, English or another language. A manager who is not a developer still has to decide who may do what, change a rule safely, and know what an AI agent did on the organization's behalf.

## What Hub Steward does about it

Hub Steward lets an agency manager run a whole organization with AI roles that do the routine and people who decide. An agency is a member organization: the word the docs use for the group, whatever it calls itself. The console says "hub" where a screen does, and a person who uses an agency is a member, whatever the agency calls them (farmer, rider, resident).

| It does | How |
|---|---|
| Designs the agency | Roles, groups, goals, rules, workflows with steps and records, forms and documents, in the console |
| Checks it before it goes live | AI and expert reviewers read the whole draft; scenarios run against a test copy; the manager answers every finding |
| Runs it day to day | Members use the phone app: chat rooms, inbox, forms, groups, and a market where the agency has one |
| Puts AI roles to work | Each role acts only through declared, permission-checked tools; what needs approval waits for a person |
| Keeps the manager in charge | Approvals (the API keeps each proposal's draft, decision and the steps taken after approving), the model each agent uses, the limits on it, and what it has spent |

## One example: the computer lab

The Siaya computer lab is the example the demo uses most. Its agency file declares three roles: Lab manager, Member and the Hub Steward role, which is the lab's front-line AI agent. As declared, the Hub Steward role answers members from the lab's documents, drafts seat bookings, Wi-Fi accounts and member set-up for approval, and tells the manager when a device goes down; [What it does](02-what-it-does/README.md) says which of that is built. The same platform runs the other demo agencies, such as the farmers' group and the boda-boda riders, with different roles, rules and AI roles.

## Where it started

Hub Steward was first entered in the Meta Global AI Developer Hackathon (26 October to 4 November 2026), hosted by Meta and Cerebral Valley, with Baseten, Modal and Fireworks as its partners for model hosting and credits. The entry was the Siaya computer lab and its agent. The project has since grown into the agency platform described on these pages, and it is independent of the event and its sponsors.

## Where it runs

Each agency runs on Mwanachama, a set of modules for member organizations: roles and permissions, approvals, chat, forms and tools an AI agent calls. Wakala is the name of the API server and agency builder that mounts those modules for each agency, and the bundled API in this repository is a trimmed copy of it. Members use the phone app; managers and designers use the console.

The agents run on the model the agency chooses. The bundled API reaches models through three providers (OpenAI-compatible, Anthropic and Gemini); Meta's Muse Spark is reached through the OpenAI-compatible one. No default model is built in, and the demo does not depend on one.
