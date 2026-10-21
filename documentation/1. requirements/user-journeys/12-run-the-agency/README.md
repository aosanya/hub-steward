# Run the agency

**Goal:** The agency manager knows who is in the agency and what it is for.

**Result:** A manager never opens a database to see who runs what.

**Who:** The agency manager (the console calls the agency a hub)

The agency manager walks the console's pages to see who is in the agency, which groups and agents exist, what the agency is for and what it says it will do, and changes the few settings a manager owns.

Mockups: [all steps in order](../../../2.%20design/mockups/journeys/12-run-the-agency/index.html).

## Steps

### 1. Sees who is in the agency

Users lists everyone in the agency as a table with their role, access and when they joined, with a search box, a role filter and one button, Invite a user. The invitation names the person by member code and shows their screen name before it is proposed for approval. Asking "Who joined this week?" fills the content area with only those users.

Mockup: [step-01-see-the-users.html](../../../2.%20design/mockups/journeys/12-run-the-agency/mockups/step-01-see-the-users.html)

### 2. Sees the groups

Groups lists each group with its number of members, its join mode (open or approval required) and the AI role that speaks there. Opening a group shows its members, and its join mode can be changed from there.

Mockup: [step-02-see-the-groups.html](../../../2.%20design/mockups/journeys/12-run-the-agency/mockups/step-02-see-the-groups.html)

### 3. Sees the agency's agents

Agents lists each agent with the model it uses and its state. A Configure link opens the agent's edit page with its model and limits, as in [AI roles](../11-ai-roles/README.md).

Mockup: [step-03-see-the-agents.html](../../../2.%20design/mockups/journeys/12-run-the-agency/mockups/step-03-see-the-agents.html)

### 4. Sees the agency's goals

Goals lists the agency's goals with the number of objectives under each. Opening a goal lists its objectives. Opening an objective shows the workflows that serve it and their steps, with the roles on each step. A step's roles appear in a small table where Responsible, Accountable, Consulted or Informed can be ticked; a role may hold two. Approved changes wait in the agency's draft, which is not live: agents and members keep using the published version until the draft is published.

Mockup: [step-04-see-the-goals.html](../../../2.%20design/mockups/journeys/12-run-the-agency/mockups/step-04-see-the-goals.html)

### 5. Sees the agency's roles and publishes

Roles lists the agency's roles, human and AI, each with its description under its name. Opening a role shows its type, what it may do and the agents that hold it, and its Edit button opens a form that proposes the change for approval. Publish, under Agency in the menu, lists the draft's changes one per line, with the kind, the title, who approved it and when. Publish checks the agency first. If the check finds problems nothing is published: the page lists each as a plain sentence with a link to the page and item to fix, and the button reads Publish again. When the check passes the page shows a quiet line such as "Published as version 4" with the time.

Mockup: [step-05-see-the-roles.html](../../../2.%20design/mockups/journeys/12-run-the-agency/mockups/step-05-see-the-roles.html)

### 6. Changes the agency's name and purpose

Profile shows the agency's name, its purpose and its id. A Rename the hub button opens a form, and the change arrives as one card to approve in the chat. An approved rename joins the draft as one more change on the Publish page, and the hub keeps its published name until the draft is published.

Mockup: [step-06-change-the-name-and-purpose.html](../../../2.%20design/mockups/journeys/12-run-the-agency/mockups/step-06-change-the-name-and-purpose.html)

### 7. Changes how people join, the language and the theme

General holds Joining (Open to join or Approval required), the default language and the theme: Dark, Light, Midnight, Forest or High contrast. A change to Joining or to the default language waits for the manager's approval before anything is recorded. The theme is kept in the browser, so it is the manager's own on that device and not a setting of the hub.

Mockup: [step-07-change-how-people-join.html](../../../2.%20design/mockups/journeys/12-run-the-agency/mockups/step-07-change-how-people-join.html)

### 8. Reads the agency's documents

Documents lists the agency's documents (the Siaya lab's are its house rules, Wi-Fi guide, booking rules and opening hours) with the languages each exists in, the number of passages and when it was updated, with a search box, a language filter and one button, Upload a document.

Mockup: [step-08-read-the-documents.html](../../../2.%20design/mockups/journeys/12-run-the-agency/mockups/step-08-read-the-documents.html)

## Not yet built

- Progress and status per goal. The Goals pages show only the objectives. A measure for an objective (a name, a target, where it stands now, a unit and a status) is written and tested but switched off: `measuresOn` is false in `code/console/src/data/features.ts`, so no measure shows.
- The people who hold a role, and giving a person a role. The role page lists no people, and no console screen grants a role. Users shows each person's roles, read from the actor module's role holders. The API has a grant-role tool, `actor_grant_role`, that the console calls nowhere.
- Restricting who may read a document. The upload form takes a title, a language and the text, and the sources module has no field or check for who may read. The only audience fence found (public, members or staff) is on the catalog. The mockup draws a Who may read choice on the upload form.
- Not checked against the code: the Documents list in step 8 (languages, number of passages, search and language filter).
