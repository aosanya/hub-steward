package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

	"wakalaserver/internal/agencies"
)

type reachWalk struct {
	rowStepWalk
}

func newReachWalk(t *testing.T) reachWalk {
	t.Helper()
	return reachWalk{rowStepWalk: newRowStepWalk(t, nil)}
}

func (w stepRunWalk) tagStore(t *testing.T) agencies.Tags {
	t.Helper()
	kept, ok := w.deps.Registry.(agencies.Tags)
	if !ok {
		t.Fatal("the registry does not keep tags")
	}
	return kept
}

func (w stepRunWalk) tagID(t *testing.T, name string) string {
	t.Helper()
	ctx := context.Background()
	listed, err := w.tagStore(t).ListTags(ctx, w.instance)
	if err != nil {
		t.Fatalf("ListTags: %v", err)
	}
	for _, tag := range listed {
		if tag.Name == name {
			return tag.ID
		}
	}
	made, err := w.tagStore(t).CreateTag(ctx, w.instance, name)
	if err != nil {
		t.Fatalf("CreateTag %s: %v", name, err)
	}
	return made.ID
}

func (w stepRunWalk) groupCarrying(t *testing.T, name string, tags ...string) string {
	t.Helper()
	ctx := context.Background()
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	group, err := um.CreateGroup(ctx, mwanachamaactor.Group{Name: name})
	if err != nil {
		t.Fatalf("CreateGroup %s: %v", name, err)
	}
	for _, tag := range tags {
		if err := w.tagStore(t).GiveGroupTag(ctx, w.instance, group.ID, w.tagID(t, tag)); err != nil {
			t.Fatalf("GiveGroupTag %s: %v", tag, err)
		}
	}
	return group.ID
}

func (w stepRunWalk) reachingEveryRow(t *testing.T, groupID string) {
	t.Helper()
	if err := w.tagStore(t).GiveGroupTag(context.Background(), w.instance, groupID, w.tagID(t, agencies.SystemTagName)); err != nil {
		t.Fatalf("GiveGroupTag all: %v", err)
	}
}

func (w stepRunWalk) callerIn(t *testing.T, subject, role, groupID string) *http.Cookie {
	t.Helper()
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, subject, agencies.RoleAgent); err != nil {
		t.Fatalf("AddMember %s: %v", subject, err)
	}
	w.grantSeat(t, subject, groupID, w.roles[role])
	as := w.cookieFor(t, subject)
	w.assumeDirectly(t, as, subject, groupID)
	return as
}

func (w reachWalk) seedTagged(t *testing.T, tender string, tags ...string) agencymodels.RecordRow {
	t.Helper()
	ids := []string{}
	for _, tag := range tags {
		ids = append(ids, w.tagID(t, tag))
	}
	row, err := w.manager.CreateRecordRow(context.Background(), agencymodels.RecordRow{
		DraftID: w.liveID, RecordID: w.record.ID, RoleID: w.record.RoleID, AddedBy: "seed",
		Answers: map[string]string{"Tender": tender}, Tags: ids,
	})
	if err != nil {
		t.Fatalf("seed row %s: %v", tender, err)
	}
	return row
}

func (w reachWalk) tendersListedFor(t *testing.T, as *http.Cookie) []string {
	t.Helper()
	rec := w.call(t, "GET", "/instances/"+w.instance+"/live-records/"+w.record.Key+"/rows", nil, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("list rows: %d %s, want 200", rec.Code, rec.Body.String())
	}
	var rows []agencymodels.RecordRow
	decodeInto(t, rec, &rows)
	names := []string{}
	for _, row := range rows {
		names = append(names, w.promptsOfRow(t, row)["Tender"])
	}
	slices.Sort(names)
	return names
}

func (w reachWalk) seedTheFourRows(t *testing.T) {
	t.Helper()
	w.seedTagged(t, "Emea only", "emea")
	w.seedTagged(t, "Apac only", "apac")
	w.seedTagged(t, "Both", "emea", "apac")
	w.seedTagged(t, "Untagged")
}

