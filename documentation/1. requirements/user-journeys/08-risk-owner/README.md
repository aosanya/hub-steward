# Risk owner

**Goal:** Knows what could go wrong with an agency's own AI roles, what stands in the way, and which safeguards are proven and which are only claimed.

**Result:** The risk owner asks plain questions and gets plain answers, and every gap has a person and a date. In a small agency its manager holds this role. The steps below use the community computer lab as the example.

Mockups: [all steps](../../../2.%20design/mockups/journeys/08-risk-owner/index.html).

## Steps

### 1. Opens the agency's risk page

The console's Bowties page lists an agency's risks as cards, each with its top event and owner, a search box and an Add a risk button. Opening a risk shows its top event, hazard and owner, then a Threats tab and a Consequences tab with their counts. Each tab is a plain table: one row per threat or consequence, with the number of controls standing on it, and a button to remove it from the risk. An Add a threat or Add a consequence form picks one from the library or creates a new one. In the lab example the open risk is "A member's information reaches someone it should not".

In the example, one threat has no controls: each turn is sent to the model provider's API. The table shows that as a control count of 0; it has no separate "No controls" mark and no Open link.

Mockup: [risk page](../../../2.%20design/mockups/journeys/08-risk-owner/mockups/step-01-risk-page.html)

### 2. Asks what the threats and the consequences are

The Threats table and the Consequences tab answer. Each consequence belongs to one hazard, so consequences are listed under their hazard. In chat, Hub Steward is meant to give the same two lists and say plainly which threats have no controls; no chat walk of this is recorded (see Not yet built).

Mockup: [threats and consequences](../../../2.%20design/mockups/journeys/08-risk-owner/mockups/step-02-threats-and-consequences.html)

### 3. Asks for the preventive measures against one threat

The question is, for example, "What are the preventive measures against: an answer quotes a document the asker may not read?" The answer lands in the content area as a table of the measures against that threat, each with its standing and the evidence behind it (a passed test with its date, or "No evidence"). Standings are Unproven, Weak, Proven and Failing, the last for a measure whose latest evidence is not a pass. The chat holds the question, the tool calls collapsed to one line, and a short reply that puts the measures that cannot yet be relied on first. This step is drawn and the tools behind it exist; no chat walk of it is recorded (see Not yet built).

Mockup: [preventive measures](../../../2.%20design/mockups/journeys/08-risk-owner/mockups/step-03-preventive-measures.html)

### 4. Drills into that threat

The threat opens as a bow-tie of its own, with the threats behind it: every member can read the lab's documents, a reply is visible to the whole room, and each turn goes to the model provider. A drill-down is a risk that names the threat it expands, and it shows on that threat in the first bow-tie. Drawn, not built: the console has no screen for it (see Not yet built).

Mockup: [drill-down](../../../2.%20design/mockups/journeys/08-risk-owner/mockups/step-04-drill-down.html)

### 5. Asks what the mitigating measures are

Hub Steward is meant to list what limits the damage if the threat happens, and name what the agency's documents do not yet say, such as who may take the agent's access away. Drawn, not built: the console has no screen for it and no chat walk is recorded (see Not yet built).

Mockup: [mitigating measures](../../../2.%20design/mockups/journeys/08-risk-owner/mockups/step-05-mitigating-measures.html)

### 6. Asks what relies on the agent's key

The answer lists every threat and consequence that the agent's agency-scoped key stands on, across risks, so one failure is seen for everything it would weaken. Drawn, not built: the console has no screen for it and no chat walk is recorded (see Not yet built).

Mockup: [what relies on the key](../../../2.%20design/mockups/journeys/08-risk-owner/mockups/step-06-what-relies-on-the-key.html)

### 7. Asks for the gaps and approves the work to close them

After asking "Draft the work to close the gaps, worst first. Nothing is recorded until approved," the content area shows "Work to close the 14 gaps" as a form of nine pieces of work. Each closes one to three gaps and has a severity (High, Medium or Low), an owner and a due date. Buttons: Approve all pending and Not now, under the line "Nothing is recorded until you approve." The chat replies "Nine pieces of work close all 14 gaps. Each has an owner and a due date." Drawn, not built: neither the form nor its Approve all pending button is in the console or the app, and no role can create actions or record evidence (see Not yet built).

A passing walk-through test can optionally be recorded as the evidence for a control.

Mockup: [gaps and approval](../../../2.%20design/mockups/journeys/08-risk-owner/mockups/step-07-gaps-and-approval.html)

## Not yet built

- Asking these questions from chat and getting the agency's own answers: the risk tools are in the API and the lab's Hub Steward role holds the permission to use them, but no chat walk of this journey is recorded.
- Step 7: the risk manager has actions (work with an owner and a due date) and evidence, but the only permission it declares is `risk.read`, which lists and reads; no role holds a permission to create actions or record evidence. The "Work to close the gaps" form and its Approve all pending button are not in the console or the app.
- Screens for the drill-down, the mitigating measures and what relies on the key; the console has the risk pages (landing, detail, add) and no screen for these three, whose mockups are separate drawings.
