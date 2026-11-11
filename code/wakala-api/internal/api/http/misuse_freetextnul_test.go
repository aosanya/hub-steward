package http

import (
	"context"
	"net/http"
	"testing"
	"time"

	"wakalaserver/internal/agencies"
	mwanachamaactor "wakalaserver/modules/actor"
)

type freeTextWalk struct {
	stepRunWalk
	forms    string
	polls    string
	groupID  string
	resident *http.Cookie
	closes   string
	opens    string
}

func newFreeTextWalk(t *testing.T) freeTextWalk {
	t.Helper()
	w := newStepRunWalk(t, nil)
	ctx := context.Background()
	directory, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	actor, err := directory.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Wren"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, actor.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	group, err := directory.CreateGroup(ctx, mwanachamaactor.Group{Name: "Kertváros"})
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	if _, err := directory.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: actor.ID, GroupID: group.ID}); err != nil {
		t.Fatalf("AssignGroup: %v", err)
	}
	return freeTextWalk{
		stepRunWalk: w, forms: "/instances/" + w.instance + "/forms/forms", polls: "/instances/" + w.instance + "/voting/polls",
		groupID: group.ID, resident: w.cookieFor(t, actor.ID),
		closes: time.Now().Add(48 * time.Hour).UTC().Format(time.RFC3339),
		opens:  time.Now().Add(-time.Hour).UTC().Format(time.RFC3339),
	}
}

func (w freeTextWalk) formBody(extra map[string]any) map[string]any {
	body := map[string]any{
		"title": "Ward consultation", "closes_at": w.closes, "originator_chapter_id": w.groupID,
		"audience": "member", "collection_mode": "self",
	}
	for k, v := range extra {
		body[k] = v
	}
	return body
}

func (w freeTextWalk) pollBody(question string, labels ...string) map[string]any {
	choices := make([]map[string]any, len(labels))
	for i, label := range labels {
		choices[i] = map[string]any{"label": label}
	}
	return map[string]any{
		"question": question, "mode": "one", "per_group": "once", "group_ids": []string{w.groupID},
		"opens_at": w.opens, "closes_at": w.closes, "choices": choices,
	}
}

func (w freeTextWalk) created(t *testing.T, path string, body map[string]any) map[string]any {
	t.Helper()
	rec := w.call(t, "POST", path, body, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST %s: %d %s, want 201", path, rec.Code, rec.Body.String())
	}
	return decodeObject(t, rec)
}

func TestFreeText_ControlBytesInFormsAndPollsAreRefusedWith400(t *testing.T) {
	w := newFreeTextWalk(t)
	form := w.created(t, w.forms, w.formBody(nil))
	formID, _ := form["id"].(string)
	choiceQuestion := w.created(t, w.forms+"/"+formID+"/questions", map[string]any{"prompt": "Which", "answer_type": "single_choice"})
	choiceQuestionID, _ := choiceQuestion["question"].(map[string]any)["id"].(string)
	poll := w.created(t, w.polls, w.pollBody("Bench colour", "green", "blue"))
	pollID, _ := poll["id"].(string)

	bad := map[string]string{"nul": "a\u0000b", "bell": "a\u0007b", "escape": "a\u001bb"}
	for label, text := range bad {
		refused := map[string]struct {
			path string
			body map[string]any
		}{
			"form language":         {w.forms, w.formBody(map[string]any{"language": text})},
			"question prompt":       {w.forms + "/" + formID + "/questions", map[string]any{"prompt": text, "answer_type": "free_text"}},
			"question unit_label":   {w.forms + "/" + formID + "/questions", map[string]any{"prompt": "How many", "answer_type": "number", "unit_label": text}},
			"option label":          {w.forms + "/" + formID + "/questions/" + choiceQuestionID + "/options", map[string]any{"label": text}},
			"poll question":         {w.polls, w.pollBody(text, "green", "blue")},
			"poll choice at create": {w.polls, w.pollBody("Bench colour", text, "blue")},
			"poll choice added":     {w.polls + "/" + pollID + "/choices", map[string]any{"label": text}},
		}
		for field, c := range refused {
			rec := w.call(t, "POST", c.path, c.body, w.owner)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("%s: %s with %q answered %d %s, want 400", label, field, text, rec.Code, rec.Body.String())
			}
		}
	}

	for field, c := range map[string]struct {
		path string
		body map[string]any
	}{
		"form language":        {w.forms, w.formBody(map[string]any{"language": "hu"})},
		"question prompt":      {w.forms + "/" + formID + "/questions", map[string]any{"prompt": "Mi a véleménye?\nKérjük, írja le.", "answer_type": "free_text"}},
		"option label":         {w.forms + "/" + formID + "/questions/" + choiceQuestionID + "/options", map[string]any{"label": "Árvíztűrő"}},
		"poll question":        {w.polls, w.pollBody("Melyik színű legyen a pad?", "zöld", "kék")},
		"poll choice added":    {w.polls + "/" + pollID + "/choices", map[string]any{"label": "piros"}},
		"question with a tab":  {w.forms + "/" + formID + "/questions", map[string]any{"prompt": "Utca\tszám", "answer_type": "free_text"}},
		"question with return": {w.forms + "/" + formID + "/questions", map[string]any{"prompt": "Utca\r\nszám", "answer_type": "free_text"}},
	} {
		if rec := w.call(t, "POST", c.path, c.body, w.owner); rec.Code != http.StatusCreated {
			t.Errorf("control %s answered %d %s, want 201", field, rec.Code, rec.Body.String())
		}
	}
}

