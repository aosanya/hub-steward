package http

import (
	"context"
	"net/http"
	"testing"
	"time"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

var controlCharacters = map[string]string{
	"NUL":                 "\u0000",
	"start of heading":    "\u0001",
	"bell":                "\u0007",
	"backspace":           "\u0008",
	"vertical tab":        "\u000b",
	"form feed":           "\u000c",
	"escape":              "\u001b",
	"delete":              "\u007f",
	"next line":           "\u0085",
	"application program": "\u009f",
}

type commRoom struct {
	walk     stepRunWalk
	room     string
	groupID  string
	resident *http.Cookie
}

func openCommRoom(t *testing.T) commRoom {
	t.Helper()
	w := newStepRunWalk(t, nil)
	ctx := context.Background()

	groups := w.call(t, "GET", "/instances/"+w.instance+"/actor/groups", nil, w.owner)
	if groups.Code != http.StatusOK {
		t.Fatalf("owner lists groups: %d %s", groups.Code, groups.Body.String())
	}
	list := decodeObjects(t, groups)
	if len(list) == 0 {
		t.Fatalf("no group for a room")
	}
	groupID, _ := list[0]["id"].(string)

	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	actor, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Resident Wren"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, actor.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	if _, err := um.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: actor.ID, GroupID: groupID}); err != nil {
		t.Fatalf("AssignGroup: %v", err)
	}
	return commRoom{
		walk:     w,
		room:     "/instances/" + w.instance + "/comm/groups/" + groupID + "/chat",
		groupID:  groupID,
		resident: w.cookieFor(t, actor.ID),
	}
}

func (r commRoom) startThread(t *testing.T, label string) string {
	t.Helper()
	rec := r.walk.call(t, "POST", r.room+"/threads", map[string]any{"label": label}, r.resident)
	if rec.Code != http.StatusCreated && rec.Code != http.StatusOK {
		t.Fatalf("resident starts a thread %q: %d %s", label, rec.Code, rec.Body.String())
	}
	id, _ := decodeObject(t, rec)["id"].(string)
	if id == "" {
		t.Fatalf("no thread id in %s", rec.Body.String())
	}
	return id
}

func TestChatMessage_ResidentCannotDoPostControlCharactersInTheBody(t *testing.T) {
	r := openCommRoom(t)
	messages := r.room + "/threads/" + r.startThread(t, "Ward notice") + "/messages"

	for label, bad := range controlCharacters {
		t.Run(label, func(t *testing.T) {
			for _, body := range []string{"a" + bad + "b", bad, "Szia!\n" + bad} {
				rec := r.walk.call(t, "POST", messages, map[string]any{"body": body}, r.resident)
				if rec.Code != http.StatusBadRequest {
					t.Fatalf("resident posting %q: %d %s, want 400", body, rec.Code, rec.Body.String())
				}
			}
		})
	}
}

func TestChatThread_ResidentCannotDoLabelAThreadWithControlCharacters(t *testing.T) {
	r := openCommRoom(t)

	for label, bad := range controlCharacters {
		t.Run(label, func(t *testing.T) {
			for _, name := range []string{"x" + bad + "y", bad + "x"} {
				rec := r.walk.call(t, "POST", r.room+"/threads", map[string]any{"label": name}, r.resident)
				if rec.Code != http.StatusBadRequest {
					t.Fatalf("resident labelling a thread %q: %d %s, want 400", name, rec.Code, rec.Body.String())
				}
			}
		})
	}
}

func TestStandingMessage_OwnerCannotDoSetUpControlCharactersInTheBody(t *testing.T) {
	r := openCommRoom(t)
	standing := r.room + "/standing"
	start := time.Now().UTC().Add(48 * time.Hour).Format(time.RFC3339)

	for label, bad := range controlCharacters {
		t.Run(label, func(t *testing.T) {
			payload := map[string]any{
				"body":  "Heti" + bad + "hírlevél",
				"zone":  "Europe/Budapest",
				"start": start,
				"rule":  "FREQ=WEEKLY",
				"end":   time.Now().UTC().Add(30 * 24 * time.Hour).Format(time.RFC3339),
			}
			rec := r.walk.call(t, "POST", standing, payload, r.walk.owner)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("owner setting up a standing message with %s: %d %s, want 400", label, rec.Code, rec.Body.String())
			}
		})
	}
}

func TestComm_PeopleCanDoWriteRealMultiLineHungarianText(t *testing.T) {
	r := openCommRoom(t)
	thread := r.startThread(t, "Szemétszállítás – Árvíztűrő tükörfúrógép \U0001F642")

	multiLine := "Kedves szomszédok!\n\n\tA zöld kuka csütörtökön megy.\r\nKöszönöm \U0001F44D\U0001F3FD, Éva"
	rec := r.walk.call(t, "POST", r.room+"/threads/"+thread+"/messages", map[string]any{"body": multiLine}, r.resident)
	if rec.Code != http.StatusCreated {
		t.Fatalf("resident posting a multi-line message: %d %s, want 201", rec.Code, rec.Body.String())
	}
	if got, _ := decodeObject(t, rec)["body"].(string); got != multiLine {
		t.Fatalf("the message came back as %q, want %q", got, multiLine)
	}

	standing := map[string]any{
		"body":  "Hétfőn\n\tülés \U0001F4C5",
		"zone":  "Europe/Budapest",
		"start": time.Now().UTC().Add(48 * time.Hour).Format(time.RFC3339),
		"rule":  "FREQ=WEEKLY",
		"end":   time.Now().UTC().Add(30 * 24 * time.Hour).Format(time.RFC3339),
	}
	if rec := r.walk.call(t, "POST", r.room+"/standing", standing, r.walk.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner setting up a multi-line standing message: %d %s, want 201", rec.Code, rec.Body.String())
	}
}
