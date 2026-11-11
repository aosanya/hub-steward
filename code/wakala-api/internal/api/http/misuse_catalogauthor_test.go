package http

import (
	"context"
	"net/http"
	"testing"

	catalog "wakalaserver/modules/catalog"
	mwanachamapermissions "wakalaserver/modules/permissions"
)

type everyoneMay struct {
	mwanachamapermissions.PermissionsManager
}

func (everyoneMay) MayPerformIn(context.Context, string, string, string, string) (bool, error) {
	return true, nil
}

type suggestionsCommented struct {
	catalog.CatalogManager
	by catalog.CommentAuthor
}

func (s *suggestionsCommented) CommentOnSuggestion(_ context.Context, _ string, author catalog.CommentAuthor, _ string) (catalog.SuggestionComment, error) {
	s.by = author
	return catalog.SuggestionComment{Author: author}, nil
}

func TestCatalogComment_ANoteNamesTheSignedInOperatorNotTheBody(t *testing.T) {
	w := newStepRunWalk(t, nil)
	manager := &suggestionsCommented{}
	w.deps.Catalog = manager
	w.deps.Permissions = everyoneMay{}
	w.handler = NewRouter(w.deps)
	rec := w.call(t, "POST", "/catalog/suggestions/s1/comments", map[string]any{"body": "a note", "author": "forged-keeper"}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("operator comments with a forged author: %d %s, want 201", rec.Code, rec.Body.String())
	}
	if manager.by != "test-owner" {
		t.Errorf("the note names %q as its author; want the signed-in test-owner, never the body's forged-keeper", manager.by)
	}
}