func wantTenders(t *testing.T, who string, got []string, want ...string) {
	t.Helper()
	slices.Sort(want)
	if !slices.Equal(got, want) {
		t.Errorf("%s lists %v, want %v", who, got, want)
	}
}

func TestTheRowListReachesTheRowsThatShareATagWithTheAssumedGroup(t *testing.T) {
	w := newReachWalk(t)
	w.seedTheFourRows(t)
	emea := w.callerIn(t, "emea-coordinator", "Coordinator", w.groupCarrying(t, "EMEA", "emea"))
	apac := w.callerIn(t, "apac-coordinator", "Coordinator", w.groupCarrying(t, "APAC", "apac"))

	wantTenders(t, "a group with emea", w.tendersListedFor(t, emea), "Emea only", "Both")
	wantTenders(t, "a group with apac", w.tendersListedFor(t, apac), "Apac only", "Both")
}

func TestTheRowListOfAGroupWithTheTagAllReachesEveryRowEvenOneWithNoTag(t *testing.T) {
	w := newReachWalk(t)
	w.seedTheFourRows(t)
	everything := w.callerIn(t, "admin-coordinator", "Coordinator", w.groupCarrying(t, "Everything", "all"))

	wantTenders(t, "a group with all", w.tendersListedFor(t, everything), "Emea only", "Apac only", "Both", "Untagged")
}

func TestTheRowListOfAGroupWithAnotherTagAndAllReachesEveryRow(t *testing.T) {
	w := newReachWalk(t)
	w.seedTheFourRows(t)
	mixed := w.callerIn(t, "mixed-coordinator", "Coordinator", w.groupCarrying(t, "Mixed", "emea", "all"))

	wantTenders(t, "a group with emea and all", w.tendersListedFor(t, mixed), "Emea only", "Apac only", "Both", "Untagged")
}

func TestTheRowListOfAGroupWithNoTagReachesNoRow(t *testing.T) {
	w := newReachWalk(t)
	w.seedTheFourRows(t)
	bare := w.callerIn(t, "bare-coordinator", "Coordinator", w.groupCarrying(t, "Bare"))

	wantTenders(t, "a group with no tag", w.tendersListedFor(t, bare))
}

func TestTheRowListOfACallerWithNoAssumedGroupReachesNoRowEvenWithTheViewRole(t *testing.T) {
	w := newReachWalk(t)
	w.seedTheFourRows(t)
	group := w.groupCarrying(t, "EMEA", "emea")
	w.callerIn(t, "seated-only", "Coordinator", group)
	notAssumed := w.cookieFor(t, "seated-only")

	rec := w.call(t, "GET", "/instances/"+w.instance+"/live-records/"+w.record.Key+"/rows", nil, notAssumed)
	if rec.Code == http.StatusOK && !strings.Contains(rec.Body.String(), "[]") {
		t.Errorf("a person who has not assumed a group lists %s, want no row", rec.Body.String())
	}
}

func TestTheRowListOfTheOwnerFollowsTheAssumedGroupLikeAnyoneElse(t *testing.T) {
	w := newReachWalk(t)
	w.seedTheFourRows(t)

	wantTenders(t, "the owner with no assumed group", w.tendersListedFor(t, w.cookieFor(t, "test-owner")))

	w.assumeDirectly(t, w.owner, "test-owner", w.groupCarrying(t, "Owner group", "apac"))
	wantTenders(t, "the owner assuming apac", w.tendersListedFor(t, w.owner), "Apac only", "Both")

	w.assumeDirectly(t, w.owner, "test-owner", w.groupCarrying(t, "Owner bare"))
	wantTenders(t, "the owner assuming a group with no tag", w.tendersListedFor(t, w.owner))
}

