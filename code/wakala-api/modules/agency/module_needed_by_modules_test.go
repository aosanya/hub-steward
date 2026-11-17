package mwanachamaagency

import (
	"encoding/json"
	"testing"

	"wakalaserver/modules/agency/models"
)

func neededByModulesOf(t *testing.T, modules []models.Module) map[string]any {
	t.Helper()
	raw, err := json.Marshal(modules)
	if err != nil {
		t.Fatalf("marshal modules: %v", err)
	}
	var decoded []map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("decode modules: %v", err)
	}
	out := make(map[string]any, len(decoded))
	for _, one := range decoded {
		code, _ := one["code"].(string)
		flag, present := one["needed_by_modules"]
		if !present {
			out[code] = "needed_by_modules missing from the module JSON"
			continue
		}
		out[code] = flag
	}
	return out
}

func moduleRows(enabled map[string]bool, locked map[string]bool) []models.Module {
	rows := make([]models.Module, 0, len(enabled))
	for code, on := range enabled {
		rows = append(rows, models.Module{ID: code, Code: code, Enabled: on, Locked: locked[code]})
	}
	return rows
}

func expectFlags(t *testing.T, flags map[string]any, want map[string]bool) {
	t.Helper()
	for code, expected := range want {
		if flags[code] != expected {
			t.Errorf("needed_by_modules of %s = %v, want %v", code, flags[code], expected)
		}
	}
}

func TestWithEffectiveEnabled_FlagsTheModulesAnEnabledModuleRequires(t *testing.T) {
	rows := moduleRows(map[string]bool{"forms": true, "catalog": true, "git": true, "comm": true}, nil)

	flags := neededByModulesOf(t, withEffectiveEnabled(rows, nil))

	expectFlags(t, flags, map[string]bool{"catalog": true, "git": true, "forms": false, "comm": false})
}

func TestWithEffectiveEnabled_FlagsNothingWhenNoEnabledModuleRequiresAnother(t *testing.T) {
	rows := moduleRows(map[string]bool{"forms": false, "catalog": true, "git": true}, nil)

	flags := neededByModulesOf(t, withEffectiveEnabled(rows, nil))

	expectFlags(t, flags, map[string]bool{"catalog": false, "git": false, "forms": false})
}

func TestWithEffectiveEnabled_CountsALockedModuleAsAnEnabledDependent(t *testing.T) {
	rows := moduleRows(map[string]bool{"forms": false, "catalog": false, "git": false}, map[string]bool{"forms": true})

	flags := neededByModulesOf(t, withEffectiveEnabled(rows, nil))

	expectFlags(t, flags, map[string]bool{"catalog": true, "git": true, "forms": false})
}

func TestWithEffectiveEnabled_CountsAModuleAWorkflowStepSwitchesOnAsAnEnabledDependent(t *testing.T) {
	rows := moduleRows(map[string]bool{"forms": false, "catalog": false, "git": false}, nil)

	flags := neededByModulesOf(t, withEffectiveEnabled(rows, map[models.StepKind]bool{"fill_form": true}))

	expectFlags(t, flags, map[string]bool{"catalog": true, "git": true, "forms": false})
}
