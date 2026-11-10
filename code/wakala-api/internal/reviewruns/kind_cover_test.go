package reviewruns

import (
	"slices"
	"testing"
)

func TestFarmersAgencyMatchesTheKindWordInAnyCase(t *testing.T) {
	cases := map[string]bool{"Farmers cooperative": true, "FARM": true, "town hall": false, "": false}
	for kind, want := range cases {
		if got := FarmersAgency(kind); got != want {
			t.Errorf("FarmersAgency(%q) = %v, want %v", kind, got, want)
		}
	}
}

func TestObjectivesAreReviewedOnlyForFarmers(t *testing.T) {
	if AreaApplies("town hall", AreaObjectives) {
		t.Error("objectives must not apply to a town hall")
	}
	if !AreaApplies("farm co-op", AreaObjectives) {
		t.Error("objectives must apply to a farm co-op")
	}
	if !AreaApplies("town hall", AreaWorkflows) {
		t.Error("workflows apply to every kind")
	}
}

func TestAreasForDropsObjectivesOutsideFarming(t *testing.T) {
	other := AreasFor("town hall")
	if slices.Contains(other, AreaObjectives) {
		t.Errorf("town hall areas include objectives: %v", other)
	}
	if len(other) != len(Areas())-1 {
		t.Errorf("town hall has %d areas, want %d", len(other), len(Areas())-1)
	}
	if !slices.Equal(AreasFor("farm"), Areas()) {
		t.Errorf("farm areas = %v, want every area %v", AreasFor("farm"), Areas())
	}
}
