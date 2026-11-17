package http

import (
	"net/http"
	"strings"
	"testing"
)

func titlesThatDrawNothing() []string {
	return []string{"ㅤ", "⠀", "ᅟ", "ㅤㅤㅤ", "AnnaㅤPolgármester"}
}

func (w freeTextWalk) refuseTaskTitles(t *testing.T, label, method, path string, extra map[string]any) {
	t.Helper()
	for _, title := range titlesThatDrawNothing() {
		body := map[string]any{"title": title}
		for k, v := range extra {
			body[k] = v
		}
		rec := w.call(t, method, path, body, w.owner)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("%s with %q: %d %s, want 400", label, title, rec.Code, rec.Body.String())
		}
		if !strings.Contains(rec.Body.String(), "title") {
			t.Fatalf("%s with %q: %s, want the message to name the title", label, title, rec.Body.String())
		}
	}
}

func (w freeTextWalk) admitTaskTitles(t *testing.T, label, method, path string, extra map[string]any) {
	t.Helper()
	for _, title := range []string{"Kovács Anna kérése", "Őze Ödön", "Szűcs-féle ügy: 2. rész", "Anna-Mária O'Neil", "Árvíztűrő tükörfúrógép"} {
		body := map[string]any{"title": title}
		for k, v := range extra {
			body[k] = v
		}
		rec := w.call(t, method, path, body, w.owner)
		if rec.Code >= 300 {
			t.Fatalf("%s with %q: %d %s, want it accepted", label, title, rec.Code, rec.Body.String())
		}
	}
}

func TestTaskTitles_OwnerCannotDoTitleAnIssueWithCharactersThatDrawNothing(t *testing.T) {
	w := newFreeTextWalk(t)
	tasks := "/instances/" + w.instance + "/taskmanager/tasks"

	w.refuseTaskTitles(t, "create issue", "POST", tasks, nil)

	created := w.call(t, "POST", tasks, map[string]any{"title": "Kovács Anna kérése"}, w.owner)
	if created.Code != http.StatusCreated {
		t.Fatalf("create issue: %d %s", created.Code, created.Body.String())
	}
	id, _ := decodeObject(t, created)["id"].(string)
	one := tasks + "/" + id

	w.refuseTaskTitles(t, "patch issue", "PATCH", one, nil)
	w.refuseTaskTitles(t, "replace issue", "PUT", one, nil)
	w.admitTaskTitles(t, "create issue", "POST", tasks, nil)
	w.admitTaskTitles(t, "patch issue", "PATCH", one, nil)
}

func TestTaskTitles_AnOddStoredTitleStaysReadableAndEditableWithoutTouchingIt(t *testing.T) {
	w := newFreeTextWalk(t)
	tasks := "/instances/" + w.instance + "/taskmanager/tasks"
	created := w.call(t, "POST", tasks, map[string]any{"title": "Kovács Anna kérése"}, w.owner)
	if created.Code != http.StatusCreated {
		t.Fatalf("create issue: %d %s", created.Code, created.Body.String())
	}
	id, _ := decodeObject(t, created)["id"].(string)
	rec := w.call(t, "PATCH", tasks+"/"+id, map[string]any{"priority": "high"}, w.owner)
	if rec.Code >= 300 {
		t.Fatalf("patch without a title: %d %s", rec.Code, rec.Body.String())
	}
}

func TestTaskTitles_AnIssueWithNoTitleIsStillAccepted(t *testing.T) {
	w := newFreeTextWalk(t)
	tasks := "/instances/" + w.instance + "/taskmanager/tasks"
	rec := w.call(t, "POST", tasks, map[string]any{}, w.owner)
	if rec.Code >= 300 {
		t.Fatalf("create issue with no title: %d %s", rec.Code, rec.Body.String())
	}
}
