package models

import (
	"slices"
	"testing"
)

const settingReadAction = "catalog.setting.read"

func TestPermissionCatalog_AssetManageReadsTheAssetConditionsSetting(t *testing.T) {
	manage, ok := LookupPermission("asset.manage")
	if !ok {
		t.Fatal("catalogue lacks asset.manage")
	}
	if !slices.Contains(manage.Actions, settingReadAction) {
		t.Errorf("asset.manage actions = %v, want %s so staff read the asset_conditions setting", manage.Actions, settingReadAction)
	}
}

func TestPermissionCatalog_OnlyAssetManageGainsTheSettingRead(t *testing.T) {
	for _, code := range []string{"member.read", "member.edit", "asset.view", "digitaltwin.view", "accounting.manage"} {
		other, found := LookupPermission(code)
		if found && slices.Contains(other.Actions, settingReadAction) {
			t.Errorf("%s also holds %s, so a role without asset.manage would read the setting", code, settingReadAction)
		}
	}
}
