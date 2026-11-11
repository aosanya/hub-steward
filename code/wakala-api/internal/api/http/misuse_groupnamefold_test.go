package http

import (
	"net/http"
	"testing"

	"gorm.io/gorm"
)

const takenGroupName = "Kertváros körzet"

type groupNameTwin struct {
	label string
	name  string
}

func groupNameTwins() []groupNameTwin {
	return []groupNameTwin{
		{"full-width Latin letters", "Ｋertváros körzet"},
		{"full-width word", "Kertváros ｋöｒｚｅｔ"},
		{"trailing dot", "Kertváros körzet."},
		{"trailing dots", "Kertváros körzet..."},
		{"trailing space", "Kertváros körzet "},
		{"trailing non-breaking space", "Kertváros körzet\u00a0"},
		{"trailing dot then space", "Kertváros körzet. "},
		{"doubled inner space", "Kertváros  körzet"},
		{"non-breaking inner space", "Kertváros\u00a0körzet"},
		{"ideographic inner space", "Kertváros\u3000körzet"},
		{"em inner space", "Kertváros\u2003körzet"},
		{"full-width trailing full stop", "Kertváros körzet．"},
	}
}

func groupNamesThatStayApart() []string {
	return []string{"Kertváros körzet 2", "Kertváros. körzet", "Kertváros körzet ház", ".Kertváros körzet"}
}

func (w stepRunWalk) groupNameFoldHolds(t *testing.T) {
	t.Helper()
	base := "/instances/" + w.instance + "/actor"
	w.createdID(t, base+"/groups", map[string]any{"name": takenGroupName})
	mover := w.createdID(t, base+"/groups", map[string]any{"name": "Malomsor körzet"})
	for _, variant := range groupNameTwins() {
		label, twin := variant.label, variant.name
		if rec := w.call(t, "POST", base+"/groups", map[string]any{"name": twin}, w.owner); rec.Code != http.StatusConflict {
			t.Errorf("create a group named with %s %q: %d %s, want 409", label, twin, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "PATCH", base+"/groups/"+mover, map[string]any{"name": twin}, w.owner); rec.Code != http.StatusConflict {
			t.Errorf("rename a group to a name with %s %q: %d %s, want 409", label, twin, rec.Code, rec.Body.String())
		}
	}
	for _, apart := range groupNamesThatStayApart() {
		if rec := w.call(t, "POST", base+"/groups", map[string]any{"name": apart}, w.owner); rec.Code != http.StatusCreated {
			t.Errorf("create a group named %q: %d %s, want 201", apart, rec.Code, rec.Body.String())
		}
	}
}

func TestGroupNames_OwnerCannotDoNameASecondGroupWithWidthDotOrSpaceVariantsOfATakenName(t *testing.T) {
	newStepRunWalk(t, nil).groupNameFoldHolds(t)
}

func TestGroupNames_OwnerCannotDoNameASecondGroupWithWidthDotOrSpaceVariantsOfATakenNameOnPostgres(t *testing.T) {
	var db *gorm.DB = localPostgresOrSkip(t)
	newStepRunWalkOn(t, db, nil).groupNameFoldHolds(t)
}

func TestGroupNames_OwnerCannotDoCreateOrRenameThroughMCPToAVariantOfATakenName(t *testing.T) {
	w := newDesignAgentWalk(t)
	created := w.mcpCall(t, "test-owner", "actor_create_group", map[string]any{"instance_id": w.instance, "name": takenGroupName})
	if created.IsError {
		t.Fatalf("create the first group through MCP: %+v", created.Content)
	}
	for _, variant := range groupNameTwins() {
		label, twin := variant.label, variant.name
		if out := w.mcpCall(t, "test-owner", "actor_create_group", map[string]any{"instance_id": w.instance, "name": twin}); !out.IsError {
			t.Errorf("MCP create of a group named with %s %q: succeeded, want a tool error", label, twin)
		}
	}
}
