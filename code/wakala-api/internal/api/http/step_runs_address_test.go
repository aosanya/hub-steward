package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
	mwanachamadigitaltwin "wakalaserver/modules/digitaltwin"
)

func addressWalk(t *testing.T, allowFreeText bool) (stepRunWalk, string) {
	t.Helper()
	w := newStepRunWalk(t, []stepSpec{
		{title: "Report", form: "Report form", role: "Volunteer", questions: []agencymodels.StepQuestion{
			{Prompt: "Street", AnswerType: agencymodels.AnswerAddress, Required: true, AllowFreeText: allowFreeText},
			{Prompt: "Reason", AnswerType: agencymodels.AnswerFreeText},
		}},
	}, "Volunteer")
	twin, err := w.deps.Registry.TwinManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("TwinManager: %v", err)
	}
	held, err := twin.CreateAddress(context.Background(), mwanachamadigitaltwin.Address{Street: "Fő tér", Number: "2"})
	if err != nil {
		t.Fatalf("CreateAddress: %v", err)
	}
	return w, held.ID
}

func (w stepRunWalk) savedPlaceRefs(t *testing.T) map[string]string {
	t.Helper()
	ctx := context.Background()
	m, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	drafts, err := draftsOfEveryPublication(ctx, m)
	if err != nil {
		t.Fatalf("drafts: %v", err)
	}
	var rows []agencymodels.RecordRow
	for _, id := range drafts {
		found, err := m.ListRecordRows(ctx, id, mwanachamaagency.RecordRowFilter{})
		if err != nil {
			t.Fatalf("ListRecordRows: %v", err)
		}
		rows = append(rows, found...)
	}
	if len(rows) == 0 {
		t.Fatal("no row was saved")
	}
	return rows[len(rows)-1].PlaceRefs
}

func TestAnAddressAnswerKeepsItsPlaceReferenceBesideTheWords(t *testing.T) {
	w, id := addressWalk(t, false)
	code, body := w.send(t, map[string]any{
		"answers":    map[string]any{"Street": "Fő tér 2"},
		"place_refs": map[string]string{"Street": "address:" + id},
	})
	if code != http.StatusCreated {
		t.Fatalf("submit: %d %s", code, body)
	}
	if got := w.savedAnswer(t, "Street"); got != "Fő tér 2" {
		t.Errorf("saved words %q, want %q", got, "Fő tér 2")
	}
	if got := w.savedPlaceRefs(t)["Street"]; got != "address:"+id {
		t.Errorf("saved place reference %q, want %q", got, "address:"+id)
	}
}

func TestAStreetReferenceIsAcceptedWhenTheTownHoldsAnAddressOnIt(t *testing.T) {
	w, _ := addressWalk(t, false)
	code, body := w.send(t, map[string]any{
		"answers":    map[string]any{"Street": "Fő tér"},
		"place_refs": map[string]string{"Street": "street:Fő tér"},
	})
	if code != http.StatusCreated {
		t.Fatalf("submit: %d %s", code, body)
	}
}

func TestAPlaceReferenceTheTownDoesNotHoldIsRefused(t *testing.T) {
	for name, ref := range map[string]string{
		"an address that is not held":  "address:nowhere",
		"a street with no address":     "street:Nincs utca",
		"a reference of no known kind": "house:1",
	} {
		t.Run(name, func(t *testing.T) {
			w, _ := addressWalk(t, false)
			code, body := w.send(t, map[string]any{
				"answers":    map[string]any{"Street": "Anywhere"},
				"place_refs": map[string]string{"Street": ref},
			})
			if code != http.StatusBadRequest {
				t.Fatalf("submit: %d %s, want 400", code, body)
			}
		})
	}
}

func TestAPlaceReferenceOnAQuestionThatIsNotAnAddressIsRefused(t *testing.T) {
	w, id := addressWalk(t, true)
	code, body := w.send(t, map[string]any{
		"answers":    map[string]any{"Street": "Fő tér 2", "Reason": "Because"},
		"place_refs": map[string]string{"Reason": "address:" + id},
	})
	if code != http.StatusBadRequest {
		t.Fatalf("submit: %d %s, want 400", code, body)
	}
}

func TestAPlaceReferenceForAPromptTheStepDoesNotAskIsRefused(t *testing.T) {
	w, id := addressWalk(t, true)
	code, body := w.send(t, map[string]any{
		"answers":    map[string]any{"Street": "Fő tér 2"},
		"place_refs": map[string]string{"Nothing asked": "address:" + id},
	})
	if code != http.StatusBadRequest {
		t.Fatalf("submit: %d %s, want 400", code, body)
	}
}

func TestAnAddressTypedAsWordsIsRefusedUnlessTheQuestionAllowsFreeText(t *testing.T) {
	cases := []struct {
		name  string
		allow bool
		want  int
	}{
		{"free text not allowed", false, http.StatusBadRequest},
		{"free text allowed", true, http.StatusCreated},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w, _ := addressWalk(t, c.allow)
			code, body := w.send(t, map[string]any{"answers": map[string]any{"Street": "Behind the mill"}})
			if code != c.want {
				t.Fatalf("submit: %d %s, want %d", code, body, c.want)
			}
		})
	}
}
