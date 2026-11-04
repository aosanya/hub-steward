package reviewruns

import (
	"fmt"
	"strings"
)

const OutputFormat = `Answer with one JSON object and nothing else, in exactly this shape:

{
  "summary": "Two sentences that say how this part stands.",
  "findings": [
    {
      "title": "Make G-2 measurable",
      "detail": "The sentence under the title that says what is wrong and why it matters.",
      "tool": "agency_update_goal",
      "arguments": {"goal_id": "gid-2", "title": "Raise renewals to 80% by December", "description": "Owned by the Secretary.", "ordinality": 2},
      "then": [{"tool": "agency_get_goal", "arguments": {"goal_id": "gid-2"}}],
      "fate": "new",
      "fate_reason": "",
      "carried_from_id": "",
      "reopen": false
    }
  ]
}

Rules for the answer:
- "summary" is never empty.
- Every finding has a "title", a "detail" and a "fate". The fate is one of new, fixed, still_open or withdrawn.
- A new finding has no "carried_from_id" and no "fate_reason".
- Every earlier finding is answered by exactly one finding that sets "carried_from_id" to its id, with the fate fixed, still_open or withdrawn and a one-sentence "fate_reason".
- "reopen" is true only on a still_open finding whose earlier finding was dismissed and whose comments no longer explain it, or whose draft has changed under it.
- Keep the whole answer short. Every "detail" is one sentence. Report each problem once, as one finding, and never report two findings for the same problem.
- A finding that answers an earlier one and has the fate fixed or withdrawn gives only "title", "detail", "fate", "fate_reason" and "carried_from_id", and leaves out "tool", "arguments" and "then".
- "tool" is the name of the agency tool that fixes the problem, "arguments" are its arguments and "then" lists follow-up tool calls in order. Give all three on every finding whenever any agency tool can carry a proposed fix, even when the fix is your best proposal for the designer to adjust. Leave out all three only when no agency tool can change what is wrong.`

var areaNames = map[string]string{
	AreaProfile:     "Profile",
	AreaGoals:       "Goals",
	AreaObjectives:  "Objectives",
	AreaRolesAgents: "Roles and agents",
	AreaWorkflows:   "Workflows",
	AreaRisks:       "Risks",
	AreaTests:       "Tests",
}

func AreaName(area string) string {
	if name, ok := areaNames[area]; ok {
		return name
	}
	return area
}

func UserMessage(in AreaInput, draft string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Review the %s part of this draft.\n\n", AreaName(in.Area))
	fmt.Fprintf(&b, "What you are reading:\n%s\n\n", strings.TrimSpace(draft))
	if len(in.Previous) == 0 {
		b.WriteString("This is the first review of this part. There are no earlier findings.\n\n")
	} else {
		b.WriteString(previousSection(in.Previous))
	}
	b.WriteString(OutputFormat)
	return b.String()
}

func previousSection(previous []PreviousFinding) string {
	var b strings.Builder
	b.WriteString("Scan the whole part again as if there were no earlier run, and report anything wrong as a new finding, except a problem an earlier finding below already names: that one is answered through the earlier finding with the fate still_open, never repeated as a new finding. Give each earlier finding below one fate. Reopen nothing the designer's comments explain: if a comment explains the problem, withdraw the finding or leave a dismissed one dismissed.\n\n")
	b.WriteString("Earlier findings:\n")
	for _, p := range previous {
		fmt.Fprintf(&b, "\n- id %s: %s\n  detail: %s\n  designer's action: %s\n", p.ID, p.Title, p.Detail, p.Status)
		if p.Fate != "" {
			fmt.Fprintf(&b, "  earlier fate: %s %s\n", p.Fate, p.FateReason)
		}
		if len(p.Comments) == 0 {
			b.WriteString("  comments: none\n")
			continue
		}
		b.WriteString("  comments:\n")
		for _, c := range p.Comments {
			fmt.Fprintf(&b, "    %s: %s\n", c.Author, c.Body)
		}
	}
	b.WriteString("\n")
	return b.String()
}
