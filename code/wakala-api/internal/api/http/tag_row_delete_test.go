package http

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

type tagDeleteAnswer struct {
	Groups int `json:"groups"`
	Rows   int `json:"rows"`
}

func (w reachWalk) deleteTag(t *testing.T, tagID string) (int, tagDeleteAnswer) {
	t.Helper()
	rec := w.call(t, "DELETE", "/instances/"+w.instance+"/tags/"+tagID, nil, w.owner)
	var answer tagDeleteAnswer
	_ = json.Unmarshal(rec.Body.Bytes(), &answer)
	return rec.Code, answer
}

func TestATagCarriedByCurrentRowsIsNotDeletedAndTheRefusalCountsThem(t *testing.T) {
	w := newReachWalk(t)
	w.seedTagged(t, "Emea one", "emea")
	w.seedTagged(t, "Emea two", "emea")
	w.seedTagged(t, "Apac only", "apac")

	code, answer := w.deleteTag(t, w.tagID(t, "emea"))
	if code != http.StatusConflict {
		t.Fatalf("delete of a tag two rows carry: %d, want 409", code)
	}
	if answer.Rows != 2 || answer.Groups != 0 {
		t.Errorf("refusal counts %+v, want 2 rows and 0 groups", answer)
	}
}

func TestATagCarriedByAReplacedRowAndItsCorrectionCountsBoth(t *testing.T) {
	w := newReachWalk(t)
	replaced := w.seedTagged(t, "Apac only", "apac")
	if _, err := w.manager.CreateRecordRow(context.Background(), agencymodels.RecordRow{
		DraftID: w.liveID, RecordID: w.record.ID, RoleID: w.record.RoleID, AddedBy: "seed",
		Answers: map[string]string{"Tender": "Apac corrected"}, Replaces: replaced.ID,
	}); err != nil {
		t.Fatalf("seed correction: %v", err)
	}

	code, answer := w.deleteTag(t, w.tagID(t, "apac"))
	if code != http.StatusConflict || answer.Rows != 2 {
		t.Errorf("delete of a tag a replaced row and its correction carry: %d with %+v, want 409 and 2 rows", code, answer)
	}
}

func TestATagNoRowCarriesIsDeleted(t *testing.T) {
	w := newReachWalk(t)
	w.seedTagged(t, "Emea only", "emea")
	spare := w.tagID(t, "spare")

	if code, _ := w.deleteTag(t, spare); code != http.StatusOK {
		t.Errorf("delete of a tag nothing carries: %d, want 200", code)
	}
}

func TestATagCarriedByARowAndAGroupCountsBoth(t *testing.T) {
	w := newReachWalk(t)
	w.seedTagged(t, "Emea only", "emea")
	w.groupCarrying(t, "EMEA", "emea")

	code, answer := w.deleteTag(t, w.tagID(t, "emea"))
	if code != http.StatusConflict || answer.Rows != 1 || answer.Groups != 1 {
		t.Errorf("delete: %d with %+v, want 409 with 1 row and 1 group", code, answer)
	}
}
