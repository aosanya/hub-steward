# Design an agency

**Who:** the designer.

**Goal:** The designer takes an agency draft through a system workflow in which AI reviewers and human domain experts read the draft, and every finding is answered before the draft is published.

**Result:** Each AI reviewer and each expert has read the draft, every finding is applied or dismissed, and Publish opens.

No mockups are drawn for this journey.

## The system workflow

The workflow belongs to the platform, not to any agency. It is not in an agency's workflows, and the designer cannot edit or remove it. One run belongs to one draft.

| Stage | Who acts | What leaves it |
|---|---|---|
| Draft | The designer | The designer asks for a review |
| AI review | The AI reviewers, one per part of the agency | Every AI reviewer has written its findings |
| Expert review | The domain experts the designer added | Every expert has written findings and signed off |
| Fix | The designer | Every finding is applied or dismissed |
| Ready | Nobody | Publish opens |

The AI reviewers only read the draft and write findings. They never change it; a change is made when the designer presses Apply on a finding.

## Steps

1. **She opens Review.** In the design, Review lists the stages of the design workflow for the draft, who holds the current stage, and the findings so far. Built today: with no review yet, one card says so and carries Run review, and the latest review shows a card for each part. The stage list is not built.
2. **She adds a domain expert (not built).** Add an expert opens a form for the expert's name, field and email. The expert becomes a person of the agency with an expert role and receives a link that opens the draft read only.
3. **She starts the review.** Run review makes each AI reviewer read its part of the draft (profile, goals, objectives, roles, workflows, risks and tests: the parts [Review an agency](../27-review-an-agency/README.md) already reads, seven in the farmers' agency and six elsewhere, because Objectives is read only there) and write findings. Built. In the design the draft also moves to AI review and the stage shows who has finished; the stage is not built.
4. **She reads the AI reviewers' findings.** Findings is a list with one row per finding: the reviewer, the goal, objective or rule it names, what it says and its state. Each row can be applied, dismissed, asked about in the chat, or opened in a Details tab.
5. **She waits for the experts (not built).** When the AI review has finished, the draft moves to Expert review. Each expert reads the draft, writes findings in the same list marked with their name, and signs off. The stage shows who has signed.
6. **She answers the findings.** Apply changes the draft and marks the finding Applied; Dismiss marks it Dismissed. A finding asked about in the chat is answered there and stays open until she applies or dismisses it.
7. **She publishes once every finding is answered (not built).** In the design, Publish is blocked while a finding is open or an expert has not signed off, and it lists what holds it. When nothing holds it, the draft is Ready. Today nothing in the console or the API blocks Publish on a finding, and Review never does ([Review an agency](../27-review-an-agency/README.md)).

## Not yet built

- The AI review exists: running reviewers over a draft and reading their findings is [Review an agency](../27-review-an-agency/README.md).
- Not built: adding an expert, the expert stage and sign-off, and the Publish block while a finding is open. The console has no expert code, and nothing in it or the API stops Publish while a finding is open.
- No screen is drawn for this journey.
