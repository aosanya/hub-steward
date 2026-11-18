package http

import (
	"context"
	"net/http"
	"strings"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
)

type reportsToMyGroups struct {
	files resultsFilesWorld
	form  string
	path  string
}

func newReportsToMyGroups(t *testing.T) reportsToMyGroups {
	t.Helper()
	files := newResultsFilesWorld(t)
	a := files.acts
	a.walk.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		switch roleID {
		case a.walk.roles["Director"], a.walk.roles["Clerk"]:
			return []string{"report.read"}, nil
		}
		return nil, nil
	}
	files.initReports(t)
	w := reportsToMyGroups{files: files, form: a.closedID, path: a.path + "/forms/forms"}
	w.joinGroup(t, a.director)
	w.joinGroup(t, a.nobody)
	return w
}

func (w reportsToMyGroups) joinGroup(t *testing.T, who *http.Cookie) {
	t.Helper()
	a := w.files.acts
	directory, err := a.walk.deps.Registry.ActorManager(context.Background(), a.walk.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	if _, err := directory.AssignGroup(context.Background(), mwanachamaactor.ActorGroupAssignment{ActorID: a.walk.subjectOf(t, who), GroupID: a.groupID}); err != nil {
		t.Fatalf("AssignGroup: %v", err)
	}
}

func (w reportsToMyGroups) publishReportAt(t *testing.T, gitPath, commit string) {
	t.Helper()
	a := w.files.acts
	rec := a.walk.call(t, "POST", w.path+"/"+w.form+"/results", map[string]any{"git_path": gitPath, "git_commit": commit}, a.walk.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("publish: %d %s", rec.Code, rec.Body.String())
	}
}

func (w reportsToMyGroups) listAs(t *testing.T, who *http.Cookie) (int, []map[string]any) {
	t.Helper()
	rec := w.files.acts.walk.call(t, "GET", w.path+"/reports/mine", nil, who)
	if rec.Code != http.StatusOK {
		return rec.Code, nil
	}
	return rec.Code, decodeObjects(t, rec)
}

func (w reportsToMyGroups) textAs(t *testing.T, who *http.Cookie) (int, string) {
	t.Helper()
	rec := w.files.acts.walk.call(t, "GET", w.path+"/"+w.form+"/results/text", nil, who)
	return rec.Code, rec.Body.String()
}

func TestReportsToMyGroups_AMemberHoldingReportReadListsAndReadsAPublishedReport(t *testing.T) {
	w := newReportsToMyGroups(t)
	file := w.form + "/annual.md"
	commit := w.files.write(t, file, "Annual report of the ward")
	w.publishReportAt(t, file, commit)

	code, listed := w.listAs(t, w.files.acts.director)
	if code != http.StatusOK || len(listed) != 1 {
		t.Fatalf("the member lists: %d %v, want one report", code, listed)
	}
	item := listed[0]
	if item["form_id"] != w.form || item["form_title"] != "Ward round" || item["version"] != float64(1) || item["git_path"] != file || item["published_at"] == "" {
		t.Fatalf("the listed report = %v", item)
	}

	code, body := w.textAs(t, w.files.acts.director)
	if code != http.StatusOK || !strings.Contains(body, "Annual report of the ward") {
		t.Fatalf("the member reads the text: %d %s", code, body)
	}
}

func TestReportsToMyGroups_APersonOutsideTheGroupListsNothingAndIsRefusedTheText(t *testing.T) {
	w := newReportsToMyGroups(t)
	file := w.form + "/annual.md"
	commit := w.files.write(t, file, "Annual report of the ward")
	w.publishReportAt(t, file, commit)

	code, listed := w.listAs(t, w.files.acts.clerk)
	if code != http.StatusOK || len(listed) != 0 {
		t.Fatalf("an outsider holding report.read lists: %d %v, want none", code, listed)
	}
	code, body := w.textAs(t, w.files.acts.clerk)
	if code != http.StatusNotFound || strings.Contains(body, "Annual report") {
		t.Fatalf("an outsider holding report.read reads the text: %d %s, want 404 and no text", code, body)
	}
}

func TestReportsToMyGroups_AMemberWithoutReportReadIsRefusedBoth(t *testing.T) {
	w := newReportsToMyGroups(t)
	file := w.form + "/annual.md"
	commit := w.files.write(t, file, "Annual report of the ward")
	w.publishReportAt(t, file, commit)

	if code, _ := w.listAs(t, w.files.acts.nobody); code < 400 || code >= 500 {
		t.Fatalf("a member with no role lists: %d, want a 4xx refusal", code)
	}
	if code, body := w.textAs(t, w.files.acts.nobody); code < 400 || code >= 500 || strings.Contains(body, "Annual report") {
		t.Fatalf("a member with no role reads the text: %d %s, want a 4xx refusal and no text", code, body)
	}
}

func TestReportsToMyGroups_TheTextOfAFileChangedAfterItsCommitIsNotShownAsThatVersion(t *testing.T) {
	w := newReportsToMyGroups(t)
	file := w.form + "/annual.md"
	commit := w.files.write(t, file, "Annual report of the ward")
	w.publishReportAt(t, file, commit)
	w.files.write(t, file, "A later draft nobody published")

	code, body := w.textAs(t, w.files.acts.director)
	if code == http.StatusOK || strings.Contains(body, "later draft") {
		t.Fatalf("the member reads: %d %s, want a refusal that shows no other version", code, body)
	}
}
