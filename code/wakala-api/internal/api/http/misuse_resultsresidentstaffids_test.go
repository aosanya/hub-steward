package http

import (
	"net/http"
	"strings"
	"testing"
)

func TestResultsRead_ResidentInTargetedGroupReadsNoStaffMemberId(t *testing.T) {
	p := newDeclaredGroupProbe(t)
	formPath := p.forms + "/forms/" + p.targeted

	if rec := p.walk.call(t, "POST", formPath+"/close", map[string]any{}, p.walk.owner); rec.Code >= 400 {
		t.Fatalf("owner closes the round: %d %s", rec.Code, rec.Body.String())
	}
	published := p.walk.call(t, "POST", formPath+"/results", map[string]any{"git_path": "reports/kertvaros.md", "git_commit": "abc1234"}, p.walk.owner)
	if published.Code != http.StatusCreated {
		t.Fatalf("owner publishes the results: %d %s", published.Code, published.Body.String())
	}
	publishedReport := decodeObject(t, published)
	publisherID, _ := publishedReport["published_by"].(string)
	if publisherID == "" {
		t.Fatalf("publisher's own reply no longer holds published_by: %s", published.Body.String())
	}

	resident := p.memberOfWard(t)
	for _, path := range []string{formPath + "/results/latest", formPath + "/results/latest/promises"} {
		read := p.walk.call(t, "GET", path, nil, resident)
		if read.Code != http.StatusOK {
			t.Fatalf("resident in the targeted group reads %s: %d %s", path, read.Code, read.Body.String())
		}
		if strings.Contains(read.Body.String(), publisherID) {
			t.Fatalf("resident's body at %s holds the staff member id %s: %s", path, publisherID, read.Body.String())
		}
		if strings.Contains(read.Body.String(), "published_by") {
			t.Fatalf("resident's body at %s holds published_by: %s", path, read.Body.String())
		}
		report := decodeObject(t, read)
		if inner, nested := report["report"].(map[string]any); nested {
			report = inner
		}
		if report["form_id"] != p.targeted || report["version"] != float64(1) || report["git_path"] != "reports/kertvaros.md" || report["git_commit"] != "abc1234" || report["published_at"] != publishedReport["published_at"] {
			t.Fatalf("resident no longer gets the report at %s: %s", path, read.Body.String())
		}
	}
}
