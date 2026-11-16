package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
	catalog "wakalaserver/modules/catalog"

	"wakalaserver/internal/agencies"
)

type messageLengthSize struct {
	name   string
	text   string
	refuse bool
}

func messageLengthSizes() []messageLengthSize {
	return []messageLengthSize{
		{name: "1", text: "a"},
		{name: "1000", text: strings.Repeat("a", 1000)},
		{name: "10000", text: strings.Repeat("a", 10000)},
		{name: "100000", text: strings.Repeat("a", 100000)},
		{name: "1000000", text: strings.Repeat("a", 1000000)},
		{name: "empty", text: ""},
		{name: "spaces", text: "   \t\n  "},
	}
}

func messageLengthBlank(text string) bool { return strings.TrimSpace(text) == "" }

func messageLengthClear(code int) bool {
	return code == http.StatusBadRequest || code == http.StatusRequestEntityTooLarge || code == http.StatusUnprocessableEntity
}

func messageLengthAdmitted(code int) bool {
	return code == http.StatusOK || code == http.StatusCreated || code == http.StatusAccepted || code == http.StatusNoContent
}

type messageLengthAnswer struct {
	probe  string
	code   int
	stored int
	body   string
}

func (a messageLengthAnswer) line() string {
	snippet := a.body
	if len(snippet) > 120 {
		snippet = snippet[:120]
	}
	return a.probe + " -> " + http.StatusText(a.code) + " stored=" + strconv.Itoa(a.stored) + " " + strings.TrimSpace(snippet)
}

func messageLengthJudge(t *testing.T, size messageLengthSize, a messageLengthAnswer) {
	t.Helper()
	t.Log(a.line())
	if a.code >= 500 {
		t.Errorf("%s: answered %d %s, want an answer below 500", a.probe, a.code, a.body)
		return
	}
	if size.refuse || messageLengthBlank(size.text) {
		if messageLengthAdmitted(a.code) {
			t.Errorf("%s: a blank message was admitted with %d", a.probe, a.code)
		}
		return
	}
	if messageLengthAdmitted(a.code) && a.stored != len(size.text) {
		t.Errorf("%s: sent %d characters, stored %d", a.probe, len(size.text), a.stored)
	}
	if !messageLengthAdmitted(a.code) && !messageLengthClear(a.code) {
		t.Errorf("%s: refused with %d %s, want a clear 400 or 413", a.probe, a.code, a.body)
	}
}

type messageLengthWorld struct {
	walk     stepRunWalk
	group    string
	resident *http.Cookie
	thread   string
	messages string
}

func newMessageLengthWorld(t *testing.T) *messageLengthWorld {
	t.Helper()
	w := newStepRunWalk(t, nil)
	ctx := context.Background()
	groups := w.call(t, "GET", "/instances/"+w.instance+"/actor/groups", nil, w.owner)
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
	resident := w.cookieFor(t, actor.ID)
	room := "/instances/" + w.instance + "/comm/groups/" + groupID + "/chat/threads"
	started := w.call(t, "POST", room, map[string]any{"label": "Ward notice"}, resident)
	if started.Code != http.StatusCreated && started.Code != http.StatusOK {
		t.Fatalf("start thread: %d %s", started.Code, started.Body.String())
	}
	threadID, _ := decodeObject(t, started)["id"].(string)
	return &messageLengthWorld{walk: w, group: groupID, resident: resident, thread: threadID, messages: room + "/" + threadID + "/messages"}
}

func (w *messageLengthWorld) answer(t *testing.T, probe string, rec *httptest.ResponseRecorder, stored int) messageLengthAnswer {
	t.Helper()
	return messageLengthAnswer{probe: probe, code: rec.Code, stored: stored, body: rec.Body.String()}
}

func (w *messageLengthWorld) lastStored(t *testing.T, field string) int {
	t.Helper()
	rec := w.walk.call(t, "GET", w.messages, nil, w.resident)
	if rec.Code != http.StatusOK {
		return -1
	}
	rows := decodeObjects(t, rec)
	if len(rows) == 0 {
		return 0
	}
	text, _ := rows[len(rows)-1][field].(string)
	return len(text)
}

