# Change a workflow or a control

**Who:** the designer.

**Goal:** change how the agency works: a workflow, its steps and its records, or a control the agency commits to.

**Result:** a workflow or a control is changed, added or removed in the draft, and nothing reaches members until it is published.

A control replaces the old rule and value. An advisory control is the old rule or value text. An enforced control has an action, a condition and what happens on a breach: block, hold for approval, flag or run a workflow. The permission catalog has controls.edit for the control actions and controls.approve for publishing a draft. The seven steps below cover workflows only; the Controls page is built in the console but no step uses it.

The mockups are in [mockups/](../../../2.%20design/mockups/journeys/19-change-a-rule/mockups/) and can be browsed in order from [index.html](../../../2.%20design/mockups/journeys/19-change-a-rule/index.html).

## Steps

1. **Opens the workflows.** [Mockup](../../../2.%20design/mockups/journeys/19-change-a-rule/mockups/step-01-opens-the-workflows.html).
   - Workflows lists the agency's workflows as cards. Each shows its steps, the roles that act in it, the objectives it serves, its version and whether it is in use, with an Actions menu.
   - The built-in Cancel is marked as a default. Its Actions menu holds Edit only.
   - Under the cards, Orders under way is meant to list each order with its workflow, state, the version it began on, the latest version and when its answer is due, with a Stop button on an order that is not closed. It is not built: a workflow's page shows only the count of its orders and the versions they are on (see Not yet built).
   - Add a workflow and Add a cancel workflow sit at the top. A line says a publish reaches members within 30 seconds.

2. **Opens one workflow.** [Mockup](../../../2.%20design/mockups/journeys/19-change-a-rule/mockups/step-02-opens-one-workflow.html).
   - Opening Group order shows a Workflow card with Version, Objectives, Orders under way and Records.
   - Below it, one numbered card per step shows its kind, its one actor, its action, the form it asks and its time limit where one is set.
   - Objectives carry Unlink and Link an objective. Each step card carries a Roles table with Responsible, Accountable, Consulted and Informed. These change by a proposal that waits for approval.

3. **Edits a workflow.** [Mockup](../../../2.%20design/mockups/journeys/19-change-a-rule/mockups/step-03-edits-a-workflow.html).
   - Edit opens the editor with three tabs on one draft held in the page. Nothing is sent before Save.
   - Workflow holds the name and what it is for. Steps holds one card per step with name, description, kind (six kinds), actor and questions, plus Up, Down, Add a step above and Remove this step. Records holds one card per record with its name, who adds rows and its questions, such as Payments added by the Group coordinator.
   - Save writes the workflow, its steps and its records into the draft, returns to Workflows and shows The workflow was saved to the draft.

4. **Adds a workflow.** [Mockup](../../../2.%20design/mockups/journeys/19-change-a-rule/mockups/step-04-adds-a-workflow.html).
   - Add a workflow opens the same three tabs empty. Steps says No steps yet and Records says No records yet, each with its add button inside the card.
   - Save stays off until the workflow has a name. A step's action is worded by the page from its kind and form, not typed.
   - After Save, the new workflow's card reads No objective yet. It cannot be published until an objective is linked on its page.
   - Add a workflow also has Opens in (a form or a chat). A workflow that opens in a chat carries a chat mark on its card. [Journey 28](../28-design-a-chat-workflow/README.md) lists what remains.

5. **Asks for a cancel workflow.** [Mockup](../../../2.%20design/mockups/journeys/19-change-a-rule/mockups/step-05-asks-for-a-cancel-workflow.html).
   - The built-in Cancel cancels at once. Edit on it opens the same editor titled Add a cancel workflow. The same can be asked in the chat.
   - The filled form lands in the content area: the Farmer fills a form saying why, then the Supplier says yes or no. Nothing is recorded until Save.

6. **Removes a workflow.** [Mockup](../../../2.%20design/mockups/journeys/19-change-a-rule/mockups/step-06-removes-a-workflow.html).
   - Remove in the Actions menu asks her to confirm and sends nothing until she does. It is not offered on the built-in Cancel.
   - While test scenarios mirror the workflow, it stays. The content area and the chat say Group order was not removed: 2 test scenarios mirror it. Remove those scenarios first. The scenarios are listed with links to Test.
   - After one scenario is removed on the Test page, asking again names the one left.

7. **Sets how long a waiting step may wait.** [Mockup](../../../2.%20design/mockups/journeys/19-change-a-rule/mockups/step-07-sets-how-long-a-waiting-step-may-wait.html).
   - A step where a person fills a form or says yes or no shows Time limit, in minutes, and When it passes, run. The second lists the other workflows and stays off until a limit is typed.
   - Save refuses a limit that is not a whole number of minutes above zero, or a limit with no workflow picked.
   - The workflow's page then reads, for example, 60 minutes, then Cancel after the Supplier says yes runs. The Orders under way list, where an order past its limit would show Closed with its cancel run, is not built (see Not yet built).

## Not yet built

- Saving a workflow blanks ordinality, event flows and tool.
- The console never reads the caller's permissions, so it offers Edit and Publish whatever the caller holds. The API checks controls.edit and controls.approve for an agent's role; whether it checks them for a person is not confirmed.
- Nothing marks a workflow as the agency's cancel workflow or puts it in the built-in Cancel's place. Add a cancel workflow opens the ordinary editor under another title, and a step's When it passes lists every other workflow. Planned: a Cancels an order tick on the workflow's Workflow tab, and a step picker that lists the ticked workflows and the built-in Cancel.
- Each Farmer is to see their own row of a record; the Records tab has no field for it.
- A group is not offered as a step's actor; the list holds the agency and its roles.
- The built-in Cancel shows no steps, roles or objectives.
- The Orders under way list under the cards, with Stop on an order and Start again after it, is not built. A workflow's page shows only the count of its orders and the versions they are on. The list of orders under way and closed and the Stop call, with its restart-on-version option, are in `code/console/src/data/pages/workflowRuns.ts`, and no screen uses them.
