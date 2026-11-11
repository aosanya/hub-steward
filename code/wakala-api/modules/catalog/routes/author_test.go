package routes

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"wakalaserver/modules/shared/dispatch"

	catalog "wakalaserver/modules/catalog"
)

type suggestionAuthors struct {
	catalog.CatalogManager
	commentedBy catalog.CommentAuthor
}

func (s *suggestionAuthors) CommentOnSuggestion(_ context.Context, _ string, author catalog.CommentAuthor, _ string) (catalog.SuggestionComment, error) {
	s.commentedBy = author
	return catalog.SuggestionComment{}, nil
}

var theSession = Mount{Caller: func(context.Context) string { return "the-session" }}

func TestASuggestionCommentIsWrittenByTheCallerNotTheBody(t *testing.T) {
	manager := &suggestionAuthors{}
	for _, route := range RoutesFor(manager, theSession) {
		if route.Action != "catalog.suggestion_comment.create" {
			continue
		}
		req := httptest.NewRequest("POST", "/", strings.NewReader(`{"body":"a note","author":"forged-clerk"}`))
		req.Header.Set("Content-Type", "application/json")
		req.SetPathValue("suggestionID", "s1")
		route.Handler(httptest.NewRecorder(), req)
		if manager.commentedBy != "the-session" {
			t.Errorf("the comment names %q as its author; want the-session, never the body's forged-clerk", manager.commentedBy)
		}
		return
	}
	t.Fatal("no route for catalog.suggestion_comment.create")
}

func TestSuggestionCommentToolDoesNotAskForItsAuthor(t *testing.T) {
	for _, tool := range ToolsFor(&suggestionAuthors{}, theSession) {
		if tool.Action != "catalog.suggestion_comment.create" {
			continue
		}
		var schema struct {
			Properties map[string]json.RawMessage `json:"properties"`
		}
		if err := json.Unmarshal(tool.InputSchema, &schema); err != nil {
			t.Fatalf("schema: %v", err)
		}
		if _, asked := schema.Properties["author"]; asked {
			t.Errorf("%s still takes author from the request; the caller signs it", tool.Name)
		}
		manager := &suggestionAuthors{}
		for _, signing := range ToolsFor(manager, theSession) {
			if signing.Action == tool.Action {
				if _, err := signing.Handle(context.Background(), dispatch.Request{Arguments: json.RawMessage(`{"suggestionID":"s1","body":"a note"}`)}); err != nil {
					t.Fatalf("%s: %v", signing.Name, err)
				}
			}
		}
		if manager.commentedBy != "the-session" {
			t.Errorf("the comment names %q as its author; want the-session", manager.commentedBy)
		}
		return
	}
	t.Fatal("no tool for catalog.suggestion_comment.create")
}
