# Design a chat workflow

**Who:** the agency manager. Any agency's workflows can open into a chat; the screens are drawn from the farmers' agency.

**Goal:** The manager makes a workflow that opens straight into a chat with an agent, boxes the chat in to what it talks about, the tools it may call and the workflows it may lead the person to, and tests it with the lines a made-up member (here a farmer) says.

**Result:** A chat workflow is in the draft with its chat step filled in. A test scenario has said lines into the chat and seen the agent lead the farmer to the right workflow without calling a tool outside its list.

The farmer's side of the same chat is step 1 of [Buy inputs](../13-buy-inputs/README.md). The workflows the chat starts are those of [Change a workflow or a control](../19-change-a-rule/README.md), and its test scenario is a scenario of [Test an agency](../20-test-an-agency/README.md).

Screens: [all four in order](../../../2.%20design/mockups/journeys/28-design-a-chat-workflow/index.html).

## Steps

1. **She sees the chat workflows.** [Mockup](../../../2.%20design/mockups/journeys/28-design-a-chat-workflow/mockups/step-01-sees-the-chat-workflows.html). Workflows lists the farmers' agency's workflows as cards. In the drawing the two that open in a chat, Buy inputs and Sell harvest, come first; the console lists workflows in their own order. Each carries a small chat icon before its name and shows the agent it chats with, the Farmers' agent, beside its steps, roles and objectives. The other cards, such as Buy now and Group order, open in a form and carry no mark.
2. **She adds a chat workflow.** [Mockup](../../../2.%20design/mockups/journeys/28-design-a-chat-workflow/mockups/step-02-adds-a-chat-workflow.html). Add a workflow opens the Workflow tab with a name, what it is for, and Opens in: A chat or A form. In the drawing the Steps tab of a chat workflow already holds step 1 as a locked step, Chat with an agent, open and empty; more steps may be added after it. Built only in part: choosing A chat does not add that step, so the locked step shows only when the workflow already holds one. Saving puts the workflow in the draft, and Publish makes it live within 30 seconds.
3. **She boxes the chat in (drawn, not built: the console has no editor for it).** [Mockup](../../../2.%20design/mockups/journeys/28-design-a-chat-workflow/mockups/step-03-boxes-the-chat-in.html). On the chat step she sets who opens it, the agent it chats with, what it talks about, what it says first, and up to three prompts. For Buy inputs the Farmer opens it, the Farmers' agent answers, the topic is buying farm inputs, the first line is "What do you want to buy?", and the prompts are I need fertiliser, I want hybrid maize seed 614 and I need something for pests. Can call is a list of tools in plain words, ticked one by one: See what is on sale, See shops and their prices, See group orders, Ask a shop, Put up a notice and See my orders are ticked; the tools that belong to selling are not. Can start lists the agency's other workflows: Buy now, Group order and Find it are ticked; Sell now, Group sale, Approve a supplier and Change my share are not. The chat may call and start only what is ticked, and the agent steers a person politely back to its topic when she strays.
4. **She tests the chat (drawn, not built: no test run plays a chat).** [Mockup](../../../2.%20design/mockups/journeys/28-design-a-chat-workflow/mockups/step-04-tests-the-chat.html). A scenario for Buy inputs has the same three tabs as any scenario. Actors holds one farmer, Farmer 1, who plays the chat step; the agents and the System are listed and read only. Blocks holds one block, the lines the made-up farmer says (I need fertiliser, Urea) and a Then line naming the workflow the agent should lead her to, picked from Can start. Run opens a report where the Test agent says the lines into the chat and the Farmers' agent answers. The table shows each answer, the tools it called, whether any was outside Can call, and whether the Then line held. In the drawing, two of the six tools were called, none outside the list, and the agent led her to Buy now.

## What the drawings invent

The tool names on the test screens are illustrative.

## Not yet built

- Built in the console, so not a gap: Add a workflow has Opens in (A chat or A form), a chat workflow shows a chat mark and the agent it chats with on its card, and its chat step shows on the Steps tab.
- The fields that box the chat in (who opens it, what it talks about, the first line, the prompts, Can call and Can start) have no editor in the console. The agency stores them on the chat step: the agent, the topic, the first line, up to three prompts, the tools and the workflows it may start.
- Choosing A chat in Add a workflow saves the workflow as opening in a chat but does not add its chat step, and the console cannot add one. The Steps tab shows a chat step, locked as step 1, only when the workflow already holds one; the agency allows one per workflow.
- Workflows are not sorted with the chat workflows first; the cards follow the workflows' own order.
- Built in the phone app, so not a gap: it lists a workflow that opens in a chat on the Start tab. Buy inputs and Sell harvest open the app's own screens by name; any other chat workflow opens the Chat tab.
- No test run plays a chat.
- Open: which objectives Buy inputs and Sell harvest attach to, so that Publish does not block them.
- Open: whether a sub chat means a workflow the person started from the chat, shown as a chat opening under it, or the discussion thread the agent opens with a shop.
