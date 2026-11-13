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

type promptedMunicipalityStep struct {
	Code   string `json:"code"`
	Title  string `json:"title"`
	Prompt string `json:"prompt"`
	municipalityStep
}

func isFormKind(kind agencymodels.StepKind) bool {
	return kind == agencymodels.StepKindFillForm || kind == agencymodels.StepKindSendForm
}

func promptedMunicipalitySteps(t *testing.T, path ...string) []promptedMunicipalityStep {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(path...))
	if err != nil {
		t.Fatalf("read %s: %v", filepath.Join(path...), err)
	}
	var file struct {
		WorkItems []promptedMunicipalityStep `json:"work_items"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatalf("decode %s: %v", filepath.Join(path...), err)
	}
	return file.WorkItems
}

func TestEveryFormStepOfTheMunicipalityTemplateHasAPrompt(t *testing.T) {
	path := []string{"..", "..", "..", "..", "..", "..", "hungarian-municipality", "agency", "municipality.en.json"}
	if _, err := os.Stat(filepath.Join(path...)); err != nil {
		t.Skip("municipality.en.json is not present")
	}
	var missing []string
	checked := 0
	for _, s := range promptedMunicipalitySteps(t, path...) {
		if !isFormKind(s.municipalityStep.Kind) || s.FormName == "" || len(s.Questions) == 0 {
			continue
		}
		checked++
		if strings.TrimSpace(s.Prompt) == "" {
			missing = append(missing, s.Code)
		}
	}
	if checked == 0 {
		t.Fatal("municipality.en.json holds no form step with questions")
	}
	if len(missing) > 0 {
		t.Errorf("%d of %d form steps have no prompt: %s", len(missing), checked, strings.Join(missing, ", "))
	}
}

func TestEveryFormStepOfTheImportedMunicipalityShowsItsPromptInTheOpenStepsReply(t *testing.T) {
	path := []string{"..", "..", "..", "..", "..", "demo", "municipality.json"}
	raw, err := os.ReadFile(filepath.Join(path...))
	if err != nil {
		t.Fatalf("read demo/municipality.json: %v", err)
	}
	promptByTitle := map[string]string{}
	for _, s := range promptedMunicipalitySteps(t, path...) {
		if isFormKind(s.municipalityStep.Kind) {
			promptByTitle[s.Title] = s.Prompt
		}
	}

	w := newStepRunWalk(t, nil)
	rec := w.call(t, "POST", "/instances/import", json.RawMessage(raw), w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("import: %d %s", rec.Code, rec.Body.String())
	}
	var result importResult
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode import result: %v", err)
	}
	w.instance, w.draftID = result.Instance.ID, result.DraftID
	w.publish(t)

	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	live, err := liveDraftOf(ctx, mgr)
	if err != nil {
		t.Fatalf("liveDraftOf: %v", err)
	}
	roles, err := mgr.ListRoles(ctx, live, mwanachamaagency.RoleFilter{})
	if err != nil {
		t.Fatalf("ListRoles: %v", err)
	}
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	group := w.call(t, "POST", "/instances/"+w.instance+"/actor/groups", map[string]any{"name": "Staff"}, w.owner)
	if group.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", group.Code, group.Body.String())
	}
	groupID, _ := decodeObject(t, group)["id"].(string)

	shown := map[string]string{}
	for _, role := range roles {
		if role.Deleted {
			continue
		}
		w.roles[role.Name] = role.ID
		member := w.seat(t, mgr, um, groupID, role.Name)
		listed := w.call(t, "GET", "/instances/"+w.instance+"/my-open-steps", nil, member)
		if listed.Code != http.StatusOK {
			t.Fatalf("my-open-steps for %s: %d %s", role.Name, listed.Code, listed.Body.String())
		}
		for _, item := range decodeObjects(t, listed) {
			kind, _ := item["kind"].(string)
			title, _ := item["title"].(string)
			if !isFormKind(agencymodels.StepKind(kind)) {
				continue
			}
			prompt, _ := item["prompt"].(string)
			shown[title] = prompt
		}
	}

	if len(shown) == 0 {
		t.Fatal("no form step came back in any role's open-steps reply")
	}
	var wrong []string
	for title, prompt := range shown {
		want, known := promptByTitle[title]
		if !known {
			t.Errorf("the reply holds the form step %q, which the template does not", title)
			continue
		}
		if prompt != want {
			wrong = append(wrong, title)
		}
	}
	if len(wrong) > 0 {
		t.Errorf("%d of %d form steps show a prompt other than the template's: %s", len(wrong), len(shown), strings.Join(wrong, "; "))
	}
	if len(shown) != len(promptByTitle) {
		t.Errorf("the replies hold %d form steps, the template %d", len(shown), len(promptByTitle))
	}
}
