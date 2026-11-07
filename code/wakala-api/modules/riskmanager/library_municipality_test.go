package riskmanager_test

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	rm "wakalaserver/modules/riskmanager"
	"wakalaserver/modules/shared/spec"
)

func starterLibraries(t *testing.T) []rm.Library {
	t.Helper()
	paths, err := filepath.Glob(filepath.Join("libraries", "municipality-*.json"))
	if err != nil || len(paths) != 4 {
		t.Fatalf("starter library files = %v, %v; want 4", paths, err)
	}
	libs := make([]rm.Library, 0, len(paths))
	for _, path := range paths {
		lib, err := rm.LoadLibrary(path)
		if err != nil {
			t.Fatalf("LoadLibrary(%s): %v", path, err)
		}
		libs = append(libs, lib)
	}
	return libs
}

func starterSpec(t *testing.T, instance string) *spec.Spec {
	t.Helper()
	s, err := rm.SpecForMount(instance, "risks")
	if err != nil {
		t.Fatalf("SpecForMount: %v", err)
	}
	return s
}

func importAll(t *testing.T, s *spec.Spec, libs []rm.Library, m rm.RiskManager) rm.ImportReport {
	t.Helper()
	var total rm.ImportReport
	open := func(context.Context) (rm.RiskManager, error) { return m, nil }
	for _, lib := range libs {
		report, err := rm.ImportLibrary(context.Background(), s, lib, open)
		if err != nil {
			t.Fatalf("ImportLibrary(%s): %v", lib.Risk.Title, err)
		}
		total.Created += report.Created
		total.Existing += report.Existing
	}
	return total
}

func TestStarterLibrariesPassTheCheck(t *testing.T) {
	s := starterSpec(t, "test")
	for _, lib := range starterLibraries(t) {
		if err := lib.Check(s); err != nil {
			t.Errorf("%s: %v", lib.Risk.Title, err)
		}
		if len(lib.Pathways) == 0 {
			t.Errorf("%s has no pathways", lib.Risk.Title)
		}
	}
}

func TestStarterLibrariesHoldFourDistinctRisks(t *testing.T) {
	seen := map[string]bool{}
	for _, lib := range starterLibraries(t) {
		seen[lib.Risk.Title] = true
	}
	if len(seen) != 4 {
		t.Fatalf("distinct risks = %d, want 4", len(seen))
	}
}

func TestAnInvalidStarterLibraryIsRefusedBeforeAnyConnection(t *testing.T) {
	libs := starterLibraries(t)
	bad := libs[0]
	bad.Risk.TopEvent = ""
	opened := 0
	open := func(context.Context) (rm.RiskManager, error) {
		opened++
		return nil, errors.New("must not be reached")
	}
	_, err := rm.ImportLibrary(context.Background(), starterSpec(t, "test"), bad, open)
	if !errors.Is(err, rm.ErrInvalid) {
		t.Fatalf("err = %v, want ErrInvalid", err)
	}
	if opened != 0 {
		t.Fatalf("open called %d times, want 0", opened)
	}
}

func TestAMalformedLibraryFileIsInvalid(t *testing.T) {
	if _, err := rm.ParseLibrary([]byte("{")); !errors.Is(err, rm.ErrInvalid) {
		t.Fatalf("err = %v, want ErrInvalid", err)
	}
}

func assertImportsIdempotently(t *testing.T, s *spec.Spec, m rm.RiskManager) {
	t.Helper()
	libs := starterLibraries(t)
	first := importAll(t, s, libs, m)
	if first.Created == 0 {
		t.Fatalf("first import created nothing: %+v", first)
	}
	second := importAll(t, s, libs, m)
	if second.Created != 0 {
		t.Fatalf("second import created %d, want 0", second.Created)
	}
	risks, err := m.ListRisks(context.Background(), rm.RiskFilter{})
	if err != nil {
		t.Fatalf("ListRisks: %v", err)
	}
	if len(risks) != 4 {
		t.Fatalf("risks = %d, want 4", len(risks))
	}
	gaps, err := m.Gaps(context.Background(), rm.GapFilter{Limit: 1000})
	if err != nil || len(gaps) == 0 {
		t.Fatalf("gaps = %d, %v; want some", len(gaps), err)
	}
	perRisk := map[string]int{}
	for _, g := range gaps {
		perRisk[g.RiskID]++
	}
	for _, r := range risks {
		if perRisk[r.ID] == 0 {
			t.Errorf("risk %q has no gap", r.Title)
		}
	}
}

