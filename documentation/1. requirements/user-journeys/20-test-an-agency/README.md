# Test an agency

**Who:** the designer.

**Goal:** prove the agency's rules work by running scenarios against a test copy, before publishing.

**Result:** every scenario has passed on the draft, and Publish shows no warning.

The mockups are in [mockups/](../../../2.%20design/mockups/journeys/20-test-an-agency/mockups/) and can be browsed in order from [index.html](../../../2.%20design/mockups/journeys/20-test-an-agency/index.html).

## How a test uses a model

A workflow step does not call a model. The model plays the people of a scenario, through the Test agent on the agency's default AI account, and judges each Then line. The agent that asks a supplier does it once with a plain request and never answers for a person. If the agent should one day write the words it sends, that is a new step kind with its own design, and its Then line would judge meaning, not exact words.

## Steps

1. **Opens Test.** [Mockup](../../../2.%20design/mockups/journeys/20-test-an-agency/mockups/step-01-opens-test.html).
   - Test lists the agency's scenarios as cards. Each has a tick box, its result, an Actions menu, what it tries, when it last ran and the tokens it used.
   - One primary button, Run all scenarios, is at the top.
   - With no scenario yet, one card says so and carries Add a scenario.

2. **Runs the scenarios.** [Mockup](../../../2.%20design/mockups/journeys/20-test-an-agency/mockups/step-02-runs-the-scenarios.html).
   - Ticking rows turns the button into Run 2 selected. The Actions menu holds Run, Open last run, Print report, Edit and Remove for one scenario.
   - After Run all scenarios, the chosen rows show Running until the server answers, then the list loads once more. The server runs as many at once as the agency's Scenarios at once setting allows, and the rest show Waiting. Each row shows the tokens of its last run. The list does not refresh by itself; a run's own page does.
   - The Publish button stays enabled, and the Publish page warns about any scenario that has not passed. The API server still refuses the publish while one has not passed (see Not yet built).

3. **Watches a run.** [Mockup](../../../2.%20design/mockups/journeys/20-test-an-agency/mockups/step-03-watches-a-run.html).
   - Running one scenario from its Actions menu opens its run at once; Run all scenarios stays on the list, and a run opens from Open last run. The run page fills step by step with the result Running and reads the server again until the run ends. The Test agent plays the people in the script and the agency's agents respond through the same endpoints a live run uses.
   - Under each step the page shows the endpoint called, what was sent, what the module answered word for word, the new lines written to the trail, the rows written and the step's tokens. The page ends with what was stored in the test copy.
   - After the run, a Data trail tab lists every line the run wrote, oldest first, each with its step, module and endpoint, and the rows each module's test copy holds at the end.
   - Closing the page does not stop the run.

4. **Reads a failed run.** [Mockup](../../../2.%20design/mockups/journeys/20-test-an-agency/mockups/step-04-reads-a-failed-run.html).
   - The page stops at the step that went wrong. It shows what was expected and what was found, the endpoint called, what was sent and, when the module refused the call, the refusal word for word.
   - A chip names each rule the step showed and whether it failed. The step carries Open the rule (it opens the Roles page), Run again and Why did this fail?
   - Asking why lands an answer in the content area with the step, the rule, what was expected and found, and the likely cause, linked to the Roles page and the workflow.

5. **Gives a stopped run more tokens.** [Mockup](../../../2.%20design/mockups/journeys/20-test-an-agency/mockups/step-05-gives-a-stopped-run-more-tokens.html).
   - A run that reached its token budget is Stopped with Budget reached. The steps done so far are kept, and Publish warns about it like any scenario that has not passed.
   - The run page offers Run this scenario again and Raise the tokens per test. Raising puts the limits form in the content area with an Approve button; after it, a note says the new limit applies to the next run.

6. **Prints a report or opens an earlier run.** [Mockup](../../../2.%20design/mockups/journeys/20-test-an-agency/mockups/step-06-prints-a-report.html).
   - Once a run has ended, one primary button prints its report: the run's details, the script and who played whom, what transpired, what was stored, the rules held and the draft version with the date and time.
   - An earlier run opens from the scenario's Runs list in the same view, marked with the draft it ran on.

7. **Adds a scenario.** [Mockup](../../../2.%20design/mockups/journeys/20-test-an-agency/mockups/step-07-adds-a-scenario.html).
   - Add a scenario opens a form with three tabs. Scenario holds the name and the workflow it follows. Actors holds the people the Test agent plays, one for each role of the workflow; a second farmer can be added, and names must differ. Steps (drawn as Blocks in the mockups) holds the workflow's steps, each with its actor and what goes in, left free for the Test agent unless a value is typed.
   - The chat can fill the form too. After Save, the scenario is the last row, Not run yet.

8. **Opens, edits or removes a scenario.** [Mockup](../../../2.%20design/mockups/journeys/20-test-an-agency/mockups/step-08-opens-edits-or-removes-a-scenario.html).
   - A scenario opens from its name with its three tabs, read only. Edit has the same tabs filled in. Saving sends the scenario back to Not run yet, and its old run stays in its Runs.
   - Remove takes it out of the list. A role or workflow a scenario uses cannot be removed from the agency.

9. **Asks which rules held.** [Mockup](../../../2.%20design/mockups/journeys/20-test-an-agency/mockups/step-09-asks-which-rules-held.html).
   - Failed only, beside Add a scenario, shows just the scenarios whose last run failed.
   - Asking which rules held lands each of the agency's rules in the content area: Held where a scenario run shows it, Failed where one broke it, Not tested yet otherwise.

10. **Publishes.** [Mockup](../../../2.%20design/mockups/journeys/20-test-an-agency/mockups/step-10-publishes.html).
    - Publish, on its own page, lists what would be published and, under it, each scenario that has not passed on this draft, with its last result and a link to its run.
    - The warning does not disable the Publish button, and no sign-off is recorded. The page says publishing is still allowed, but the API server refuses it while a scenario has not passed (see Not yet built).
    - When every scenario has passed, no warning shows, and one line says a publish reaches members within 30 seconds.

## Not yet built

- The Publish page says publishing is still allowed, but the API server's publish check raises an error for each scenario that has not passed (`checkScenarios`), and an error refuses the publish. A publish pressed with one unpassed is refused, and the Publish page lists that sentence as a problem. The button is never disabled for this.
