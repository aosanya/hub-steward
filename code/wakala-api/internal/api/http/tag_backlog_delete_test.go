package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamataskmanager "github.com/aosanya/mwanachama-backend-taskmanager"
)

func (w reachWalk) backlogCarrying(t *testing.T, name string, tags ...string) {
	t.Helper()
	ctx := context.Background()
	board, err := w.deps.Registry.TaskManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("TaskManager: %v", err)
	}
	ids := []string{}
	for _, tag := range tags {
		ids = append(ids, w.tagID(t, tag))
	}
	board.UseGroupTags(mwanachamataskmanager.GroupTags(func(context.Context, string) ([]string, error) { return ids, nil }))
	if _, err := board.CreateBacklogAs(ctx, "maker", name, []string{"Open"}, nil); err != nil {
		t.Fatalf("CreateBacklogAs %s: %v", name, err)
	}
}

func TestATagABacklogCarriesIsNotDeletedAndTheRefusalCountsTheBacklog(t *testing.T) {
	w := newReachWalk(t)
	w.backlogCarrying(t, "Sprint 1", "emea")
	w.backlogCarrying(t, "Sprint 2", "emea")
	w.backlogCarrying(t, "Apac sprint", "apac")

	code, answer := w.deleteTag(t, w.tagID(t, "emea"))
	if code != http.StatusConflict {
		t.Fatalf("delete of a tag two backlogs carry: %d, want 409", code)
	}
	if answer.Backlogs != 2 || answer.Rows != 0 || answer.Groups != 0 {
		t.Errorf("refusal counts %+v, want 2 backlogs, 0 rows and 0 groups", answer)
	}
}

func TestATagOneBacklogCarriesIsRefusedWithOneBacklog(t *testing.T) {
	w := newReachWalk(t)
	w.backlogCarrying(t, "Sprint 1", "emea")

	code, answer := w.deleteTag(t, w.tagID(t, "emea"))
	if code != http.StatusConflict || answer.Backlogs != 1 {
		t.Errorf("delete: %d with %+v, want 409 with 1 backlog", code, answer)
	}
}

func TestATagNoBacklogCarriesStillDeletesWhenOthersAreTagged(t *testing.T) {
	w := newReachWalk(t)
	w.backlogCarrying(t, "Emea sprint", "emea")

	if code, _ := w.deleteTag(t, w.tagID(t, "spare")); code != http.StatusOK {
		t.Errorf("delete of a tag no backlog carries: %d, want 200", code)
	}
}

func TestATagABacklogARowAndAGroupCarryCountsAllThree(t *testing.T) {
	w := newReachWalk(t)
	w.seedTagged(t, "Emea only", "emea")
	w.groupCarrying(t, "EMEA", "emea")
	w.backlogCarrying(t, "Sprint 1", "emea")

	code, answer := w.deleteTag(t, w.tagID(t, "emea"))
	if code != http.StatusConflict || answer.Rows != 1 || answer.Groups != 1 || answer.Backlogs != 1 {
		t.Errorf("delete: %d with %+v, want 409 with 1 row, 1 group and 1 backlog", code, answer)
	}
}
