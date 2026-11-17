package models

import "testing"

func TestPermissionCatalog_ControlsEditCanReadWhatItEdits(t *testing.T) {
	requirePermissionCarries(t, "controls.edit",
		"agency.hazard.list", "agency.hazard.read",
		"agency.threat.list", "agency.threat.read",
		"agency.consequence.list", "agency.consequence.read",
		"agency.risk_threat.list", "agency.risk_consequence.list")
}
