package http

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type declareWardsProbe struct {
	walk   stepRunWalk
	door   string
	forms  string
	formID string
}

func (p declareWardsProbe) stranger(t *testing.T, path string, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	out := httptest.NewRecorder()
	p.walk.handler.ServeHTTP(out, req)
	return out
}

func (p declareWardsProbe) respondent(t *testing.T) map[string]any {
	t.Helper()
	registered := p.stranger(t, p.door+"/respondents", map[string]any{})
	if registered.Code != http.StatusOK {
		t.Fatalf("registering: %d %s", registered.Code, registered.Body.String())
	}
	return decodeObject(t, registered)
}

func (p declareWardsProbe) declare(t *testing.T, who map[string]any, key any, group string) *httptest.ResponseRecorder {
	t.Helper()
	return p.stranger(t, p.door+"/declarations", map[string]any{
		"respondent_id": who["id"], "public_key": key, "declared_chapter_id": group,
	})
}

func (p declareWardsProbe) ward(t *testing.T, name string) string {
	t.Helper()
	rec := p.walk.call(t, "POST", "/instances/"+p.walk.instance+"/actor/groups", map[string]any{"name": name}, p.walk.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create ward %s: %d %s", name, rec.Code, rec.Body.String())
	}
	id, _ := decodeObject(t, rec)["id"].(string)
	return id
}

func (p declareWardsProbe) declaredWard(t *testing.T, respondentID string) string {
	t.Helper()
	rec := p.walk.call(t, "GET", p.forms+"/forms/"+p.formID+"/declarations", nil, p.walk.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("listing declarations: %d %s", rec.Code, rec.Body.String())
	}
	var rows []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &rows); err != nil {
		t.Fatalf("declarations body: %v", err)
	}
	for _, row := range rows {
		if row["respondent_id"] == respondentID {
			ward, _ := row["declared_chapter_id"].(string)
			return ward
		}
	}
	return ""
}

func newDeclareWardsProbe(t *testing.T) declareWardsProbe {
	t.Helper()
	w := newStepRunWalk(t, nil)
	p := declareWardsProbe{walk: w, forms: "/instances/" + w.instance + "/forms"}
	p.door = p.forms + "/public-links/declare-wards-key"
	closes := time.Now().Add(48 * time.Hour).UTC().Format(time.RFC3339)
	rec := w.call(t, "POST", p.forms+"/forms", map[string]any{"title": "Street survey", "audience": "public", "closes_at": closes}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create form: %d %s", rec.Code, rec.Body.String())
	}
	p.formID, _ = decodeObject(t, rec)["id"].(string)
	if rec := w.call(t, "POST", p.forms+"/forms/"+p.formID+"/publish", map[string]any{"candidate_link_key": "declare-wards-key"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("publish form: %d %s", rec.Code, rec.Body.String())
	}
	return p
}

func TestPublicFormDoor_StrangerCannotDeclareAHiddenGroup(t *testing.T) {
	p := newDeclareWardsProbe(t)
	listed := p.ward(t, "Kertváros")
	hidden := p.ward(t, "Council committee")
	directory, err := p.walk.deps.Registry.ActorManager(context.Background(), p.walk.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	if _, err := directory.SetGroupHidden(context.Background(), hidden, true); err != nil {
		t.Fatalf("hide group: %v", err)
	}
	who := p.respondent(t)

	if got := p.declare(t, who, who["public_key"], listed); got.Code != http.StatusCreated {
		t.Fatalf("declaring a listed ward: %d %s, want 201", got.Code, got.Body.String())
	}
	other := p.respondent(t)
	if got := p.declare(t, other, other["public_key"], hidden); got.Code != http.StatusBadRequest {
		t.Fatalf("declaring a hidden group: %d %s, want 400", got.Code, got.Body.String())
	}
	if got := p.declaredWard(t, other["id"].(string)); got != "" {
		t.Fatalf("a refused declaration left ward %q behind", got)
	}
}

func TestPublicFormDoor_SecondDeviceCannotOverwriteTheDeclaredWard(t *testing.T) {
	p := newDeclareWardsProbe(t)
	first, second := p.ward(t, "Kertváros"), p.ward(t, "Belváros")
	who := p.respondent(t)
	if got := p.declare(t, who, who["public_key"], first); got.Code != http.StatusCreated {
		t.Fatalf("first declaration: %d %s", got.Code, got.Body.String())
	}
	stranger := p.respondent(t)
	for name, key := range map[string]any{
		"no key":                   "",
		"a guessed key":            "0000000000000000000000000000000000000000000000000000000000000000",
		"another respondent's key": stranger["public_key"],
	} {
		if got := p.declare(t, who, key, second); got.Code != http.StatusBadRequest {
			t.Fatalf("second device with %s: %d %s, want 400", name, got.Code, got.Body.String())
		}
	}
	if got := p.declaredWard(t, who["id"].(string)); got != first {
		t.Fatalf("declared ward is %q after refused overwrites, want %q", got, first)
	}
	if got := p.declare(t, who, who["public_key"], second); got.Code != http.StatusCreated {
		t.Fatalf("the holder changing their own ward: %d %s, want 201", got.Code, got.Body.String())
	}
	if got := p.declaredWard(t, who["id"].(string)); got != second {
		t.Fatalf("declared ward is %q after the holder changed it, want %q", got, second)
	}
}
