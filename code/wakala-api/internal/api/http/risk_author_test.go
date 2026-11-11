package http

import (
	"net/http"
	"testing"
)

func TestRiskEvidenceAndAssessmentNameTheSignedInMemberNotTheBody(t *testing.T) {
	w := newStepRunWalk(t, nil)
	path := "/instances/" + w.instance + "/risks"
	post := func(route string, body map[string]any) map[string]any {
		t.Helper()
		rec := w.call(t, "POST", path+route, body, w.owner)
		if rec.Code != http.StatusCreated {
			t.Fatalf("POST %s: %d %s", route, rec.Code, rec.Body.String())
		}
		return decodeObject(t, rec)
	}
	idOf := func(object map[string]any) string {
		id, _ := object["id"].(string)
		return id
	}
	risk := idOf(post("/risks", map[string]any{"title": "Bridge flooding", "top_event": "River floods the footbridge"}))
	threat := idOf(post("/pathways", map[string]any{"risk_id": risk, "side": "threat", "title": "Heavy rain"}))
	control := idOf(post("/controls", map[string]any{"name": "Flood gate"}))
	barrier := idOf(post("/barriers", map[string]any{"risk_id": risk, "pathway_id": threat, "control_id": control}))

	evidence := post("/evidence", map[string]any{"barrier_id": barrier, "kind": "test", "outcome": "pass", "summary": "Gate closed in the drill", "recorded_by": "forged-clerk"})
	assessment := post("/assessments", map[string]any{"risk_id": risk, "kind": "inherent", "likelihood": 3, "impact": 4, "assessed_by": "forged-clerk"})

	if by, _ := evidence["recorded_by"].(string); by != "test-owner" {
		t.Errorf("evidence is recorded by %q; want the signed-in test-owner, never the body's forged-clerk", by)
	}
	if by, _ := assessment["assessed_by"].(string); by != "test-owner" {
		t.Errorf("assessment is rated by %q; want the signed-in test-owner, never the body's forged-clerk", by)
	}
}
