package http

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"gorm.io/gorm"
)

type respondentKeyDoor struct {
	walk  stepRunWalk
	doors string
}

func onEachBackend(t *testing.T, run func(t *testing.T, db *gorm.DB)) {
	t.Run("memory", func(t *testing.T) { run(t, stepRunDB(t)) })
	t.Run("postgres", func(t *testing.T) { run(t, localPostgresOrSkip(t)) })
}

func newRespondentKeyDoor(t *testing.T, db *gorm.DB, linkKeys ...string) respondentKeyDoor {
	t.Helper()
	w := newStepRunWalkOn(t, db, nil)
	forms := "/instances/" + w.instance + "/forms"
	closes := time.Now().Add(48 * time.Hour).UTC().Format(time.RFC3339)
	for _, linkKey := range linkKeys {
		rec := w.call(t, "POST", forms+"/forms", map[string]any{"title": "Form " + linkKey, "audience": "public", "closes_at": closes}, w.owner)
		if rec.Code != http.StatusCreated {
			t.Fatalf("create form: %d %s", rec.Code, rec.Body.String())
		}
		formID, _ := decodeObject(t, rec)["id"].(string)
		if rec := w.call(t, "POST", forms+"/forms/"+formID+"/publish", map[string]any{"candidate_link_key": linkKey}, w.owner); rec.Code != http.StatusOK {
			t.Fatalf("publish form: %d %s", rec.Code, rec.Body.String())
		}
	}
	return respondentKeyDoor{walk: w, doors: forms + "/public-links/"}
}

func (d respondentKeyDoor) register(linkKey string, body map[string]any) *httptest.ResponseRecorder {
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest("POST", d.doors+linkKey+"/respondents", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	out := httptest.NewRecorder()
	d.walk.handler.ServeHTTP(out, req)
	return out
}

func TestRespondentRegistration_ACallerChosenKeyIsRefusedAndTheServerMintsOne(t *testing.T) {
	onEachBackend(t, func(t *testing.T, db *gorm.DB) {
		d := newRespondentKeyDoor(t, db, "key-door-a")
		chosen := []string{
			"chosen-by-caller",
			"a",
			strings.Repeat("f", 63),
			strings.Repeat("f", 64),
			strings.Repeat("f", 65),
			strings.Repeat("x", 4096),
			"white space",
			"semi;colon'quote\"",
			"nul\x00byte",
			"../../etc/passwd",
			"<script>alert(1)</script>",
		}
		for _, key := range chosen {
			rec := d.register("key-door-a", map[string]any{"public_key": key})
			if rec.Code < 400 || rec.Code >= 500 {
				t.Fatalf("registering with the caller-chosen key %.40q: %d %s, want 4xx", key, rec.Code, rec.Body.String())
			}
		}
		minted := d.register("key-door-a", map[string]any{})
		if minted.Code >= 300 {
			t.Fatalf("registering without a key: %d %s", minted.Code, minted.Body.String())
		}
		got, _ := decodeObject(t, minted)["public_key"].(string)
		if len(got) != 64 || strings.Contains(strings.Join(chosen, "\n"), got) {
			t.Fatalf("the server must mint the key, got %q", got)
		}
	})
}

func TestRespondentRegistration_TwoRegistrationsGetTwoRespondentsWithDifferentKeys(t *testing.T) {
	onEachBackend(t, func(t *testing.T, db *gorm.DB) {
		d := newRespondentKeyDoor(t, db, "key-door-b")
		first := decodeObject(t, d.register("key-door-b", map[string]any{}))
		second := decodeObject(t, d.register("key-door-b", map[string]any{}))
		if first["public_key"] == second["public_key"] || first["id"] == second["id"] {
			t.Fatalf("two devices share a respondent: %v %v", first, second)
		}
	})
}

func TestRespondentRegistration_AnIssuedKeyReclaimsItsRespondentOnThatLinkAndOnAnother(t *testing.T) {
	onEachBackend(t, func(t *testing.T, db *gorm.DB) {
		d := newRespondentKeyDoor(t, db, "key-door-c", "key-door-d")
		first := decodeObject(t, d.register("key-door-c", map[string]any{}))
		key, _ := first["public_key"].(string)

		again := d.register("key-door-c", map[string]any{"public_key": key})
		if again.Code >= 300 || decodeObject(t, again)["id"] != first["id"] {
			t.Fatalf("reclaiming on the same link: %d %s", again.Code, again.Body.String())
		}
		other := d.register("key-door-d", map[string]any{"public_key": key})
		if other.Code >= 300 || decodeObject(t, other)["id"] != first["id"] {
			t.Fatalf("the holder of the key joining another link: %d %s", other.Code, other.Body.String())
		}
	})
}

func TestRespondentRegistration_AKeyIssuedOnAnotherLinkDoesNotLetAStrangerDeclareThere(t *testing.T) {
	onEachBackend(t, func(t *testing.T, db *gorm.DB) {
		d := newRespondentKeyDoor(t, db, "key-door-e", "key-door-f")
		victim := decodeObject(t, d.register("key-door-e", map[string]any{}))
		victimID, _ := victim["id"].(string)

		stranger := decodeObject(t, d.register("key-door-f", map[string]any{}))
		strangerKey, _ := stranger["public_key"].(string)

		raw, _ := json.Marshal(map[string]any{"respondent_id": victimID, "public_key": strangerKey, "declared_chapter_id": "any"})
		req := httptest.NewRequest("POST", d.doors+"key-door-e/declarations", bytes.NewReader(raw))
		req.Header.Set("Content-Type", "application/json")
		out := httptest.NewRecorder()
		d.walk.handler.ServeHTTP(out, req)
		if out.Code < 400 || out.Code >= 500 {
			t.Fatalf("a stranger's own key declaring for the victim: %d %s, want 4xx", out.Code, out.Body.String())
		}
	})
}