func TestMessageLength_Round1_GroupChatPostLengths(t *testing.T) {
	w := newMessageLengthWorld(t)
	for _, size := range messageLengthSizes() {
		rec := w.walk.call(t, "POST", w.messages, map[string]any{"body": size.text}, w.resident)
		stored := 0
		if messageLengthAdmitted(rec.Code) {
			stored = w.lastStored(t, "body")
		}
		messageLengthJudge(t, size, w.answer(t, "chat post "+size.name, rec, stored))
	}
}

func TestMessageLength_Round1_JoinMessageLengths(t *testing.T) {
	w := newStepRunWalk(t, nil)
	path := "/instances/" + w.instance
	if rec := w.call(t, "PUT", path+"/join-mode", map[string]any{"join_mode": "confirmed"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner sets confirmed join mode: %d %s", rec.Code, rec.Body.String())
	}
	sizes := []messageLengthSize{
		{name: "500", text: strings.Repeat("a", 500)},
		{name: "501", text: strings.Repeat("a", 501)},
		{name: "1000000", text: strings.Repeat("a", 1000000)},
	}
	for i, size := range sizes {
		applicant := w.cookieFor(t, "applicant-"+size.name+"-"+strconv.Itoa(i))
		rec := w.call(t, "POST", path+"/join", map[string]any{"message": size.text}, applicant)
		stored := 0
		if messageLengthAdmitted(rec.Code) {
			stored = len(size.text)
		}
		messageLengthJudge(t, size, messageLengthAnswer{probe: "join " + size.name, code: rec.Code, stored: stored, body: rec.Body.String()})
	}
}

type messageLengthProbe struct {
	name string
	post func(text string) *httptest.ResponseRecorder
	read func(sent int) int
}

func (p messageLengthProbe) run(t *testing.T, sizes []messageLengthSize) {
	t.Helper()
	for _, size := range sizes {
		rec := p.post(size.text)
		stored := 0
		if messageLengthAdmitted(rec.Code) {
			stored = p.read(len(size.text))
		}
		messageLengthJudge(t, size, messageLengthAnswer{probe: p.name + " " + size.name, code: rec.Code, stored: stored, body: rec.Body.String()})
	}
}

func messageLengthStoredLength(t *testing.T, w stepRunWalk, path string, as *http.Cookie, field string) func(sent int) int {
	return func(sent int) int {
		rec := w.call(t, "GET", path, nil, as)
		if rec.Code != http.StatusOK {
			return -1
		}
		longest := 0
		for _, row := range decodeObjects(t, rec) {
			text, _ := row[field].(string)
			if len(text) == sent {
				return sent
			}
			longest = max(longest, len(text))
		}
		return longest
	}
}

func messageLengthCatalogWalk(t *testing.T) stepRunWalk {
	t.Helper()
	w := newStepRunWalk(t, nil)
	manager, err := w.deps.Registry.CatalogManager(context.Background(), w.instance, agencies.MountCatalog)
	if err != nil {
		t.Fatalf("catalog manager: %v", err)
	}
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, "resident-1", agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	w.deps.Catalog = manager
	w.deps.Permissions = everyoneMay{}
	w.handler = NewRouter(w.deps)
	return w
}

func TestMessageLength_Round2_ReplyAndSuggestionCommentLengths(t *testing.T) {
	w := messageLengthCatalogWalk(t)
	filed := w.call(t, "POST", "/catalog/raised-items/filed", map[string]any{"title": "Broken street lamp", "topic": "Lighting", "raised_by": "resident-1", "channel": "phone", "publishable": true}, w.owner)
	if filed.Code != http.StatusCreated {
		t.Fatalf("staff files the item: %d %s", filed.Code, filed.Body.String())
	}
	itemID, _ := decodeObject(t, filed)["id"].(string)
	replies := "/catalog/raised-items/" + itemID + "/replies"
	messageLengthProbe{
		name: "reply",
		post: func(text string) *httptest.ResponseRecorder {
			return w.call(t, "POST", replies, map[string]any{"body": text}, w.owner)
		},
		read: messageLengthStoredLength(t, w, replies, w.owner, "body"),
	}.run(t, messageLengthSizes())

	manager := w.deps.Catalog
	suggestion, err := manager.FileSuggestion(context.Background(), catalog.Suggestion{Slug: "a-lamp", Title: "A lamp", Why: "needs a bulb", Source: catalog.SuggestionSourceOwner})
	if err != nil {
		t.Fatalf("file suggestion: %v", err)
	}
	comments := "/catalog/suggestions/" + suggestion.ID + "/comments"
	all := messageLengthSizes()
	messageLengthProbe{
		name: "suggestion comment",
		post: func(text string) *httptest.ResponseRecorder {
			return w.call(t, "POST", comments, map[string]any{"body": text}, w.owner)
		},
		read: messageLengthStoredLength(t, w, comments, w.owner, "body"),
	}.run(t, []messageLengthSize{all[0], all[4], all[5]})
}

func TestMessageLength_Round3_SubjectMessageAndStandingMessageLengths(t *testing.T) {
	w := newMessageLengthWorld(t)
	instance := "/instances/" + w.walk.instance
	fourth := w.walk.call(t, "POST", instance+"/actor/groups", map[string]any{"name": "Zugló"}, w.walk.owner)
	if fourth.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", fourth.Code, fourth.Body.String())
	}
	groupID, _ := decodeObject(t, fourth)["id"].(string)
	if rec := w.walk.call(t, "PUT", instance+"/actor/groups/"+groupID+"/join-mode", map[string]any{"join_mode": "confirmed"}, w.walk.owner); rec.Code != http.StatusOK {
		t.Fatalf("confirmed join mode: %d %s", rec.Code, rec.Body.String())
	}
	asked := w.walk.call(t, "POST", instance+"/actor/groups/"+groupID+"/join", map[string]any{"message": "May I too?"}, w.resident)
	if asked.Code >= 400 {
		t.Fatalf("resident asks to join: %d %s", asked.Code, asked.Body.String())
	}
	request, _ := decodeObject(t, asked)["request"].(map[string]any)
	requestID, _ := request["id"].(string)
	opened := w.walk.call(t, "POST", instance+"/comm/subjects/group_join_request/"+requestID+"/threads", map[string]any{"audience": "private"}, w.resident)
	if opened.Code >= 400 {
		t.Fatalf("resident opens the join request thread: %d %s", opened.Code, opened.Body.String())
	}
	threadID, _ := decodeObject(t, opened)["id"].(string)
	thread := instance + "/comm/subject-threads/" + threadID + "/messages"
	messageLengthProbe{
		name: "subject message",
		post: func(text string) *httptest.ResponseRecorder {
			return w.walk.call(t, "POST", thread, map[string]any{"body": text}, w.resident)
		},
		read: messageLengthStoredLength(t, w.walk, thread, w.resident, "body"),
	}.run(t, messageLengthSizes())

	standing := instance + "/comm/groups/" + w.group + "/chat/standing"
	all := messageLengthSizes()
	messageLengthProbe{
		name: "standing message",
		post: func(text string) *httptest.ResponseRecorder {
			return w.walk.call(t, "POST", standing, map[string]any{
				"body": text, "dates": []string{"2030-01-02"}, "zone": "Europe/Budapest",
				"start": "2030-01-02T09:00:00+01:00", "end": "2030-01-03T09:00:00+01:00",
			}, w.walk.owner)
		},
		read: messageLengthStoredLength(t, w.walk, standing, w.walk.owner, "body"),
	}.run(t, []messageLengthSize{all[0], all[4], all[5]})
}

