# AI roles

**Goal:** The manager configures each agentic role the agency's blueprint gives it, without touching code: the instructions come from the agency, and each agent has its own model, limits and fine-tuning.

**Result:** A manager shapes how an agent speaks and how much it may use, and sees which model each one uses.

**Who:** The agency manager

The agency manager opens an agent, gives it a model, caps what it may use, adds their own fine-tuning to the instructions the agency already gives it, and sees what happens when it reaches a limit.

Mockups: [all steps in order](../../../2.%20design/mockups/journeys/11-ai-roles/index.html).

## Steps

### 1. Sees the agents

The Agents page lists every agentic role in the agency's blueprint: the farmers' agency declares two (the Farmers' agent and the Suppliers' agent) and the riders' agency three (Hub Steward, Dispatcher and Assets Keeper). Each row shows the agent, who it works for, its model and its state, and a Configure link to its edit page. There is no button to add one. Each row shows its model as a chip; in the drawn example the Farmers' agent has Muse Spark 1.3 and the riders' Hub Steward has Muse Glimmer, models a hub chose for them, as no default model is built in. An agent with no model reads "No model key"; asking "Which agents have no model?" lists them.

Mockup: [step-01-see-the-agents.html](../../../2.%20design/mockups/journeys/11-ai-roles/mockups/step-01-see-the-agents.html)

### 2. Chooses the agent's model

On the agent's edit page the Model tab says "No model: this agent cannot speak." until one is set. One field, Model, picks it, for example Meta Model API · Muse Spark 1.3 for the Farmers' agent, and Save changes stores it. The agency role an agent acts as is assigned on the Users page, and its instructions are on the Instructions tab.

Mockup: [step-02-map-the-role.html](../../../2.%20design/mockups/journeys/11-ai-roles/mockups/step-02-map-the-role.html)

### 3. Sets the agent's limits

The Limits tab holds the same seven limits as a model, each with an Applies switch; off reads "No limit". Hub Steward's example applies only tokens per week, at 500,000. Under each name sit the model's own maximum, for example "model max 8,000", and what is in force and used so far; the lower of the agent's and the model's applies. Save changes stores them.

Mockup: [step-03-set-the-role-limits.html](../../../2.%20design/mockups/journeys/11-ai-roles/mockups/step-03-set-the-role-limits.html)

### 4. Fine-tunes the instructions

The Instructions tab shows a read-only card From the agency: the seat's description, its objectives, the values and rules that apply, and the work items that serve the objectives. Under it the manager writes their own fine-tuning and sees both together as one Preview. Turning Use the agency's instructions off leaves the fine-tuning alone. Every save is kept with who and when, earlier versions can be listed, and each has a Restore button. The change is live on the agent's next message. When the agency changes the seat, its part updates and the fine-tuning stays. Owners and staff seats can do this.

Mockup: [step-04-fine-tune-the-instructions.html](../../../2.%20design/mockups/journeys/11-ai-roles/mockups/step-04-fine-tune-the-instructions.html)

### 5. The agent speaks, and stops at a limit

Every model call uses the agent's model with the key from the Models page, cuts a reply to the tokens-per-call limit and counts the use against the agent. At a limit of the agent or of its model the agent stops with one plain line naming it, posted once in its room. Asking "Why did Hub Steward stop?" shows the sentence "This AI role's weekly token limit is reached.", the limit (tokens per week, 500,000 of 500,000), where it is set (the role) and when it was posted (once, at 09:12).

Mockup: [step-05-the-agent-speaks.html](../../../2.%20design/mockups/journeys/11-ai-roles/mockups/step-05-the-agent-speaks.html)

## Not yet built

- The Agents page lists a state of Running, Skipped, Stopped, Cannot speak or No model; a state such as "needs a tool" is planned.
