package routes

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	voting "wakalaserver/modules/voting"
)

type liveVoting struct {
	mux *http.ServeMux
}

func newLiveVoting(t *testing.T, caller string, groupsOf map[string][]string) *liveVoting {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=private", strings.ReplaceAll(t.Name(), "/", "_"))), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("sql db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { sqlDB.Close() })
	s, err := voting.SpecFor("live")
	if err != nil {
		t.Fatalf("spec: %v", err)
	}
	if err := voting.Provision(db, s); err != nil {
		t.Fatalf("provision: %v", err)
	}
	manager, err := voting.NewPollManager(db, s)
	if err != nil {
		t.Fatalf("manager: %v", err)
	}
	type groupsUser interface{ UseGroups(voting.Groups) }
	manager.(groupsUser).UseGroups(func(_ context.Context, who string) ([]string, error) { return groupsOf[who], nil })
	routes, err := BuildFor(manager, Mount{Caller: func(context.Context) string { return caller }})
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	mux := http.NewServeMux()
	for _, route := range routes {
		mux.HandleFunc(route.Pattern(""), route.Handler)
	}
	return &liveVoting{mux: mux}
}

func (l *liveVoting) call(method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	l.mux.ServeHTTP(rec, req)
	return rec
}

func decodeObject(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("body %q is not an object: %v", rec.Body.String(), err)
	}
	return out
}

func pollBody(question string) string {
	now := time.Now().UTC()
	return fmt.Sprintf(`{"question":%q,"mode":"one","per_group":"once","group_ids":["ward-a"],"opens_at":%q,"closes_at":%q}`,
		question, now.Add(-time.Hour).Format(time.RFC3339), now.Add(time.Hour).Format(time.RFC3339))
}

func (l *liveVoting) newPoll(t *testing.T, question string) string {
	t.Helper()
	rec := l.call("POST", "/polls", pollBody(question))
	if rec.Code != http.StatusCreated {
		t.Fatalf("create poll: %d %s", rec.Code, rec.Body.String())
	}
	id, _ := decodeObject(t, rec)["id"].(string)
	if id == "" {
		t.Fatalf("poll has no id: %s", rec.Body.String())
	}
	return id
}

func TestEverySentinelThisModuleExportsIsMappedToAStatus(t *testing.T) {
	unmapped, err := Table.UnmappedSentinels()
	if err != nil {
		t.Fatalf("spec: %v", err)
	}
	if len(unmapped) != 0 {
		t.Errorf("sentinels with no declared status: %v", unmapped)
	}
}

func TestNothingInVotingIsAnonymousAndSplitAgreesWithBuild(t *testing.T) {
	if len(AnonymousActions) != 0 {
		t.Fatalf("AnonymousActions = %v, want none", AnonymousActions)
	}
	built, err := Build(&pollAuthors{})
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	split := Split(&pollAuthors{}, Mount{})
	if len(split.Anonymous) != 0 || len(split.Gated) != len(built) {
		t.Errorf("anonymous %d gated %d, want 0 and %d", len(split.Anonymous), len(split.Gated), len(built))
	}
	seen := map[string]bool{}
	for _, route := range built {
		key := route.Method + " " + route.Path
		if seen[key] {
			t.Errorf("%s declared twice", key)
		}
		seen[key] = true
	}
}

func TestARefusingAuthorizerAnswers403ForEveryVotingAddress(t *testing.T) {
	asked := map[string]bool{}
	mount := Mount{Authorize: func(_ context.Context, action string) error {
		asked[action] = true
		return fmt.Errorf("no")
	}}
	routes := RoutesFor(&pollAuthors{}, mount)
	if len(routes) == 0 {
		t.Fatal("no routes")
	}
	for _, route := range routes {
		req := httptest.NewRequest(route.Method, "/", strings.NewReader(`{}`))
		req.SetPathValue("pollID", "p1")
		rec := httptest.NewRecorder()
		route.Handler(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Errorf("%s answered %d, want 403", route.Action, rec.Code)
		}
		if !asked[route.Action] {
			t.Errorf("authorizer never asked about %s", route.Action)
		}
	}
}

func TestAPollIsMadeAsADraftAndReadBack(t *testing.T) {
	l := newLiveVoting(t, "clerk", nil)
	id := l.newPoll(t, "Which street first?")
	rec := l.call("GET", "/polls/"+id, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("read: %d %s", rec.Code, rec.Body.String())
	}
	body := decodeObject(t, rec)
	if body["state"] != "draft" || body["question"] != "Which street first?" {
		t.Errorf("poll = %v, want a draft asking Which street first?", body)
	}
}

func TestAnUnknownPollIsNotFoundOnEveryPollAddress(t *testing.T) {
	l := newLiveVoting(t, "clerk", map[string][]string{"clerk": {"ward-a"}})
	for _, c := range []struct{ method, path, body string }{
		{"GET", "/polls/nope", ""},
		{"GET", "/polls/nope/choices", ""},
		{"POST", "/polls/nope/choices", `{"label":"x"}`},
		{"GET", "/polls/nope/count", ""},
	} {
		if rec := l.call(c.method, c.path, c.body); rec.Code != http.StatusNotFound {
			t.Errorf("%s %s answered %d %s, want 404", c.method, c.path, rec.Code, rec.Body.String())
		}
	}
}

func TestAPollWithoutAQuestionOrWithBrokenJSONIsRefusedAs400(t *testing.T) {
	l := newLiveVoting(t, "clerk", nil)
	for _, body := range []string{`{}`, `{"question":""}`, `{not json`} {
		if rec := l.call("POST", "/polls", body); rec.Code != http.StatusBadRequest {
			t.Errorf("body %s answered %d %s, want 400", body, rec.Code, rec.Body.String())
		}
	}
}