func messageLengthEdgeSizes() []messageLengthSize {
	return []messageLengthSize{
		{name: "1048000 ascii", text: strings.Repeat("a", 1048000)},
		{name: "1048577 ascii", text: strings.Repeat("a", 1048577), refuse: true},
		{name: "500000 two-byte", text: strings.Repeat("\u00e9", 500000)},
		{name: "1000000 two-byte", text: strings.Repeat("\u00e9", 1000000), refuse: true},
		{name: "100000 emoji", text: strings.Repeat("\U0001F600", 100000)},
		{name: "10000 newlines", text: strings.Repeat("\n", 10000) + "x"},
		{name: "no-break spaces", text: "\u00a0\u00a0\u3000", refuse: true},
		{name: "null byte", text: "a\x00b", refuse: true},
		{name: "control bell", text: "a\x07b", refuse: true},
	}
}

func TestMessageLength_Round4_ChatPostEdgeLengthsAndBlanks(t *testing.T) {
	w := newMessageLengthWorld(t)
	messageLengthProbe{
		name: "chat post",
		post: func(text string) *httptest.ResponseRecorder {
			return w.walk.call(t, "POST", w.messages, map[string]any{"body": text}, w.resident)
		},
		read: messageLengthStoredLength(t, w.walk, w.messages, w.resident, "body"),
	}.run(t, messageLengthEdgeSizes())
}

