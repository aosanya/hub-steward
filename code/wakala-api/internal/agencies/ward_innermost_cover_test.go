package agencies

import (
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
	"wakalaserver/modules/shared/geo"
)

func boxedGroup(name string, minLon, minLat, maxLon, maxLat float64) mwanachamaactor.Group {
	ring := geo.NewPolygon(geo.Ring{{minLon, minLat}, {maxLon, minLat}, {maxLon, maxLat}, {minLon, maxLat}, {minLon, minLat}})
	return mwanachamaactor.Group{Name: name, Boundary: &ring}
}

func TestInnermostPicksTheSmallestBoundingBox(t *testing.T) {
	groups := []mwanachamaactor.Group{
		boxedGroup("District", 0, 0, 10, 10),
		boxedGroup("Ward", 4, 4, 6, 6),
		boxedGroup("Town", 2, 2, 8, 8),
	}
	if got := innermost(groups).Name; got != "Ward" {
		t.Fatalf("got %q, want Ward", got)
	}
}

func TestInnermostKeepsTheFirstWhenBoxesAreEqual(t *testing.T) {
	groups := []mwanachamaactor.Group{
		boxedGroup("First", 0, 0, 2, 2),
		boxedGroup("Second", 5, 5, 7, 7),
	}
	if got := innermost(groups).Name; got != "First" {
		t.Fatalf("got %q, want First", got)
	}
}

func TestInnermostOfOneGroupIsThatGroup(t *testing.T) {
	if got := innermost([]mwanachamaactor.Group{boxedGroup("Only", 0, 0, 1, 1)}).Name; got != "Only" {
		t.Fatalf("got %q", got)
	}
}
