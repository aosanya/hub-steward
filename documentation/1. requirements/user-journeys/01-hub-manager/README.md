# Agency manager

**Goal:** Runs an agency from the console: starts it from a template, approves what its agents draft, and sees what every AI role is doing.

**Result:** The manager decides; the agents draft. Nothing that needs approval happens without it.

The steps below follow a manager of the Siaya computer lab, the worked example. Another agency's manager does the same things with that agency's roles, rules and requests; steps 2 and 3 name the lab's rows as the example.

Mockups: [all steps](../../../2.%20design/mockups/journeys/01-hub-manager/index.html).

## Steps

### 1. Starts the agency from its template

The manager opens the start page, names the hub, picks a template (the demo has Computer lab, Farmers' group, Boda boda riders and five more), enters an email and password if not already signed in, and presses Create Hub. The page then shows the hub being made in three steps: importing the agency template, connecting Hub Steward to the hub, creating the groups. It ends on "Your hub is ready" with the steps ticked, the number of roles and goals, and a button to open Status.

Behind that screen the hub gets its roles, rules and permissions from the template, Hub Steward is linked to the role that may use AI so that it holds only the permissions that role grants, and three rooms (Managers', Farmers' and Suppliers') are made open to join, whichever template was picked. The three are fixed: a lab hub gets the farmers' rooms too, and the page offers no way to choose the rooms. A template with no role that may use AI stops at the second step with "The hub has no Hub Steward role, so the agent was not connected".

Mockup: [create hub](../../../2.%20design/mockups/journeys/01-hub-manager/mockups/step-01-create-hub.html)

### 2. Opens the approvals list

Approvals, in the menu of lab and riders hubs, opens on a Pending tab (Approved and Declined are the other two). Its table shows what the agent drafted: who asked, what, and which agent drafted it (with the language when it is not English), and an Approve and a Decline button on each row. In the lab the rows are meant to be access requests (a seat, a Wi-Fi account, member set-up) and seat bookings; the agent that drafts them is not run by this repository and the seat and set-up behind them are not built (see Not yet built). In the riders' agency the Assets Keeper also drafts allocations, such as a laptop for a rider. There is one approval per request, and nothing happens until it is approved.

Mockup: [approvals list](../../../2.%20design/mockups/journeys/01-hub-manager/mockups/step-02-approvals-list.html)

### 3. Approves with one tap

In the lab, Approve is meant to set the member up and hold the seat, and a Wi-Fi request to open a task, "Create a Wi-Fi account", for the manager rather than creating the account itself. Today Approve records the decision and carries out the write only for the kinds the API knows (agency edits, groups, documents, market and risk writes); a seat hold, member set-up and the Wi-Fi task are not among them. The approved request shows who drafted it, who approved it, and a log with the time, who and what was done.

Mockup: [one-tap approval](../../../2.%20design/mockups/journeys/01-hub-manager/mockups/step-03-approve-one-tap.html)

### 4. Opens the operations screen

Operations shows a tile for the AI roles switched on. The Activity page lists each AI role the agency has (in the lab's template: Hub Steward) as Switched on or Switched off.

Mockup: [operations screen](../../../2.%20design/mockups/journeys/01-hub-manager/mockups/step-05-operations-screen.html)

## Not yet built

- The phone app's own version of the approvals list.
- The real member set-up call and the seat asset behind Approve, the Wi-Fi task, and telling the member in her thread that a request was decided: the approvals code sends no message.
- The last action and the time on the Activity page: it shows only each AI role's name and whether it is switched on.
- Creating a hub from a template with no role that may use AI: five of the eight templates (freight, drone spraying, clinical research, electric grid, mobile money) stop at connecting Hub Steward.
- Approvals, Operations and Documents for agencies other than the lab and the riders: the menu shows them to those two kinds only, and a hub of any other template is shown the lab's menu.
