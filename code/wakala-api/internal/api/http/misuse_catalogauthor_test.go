package http

import (
	"context"
	"net/http"
	"testing"

	catalog "wakalaserver/modules/catalog"
	mwanachamapermissions "wakalaserver/modules/permissions"

	"wakalaserver/internal/agencies"
)

type everyoneMay struct {
	mwanachamapermissions.PermissionsManager
}

func (everyoneMay) MayPerformIn(context.Context, string, string, string, string) (bool, error) {
	return true, nil
}

func TestCatalogComment_ANoteNamesTheSignedInOperatorNotTheBody(t *testing.T) {
	w := newStepRunWalk(t, nil)
	manager, err := w.deps.Registry.CatalogManager(context.Background(), w.instance, agencies.MountCatalog)
	if err != nil {
		t.Fatalf("catalog manager: %v", err)
	}
	w.deps.Catalog = manager
	w.deps.Permissions = everyoneMay{}
	w.handler = NewRouter(w.deps)
	filed, err := manager.FileSuggestion(context.Background(), catalog.Suggestion{Slug: "a-lamp", Title: "A lamp", Why: "needs a bulb", Source: catalog.SuggestionSourceOwner})
	if err != nil {
		t.Fatalf("file suggestion: %v", err)
	}
	rec := w.call(t, "POST", "/catalog/suggestions/"+filed.ID+"/comments", map[string]any{"body": "a note", "author": "forged-keeper"}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("operator comments with a forged author: %d %s, want 201", rec.Code, rec.Body.String())
	}
	notes, err := manager.ListSuggestionComments(context.Background(), filed.ID)
	if err != nil || len(notes) != 1 {
		t.Fatalf("notes on the suggestion: %v %v", notes, err)
	}
	if notes[0].Author != "test-owner" {
		t.Errorf("the note names %q as its author; want the signed-in test-owner, never the body's forged-keeper", notes[0].Author)
	}
}
