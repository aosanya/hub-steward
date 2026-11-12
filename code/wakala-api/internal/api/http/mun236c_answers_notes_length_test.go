package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	agencymodels "wakalaserver/modules/agency/models"
)

var mun236cSizes = []int{1, 1000, 10000, 100000, 1000000}

type mun236cProbe struct {
	surface string
	size    int
	send    func(text string) *httptest.ResponseRecorder
}

func mun236cShort(rec *httptest.ResponseRecorder) string {
	body := strings.TrimSpace(rec.Body.String())
	if len(body) > 120 {
		body = body[:120] + "..."
	}
	return body
}

func mun236cRound(t *testing.T, name string, probes []mun236cProbe) {
	t.Helper()
	accepted, refused := 0, 0
	for _, p := range probes {
		rec := p.send(strings.Repeat("a", p.size))
		t.Logf("%s %d chars -> %d %s", p.surface, p.size, rec.Code, mun236cShort(rec))
		switch {
		case rec.Code >= 500:
			t.Errorf("%s %d chars answered %d %s, want never 5xx", p.surface, p.size, rec.Code, mun236cShort(rec))
		case rec.Code == http.StatusBadRequest || rec.Code == http.StatusRequestEntityTooLarge:
			refused++
			if strings.Contains(rec.Body.String(), "not valid JSON") {
				t.Errorf("%s %d chars is valid JSON but was refused with %d %s, want 413 or an answer that names the length", p.surface, p.size, rec.Code, mun236cShort(rec))
			}
			if strings.TrimSpace(rec.Body.String()) == "" {
				t.Errorf("%s %d chars refused with %d and no reason", p.surface, p.size, rec.Code)
			}
		case rec.Code == http.StatusOK || rec.Code == http.StatusCreated:
			accepted++
		default:
			t.Errorf("%s %d chars answered %d %s, want 2xx, 400 or 413", p.surface, p.size, rec.Code, mun236cShort(rec))
		}
	}
	t.Logf("%s: %d probes, %d accepted, %d refused", name, len(probes), accepted, refused)
}

func TestMUN236c_RoundOneFormAndStepAnswers(t *testing.T) {
	forms := newFreeTextWalk(t)
	form := forms.created(t, forms.forms, forms.formBody(nil))
	formID, _ := form["id"].(string)
	question := forms.created(t, forms.forms+"/"+formID+"/questions", map[string]any{"prompt": "Your view", "answer_type": "free_text"})
	questionID, _ := question["question"].(map[string]any)["id"].(string)
	forms.created(t, forms.forms+"/"+formID+"/targets", map[string]any{"chapter_id": forms.groupID})
	if rec := forms.call(t, "POST", forms.forms+"/"+formID+"/publish", map[string]any{}, forms.owner); rec.Code != http.StatusOK {
		t.Fatalf("publish: %d %s", rec.Code, rec.Body.String())
	}

	plan := []stepSpec{{title: "Describe", form: "Describe", role: "Clerk", questions: []agencymodels.StepQuestion{
		{Prompt: "Notes", AnswerType: agencymodels.AnswerFreeText, Required: true},
	}}}
	steps := newStepRunWalk(t, plan, "Clerk")

	var probes []mun236cProbe
	for _, size := range mun236cSizes {
		probes = append(probes,
			mun236cProbe{"form answer", size, func(text string) *httptest.ResponseRecorder {
				body := map[string]any{"answers": []map[string]any{{"question_id": questionID, "value_text": text}}}
				return forms.call(t, "POST", forms.forms+"/"+formID+"/answers", body, forms.resident)
			}},
			mun236cProbe{"step answer", size, func(text string) *httptest.ResponseRecorder {
				return steps.submit(t, steps.people["Clerk"], "Describe", map[string]string{"Notes": text}, "")
			}},
		)
	}
	mun236cRound(t, "round 1", probes)
}

func TestMUN236c_RoundTwoIssueNotesAndDescriptions(t *testing.T) {
	w := newStepRunWalk(t, nil)
	base := "/instances/" + w.instance + "/taskmanager/tasks"
	created := w.call(t, "POST", base, map[string]any{"title": "Probe issue"}, w.owner)
	if created.Code != http.StatusCreated {
		t.Fatalf("create issue: %d %s", created.Code, created.Body.String())
	}
	taskID, _ := decodeObject(t, created)["id"].(string)

	var probes []mun236cProbe
	for _, size := range mun236cSizes {
		probes = append(probes,
			mun236cProbe{"log note", size, func(text string) *httptest.ResponseRecorder {
				return w.call(t, "POST", base+"/"+taskID+"/notes", map[string]any{"text": text, "kind": "worker"}, w.owner)
			}},
			mun236cProbe{"issue description on create", size, func(text string) *httptest.ResponseRecorder {
				return w.call(t, "POST", base, map[string]any{"title": "Described issue", "description": text}, w.owner)
			}},
		)
	}
	mun236cRound(t, "round 2", probes)
}

