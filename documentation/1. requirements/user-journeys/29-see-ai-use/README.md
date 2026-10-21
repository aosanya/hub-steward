# See where the tokens go

**Who:** the agency manager.

**Goal:** The agency manager sees how many tokens the agency's models used, for what kind of work (chat, workflow run, agency review, test run, background job) and by which person or agent, and finds out why a month's tokens are going fast.

**Result:** The manager knows which kind of work and which agent spent the tokens, and can act on it.

The three Usage pages in the menu are for managers only; a staff seat does not see them. A staff seat still sees the Usage tab on a model's own page, without the link to these pages ([AI accounts](../10-ai-accounts/README.md)).

Screens: [all four in order](../../../2.%20design/mockups/journeys/29-see-ai-use/index.html). Each is drawn from the Farmers' agency in the console, where an AI role is called an agent and an AI account is called a model. Every agency with AI roles has the same pages; the lab's agency would list Hub Steward and its other roles in place of the Farmers' agent.

## Steps

1. **She opens Usage and sees the month.** [Mockup](../../../2.%20design/mockups/journeys/29-see-ai-use/mockups/step-01-open-usage.html). The manager opens Usage under Models in Settings, which opens into three pages in the menu: Overview, Kind of work, and Agents and people. Overview is the month so far: four figures (tokens, requests, input against output, the top model) and the tokens of each day stacked by model. Kind of work shows each kind's share of the month and a grid of models against kinds of work, with the darkest square the biggest spender. Above the charts on every page she picks Today, 7 days, This month or Last month. Before any call has been made, Overview says there are no calls yet.
2. **She sees who spent it, by person and by agent.** [Mockup](../../../2.%20design/mockups/journeys/29-see-ai-use/mockups/step-02-see-who-spent-it.html). On Agents and people, a Group by switch changes who the tokens are charged to. Person charges them to the member or manager who started the chat or run, with jobs an agent started on its own under The agent itself; the bars and the Breakdown table list people. Agent charges them to the agents, and the bars and table list agents.
3. **She narrows everything to one agent by clicking it.** [Mockup](../../../2.%20design/mockups/journeys/29-see-ai-use/mockups/step-03-narrow-to-one-agent.html). She clicks an agent's bar and the pages filter themselves to that agent. A chip, Role: Farmers' agent, appears beside the time choice, the bars become Who used Farmers' agent and name the people, and the Breakdown table lists only that agent. Kind of work redraws for that agent alone. The x on the chip brings the whole agency back.
4. **She asks the chat why a kind of work used so much.** [Mockup](../../../2.%20design/mockups/journeys/29-see-ai-use/mockups/step-04-ask-why.html). She asks "Why did test runs use so much of the month?" and the answer fills the content area of Overview in a tab named after the question, next to the Overview tab. It shows the tokens the test runs used and their share of the month, the number of runs, the busiest day, the test runs by agent, and the three busiest days with who ran them. The chat says the manager ran the scenarios of both agents again and again; the drawing labels that person Hub manager, a role the farmers' template does not declare (it has Group coordinator).

## Not yet built

- The server records the kind for chats, test runs and agency reviews only. It accepts workflow run and background job as kinds, but nothing records them yet, so they cannot be told apart in Kind of work.
