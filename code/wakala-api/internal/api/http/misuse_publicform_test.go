package http

import (
	"net/http"
	"testing"
	"time"
)

func TestPublicFormDoor_StrangerCannotDoOpenAFormThatIsNotOpen(t *testing.T) {
	w := newStepRunWalk(t, nil)
	forms := "/instances/" + w.instance + "/forms"
	door := forms + "/public-links/"
	closes := time.Now().Add(72 * time.Hour).UTC().Format(time.RFC3339)

	create := func(title string) string {
		rec := w.call(t, "POST", forms+"/forms", map[string]any{"title": title, "audience": "public", "closes_at": closes}, w.owner)
		if rec.Code != http.StatusCreated {
			t.Fatalf("owner creates %s: %d %s", title, rec.Code, rec.Body.String())
		}
		id, _ := decodeObject(t, rec)["id"].(string)
		return id
	}
	publish := func(id, key string) {
		rec := w.call(t, "POST", forms+"/forms/"+id+"/publish", map[string]any{"candidate_link_key": key}, w.owner)
		if rec.Code >= 400 {
			t.Fatalf("owner publishes %s: %d %s", id, rec.Code, rec.Body.String())
		}
	}

	draftID := create("Street lighting survey draft")
	closedID := create("Bus shelter survey")
	publish(closedID, "bus-shelter-key")
	if rec := getWithHeaders(w, door+"bus-shelter-key", "", nil); rec.Code != http.StatusOK {
		t.Fatalf("stranger opening the bus shelter survey while open: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", forms+"/forms/"+closedID+"/close", map[string]any{}, w.owner); rec.Code >= 400 {
		t.Fatalf("owner closes the bus shelter survey: %d %s", rec.Code, rec.Body.String())
	}
	openID := create("Street lighting survey")
	publish(openID, "street-lighting-key")

	for _, key := range []string{draftID, "bus-shelter-key"} {
		if rec := getWithHeaders(w, door+key, "", nil); rec.Code != http.StatusNotFound {
			t.Fatalf("stranger opening a form that is not open via %s: %d %s, want 404", key, rec.Code, rec.Body.String())
		}
		if rec := getWithHeaders(w, door+key+"/questions", "", nil); rec.Code != http.StatusNotFound {
			t.Fatalf("stranger reading questions of a form that is not open via %s: %d %s, want 404", key, rec.Code, rec.Body.String())
		}
	}

	admitted := getWithHeaders(w, door+"street-lighting-key", "", nil)
	if admitted.Code != http.StatusOK {
		t.Fatalf("stranger opening the published public form: %d %s, want 200", admitted.Code, admitted.Body.String())
	}
	if agency, ok := decodeObject(t, admitted)["agency"].(map[string]any); !ok || agency["id"] != w.instance {
		t.Fatalf("published public form does not name its agency: %s", admitted.Body.String())
	}
}