func TestMUN236c_RoundThreeIssueDescriptionsOnUpdate(t *testing.T) {
	w := newStepRunWalk(t, nil)
	base := "/instances/" + w.instance + "/taskmanager/tasks"
	created := w.call(t, "POST", base, map[string]any{"title": "Probe issue"}, w.owner)
	if created.Code != http.StatusCreated {
		t.Fatalf("create issue: %d %s", created.Code, created.Body.String())
	}
	taskID, _ := decodeObject(t, created)["id"].(string)

	var probes []mun236cProbe
	for _, size := range mun236cSizes {
		probes = append(probes,
			mun236cProbe{"issue description on patch", size, func(text string) *httptest.ResponseRecorder {
				return w.call(t, "PATCH", base+"/"+taskID, map[string]any{"description": text}, w.owner)
			}},
			mun236cProbe{"issue description on update", size, func(text string) *httptest.ResponseRecorder {
				return w.call(t, "PUT", base+"/"+taskID, map[string]any{"title": "Probe issue", "description": text, "status": "pending"}, w.owner)
			}},
		)
	}
	mun236cRound(t, "round 3", probes)
}

func mun236cNotes(t *testing.T, rec *httptest.ResponseRecorder) []map[string]any {
	t.Helper()
	var wrapped struct {
		Items []map[string]any `json:"items"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &wrapped); err == nil && wrapped.Items != nil {
		return wrapped.Items
	}
	return decodeObjects(t, rec)
}

func TestMUN236c_RoundFourStoredTextComesBackWhole(t *testing.T) {
	w := newStepRunWalk(t, nil)
	base := "/instances/" + w.instance + "/taskmanager/tasks"
	created := w.call(t, "POST", base, map[string]any{"title": "Probe issue"}, w.owner)
	taskID, _ := decodeObject(t, created)["id"].(string)

	for _, size := range []int{1, 1000, 10000, 100000, 500000} {
		text := strings.Repeat("é", size)
		if rec := w.call(t, "POST", base+"/"+taskID+"/notes", map[string]any{"text": text, "kind": "worker"}, w.owner); rec.Code != http.StatusCreated {
			t.Errorf("note of %d characters answered %d %s", size, rec.Code, mun236cShort(rec))
			continue
		}
		listed := mun236cNotes(t, w.call(t, "GET", base+"/"+taskID+"/notes", nil, w.owner))
		last, _ := listed[len(listed)-1]["text"].(string)
		if last != text {
			t.Errorf("note of %d characters came back as %d characters", size, len([]rune(last)))
		}
	}

	described := w.call(t, "PATCH", base+"/"+taskID, map[string]any{"description": strings.Repeat("é", 500000)}, w.owner)
	if got, _ := decodeObject(t, described)["description"].(string); len([]rune(got)) != 500000 {
		t.Errorf("description of 500000 characters came back as %d characters (%d)", len([]rune(got)), described.Code)
	}

	overCap := strings.Repeat("a", maxRequestBody)
	for name, rec := range map[string]*httptest.ResponseRecorder{
		"note over the body cap":        w.call(t, "POST", base+"/"+taskID+"/notes", map[string]any{"text": overCap}, w.owner),
		"description over the body cap": w.call(t, "PATCH", base+"/"+taskID, map[string]any{"description": overCap}, w.owner),
	} {
		t.Logf("%s -> %d %s", name, rec.Code, mun236cShort(rec))
		if rec.Code != http.StatusRequestEntityTooLarge {
			t.Errorf("%s answered %d %s, want 413", name, rec.Code, mun236cShort(rec))
		}
	}
}

func TestMUN236c_RoundFiveFormAnswerComesBackWhole(t *testing.T) {
	forms := newFreeTextWalk(t)
	form := forms.created(t, forms.forms, forms.formBody(nil))
	formID, _ := form["id"].(string)
	question := forms.created(t, forms.forms+"/"+formID+"/questions", map[string]any{"prompt": "Your view", "answer_type": "free_text"})
	questionID, _ := question["question"].(map[string]any)["id"].(string)
	forms.created(t, forms.forms+"/"+formID+"/targets", map[string]any{"chapter_id": forms.groupID})
	if rec := forms.call(t, "POST", forms.forms+"/"+formID+"/publish", map[string]any{}, forms.owner); rec.Code != http.StatusOK {
		t.Fatalf("publish: %d %s", rec.Code, rec.Body.String())
	}

	for _, size := range []int{1, 1000, 10000, 100000, 500000} {
		text := strings.Repeat("ű", size)
		body := map[string]any{"answers": []map[string]any{{"question_id": questionID, "value_text": text}}}
		if rec := forms.call(t, "POST", forms.forms+"/"+formID+"/answers", body, forms.resident); rec.Code != http.StatusOK {
			t.Errorf("answer of %d characters answered %d %s", size, rec.Code, mun236cShort(rec))
			continue
		}
		mine := decodeObjects(t, forms.call(t, "GET", forms.forms+"/"+formID+"/answers/mine", nil, forms.resident))
		stored, _ := mine[0]["value_text"].(string)
		if stored != text {
			t.Errorf("answer of %d characters came back as %d characters", size, len([]rune(stored)))
		}
	}
}
