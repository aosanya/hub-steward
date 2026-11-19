package http

import "testing"

func TestSeatedRoleKeepsTheModulesOfSelfServiceActions(t *testing.T) {
	visible := seatedModuleVisibility([]string{"digitaltwin.view"})
	for _, module := range []string{"instance", "forms", "actor", "digitaltwin"} {
		if !visible(module) {
			t.Errorf("a seat whose role holds only digitaltwin.view cannot see the %s module, so its own open steps and forms are unknown tools", module)
		}
	}
}

func TestSeatedRoleStillDoesNotSeeModulesItHasNoRightIn(t *testing.T) {
	visible := seatedModuleVisibility([]string{"digitaltwin.view"})
	for _, module := range []string{"accounting", "assetmanager", "taskmanager"} {
		if visible(module) {
			t.Errorf("a seat whose role holds only digitaltwin.view sees the %s module", module)
		}
	}
}

func TestSeatedRoleWithNoPermissionSeesNoModule(t *testing.T) {
	visible := seatedModuleVisibility(nil)
	for _, module := range []string{"instance", "forms", "actor", "digitaltwin"} {
		if visible(module) {
			t.Errorf("a seat whose role holds no permission sees the %s module", module)
		}
	}
}
