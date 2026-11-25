package agencies

import (
	"testing"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
)

func seatOf(kind mwanachamaactor.RoleKind) LiveSeat {
	return LiveSeat{Kind: kind}
}

func TestFirstGroupAdministration_OnlyTheUnboundAdministratorKindCarriesTheDefault(t *testing.T) {
	cases := []struct {
		name string
		kind mwanachamaactor.RoleKind
		want bool
	}{
		{"the Administrator kind the first group creates", mwanachamaactor.RoleKind{Name: FirstGroupRoleKindName}, true},
		{"an Administrator kind bound to a published role", mwanachamaactor.RoleKind{Name: FirstGroupRoleKindName, DefinitionRoleID: "R-1"}, false},
		{"another kind with no published role", mwanachamaactor.RoleKind{Name: "Treasurer"}, false},
		{"a kind bound to a published role", mwanachamaactor.RoleKind{Name: "Treasurer", DefinitionRoleID: "R-2"}, false},
	}
	for _, c := range cases {
		if got := IsFirstGroupAdministration(seatOf(c.kind)); got != c.want {
			t.Errorf("%s: %v, want %v", c.name, got, c.want)
		}
	}
}
