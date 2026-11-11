package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"wakalaserver/modules/shared/dispatch"
	voting "wakalaserver/modules/voting"
)

type pollAuthors struct {
	voting.PollManager
	createdBy, answeredBy, publishedBy string
}

func (p *pollAuthors) CreatePoll(_ context.Context, in voting.Poll) (voting.Poll, error) {
	p.createdBy = in.CreatedBy
	return voting.Poll{}, nil
}

func (p *pollAuthors) AnswerPoll(_ context.Context, in voting.Answer) (voting.Participation, error) {
	p.answeredBy = in.AnsweredBy
	return voting.Participation{}, nil
}

func (p *pollAuthors) PublishResult(_ context.Context, in voting.Publication) (voting.Poll, error) {
	p.publishedBy = in.PublishedBy
	return voting.Poll{}, nil
}

func pollRouteFor(t *testing.T, manager voting.PollManager, action string) Route {
	t.Helper()
	for _, route := range RoutesFor(manager, Mount{Caller: func(context.Context) string { return "the-session" }}) {
		if route.Action == action {
			return route
		}
	}
	t.Fatalf("no route for %s", action)
	return Route{}
}

func postPoll(handler http.HandlerFunc, body string) {
	req := httptest.NewRequest("POST", "/", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("pollID", "p1")
	handler(httptest.NewRecorder(), req)
}

func TestAPollIsMadeByTheCallerNotTheBody(t *testing.T) {
	manager := &pollAuthors{}
	postPoll(pollRouteFor(t, manager, "voting.poll.create").Handler, `{"question":"q","created_by":"forged-clerk"}`)
	if manager.createdBy != "the-session" {
		t.Errorf("the poll names %q as its maker; want the-session", manager.createdBy)
	}
}

func TestAnAnswerIsGivenByTheCallerNotTheBody(t *testing.T) {
	manager := &pollAuthors{}
	postPoll(pollRouteFor(t, manager, "voting.answer.create").Handler, `{"votes":{"c1":1},"answered_by":"forged-resident"}`)
	if manager.answeredBy != "the-session" {
		t.Errorf("the answer names %q as its giver; want the-session", manager.answeredBy)
	}
}

func TestAResultIsPublishedByTheCallerNotTheBody(t *testing.T) {
	manager := &pollAuthors{}
	postPoll(pollRouteFor(t, manager, "voting.result.publish").Handler, `{"group_ids":["g1"],"published_by":"forged-clerk"}`)
	if manager.publishedBy != "the-session" {
		t.Errorf("the result names %q as its publisher; want the-session", manager.publishedBy)
	}
}

func TestPollToolsDoNotAskForTheirAuthor(t *testing.T) {
	spec, err := Table.Spec()
	if err != nil {
		t.Fatalf("Spec: %v", err)
	}
	tools, err := dispatch.Tools(spec, dispatch.Deps{Manager: &pollAuthors{}, Errors: Sentinels})
	if err != nil {
		t.Fatalf("Tools: %v", err)
	}
	asked := map[string]string{"voting.poll.create": "created_by", "voting.answer.create": "answered_by", "voting.result.publish": "published_by"}
	seen := 0
	for _, tool := range tools {
		field, ok := asked[tool.Action]
		if !ok {
			continue
		}
		seen++
		var schema struct {
			Properties map[string]json.RawMessage `json:"properties"`
		}
		if err := json.Unmarshal(tool.InputSchema, &schema); err != nil {
			t.Fatalf("%s schema: %v", tool.Name, err)
		}
		if _, present := schema.Properties[field]; present {
			t.Errorf("%s still takes %s from the request; the caller signs it", tool.Name, field)
		}
	}
	if seen != len(asked) {
		t.Fatalf("found %d of the %d tools under test", seen, len(asked))
	}
}
