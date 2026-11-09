package reviewruns

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"testing"

	agencymodels "wakalaserver/modules/agency/models"
)

var (
	headingOf  = regexp.MustCompile(`(?m)^Workflow id (\S+),`)
	previousOf = regexp.MustCompile(`(?m)^- id (\S+):`)
)

type partsModel struct {
	mu    sync.Mutex
	users []string
	fail  func(user string) error
}

func (m *partsModel) Complete(_ context.Context, _, user string) (Completion, error) {
	m.mu.Lock()
	m.users = append(m.users, user)
	m.mu.Unlock()
	if m.fail != nil {
		if err := m.fail(user); err != nil {
			return Completion{}, err
		}
	}
	findings := []any{map[string]any{"title": "Check part", "detail": "Check it.", "fate": "new"}}
	for _, id := range previousOf.FindAllStringSubmatch(user, -1) {
		findings = append(findings, map[string]any{"title": "Earlier " + id[1], "detail": "Still there.", "fate": "still_open", "fate_reason": "Nothing changed.", "carried_from_id": id[1]})
	}
	answer, err := json.Marshal(map[string]any{"summary": "One part was read. It stands well.", "findings": findings})
	if err != nil {
		return Completion{}, err
	}
	return Completion{Text: string(answer), Tokens: 10}, nil
}

func (m *partsModel) workflowsRead() [][]string {
	m.mu.Lock()
	defer m.mu.Unlock()
	var read [][]string
	for _, user := range m.users {
		var ids []string
		for _, h := range headingOf.FindAllStringSubmatch(user, -1) {
			ids = append(ids, h[1])
		}
		read = append(read, ids)
	}
	return read
}

func partsOf(workflows int) int {
	return (workflows + workflowsBatchSize - 1) / workflowsBatchSize
}

func (d *carryDesk) manyWorkflows(extra int) []agencymodels.Workflow {
	d.t.Helper()
	ctx := context.Background()
	var made []agencymodels.Workflow
	for i := 0; i < extra; i++ {
		made = append(made, d.workflow(ctx, agencymodels.Workflow{Name: fmt.Sprintf("Run job %d", i), Description: "A member runs a job.", Ordinality: 20 + i}))
	}
	return made
}

func (d *carryDesk) reviewParts(model Model, previous []PreviousFinding) (AreaResult, error) {
	return NewWorkflowsReviewer(model, NewWorkflowsReader(d.mgr)).Review(context.Background(), AreaInput{ReviewID: "rv-1", Area: AreaWorkflows, DraftID: d.draftID, Previous: previous})
}

func TestWorkflowsReviewOfASmallDraftIsOneCall(t *testing.T) {
	d := newCarryDesk(t)
	model := &partsModel{}
	if _, err := d.reviewParts(model, nil); err != nil {
		t.Fatal(err)
	}
	if got := len(model.workflowsRead()); got != 1 {
		t.Fatalf("calls = %d, want 1", got)
	}
}

func TestWorkflowsReviewSplitsALargeDraftIntoParts(t *testing.T) {
	d := newCarryDesk(t)
	d.manyWorkflows(12)
	model := &partsModel{}
	if _, err := d.reviewParts(model, nil); err != nil {
		t.Fatal(err)
	}
	read := model.workflowsRead()
	if want := partsOf(15); len(read) != want {
		t.Fatalf("calls = %d, want %d for 15 workflows", len(read), want)
	}
	seen := map[string]int{}
	for _, ids := range read {
		if len(ids) > workflowsBatchSize {
			t.Errorf("a part read %d workflows, limit %d", len(ids), workflowsBatchSize)
		}
		for _, id := range ids {
			seen[id]++
		}
	}
	if len(seen) != 15 {
		t.Fatalf("workflows read = %d, want 15", len(seen))
	}
	for id, times := range seen {
		if times != 1 {
			t.Errorf("workflow %s read %d times", id, times)
		}
	}
}

func TestWorkflowsReviewPartsStillNameEveryWorkflowForCrossReferences(t *testing.T) {
	d := newCarryDesk(t)
	d.manyWorkflows(12)
	model := &partsModel{}
	if _, err := d.reviewParts(model, nil); err != nil {
		t.Fatal(err)
	}
	for _, user := range model.users {
		if !strings.Contains(user, "of 15, the others are read in other parts") {
			t.Errorf("a part does not say it is one of several: %q", user[:200])
		}
	}
}

func TestWorkflowsReviewMergesTheFindingsAndTokensOfEveryPart(t *testing.T) {
	d := newCarryDesk(t)
	d.manyWorkflows(12)
	got, err := d.reviewParts(&partsModel{}, nil)
	if err != nil {
		t.Fatal(err)
	}
	parts := partsOf(15)
	if len(got.Findings) != parts || got.Tokens != 10*parts {
		t.Fatalf("findings %d tokens %d, want %d and %d", len(got.Findings), got.Tokens, parts, 10*parts)
	}
	if want := fmt.Sprintf("15 workflows were read in %d parts. They hold %d findings in all.", parts, parts); got.Summary != want {
		t.Fatalf("summary = %q, want %q", got.Summary, want)
	}
}

func TestWorkflowsReviewSendsAnEarlierFindingToThePartThatHoldsItsWorkflow(t *testing.T) {
	d := newCarryDesk(t)
	made := d.manyWorkflows(12)
	last := made[len(made)-1]
	previous := []PreviousFinding{{ID: "pf-7", Title: "Rename it", Detail: "Needs a verb.", Tool: toolUpdateWorkflow, Arguments: map[string]any{"workflow_id": last.ID}, Status: "open"}}
	model := &partsModel{}
	got, err := d.reviewParts(model, previous)
	if err != nil {
		t.Fatal(err)
	}
	holders := 0
	for i, user := range model.users {
		if strings.Contains(user, "id pf-7:") {
			holders++
			if !strings.Contains(user, "Workflow id "+last.ID+",") {
				t.Errorf("part %d was given the finding but not its workflow", i)
			}
		}
	}
	if holders != 1 {
		t.Fatalf("parts given the earlier finding = %d, want 1", holders)
	}
	carried := 0
	for _, f := range got.Findings {
		if f.CarriedFromID == "pf-7" {
			carried++
		}
	}
	if carried != 1 {
		t.Fatalf("carried findings = %d, want 1", carried)
	}
}

func TestWorkflowsReviewSendsAnEarlierFindingByWorkflowCodeInItsTitle(t *testing.T) {
	d := newCarryDesk(t)
	made := d.manyWorkflows(12)
	last := made[len(made)-1]
	previous := []PreviousFinding{{ID: "pf-8", Title: "Add a time limit to " + last.Code + " step S-1", Detail: "No limit.", Status: "open"}}
	model := &partsModel{}
	if _, err := d.reviewParts(model, previous); err != nil {
		t.Fatal(err)
	}
	for _, user := range model.users {
		if strings.Contains(user, "id pf-8:") && !strings.Contains(user, "Workflow id "+last.ID+",") {
			t.Fatal("the finding went to a part that does not hold its workflow")
		}
	}
}

func TestWorkflowsReviewFailsWhenOnePartFails(t *testing.T) {
	d := newCarryDesk(t)
	made := d.manyWorkflows(12)
	broken := errors.New("The AI account refused the call.")
	model := &partsModel{fail: func(user string) error {
		if strings.Contains(user, "Workflow id "+made[len(made)-1].ID+",") {
			return broken
		}
		return nil
	}}
	_, err := d.reviewParts(model, nil)
	if !errors.Is(err, broken) {
		t.Fatalf("err = %v, want the failing part's error", err)
	}
}
