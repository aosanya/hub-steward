# 03 · The agent

An agent is an AI role on an agency. Hub Steward is the front-line role; an agency can also have roles such as Assets Keeper, Farmers' agent and Suppliers' agent. Each has its own model, limits and instructions, set in the console.

## What is built

The API holds everything an agent stands on: the roles and their permissions, the rooms, the tools on `/mcp`, approvals, the AI gateway and the service key ([hub keys](../hub-keys.md)). The loop below is the design of the agent that uses them. No code in this repository runs it: nothing here notices new messages, calls the model for a reply or posts one, so it is To be built or runs outside this repository. What does call the model inside the API today is the Test agent that plays scenarios and the review runs.

## The loop

1. **Notice.** Every few seconds, ask chat for threads in the agency's rooms with unread messages; fetch only those after the last one seen.
2. **Understand.** Send the new message, the thread and the tool list to the model.
3. **Act.** Run the model's tool calls through Mwanachama's MCP endpoint and return results until it has an answer.
4. **Reply.** Post the answer in the member's thread, in the member's language, and mark the thread read.

## What it calls

| Called | How | State |
|---|---|---|
| The model | The agency's AI gateway in the API, with the account set on the console's Models page. No model is built in as a default: the console marks the first account that has a key as the default (`ensureDefaultAccount` in `code/console/src/data/accounts.ts`), and a manager can change it. The console offers Meta's Muse Spark models first, and the API stores one of three provider kinds (`openai_compatible`, `anthropic`, `gemini`) | Exists; no live call to a provider is recorded, and a call from Germany is untested |
| Mwanachama | MCP over HTTPS at `/mcp`, with the service key | Endpoint, service key, and the tools of the modules the agency switches on exist; see [tools and APIs](../04-tools-and-apis/README.md) |

## What an agent can do

| Kind of work | Tools, in order | Approval |
|---|---|---|
| Answer a question | Search the agency's documents, then reply naming the document and heading of each passage used | None |
| Change something the agency guards | Draft the change, a person the agency names approves, then the agent acts | The approver |
| Watch and tell | Read the latest state, then post in the room of the people who must know | None |

Which tools an agent has depends on the modules its agency switches on and on its role's permissions. Deciding a proposal is for an owner: the tool is owner only and a service agent is refused, so an agent never approves its own drafts.

## For example, in the Siaya computer lab

The lab calls its approver the Lab manager. The riders call theirs the Hub manager and the farmers the Group coordinator; in this spec the role is the agency manager.

| Feature | Tools, in order | Approval | State |
|---|---|---|---|
| Answers | Search passages, then reply naming the document and heading of each passage used | None | Tools exist; the lab's file does not switch the documents on |
| Seat | Find free terminals, draft the hold, the agency manager approves, place the hold | Agency manager | To be built; the bundled API has no bookings module |
| Wi-Fi account | Draft the request, the agency manager approves, open a task for the agency manager | Agency manager | Task manager exists; the approval does not carry the task out |
| Member set-up | Draft the set-up, the agency manager approves, the member scans the barcode at the lab terminal and joins | Agency manager | To be built; no barcode screen in the app |

## Rules

- Answer only from the agency's documents and declared rules; if they do not answer, say so.
- Reply in the member's language. The lab's documents are in English, Swahili and German.
- Never carry out a change the agency guards before it is approved. A role that only reads or answers, such as an answering role, needs no approval.
- Act only as the agency's agent: its service key reaches one agency.

## Open

| Choice | State |
|---|---|
| Model for document-search embeddings | Not chosen; whether Meta's Model API offers embeddings is unchecked |