func TestTheRowListKeepsTheHistoryOfOnlyTheRowsTheGroupReaches(t *testing.T) {
	w := newReachWalk(t)
	apacRow := w.seedTagged(t, "Apac only", "apac")
	w.seedTagged(t, "Emea only", "emea")
	emea := w.callerIn(t, "emea-coordinator", "Coordinator", w.groupCarrying(t, "EMEA", "emea"))
	if _, err := w.manager.CreateRecordRow(context.Background(), agencymodels.RecordRow{
		DraftID: w.liveID, RecordID: w.record.ID, RoleID: w.record.RoleID, AddedBy: "seed",
		Answers: map[string]string{"Tender": "Apac corrected"}, Replaces: apacRow.ID,
	}); err != nil {
		t.Fatalf("seed correction: %v", err)
	}

	rec := w.call(t, "GET", "/instances/"+w.instance+"/live-records/"+w.record.Key+"/rows?history=true", nil, emea)
	if rec.Code != http.StatusOK {
		t.Fatalf("history: %d %s, want 200", rec.Code, rec.Body.String())
	}
	var rows []agencymodels.RecordRow
	decodeInto(t, rec, &rows)
	if len(rows) != 0 {
		t.Errorf("history of a group with emea holds %d rows, want none: the replaced row is apac", len(rows))
	}
}

func refusedAsNotACurrentRow(t *testing.T, what string, rec *httptest.ResponseRecorder) {
	t.Helper()
	body := rec.Body.String()
	if rec.Code != http.StatusBadRequest || !strings.Contains(body, "row_id is not a current row of Tenders") {
		t.Errorf("%s: %d %s, want 400 saying row_id is not a current row of Tenders", what, rec.Code, body)
	}
	lowered := strings.ToLower(body)
	if strings.Contains(lowered, "tag") || strings.Contains(lowered, "group") {
		t.Errorf("%s: %s says more than that the row is not a current row", what, body)
	}
}

func (w reachWalk) editBody(row agencymodels.RecordRow) map[string]any {
	return map[string]any{"row_id": row.ID, "answers": map[string]string{"Tender": "Changed"}}
}

func (w reachWalk) deleteBody(row agencymodels.RecordRow) map[string]any {
	return map[string]any{"row_id": row.ID, "answers": map[string]string{"Why is it removed": "Entered twice"}}
}

func TestAnEditStepRefusesARowTheAssumedGroupDoesNotReach(t *testing.T) {
	w := newReachWalk(t)
	apacRow := w.seedTagged(t, "Apac only", "apac")
	emeaRow := w.seedTagged(t, "Emea only", "emea")
	emea := w.callerIn(t, "emea-liaison", "Liaison", w.groupCarrying(t, "EMEA", "emea"))

	refusedAsNotACurrentRow(t, "edit of an apac row by emea", w.send(t, emea, "edit", w.editBody(apacRow)))
	if rec := w.send(t, emea, "edit", w.editBody(emeaRow)); rec.Code != http.StatusCreated {
		t.Errorf("edit of an emea row by emea: %d %s, want 201", rec.Code, rec.Body.String())
	}
}

func TestAnEditStepRefusesARowWithNoTagUnlessTheGroupCarriesAll(t *testing.T) {
	w := newReachWalk(t)
	untagged := w.seedTagged(t, "Old row")
	emea := w.callerIn(t, "emea-liaison", "Liaison", w.groupCarrying(t, "EMEA", "emea"))
	everything := w.callerIn(t, "admin-liaison", "Liaison", w.groupCarrying(t, "Everything", "all"))

	refusedAsNotACurrentRow(t, "edit of an untagged row by emea", w.send(t, emea, "edit", w.editBody(untagged)))
	if rec := w.send(t, everything, "edit", w.editBody(untagged)); rec.Code != http.StatusCreated {
		t.Errorf("edit of an untagged row by a group with all: %d %s, want 201", rec.Code, rec.Body.String())
	}
}

