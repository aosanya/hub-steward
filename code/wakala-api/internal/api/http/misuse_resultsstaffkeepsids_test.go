package http

import (
	"net/http"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
)

func TestResultsRead_OwnerInTargetedGroupStillReadsWhoPublishedTheReport(t *testing.T) {
	p := newDeclaredGroupProbe(t)
	formPath := p.forms + "/forms/" + p.targeted

	if rec := p.walk.call(t, "POST", formPath+"/close", map[string]any{}, p.walk.owner); rec.Code >= 400 {
		t.Fatalf("owner closes the round: %d %s", rec.Code, rec.Body.String())
	}
	published := p.walk.call(t, "POST", formPath+"/results", map[string]any{"git_path": "reports/kertvaros.md", "git_commit": "abc1234"}, p.walk.owner)
	if published.Code != http.StatusCreated {
		t.Fatalf("owner publishes the results: %d %s", published.Code, published.Body.String())
	}
	publisherID, _ := decodeObject(t, published)["published_by"].(string)
	if publisherID == "" {
		t.Fatalf("publisher's own reply no longer holds published_by: %s", published.Body.String())
	}

	directory, err := p.walk.deps.Registry.ActorManager(t.Context(), p.walk.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	if _, err := directory.AssignGroup(t.Context(), mwanachamaactor.ActorGroupAssignment{ActorID: publisherID, GroupID: p.ward}); err != nil {
		t.Fatalf("AssignGroup: %v", err)
	}

	for _, path := range []string{formPath + "/results/latest", formPath + "/results/latest/promises"} {
		read := p.walk.call(t, "GET", path, nil, p.walk.owner)
		if read.Code != http.StatusOK {
			t.Fatalf("owner in the targeted group reads %s: %d %s", path, read.Code, read.Body.String())
		}
		report := decodeObject(t, read)
		if inner, nested := report["report"].(map[string]any); nested {
			report = inner
		}
		if report["published_by"] != publisherID {
			t.Fatalf("owner's body at %s lost published_by: %s", path, read.Body.String())
		}
	}
}
