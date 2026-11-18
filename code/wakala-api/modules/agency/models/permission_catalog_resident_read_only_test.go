package models

import (
	"slices"
	"testing"
)

func TestPermissionCatalog_OnlyResidentReadCarriesTheActionsThatOpenAResidentsNameAndAddress(t *testing.T) {
	for _, action := range []string{"actor.actor.list", "actor.actor.read", "actor.actor.read_many"} {
		if got := holdersOf(action); !slices.Equal(got, []string{"resident.read"}) {
			t.Errorf("permissions carrying %s = %v, want only resident.read", action, got)
		}
	}
}
