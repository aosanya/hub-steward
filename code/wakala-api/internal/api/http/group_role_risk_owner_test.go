package http

import (
	"context"
	"slices"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

const riskRecordPermission = "risk.record"

const riskOwnerName = "Risk owner"

var riskRecordActions = []string{
	"riskmanager.evidence.record",
	"riskmanager.action.update",
	"riskmanager.action.set_status",
}

var riskOwnerWrites = map[string]map[string]any{
	"riskmanager_evidence_record": {
		"barrier_id": "no-such-barrier",
		"kind":       "inspection",
		"summary":    "Footbridge drainage inspected",
	},
	"riskmanager_action_update": {
		"action_id": "no-such-action",
		"title":     "Clear the drainage channel",
	},
	"riskmanager_action_set_status": {
		"action_id": "no-such-action",
		"status":    "done",
	},
}

var riskRefusalMarkers = []string{
	"you need the permission",
	"you need a permission",
	"may not perform that action",
}

func isRiskRefusal(text string) bool {
	for _, marker := range riskRefusalMarkers {
		if strings.Contains(text, marker) {
			return true
		}
	}
	return false
}

func (w groupRoleWalk) riskOwnerRole(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	mods, err := mgr.ListModules(ctx, w.draftID, mwanachamaagency.ModuleFilter{})
	if err != nil {
		t.Fatalf("ListModules: %v", err)
	}
	for _, m := range mods {
		if m.Code == riskModule {
			if _, err := mgr.SetModuleEnabled(ctx, w.draftID, m.ID, true); err != nil {
				t.Fatalf("SetModuleEnabled: %v", err)
			}
		}
	}
	held := []string{riskReadPermission, riskRecordPermission, "mount.list"}
	role, err := mgr.CreateRole(ctx, agencymodels.Role{DraftID: w.draftID, Name: riskOwnerName, Permissions: []string{riskReadPermission, "mount.list"}})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}
	w.roles[riskOwnerName] = role.ID
	w.publish(t)
	agencyMountedSets.forget(w.instance)
	before := w.deps.rolePermissionsOverride
	w.deps.rolePermissionsOverride = func(ctx context.Context, roleID string) ([]string, error) {
		if roleID == role.ID {
			return held, nil
		}
		return before(ctx, roleID)
	}
}

func (w groupRoleWalk) callRiskWrite(t *testing.T, subject, tool string) *mcp.CallToolResult {
	t.Helper()
	args := map[string]any{"instance_id": w.instance}
	for k, v := range riskOwnerWrites[tool] {
		args[k] = v
	}
	return w.callTool(t, subject, tool, args)
}

func TestGroupRoleRiskOwner_AResidentHoldingRiskRecordIsNotRefusedTheRecordingTools(t *testing.T) {
	w := newGroupRoleWalk(t)
	w.riskOwnerRole(t)
	id, _ := w.resident(t, "Amina", "Owners")
	w.giveRole(t, "Owners", riskOwnerName)
	for tool := range riskOwnerWrites {
		t.Run(tool, func(t *testing.T) {
			out := w.callRiskWrite(t, id, tool)
			if text := toolErrorText(out); out.IsError && isRiskRefusal(text) {
				t.Fatalf("%s: a resident holding %s was refused: %q", tool, riskRecordPermission, text)
			}
		})
	}
}

func TestGroupRoleRiskOwner_AResidentHoldingOnlyRiskReadIsRefusedTheRecordingTools(t *testing.T) {
	w := newGroupRoleWalk(t)
	w.riskReaderRole(t)
	id, _ := w.resident(t, "Amina", "Analysts")
	w.giveRole(t, "Analysts", riskReaderName)
	for tool := range riskOwnerWrites {
		t.Run(tool, func(t *testing.T) {
			out := w.callRiskWrite(t, id, tool)
			if !out.IsError || !isRiskRefusal(toolErrorText(out)) {
				t.Fatalf("%s: a resident holding only %s got %q (error=%v), want a refusal", tool, riskReadPermission, toolErrorText(out), out.IsError)
			}
		})
	}
}

func TestGroupRoleRiskOwner_TheCatalogueHoldsARiskRecordPermissionWithTheThreeWriteActions(t *testing.T) {
	var found *agencymodels.Permission
	for _, p := range agencymodels.PermissionCatalog() {
		if p.Code == riskRecordPermission {
			found = &p
		}
	}
	if found == nil {
		t.Fatalf("the permissions catalogue has no %s permission", riskRecordPermission)
	}
	if found.Module != riskModule {
		t.Errorf("%s belongs to module %q, want %q", riskRecordPermission, found.Module, riskModule)
	}
	got := slices.Clone(found.Actions)
	want := slices.Clone(riskRecordActions)
	slices.Sort(got)
	slices.Sort(want)
	if !slices.Equal(got, want) {
		t.Errorf("%s holds the actions %v, want exactly %v", riskRecordPermission, got, want)
	}
}
