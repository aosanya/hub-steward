package riskmanager_test

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	rm "wakalaserver/modules/riskmanager"
	"wakalaserver/modules/shared/spec"
)

type libraryHarness struct {
	spec    *spec.Spec
	manager rm.RiskManager
}

func newLibraryHarness(t *testing.T) libraryHarness {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}
	s, err := rm.SpecForMount("test", "risks")
	if err != nil {
		t.Fatalf("SpecForMount: %v", err)
	}
	if err := rm.Provision(db, s); err != nil {
		t.Fatalf("Provision: %v", err)
	}
	m, err := rm.NewRiskManager(db, s)
	if err != nil {
		t.Fatalf("NewRiskManager: %v", err)
	}
	return libraryHarness{spec: s, manager: m}
}

func (h libraryHarness) open(context.Context) (rm.RiskManager, error) { return h.manager, nil }

func sampleLibrary() rm.Library {
	return rm.Library{
		Name: "depot",
		Risk: rm.LibraryRisk{Title: "Flooded depot", TopEvent: "Depot floods"},
		Pathways: []rm.LibraryPathway{
			{
				Title: "Heavy rain", Side: rm.SideThreat,
				Controls: []rm.LibraryControl{
					{Name: "Sandbags", Stage: "prevent"},
					{Name: "Pumps", Stage: "prevent"},
				},
			},
			{
				Title: "Stock lost", Side: rm.SideConsequence,
				Controls: []rm.LibraryControl{{Name: "Pumps", Stage: "recover"}},
			},
		},
		Drilldowns: []rm.LibraryDrilldown{{
			Pathway: "Heavy rain",
			Risk:    rm.LibraryRisk{Title: "Gutter blocked", TopEvent: "Gutter overflows"},
			Pathways: []rm.LibraryPathway{
				{Title: "Leaf fall", Side: rm.SideThreat, Controls: []rm.LibraryControl{{Name: "Sandbags", Stage: "prevent"}}},
			},
		}},
	}
}

func TestParseLibraryRefusesTextThatIsNotJSON(t *testing.T) {
	if _, err := rm.ParseLibrary([]byte("{not json")); !errors.Is(err, rm.ErrInvalid) {
		t.Fatalf("err = %v, want ErrInvalid", err)
	}
}

func TestParseLibraryReadsTheDeclaredShape(t *testing.T) {
	raw := `{"library":"depot","note":"n","risk":{"title":"R","top_event":"E","hazard":"H"},
	"pathways":[{"title":"P","scenario":"S","side":"threat","controls":[{"name":"C","description":"D","stage":"prevent"}]}],
	"drilldowns":[{"pathway":"P","risk":{"title":"R2","top_event":"E2"},"pathways":[]}]}`
	lib, err := rm.ParseLibrary([]byte(raw))
	if err != nil {
		t.Fatalf("ParseLibrary: %v", err)
	}
	if lib.Name != "depot" || lib.Risk.Hazard != "H" || lib.Pathways[0].Scenario != "S" ||
		lib.Pathways[0].Controls[0].Description != "D" || lib.Drilldowns[0].Pathway != "P" {
		t.Fatalf("library = %+v", lib)
	}
}

