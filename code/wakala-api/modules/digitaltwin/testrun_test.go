package digitaltwin_test

import (
	"testing"

	digitaltwin "wakalaserver/modules/digitaltwin"
)

func TestARunRefusesAnEmptyRunID(t *testing.T) {
	tm, _ := newManager(t)
	if _, err := tm.ForRun(""); err == nil {
		t.Fatal("ForRun with an empty id succeeded")
	}
}

func TestANodeCreatedInARunNeverReachesTheLiveTable(t *testing.T) {
	live, ctx := newManager(t)
	run, err := live.ForRun("run-1")
	if err != nil {
		t.Fatal(err)
	}
	seedNode(t, run, ctx, "Streetlight 14", "asset")

	liveNodes, err := live.ListNodes(ctx, digitaltwin.NodeFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(liveNodes) != 0 {
		t.Fatalf("live nodes = %d after a run, want 0", len(liveNodes))
	}
	runNodes, err := run.ListNodes(ctx, digitaltwin.NodeFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(runNodes) != 1 {
		t.Fatalf("run nodes = %d, want 1", len(runNodes))
	}
}