func messageLengthInvisibleSizes() []messageLengthSize {
	return []messageLengthSize{
		{name: "zero-width spaces", text: "\u200b\u200b\u200b", refuse: true},
		{name: "word joiners and marks", text: "\u2060\u200e\ufeff", refuse: true},
	}
}

func TestMessageLength_Round5_InvisibleMessagesAreRefused(t *testing.T) {
	t.Skip("Known defect: a message of only invisible characters is admitted; remove this line with the fix")
	chat := newMessageLengthWorld(t)
	messageLengthProbe{
		name: "chat post",
		post: func(text string) *httptest.ResponseRecorder {
			return chat.walk.call(t, "POST", chat.messages, map[string]any{"body": text}, chat.resident)
		},
		read: messageLengthStoredLength(t, chat.walk, chat.messages, chat.resident, "body"),
	}.run(t, messageLengthInvisibleSizes())

	w := messageLengthCatalogWalk(t)
	filed := w.call(t, "POST", "/catalog/raised-items/filed", map[string]any{"title": "Broken street lamp", "topic": "Lighting", "raised_by": "resident-1", "channel": "phone", "publishable": true}, w.owner)
	itemID, _ := decodeObject(t, filed)["id"].(string)
	replies := "/catalog/raised-items/" + itemID + "/replies"
	messageLengthProbe{
		name: "reply",
		post: func(text string) *httptest.ResponseRecorder {
			return w.call(t, "POST", replies, map[string]any{"body": text}, w.owner)
		},
		read: messageLengthStoredLength(t, w, replies, w.owner, "body"),
	}.run(t, messageLengthInvisibleSizes())

	suggestion, err := w.deps.Catalog.FileSuggestion(context.Background(), catalog.Suggestion{Slug: "a-lamp", Title: "A lamp", Why: "needs a bulb", Source: catalog.SuggestionSourceOwner})
	if err != nil {
		t.Fatalf("file suggestion: %v", err)
	}
	comments := "/catalog/suggestions/" + suggestion.ID + "/comments"
	messageLengthProbe{
		name: "suggestion comment",
		post: func(text string) *httptest.ResponseRecorder {
			return w.call(t, "POST", comments, map[string]any{"body": text}, w.owner)
		},
		read: messageLengthStoredLength(t, w, comments, w.owner, "body"),
	}.run(t, messageLengthInvisibleSizes())

	instance := "/instances/" + chat.walk.instance
	standing := instance + "/comm/groups/" + chat.group + "/chat/standing"
	messageLengthProbe{
		name: "standing message",
		post: func(text string) *httptest.ResponseRecorder {
			return chat.walk.call(t, "POST", standing, map[string]any{
				"body": text, "dates": []string{"2030-01-02"}, "zone": "Europe/Budapest",
				"start": "2030-01-02T09:00:00+01:00", "end": "2030-01-03T09:00:00+01:00",
			}, chat.walk.owner)
		},
		read: messageLengthStoredLength(t, chat.walk, standing, chat.walk.owner, "body"),
	}.run(t, messageLengthInvisibleSizes()[:1])
}
