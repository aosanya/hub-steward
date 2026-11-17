package mwanachamaagency

import "testing"

func TestCatalogueActionsAcceptTheActionTheCreatePostRouteReports(t *testing.T) {
	actions := catalogueActions()
	for _, a := range []string{
		"engage.post.create",
		"engage.post.create_notice", "engage.post.create_event", "engage.post.create_volunteer_call",
	} {
		if !actions[a] {
			t.Errorf("a control may name %s, but the scan does not accept it", a)
		}
	}
}

func TestCatalogueActionsStillRefuseAnActionNoPermissionNames(t *testing.T) {
	if catalogueActions()["engage.post.create_nothing"] {
		t.Error("the scan accepts an action no permission names")
	}
}
