package http

import (
	"net/http"
	"testing"
)

const (
	composedTitle   = "Árvíz űr"
	decomposedTitle = "Árvíz űr"
)

func TestLibraryTitles_OwnerCannotDoTitleASecondHazardOrThreatWithTheOtherSpellingOfATakenTitle(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Liaison")
	base := "/instances/" + w.instance
	for _, kind := range []string{"hazards", "threats"} {
		w.createdID(t, base+"/"+kind, map[string]any{"draft_id": w.draftID, "title": composedTitle})
		rec := w.call(t, "POST", base+"/"+kind, map[string]any{"draft_id": w.draftID, "title": decomposedTitle}, w.owner)
		if rec.Code != http.StatusConflict {
			t.Errorf("create a %s titled with combining marks: %d %s, want 409", kind, rec.Code, rec.Body.String())
		}
		mover := w.createdID(t, base+"/"+kind, map[string]any{"draft_id": w.draftID, "title": "Mas"})
		rec = w.call(t, "PATCH", base+"/"+kind+"/"+mover, map[string]any{"title": decomposedTitle}, w.owner)
		if rec.Code != http.StatusConflict {
			t.Errorf("retitle a %s onto the other spelling: %d %s, want 409", kind, rec.Code, rec.Body.String())
		}
	}
}

func TestScenarioActorNames_OwnerCannotDoNameASecondActorWithTheOtherSpellingOfATakenName(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Liaison")
	base := "/instances/" + w.instance
	scenarioID := w.createdID(t, base+"/scenarios", map[string]any{"draft_id": w.draftID, "name": "Referral arrives", "workflow_id": w.workflow})
	actors := base + "/scenarios/" + scenarioID + "/actors"
	role := w.roles["Liaison"]
	w.createdID(t, actors, map[string]any{"name": "Ráckeve Ödön", "role_id": role})
	rec := w.call(t, "POST", actors, map[string]any{"name": "Ráckeve Ödön", "role_id": role}, w.owner)
	if rec.Code != http.StatusConflict {
		t.Errorf("add an actor named with combining marks: %d %s, want 409", rec.Code, rec.Body.String())
	}
	mover := w.createdID(t, actors, map[string]any{"name": "Anna", "role_id": role})
	rec = w.call(t, "PATCH", actors+"/"+mover, map[string]any{"name": "Ráckeve Ödön"}, w.owner)
	if rec.Code != http.StatusConflict {
		t.Errorf("rename an actor onto the other spelling: %d %s, want 409", rec.Code, rec.Body.String())
	}
}