func TestStarterLibrariesImportIdempotentlyWithGaps(t *testing.T) {
	assertImportsIdempotently(t, starterSpec(t, "test"), newManager(t))
}

func TestStarterRisksShowEveryStanding(t *testing.T) {
	ctx := context.Background()
	m := newManager(t)
	importAll(t, starterSpec(t, "test"), starterLibraries(t), m)
	barriers, err := m.ListBarriers(ctx, rm.BarrierFilter{Limit: 1000})
	if err != nil {
		t.Fatalf("ListBarriers: %v", err)
	}
	adequate, partial := rm.JudgementAdequate, rm.JudgementPartial
	outcomes := []rm.Outcome{rm.OutcomePass, rm.OutcomePass, "", rm.OutcomeFail}
	for i, b := range barriers {
		switch i % 4 {
		case 0:
			if _, err := m.UpdateBarrier(ctx, rm.BarrierChange{ID: b.ID, Design: &adequate, Coverage: &adequate}); err != nil {
				t.Fatalf("UpdateBarrier: %v", err)
			}
		case 1:
			if _, err := m.UpdateBarrier(ctx, rm.BarrierChange{ID: b.ID, Design: &partial, Coverage: &adequate}); err != nil {
				t.Fatalf("UpdateBarrier: %v", err)
			}
		}
		if outcomes[i%4] == "" {
			continue
		}
		if _, err := m.RecordEvidence(ctx, rm.Evidence{BarrierID: b.ID, Kind: rm.EvidenceTest, Outcome: outcomes[i%4], Summary: "Szintetikus próba"}); err != nil {
			t.Fatalf("RecordEvidence: %v", err)
		}
	}
	risks, err := m.ListRisks(ctx, rm.RiskFilter{})
	if err != nil {
		t.Fatalf("ListRisks: %v", err)
	}
	seen := map[rm.Standing]bool{}
	for _, r := range risks {
		prevent, err := m.PreventiveMeasures(ctx, rm.MeasureFilter{RiskID: r.ID, Limit: 1000})
		if err != nil {
			t.Fatalf("PreventiveMeasures: %v", err)
		}
		mitigate, err := m.MitigatingMeasures(ctx, rm.MeasureFilter{RiskID: r.ID, Limit: 1000})
		if err != nil {
			t.Fatalf("MitigatingMeasures: %v", err)
		}
		if len(prevent) == 0 || len(mitigate) == 0 {
			t.Errorf("risk %q: preventive %d, mitigating %d; want both", r.Title, len(prevent), len(mitigate))
		}
		for _, measure := range append(prevent, mitigate...) {
			seen[measure.Standing] = true
		}
	}
	for _, want := range []rm.Standing{rm.StandingProven, rm.StandingWeak, rm.StandingUnproven, rm.StandingFailing} {
		if !seen[want] {
			t.Errorf("no %s measure across the starter risks", want)
		}
	}
}

func localDatabase(t *testing.T) string {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL is not set")
	}
	u, err := url.Parse(dsn)
	if err != nil || (u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost") {
		t.Skip("DATABASE_URL does not point at 127.0.0.1 or localhost")
	}
	return dsn
}

func TestStarterLibrariesImportIdempotentlyIntoPostgres(t *testing.T) {
	dsn := localDatabase(t)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}
	instance := fmt.Sprintf("mun60_%d", os.Getpid())
	s := starterSpec(t, instance)
	t.Cleanup(func() {
		var names []string
		db.Raw("select tablename from pg_tables where schemaname = current_schema() and tablename like ?", instance+"%").Scan(&names)
		for _, name := range names {
			db.Exec(fmt.Sprintf("drop table if exists %q cascade", strings.ReplaceAll(name, `"`, "")))
		}
	})
	if err := rm.Provision(db, s); err != nil {
		t.Fatalf("Provision: %v", err)
	}
	m, err := rm.NewRiskManager(db, s)
	if err != nil {
		t.Fatalf("NewRiskManager: %v", err)
	}
	assertImportsIdempotently(t, s, m)
}