func TestPollWithNoCallerIsRefusedAs401(t *testing.T) {
	l := newLiveVoting(t, "", nil)
	if rec := l.call("POST", "/polls", pollBody("Anyone there?")); rec.Code != http.StatusUnauthorized {
		t.Errorf("create without a caller answered %d %s, want 401", rec.Code, rec.Body.String())
	}
}

func TestChoicesAreListedInTheOrderTheyWereAdded(t *testing.T) {
	l := newLiveVoting(t, "clerk", nil)
	id := l.newPoll(t, "Pick one")
	for _, label := range []string{"Mill Street", "Orchard Lane", "Mill Road"} {
		if rec := l.call("POST", "/polls/"+id+"/choices", fmt.Sprintf(`{"label":%q}`, label)); rec.Code != http.StatusCreated {
			t.Fatalf("add %s: %d %s", label, rec.Code, rec.Body.String())
		}
	}
	rec := l.call("GET", "/polls/"+id+"/choices", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("list: %d %s", rec.Code, rec.Body.String())
	}
	var items []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &items); err != nil {
		var wrapped struct {
			Items []map[string]any `json:"items"`
		}
		if err2 := json.Unmarshal(rec.Body.Bytes(), &wrapped); err2 != nil {
			t.Fatalf("list body %s", rec.Body.String())
		}
		items = wrapped.Items
	}
	var labels []string
	for _, item := range items {
		labels = append(labels, fmt.Sprint(item["label"]))
	}
	if strings.Join(labels, ",") != "Mill Street,Orchard Lane,Mill Road" {
		t.Errorf("choices = %v, want the order they were added", labels)
	}
}

func TestAChoiceWithoutALabelIsRefusedAs400(t *testing.T) {
	l := newLiveVoting(t, "clerk", nil)
	id := l.newPoll(t, "Pick one")
	if rec := l.call("POST", "/polls/"+id+"/choices", `{"label":""}`); rec.Code != http.StatusBadRequest {
		t.Errorf("empty label answered %d %s, want 400", rec.Code, rec.Body.String())
	}
}

func (l *liveVoting) pollWithChoices(t *testing.T) (string, []string) {
	t.Helper()
	id := l.newPoll(t, "Pick one")
	var ids []string
	for _, label := range []string{"Yes", "No"} {
		rec := l.call("POST", "/polls/"+id+"/choices", fmt.Sprintf(`{"label":%q}`, label))
		if rec.Code != http.StatusCreated {
			t.Fatalf("add %s: %d %s", label, rec.Code, rec.Body.String())
		}
		ids = append(ids, decodeObject(t, rec)["id"].(string))
	}
	return id, ids
}

func TestACallerOutsideThePollsGroupsCannotAnswerAndIsTold404(t *testing.T) {
	l := newLiveVoting(t, "stranger", map[string][]string{"stranger": {"ward-z"}})
	id, choices := l.pollWithChoices(t)
	rec := l.call("POST", "/polls/"+id+"/answers", fmt.Sprintf(`{"votes":{%q:1}}`, choices[0]))
	if rec.Code != http.StatusNotFound {
		t.Errorf("outsider answered %d %s, want 404", rec.Code, rec.Body.String())
	}
}

func TestAMemberAnswersOnceAndTheSecondAnswerIsRefusedAs409(t *testing.T) {
	l := newLiveVoting(t, "amina", map[string][]string{"amina": {"ward-a"}})
	id, choices := l.pollWithChoices(t)
	body := fmt.Sprintf(`{"votes":{%q:1}}`, choices[0])
	first := l.call("POST", "/polls/"+id+"/answers", body)
	if first.Code != http.StatusCreated {
		t.Fatalf("first answer: %d %s", first.Code, first.Body.String())
	}
	if second := l.call("POST", "/polls/"+id+"/answers", fmt.Sprintf(`{"votes":{%q:1}}`, choices[1])); second.Code != http.StatusConflict {
		t.Errorf("second answer answered %d %s, want 409", second.Code, second.Body.String())
	}
}

func TestAnAnswerNamingNoKnownChoiceIsRefusedAs400(t *testing.T) {
	l := newLiveVoting(t, "amina", map[string][]string{"amina": {"ward-a"}})
	id, _ := l.pollWithChoices(t)
	if rec := l.call("POST", "/polls/"+id+"/answers", `{"votes":{"no-such-choice":1}}`); rec.Code != http.StatusBadRequest {
		t.Errorf("answered %d %s, want 400", rec.Code, rec.Body.String())
	}
}

func TestAResultPublishedTwiceIsRefusedAs409AndOneWithoutGroupsAs400(t *testing.T) {
	l := newLiveVoting(t, "clerk", map[string][]string{"clerk": {"ward-a"}})
	id, _ := l.pollWithChoices(t)
	if rec := l.call("POST", "/polls/"+id+"/result", `{"group_ids":[]}`); rec.Code != http.StatusBadRequest {
		t.Errorf("publish with no groups answered %d %s, want 400", rec.Code, rec.Body.String())
	}
	if rec := l.call("POST", "/polls/"+id+"/result", `{"group_ids":["ward-a"]}`); rec.Code >= 300 {
		t.Fatalf("publish: %d %s", rec.Code, rec.Body.String())
	}
	if rec := l.call("POST", "/polls/"+id+"/result", `{"group_ids":["ward-a"]}`); rec.Code != http.StatusConflict {
		t.Errorf("second publish answered %d %s, want 409", rec.Code, rec.Body.String())
	}
}