func TestLoadLibraryRefusesAMissingFileAndReadsAPresentOne(t *testing.T) {
	dir := t.TempDir()
	if _, err := rm.LoadLibrary(filepath.Join(dir, "absent.json")); !errors.Is(err, rm.ErrInvalid) {
		t.Fatalf("missing file err = %v, want ErrInvalid", err)
	}
	path := filepath.Join(dir, "lib.json")
	if err := os.WriteFile(path, []byte(`{"library":"on disk","risk":{"title":"R","top_event":"E"}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	lib, err := rm.LoadLibrary(path)
	if err != nil || lib.Name != "on disk" {
		t.Fatalf("LoadLibrary = %+v, %v", lib, err)
	}
}

func TestLibraryCheckAcceptsAWellFormedLibrary(t *testing.T) {
	h := newLibraryHarness(t)
	if err := sampleLibrary().Check(h.spec); err != nil {
		t.Fatalf("Check: %v", err)
	}
}

func TestLibraryCheckRefusals(t *testing.T) {
	h := newLibraryHarness(t)
	cases := map[string]func(*rm.Library){
		"a risk with no title":           func(l *rm.Library) { l.Risk.Title = "" },
		"a risk with no top event":       func(l *rm.Library) { l.Risk.TopEvent = " " },
		"a pathway with no title":        func(l *rm.Library) { l.Pathways[0].Title = "" },
		"a pathway on neither side":      func(l *rm.Library) { l.Pathways[0].Side = "sideways" },
		"a control with no name":         func(l *rm.Library) { l.Pathways[0].Controls[0].Name = "" },
		"a drill-down of an unknown one": func(l *rm.Library) { l.Drilldowns[0].Pathway = "Nowhere" },
		"a drill-down risk with no title": func(l *rm.Library) {
			l.Drilldowns[0].Risk.Title = ""
		},
		"a drill-down pathway on no side": func(l *rm.Library) {
			l.Drilldowns[0].Pathways[0].Side = ""
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			lib := sampleLibrary()
			mutate(&lib)
			if err := lib.Check(h.spec); !errors.Is(err, rm.ErrInvalid) {
				t.Fatalf("err = %v, want ErrInvalid", err)
			}
		})
	}
}

func TestADrilldownNamingAnUnknownPathwayNamesBothInTheRefusal(t *testing.T) {
	h := newLibraryHarness(t)
	lib := sampleLibrary()
	lib.Drilldowns[0].Pathway = "Nowhere"
	err := lib.Check(h.spec)
	if err == nil || !strings.Contains(err.Error(), `"Gutter blocked"`) || !strings.Contains(err.Error(), `"Nowhere"`) {
		t.Fatalf("err = %v, want the drill-down risk and the missing pathway named", err)
	}
}

func TestImportLibraryBuildsTheBowtieAndCountsWhatItCreated(t *testing.T) {
	ctx := context.Background()
	h := newLibraryHarness(t)
	report, err := rm.ImportLibrary(ctx, h.spec, sampleLibrary(), h.open)
	if err != nil {
		t.Fatalf("ImportLibrary: %v", err)
	}
	if report.Created != 11 || report.Existing != 2 {
		t.Fatalf("report = %+v, want 11 created and 2 existing (Pumps and Sandbags reused as controls)", report)
	}
	risks, err := h.manager.ListRisks(ctx, rm.RiskFilter{})
	if err != nil || len(risks) != 2 {
		t.Fatalf("risks = %v, %v, want the library's risk and its drill-down", risks, err)
	}
	controls, err := h.manager.ListControls(ctx, rm.ControlFilter{})
	if err != nil || len(controls) != 2 {
		t.Fatalf("controls = %v, %v, want Sandbags and Pumps stored once each", controls, err)
	}
}

func TestImportLibraryParentsTheDrilldownOnItsPathway(t *testing.T) {
	ctx := context.Background()
	h := newLibraryHarness(t)
	if _, err := rm.ImportLibrary(ctx, h.spec, sampleLibrary(), h.open); err != nil {
		t.Fatalf("ImportLibrary: %v", err)
	}
	risks, _ := h.manager.ListRisks(ctx, rm.RiskFilter{})
	var parent, child rm.Risk
	for _, r := range risks {
		if r.Title == "Gutter blocked" {
			child = r
		} else {
			parent = r
		}
	}
	if child.ParentPathwayID == "" || parent.ParentPathwayID != "" {
		t.Fatalf("parent = %+v, child = %+v", parent, child)
	}
	threats, err := h.manager.Threats(ctx, rm.PathwayFilter{RiskID: parent.ID})
	if err != nil || len(threats) != 1 || threats[0].ID != child.ParentPathwayID || threats[0].Title != "Heavy rain" {
		t.Fatalf("threats = %+v, %v, want the drill-down hung on Heavy rain", threats, err)
	}
}

func TestImportLibraryKeepsControlOrderAsBarrierPosition(t *testing.T) {
	ctx := context.Background()
	h := newLibraryHarness(t)
	if _, err := rm.ImportLibrary(ctx, h.spec, sampleLibrary(), h.open); err != nil {
		t.Fatalf("ImportLibrary: %v", err)
	}
	risks, _ := h.manager.ListRisks(ctx, rm.RiskFilter{Query: "Flooded"})
	threats, _ := h.manager.Threats(ctx, rm.PathwayFilter{RiskID: risks[0].ID})
	barriers, err := h.manager.ListBarriers(ctx, rm.BarrierFilter{PathwayID: threats[0].ID})
	if err != nil || len(barriers) != 2 {
		t.Fatalf("barriers = %+v, %v", barriers, err)
	}
	positions := map[int]bool{}
	for _, b := range barriers {
		positions[b.Position] = true
	}
	if !positions[1] || !positions[2] {
		t.Fatalf("positions = %v, want 1 and 2 in the order the library lists them", positions)
	}
}

func TestImportingTheSameLibraryTwiceCreatesNothingTheSecondTime(t *testing.T) {
	ctx := context.Background()
	h := newLibraryHarness(t)
	first, err := rm.ImportLibrary(ctx, h.spec, sampleLibrary(), h.open)
	if err != nil {
		t.Fatalf("first import: %v", err)
	}
	second, err := rm.ImportLibrary(ctx, h.spec, sampleLibrary(), h.open)
	if err != nil {
		t.Fatalf("second import: %v", err)
	}
	if second.Created != 0 || second.Existing != first.Created+first.Existing {
		t.Fatalf("first = %+v, second = %+v, want nothing created and everything existing", first, second)
	}
	risks, _ := h.manager.ListRisks(ctx, rm.RiskFilter{})
	if len(risks) != 2 {
		t.Fatalf("risks = %d after a second import, want 2", len(risks))
	}
}

func TestAnInvalidLibraryIsRefusedBeforeTheManagerIsOpened(t *testing.T) {
	h := newLibraryHarness(t)
	opened := false
	open := func(context.Context) (rm.RiskManager, error) {
		opened = true
		return h.manager, nil
	}
	lib := sampleLibrary()
	lib.Pathways[1].Side = "bogus"
	report, err := rm.ImportLibrary(context.Background(), h.spec, lib, open)
	if !errors.Is(err, rm.ErrInvalid) || opened || report != (rm.ImportReport{}) {
		t.Fatalf("report = %+v, err = %v, opened = %v", report, err, opened)
	}
	risks, _ := h.manager.ListRisks(context.Background(), rm.RiskFilter{})
	if len(risks) != 0 {
		t.Fatalf("risks = %d, want none written for a refused library", len(risks))
	}
}

func TestImportLibraryReturnsTheOpenersError(t *testing.T) {
	h := newLibraryHarness(t)
	boom := errors.New("no database")
	open := func(context.Context) (rm.RiskManager, error) { return nil, boom }
	if _, err := rm.ImportLibrary(context.Background(), h.spec, sampleLibrary(), open); !errors.Is(err, boom) {
		t.Fatalf("err = %v, want the opener's error", err)
	}
}
