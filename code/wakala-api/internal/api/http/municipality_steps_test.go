package http

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

type municipalityStep struct {
	Code            string                      `json:"code"`
	Kind            agencymodels.StepKind       `json:"kind"`
	RoleID          string                      `json:"role_id"`
	RecipientRoleID string                      `json:"recipient_role_id"`
	FormName        string                      `json:"form_name"`
	Questions       []agencymodels.StepQuestion `json:"questions"`
}

func municipalitySteps(t *testing.T, path ...string) []municipalityStep {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(path...))
	if err != nil {
		t.Fatalf("read %s: %v", filepath.Join(path...), err)
	}
	var file struct {
		WorkItems []municipalityStep `json:"work_items"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatalf("decode %s: %v", filepath.Join(path...), err)
	}
	return file.WorkItems
}

func TestEveryStepOfTheMunicipalityAgencyHasAKindAndAWhoWhoRunsIt(t *testing.T) {
	templates := map[string][]string{
		"demo/municipality.json": {"..", "..", "..", "..", "..", "demo", "municipality.json"},
		"municipality.en.json":   {"..", "..", "..", "..", "..", "..", "hungarian-municipality", "agency", "municipality.en.json"},
	}
	for name, path := range templates {
		if _, err := os.Stat(filepath.Join(path...)); err != nil && name != "demo/municipality.json" {
			continue
		}
		for _, s := range municipalitySteps(t, path...) {
			switch {
			case s.Kind == "":
				t.Errorf("%s: step %s has no kind", name, s.Code)
			case s.Kind.AgencyOnly() && s.RoleID != "":
				t.Errorf("%s: step %s is the agency's own but names role %s", name, s.Code, s.RoleID)
			case s.Kind == agencymodels.StepKindSendForm && s.RecipientRoleID == "":
				t.Errorf("%s: step %s sends a form to no one", name, s.Code)
			case !s.Kind.AgencyOnly() && s.RoleID == "":
				t.Errorf("%s: step %s has no role, so nobody can run it", name, s.Code)
			}
			if (s.Kind == agencymodels.StepKindFillForm || s.Kind == agencymodels.StepKindSendForm) && (s.FormName == "" || len(s.Questions) == 0) {
				t.Errorf("%s: step %s has no form to answer", name, s.Code)
			}
		}
	}
}

func TestOncePublishedEveryStepOfWorkflowsFourAndFiveRunsAndTheSheetsRoundForks(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "..", "..", "demo", "municipality.json"))
	if err != nil {
		t.Fatalf("read demo/municipality.json: %v", err)
	}
	walk := newStepRunWalk(t, nil)
	rec := walk.call(t, "POST", "/instances/import", json.RawMessage(raw), walk.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("import: %d %s", rec.Code, rec.Body.String())
	}
	var result importResult
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode import result: %v", err)
	}
	walk.instance, walk.draftID = result.Instance.ID, result.DraftID
	walk.publish(t)

	ctx := context.Background()
	mgr, err := walk.deps.Registry.AgencyManager(ctx, walk.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	live, err := liveDraftOf(ctx, mgr)
	if err != nil {
		t.Fatalf("liveDraftOf: %v", err)
	}
	workflows, _ := mgr.ListWorkflows(ctx, live, mwanachamaagency.WorkflowFilter{})
	steps, _ := mgr.ListWorkItems(ctx, live, mwanachamaagency.WorkItemFilter{})
	records, _ := mgr.ListRecords(ctx, live, mwanachamaagency.RecordFilter{})
	chains := formStepsByWorkflow(steps, records)

	byCode := map[string]string{}
	for _, wf := range workflows {
		byCode[wf.Name] = wf.ID
	}
	for _, name := range []string{"Az eredménytől a döntésen át a visszajelzésig", "Az ügyintézés háttere"} {
		if got := len(chains[byCode[name]]); got != 5 {
			t.Errorf("%q runs %d steps once published, want 5", name, got)
		}
	}
	sheets := chains[byCode["Kör papíron, telefonon vagy személyesen"]]
	forked := 0
	var sentForm bool
	for _, link := range sheets {
		if link.step.Kind == agencymodels.StepKindSendForm {
			sentForm = true
		}
		if len(link.routedBy) > 0 {
			forked++
		}
	}
	if !sentForm || forked != 3 {
		t.Errorf("the sheets round chain holds the sent form %v and %d forked recording steps, want true and 3", sentForm, forked)
	}
}

func TestTheMayorsReasonStepsAskForAReasonInTheMayorsOwnName(t *testing.T) {
	path := []string{"..", "..", "..", "..", "..", "..", "hungarian-municipality", "agency", "municipality.en.json"}
	if _, err := os.Stat(filepath.Join(path...)); err != nil {
		t.Skip("municipality.en.json is not present")
	}
	steps := municipalitySteps(t, path...)
	for _, code := range []string{"WI-43-3", "WI-26-5", "WI-31-6"} {
		found := false
		for _, s := range steps {
			if s.Code != code {
				continue
			}
			found = true
			asksForReason := false
			for _, q := range s.Questions {
				if q.AnswerType == agencymodels.AnswerFreeText && q.Required && strings.HasPrefix(q.Prompt, "Your reason, in your own name") {
					asksForReason = true
				}
			}
			if !asksForReason {
				t.Errorf("%s has no required free-text question starting with %q", code, "Your reason, in your own name")
			}
		}
		if !found {
			t.Errorf("%s is not in the template", code)
		}
	}
}
