package digitaltwin_test

import (
	"testing"
	"time"

	digitaltwin "wakalaserver/modules/digitaltwin"
)

func TestSweepPurgesOnlyWhatARuleCovers(t *testing.T) {
	tm, ctx := newManager(t)
	n := seedNode(t, tm, ctx, "Line 4", "pipeline")
	now := time.Date(2026, 9, 3, 0, 0, 0, 0, time.UTC)
	old := now.AddDate(0, 0, -40).Format(time.RFC3339)
	recent := now.AddDate(0, 0, -5).Format(time.RFC3339)

	if _, err := tm.SetRetention(ctx, digitaltwin.Retention{
		NodeKind: "pipeline", MetricName: "pressure_psi", RetentionDays: 30,
	}); err != nil {
		t.Fatalf("rule: %v", err)
	}
	if _, err := tm.RecordObservations(ctx, []digitaltwin.Observation{
		{NodeID: n.ID, NodeKind: "pipeline", MetricName: "pressure_psi", Value: 1, RecordedAt: old},
		{NodeID: n.ID, NodeKind: "pipeline", MetricName: "pressure_psi", Value: 2, RecordedAt: recent},
		{NodeID: n.ID, NodeKind: "pipeline", MetricName: "flow_m3h", Value: 3, RecordedAt: old},
	}); err != nil {
		t.Fatalf("record: %v", err)
	}

	purged, err := digitaltwin.Sweep(ctx, tm, now)
	if err != nil {
		t.Fatalf("sweep: %v", err)
	}
	if purged != 1 {
		t.Fatalf("purged = %d, want 1 — only the old pressure_psi observation", purged)
	}

	left, err := tm.QueryObservations(ctx, digitaltwin.ObservationFilter{NodeID: n.ID})
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	if len(left) != 2 {
		t.Fatalf("left = %d, want 2 — the recent pressure and the old flow no rule covers", len(left))
	}
}

func TestW13_ASpecificRuleProtectsWhatABroaderRuleWouldPurge(t *testing.T) {
	tm, ctx := newManager(t)
	n := seedNode(t, tm, ctx, "Line 4", "pipeline")
	now := time.Date(2026, 9, 23, 0, 0, 0, 0, time.UTC)
	forty := now.AddDate(0, 0, -40).Format(time.RFC3339)

	for _, r := range []digitaltwin.Retention{
		{NodeKind: "pipeline", MetricName: "pressure_psi", RetentionDays: 365},
		{NodeKind: "pipeline", RetentionDays: 20},
		{RetentionDays: 10},
	} {
		if _, err := tm.SetRetention(ctx, r); err != nil {
			t.Fatalf("rule %+v: %v", r, err)
		}
	}
	if _, err := tm.RecordObservations(ctx, []digitaltwin.Observation{
		{NodeID: n.ID, NodeKind: "pipeline", MetricName: "pressure_psi", Value: 1, RecordedAt: forty},
		{NodeID: n.ID, NodeKind: "pipeline", MetricName: "flow_m3h", Value: 2, RecordedAt: forty},
		{NodeID: n.ID, NodeKind: "valve", MetricName: "open_pct", Value: 3, RecordedAt: forty},
	}); err != nil {
		t.Fatalf("record: %v", err)
	}

	purged, err := digitaltwin.Sweep(ctx, tm, now)
	if err != nil {
		t.Fatalf("sweep: %v", err)
	}
	if purged != 2 {
		t.Fatalf("purged = %d, want 2: the pipeline flow reading (kind rule, 20 days) and the valve reading (catch-all, 10 days)", purged)
	}

	left, err := tm.QueryObservations(ctx, digitaltwin.ObservationFilter{NodeID: n.ID})
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	if len(left) != 1 || left[0].MetricName != "pressure_psi" {
		t.Fatalf("left = %+v, want only the pressure_psi reading the 365-day rule protects", left)
	}
}

func TestSweepWithNoRulesPurgesNothing(t *testing.T) {
	tm, ctx := newManager(t)
	n := seedNode(t, tm, ctx, "Line 4", "pipeline")

	if _, err := tm.RecordObservation(ctx, digitaltwin.Observation{
		NodeID: n.ID, NodeKind: "pipeline", MetricName: "pressure_psi",
		RecordedAt: "2000-01-01T00:00:00Z",
	}); err != nil {
		t.Fatalf("record: %v", err)
	}

	purged, err := digitaltwin.Sweep(ctx, tm, time.Now())
	if err != nil {
		t.Fatalf("sweep: %v", err)
	}
	if purged != 0 {
		t.Fatalf("purged = %d, want 0 — no rule means keep indefinitely", purged)
	}
}
