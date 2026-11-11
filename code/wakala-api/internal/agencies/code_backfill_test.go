package agencies

import (
	"context"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	mwanachamataskmanager "wakalaserver/modules/taskmanager"
)

func boardWithOneUncodedIssue(t *testing.T) (mwanachamataskmanager.TaskManager, *gorm.DB, string) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	s, err := mwanachamataskmanager.SpecForMount("backfill1", MountBoard)
	if err != nil {
		t.Fatal(err)
	}
	if err := mwanachamataskmanager.Provision(db, s); err != nil {
		t.Fatal(err)
	}
	board, err := mwanachamataskmanager.NewTaskManager(db, s, nil)
	if err != nil {
		t.Fatal(err)
	}
	made, err := board.CreateTask(context.Background(), mwanachamataskmanager.Task{Title: "DEV-9 Old row", ProjectName: "kazi", LinkedRef: "kazi/DEV-9", Code: "TEMP"})
	if err != nil {
		t.Fatal(err)
	}
	object, _ := s.ByRole("task")
	table := s.TableFor(object)
	if err := db.Exec("update " + table + " set code = '', code_series = '', code_number = 0").Error; err != nil {
		t.Fatal(err)
	}
	return board, db, made.ID
}

func TestTheIssueCodeBackfillDoesNothingUnlessTheOwnerSwitchesItOn(t *testing.T) {
	board, _, id := boardWithOneUncodedIssue(t)

	backfillIssueCodes(context.Background(), board, "inst")

	read, err := board.GetTask(context.Background(), id)
	if err != nil || read.Code != "" {
		t.Fatalf("got %q, %v, want no code", read.Code, err)
	}
}

func TestTheIssueCodeBackfillReportsWithoutWritingWhenTheOwnerAsksForAReport(t *testing.T) {
	board, _, id := boardWithOneUncodedIssue(t)
	t.Setenv(envBackfillIssueCodes, "report")

	backfillIssueCodes(context.Background(), board, "inst")

	read, _ := board.GetTask(context.Background(), id)
	if read.Code != "" {
		t.Fatalf("a report wrote %q", read.Code)
	}
}

func TestTheIssueCodeBackfillWritesWhenTheOwnerSaysApply(t *testing.T) {
	board, _, id := boardWithOneUncodedIssue(t)
	t.Setenv(envBackfillIssueCodes, "apply")

	backfillIssueCodes(context.Background(), board, "inst")

	read, err := board.GetTask(context.Background(), id)
	if err != nil || read.Code != "DEV-9" {
		t.Fatalf("got %q, %v, want DEV-9", read.Code, err)
	}
}