func TestFreeText_ControlBytesInAResidentsAnswerAreRefusedWith400(t *testing.T) {
	w := newFreeTextWalk(t)
	form := w.created(t, w.forms, w.formBody(nil))
	formID, _ := form["id"].(string)
	question := w.created(t, w.forms+"/"+formID+"/questions", map[string]any{"prompt": "Your view", "answer_type": "free_text"})
	questionID, _ := question["question"].(map[string]any)["id"].(string)
	w.created(t, w.forms+"/"+formID+"/targets", map[string]any{"chapter_id": w.groupID})
	if rec := w.call(t, "POST", w.forms+"/"+formID+"/publish", map[string]any{}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("publish: %d %s", rec.Code, rec.Body.String())
	}
	answer := func(text string) int {
		body := map[string]any{"answers": []map[string]any{{"question_id": questionID, "value_text": text}}}
		return w.call(t, "POST", w.forms+"/"+formID+"/answers", body, w.resident).Code
	}

	for label, text := range map[string]string{"nul": "a\u0000b", "bell": "a\u0007b", "escape": "a\u001bb", "delete": "a\u007fb"} {
		if code := answer(text); code != http.StatusBadRequest {
			t.Errorf("%s: answer %q answered %d, want 400", label, text, code)
		}
	}
	for label, text := range map[string]string{
		"hungarian":     "Árvíztűrő tükörfúrógép",
		"several lines": "Kertváros\nMalom utca 4.\r\nBelváros",
		"tab":           "Malom utca\t4.",
		"markup":        "<script>alert(1)</script>",
	} {
		if code := answer(text); code != http.StatusOK {
			t.Errorf("control %s: answer %q answered %d, want 200", label, text, code)
		}
	}
}

func TestFreeText_ControlBytesInAStrangersIdentifiersAtThePublicDoorAreRefusedWith400(t *testing.T) {
	p := newDeclaredGroupProbe(t)
	nul := "a\u0000b"
	registered := p.stranger(t, p.door+"/respondents", map[string]any{})
	respondent := decodeObject(t, registered)

	if rec := p.stranger(t, p.door+"/respondents", map[string]any{"public_key": nul}); rec.Code != http.StatusBadRequest {
		t.Errorf("registering with a public_key holding a NUL byte: %d %s, want 400", rec.Code, rec.Body.String())
	}
	if rec := p.stranger(t, p.door+"/respondents/claim", map[string]any{"public_key": nul}); rec.Code != http.StatusBadRequest && rec.Code != http.StatusUnauthorized {
		t.Errorf("claiming with a public_key holding a NUL byte: %d %s, want 400 or 401", rec.Code, rec.Body.String())
	}
	for field, body := range map[string]map[string]any{
		"respondent_id":       {"respondent_id": nul, "public_key": respondent["public_key"]},
		"public_key":          {"respondent_id": respondent["id"], "public_key": nul},
		"declared_chapter_id": {"respondent_id": respondent["id"], "public_key": respondent["public_key"], "declared_chapter_id": nul},
	} {
		if rec := p.stranger(t, p.door+"/declarations", body); rec.Code != http.StatusBadRequest {
			t.Errorf("declaring with %s holding a NUL byte: %d %s, want 400", field, rec.Code, rec.Body.String())
		}
	}
}

func TestFreeText_ControlBytesInTheCatalogsStaffNotesAreRefusedWith400(t *testing.T) {
	w := newFreeTextWalk(t)
	catalog := "/instances/" + w.instance + "/forms-catalog"
	raised := w.created(t, catalog+"/raised-items", map[string]any{"title": "Lyuk az úton", "topic": "roads"})
	raisedID, _ := raised["id"].(string)
	board := w.created(t, catalog+"/board-items", map[string]any{"title": "Utak"})
	boardID, _ := board["id"].(string)

	type call struct {
		method, path string
		body         map[string]any
		ok           int
	}
	cases := map[string]func(text string) call{
		"board outcome": func(text string) call {
			return call{"PUT", catalog + "/board-items/" + boardID + "/outcome", map[string]any{"outcome": text}, http.StatusNoContent}
		},
		"raised department": func(text string) call {
			return call{"PUT", catalog + "/raised-items/" + raisedID + "/department", map[string]any{"department": text}, http.StatusNoContent}
		},
		"setting value": func(text string) call {
			return call{"PUT", catalog + "/settings/greeting", map[string]any{"value": text}, http.StatusOK}
		},
		"run summary": func(text string) call {
			return call{"POST", catalog + "/runs", map[string]any{"summary": text}, http.StatusCreated}
		},
	}
	for field, build := range cases {
		for label, text := range map[string]string{"nul": "a\u0000b", "bell": "a\u0007b"} {
			c := build(text)
			if rec := w.call(t, c.method, c.path, c.body, w.owner); rec.Code != http.StatusBadRequest {
				t.Errorf("%s: %s with %q answered %d %s, want 400", label, field, text, rec.Code, rec.Body.String())
			}
		}
		c := build("Elvégezve:\nkátyú befoltozva")
		if rec := w.call(t, c.method, c.path, c.body, w.owner); rec.Code != c.ok {
			t.Errorf("control %s with two lines answered %d %s, want %d", field, rec.Code, rec.Body.String(), c.ok)
		}
	}
}