func TestADeleteStepAsksOnlyWhetherTheAssumedGroupReachesTheRow(t *testing.T) {
	w := newReachWalk(t)
	apacRow := w.seedTagged(t, "Apac only", "apac")
	emeaRow := w.seedTagged(t, "Emea only", "emea")
	emea := w.callerIn(t, "emea-volunteer", "Volunteer", w.groupCarrying(t, "EMEA", "emea"))
	bare := w.callerIn(t, "bare-volunteer", "Volunteer", w.groupCarrying(t, "Bare"))

	refusedAsNotACurrentRow(t, "delete of an apac row by emea", w.send(t, emea, "delete", w.deleteBody(apacRow)))
	refusedAsNotACurrentRow(t, "delete of an emea row by a group with no tag", w.send(t, bare, "delete", w.deleteBody(emeaRow)))
	if rec := w.send(t, emea, "delete", w.deleteBody(emeaRow)); rec.Code != http.StatusCreated {
		t.Errorf("delete of an emea row by emea: %d %s, want 201", rec.Code, rec.Body.String())
	}
}

func TestADirectEditThroughReplacesRefusesARowTheOwnersGroupDoesNotReach(t *testing.T) {
	w := newReachWalk(t)
	apacRow := w.seedTagged(t, "Apac only", "apac")
	emeaRow := w.seedTagged(t, "Emea only", "emea")
	w.assumeDirectly(t, w.owner, "test-owner", w.groupCarrying(t, "Owner group", "emea"))
	path := "/instances/" + w.instance + "/live-records/" + w.record.Key + "/rows"
	edit := func(row agencymodels.RecordRow) *httptest.ResponseRecorder {
		return w.call(t, "POST", path, map[string]any{"answers": map[string]string{"Tender": "Changed " + row.ID}, "replaces": row.ID}, w.owner)
	}

	refusedAsNotACurrentRow(t, "direct edit of an apac row by the owner in emea", edit(apacRow))
	if rec := edit(emeaRow); rec.Code != http.StatusCreated {
		t.Errorf("direct edit of an emea row by the owner in emea: %d %s, want 201", rec.Code, rec.Body.String())
	}
}

func TestStartingASubjectWorkflowRefusesARowTheAssumedGroupDoesNotReach(t *testing.T) {
	w := newSubjectWalk(t, true)
	seed := func(tender string, tags ...string) string {
		ids := []string{}
		for _, tag := range tags {
			ids = append(ids, w.tagID(t, tag))
		}
		row, err := w.manager.CreateRecordRow(context.Background(), agencymodels.RecordRow{
			DraftID: w.liveID, RecordID: w.tenders.ID, RoleID: w.tenders.RoleID, AddedBy: "seed",
			Answers: map[string]string{"Tender": tender}, Tags: ids,
		})
		if err != nil {
			t.Fatalf("seed row %s: %v", tender, err)
		}
		return row.ID
	}
	apacRow, emeaRow := seed("Apac only", "apac"), seed("Emea only", "emea")
	emea := w.callerIn(t, "emea-volunteer", "Volunteer", w.groupCarrying(t, "EMEA", "emea"))
	start := func(row string) *httptest.ResponseRecorder {
		return w.call(t, "POST", "/instances/"+w.instance+"/steps/"+w.steps["Report a referral"]+"/answers", map[string]any{"answers": referralAnswers(), "row_id": row}, emea)
	}

	if rec := start(apacRow); rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "row_id is not a current row of Tenders") || strings.Contains(strings.ToLower(rec.Body.String()), "tag") {
		t.Errorf("start on an apac row by emea: %d %s, want 400 saying row_id is not a current row of Tenders", rec.Code, rec.Body.String())
	}
	if rec := start(emeaRow); rec.Code != http.StatusCreated {
		t.Errorf("start on an emea row by emea: %d %s, want 201", rec.Code, rec.Body.String())
	}
}
