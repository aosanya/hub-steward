package mwanachamataskmanager_test

import (
	"context"
	"errors"
	"testing"

	mwanachamataskmanager "wakalaserver/modules/taskmanager"
	"wakalaserver/modules/taskmanager/models"
)

const (
	composedName   = "Utcák és közút"
	decomposedName = "Utcák és közút"
)

func TestBacklogNames_ADecomposedTwinOfABacklogNameIsASecondBacklog(t *testing.T) {
	mgr := newTestManager(t)
	ctx := context.Background()
	if _, err := mgr.CreateBacklog(ctx, composedName, []string{"Open", "Closed"}); err != nil {
		t.Fatal(err)
	}
	if _, err := mgr.CreateBacklog(ctx, decomposedName, []string{"Open", "Closed"}); err == nil {
		t.Fatal("a backlog named with combining marks was created beside its precomposed twin")
	}
	other, err := mgr.CreateBacklog(ctx, "Vizek", []string{"Open", "Closed"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := mgr.RenameBacklog(ctx, other.ID, decomposedName); err == nil {
		t.Fatal("a backlog was renamed onto the decomposed twin of another backlog's name")
	}
}

func TestBacklogNames_RenamingABacklogToItsOwnNameInAnotherFormIsAllowed(t *testing.T) {
	mgr := newTestManager(t)
	ctx := context.Background()
	made, err := mgr.CreateBacklog(ctx, composedName, []string{"Open", "Closed"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := mgr.RenameBacklog(ctx, made.ID, decomposedName); err != nil {
		t.Fatalf("a backlog may take its own name in another form: %v", err)
	}
}

func TestStepNames_ADecomposedTwinOfAStepNameIsASecondStep(t *testing.T) {
	mgr := newTestManager(t)
	ctx := context.Background()
	made, err := mgr.CreateBacklog(ctx, "Vizek", []string{composedName, "Closed"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := mgr.CreateBacklog(ctx, "Utak", []string{composedName, decomposedName}); !errors.Is(err, mwanachamataskmanager.ErrInvalidBacklog) && err == nil {
		t.Fatal("a backlog was created with a step and its decomposed twin")
	}
	if _, err := mgr.AddBacklogStep(ctx, made.ID, decomposedName, ""); err == nil {
		t.Fatal("a step was added beside its decomposed twin")
	}
	if _, err := mgr.RenameBacklogStep(ctx, made.ID, "closed", decomposedName); err == nil {
		t.Fatal("a step was renamed onto the decomposed twin of another step")
	}
}

func TestCheckBacklogs_ADecomposedTwinIsDeclaredTwice(t *testing.T) {
	steps := []models.BacklogStep{{ID: "open", Name: "Open"}}
	first := models.Backlog{ID: "a", Name: composedName, Steps: steps}
	second := models.Backlog{ID: "b", Name: decomposedName, Steps: steps}
	if err := models.CheckBacklogs([]models.Backlog{first, second}); err == nil {
		t.Fatal("two backlogs whose names differ only in Unicode form were accepted")
	}
	twinSteps := []models.BacklogStep{{ID: "x", Name: composedName}, {ID: "y", Name: decomposedName}}
	if err := models.CheckBacklogs([]models.Backlog{{ID: "a", Name: "A", Steps: twinSteps}}); err == nil {
		t.Fatal("two steps whose names differ only in Unicode form were accepted")
	}
}
