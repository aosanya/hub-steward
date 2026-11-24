package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func (w stepRunWalk) newTag(t *testing.T, name string) string {
	t.Helper()
	rec := w.call(t, "POST", "/instances/"+w.instance+"/tags", map[string]any{"name": name}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create tag %q: %d %s", name, rec.Code, rec.Body.String())
	}
	id, _ := decodeObject(t, rec)["id"].(string)
	return id
}

func (w stepRunWalk) systemTag(t *testing.T) string {
	t.Helper()
	rec := w.call(t, "GET", "/instances/"+w.instance+"/tags", nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("list tags: %d %s", rec.Code, rec.Body.String())
	}
	items, _ := decodeObject(t, rec)["items"].([]any)
	for _, item := range items {
		tag := item.(map[string]any)
		if tag["system"] == true {
			return tag["id"].(string)
		}
	}
	t.Fatalf("no system tag in %s", rec.Body.String())
	return ""
}

func (w stepRunWalk) giveGroupTag(t *testing.T, groupID, tagID string) {
	t.Helper()
	rec := w.call(t, "POST", "/instances/"+w.instance+"/group-tags", map[string]any{"group_id": groupID, "tag_id": tagID}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("give tag %s to group %s: %d %s", tagID, groupID, rec.Code, rec.Body.String())
	}
}

func (w stepRunWalk) newGroup(t *testing.T, name string) string {
	t.Helper()
	rec := w.call(t, "POST", "/instances/"+w.instance+"/actor/groups", map[string]any{"name": name}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create group %s: %d %s", name, rec.Code, rec.Body.String())
	}
	id, _ := decodeObject(t, rec)["id"].(string)
	return id
}

func (w stepRunWalk) assumedGroupOf(t *testing.T, as *http.Cookie) string {
	t.Helper()
	rec := w.call(t, "GET", "/instances/"+w.instance+"/my-group", nil, as)
	group, _ := decodeObject(t, rec)["group"].(map[string]any)
	id, _ := group["id"].(string)
	if id == "" {
		t.Fatalf("no assumed group: %d %s", rec.Code, rec.Body.String())
	}
	return id
}

func (w stepRunWalk) ownerAssumesItsFirstGroup(t *testing.T) string {
	t.Helper()
	rec := w.call(t, "GET", "/instances/"+w.instance+"/my-groups", nil, w.owner)
	groups, _ := decodeObject(t, rec)["groups"].([]any)
	if len(groups) != 1 {
		t.Fatalf("groups of the owner: %s, want one", rec.Body.String())
	}
	id := groups[0].(map[string]any)["id"].(string)
	if put := w.call(t, "PUT", "/instances/"+w.instance+"/my-group", map[string]any{"group_id": id}, w.owner); put.Code != http.StatusOK {
		t.Fatalf("the owner assumes %s: %d %s", id, put.Code, put.Body.String())
	}
	return id
}

func (w stepRunWalk) assumeNothing(t *testing.T, as *http.Cookie) {
	t.Helper()
	if err := w.db.Exec("DELETE FROM agency_assumed_groups WHERE session_key = ?", cookieSessionKeyOf(as.Value)).Error; err != nil {
		t.Fatalf("drop the assumed group: %v", err)
	}
}

func (w stepRunWalk) storedRow(t *testing.T, rowID string) agencymodels.RecordRow {
	t.Helper()
	ctx := context.Background()
	m, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	drafts, err := draftsOfEveryPublication(ctx, m)
	if err != nil {
		t.Fatalf("draftsOfEveryPublication: %v", err)
	}
	for _, id := range drafts {
		rows, err := m.ListRecordRows(ctx, id, mwanachamaagency.RecordRowFilter{IncludeRetired: true})
		if err != nil {
			t.Fatalf("ListRecordRows: %v", err)
		}
		for _, row := range rows {
			if row.ID == rowID {
				return row
			}
		}
	}
	t.Fatalf("the sibling holds no row %s", rowID)
	return agencymodels.RecordRow{}
}

func (w stepRunWalk) storedRowCount(t *testing.T) int {
	t.Helper()
	ctx := context.Background()
	m, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	drafts, err := draftsOfEveryPublication(ctx, m)
	if err != nil {
		t.Fatalf("draftsOfEveryPublication: %v", err)
	}
	count := 0
	for _, id := range drafts {
		rows, err := m.ListRecordRows(ctx, id, mwanachamaagency.RecordRowFilter{IncludeRetired: true})
		if err != nil {
			t.Fatalf("ListRecordRows: %v", err)
		}
		count += len(rows)
	}
	return count
}

func sameTags(got []string, want ...string) bool {
	got, want = slices.Clone(got), slices.Clone(want)
	slices.Sort(got)
	slices.Sort(want)
	return slices.Equal(got, want)
}

func (w rowStepWalk) addTenderTagged(t *testing.T, as *http.Cookie, tender string) agencymodels.RecordRow {
	t.Helper()
	return w.storedRow(t, w.add(t, as, tender))
}

func (w rowStepWalk) reportReferral(t *testing.T, as *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	return w.submit(t, as, "Report a referral", map[string]string{"Reason": "Fever", "Minutes to the clinic": "12"}, "")
}

func TestAnAddRowStepTakesTheTagsOfTheGroupAssumed(t *testing.T) {
	w := newRowStepWalk(t, nil)
	emea, north := w.newTag(t, "emea"), w.newTag(t, "north")
	staff := w.assumedGroupOf(t, w.people["Coordinator"])
	w.giveGroupTag(t, staff, emea)
	w.giveGroupTag(t, staff, north)

	row := w.addTenderTagged(t, w.people["Coordinator"], "Road survey")
	if !sameTags(row.Tags, emea, north) {
		t.Fatalf("tags of the added row: %v, want emea %s and north %s", row.Tags, emea, north)
	}
}

func TestTheSamePersonInAnotherSessionStampsTheTagsOfThatSessionsGroup(t *testing.T) {
	w := newRowStepWalk(t, nil)
	emea, north, apac := w.newTag(t, "emea"), w.newTag(t, "north"), w.newTag(t, "apac")
	staff := w.assumedGroupOf(t, w.people["Coordinator"])
	w.giveGroupTag(t, staff, emea)
	w.giveGroupTag(t, staff, north)
	other := w.newGroup(t, "Asia")
	w.giveGroupTag(t, other, apac)
	subject := w.subjects["Coordinator"]
	w.grantSeat(t, subject, other, w.roles["Coordinator"])
	second := w.cookieAssuming(t, subject, other)

	first := w.addTenderTagged(t, w.people["Coordinator"], "Road survey")
	again := w.addTenderTagged(t, second, "Bridge survey")
	if !sameTags(first.Tags, emea, north) || !sameTags(again.Tags, apac) {
		t.Fatalf("tags of the two rows: %v and %v, want emea and north, then apac", first.Tags, again.Tags)
	}
}

func TestADesignedFormStepRowTakesTheTagsOfTheGroupAssumed(t *testing.T) {
	w := newRowStepWalk(t, nil)
	emea, north := w.newTag(t, "emea"), w.newTag(t, "north")
	staff := w.assumedGroupOf(t, w.people["Volunteer"])
	w.giveGroupTag(t, staff, emea)
	w.giveGroupTag(t, staff, north)

	rec := w.reportReferral(t, w.people["Volunteer"])
	if rec.Code != http.StatusCreated {
		t.Fatalf("report a referral: %d %s", rec.Code, rec.Body.String())
	}
	row := w.storedRow(t, decodeObject(t, rec)["row_id"].(string))
	if !sameTags(row.Tags, emea, north) {
		t.Fatalf("tags of the designed step row: %v, want emea %s and north %s", row.Tags, emea, north)
	}
}

func TestADirectAddByTheOwnerTakesTheTagsOfTheGroupTheOwnerAssumed(t *testing.T) {
	b := businessRegister(t)
	emea, north := b.newTag(t, "emea"), b.newTag(t, "north")
	administrators := b.ownerAssumesItsFirstGroup(t)
	b.giveGroupTag(t, administrators, emea)
	b.giveGroupTag(t, administrators, north)

	row := b.storedRow(t, b.addBusiness(t, "Alpha Bakery", b.alpha, "front desk", "", ""))
	if !sameTags(row.Tags, emea, north) {
		t.Fatalf("tags of the direct row: %v, want emea %s and north %s", row.Tags, emea, north)
	}
}

func TestAnEditKeepsTheTagsOfTheRowItReplaces(t *testing.T) {
	w := newRowStepWalk(t, nil)
	emea, north, apac := w.newTag(t, "emea"), w.newTag(t, "north"), w.newTag(t, "apac")
	staff := w.assumedGroupOf(t, w.people["Coordinator"])
	w.giveGroupTag(t, staff, emea)
	w.giveGroupTag(t, staff, north)
	other := w.newGroup(t, "Asia")
	w.giveGroupTag(t, other, apac)
	subject := w.subjects["Liaison"]
	w.grantSeat(t, subject, other, w.roles["Liaison"])
	editor := w.cookieAssuming(t, subject, other)
	original := w.addTenderTagged(t, w.people["Coordinator"], "Road survey")

	rec := w.send(t, editor, "edit", map[string]any{"row_id": original.ID, "answers": map[string]string{"Tender": "Road survey, phase two"}})
	if rec.Code != http.StatusCreated {
		t.Fatalf("edit as the group with apac: %d %s", rec.Code, rec.Body.String())
	}
	replacing := w.storedRow(t, decodeObject(t, rec)["row_id"].(string))
	if replacing.Replaces != original.ID || !sameTags(replacing.Tags, emea, north) {
		t.Fatalf("replacing row: replaces %q with tags %v, want %s with emea and north", replacing.Replaces, replacing.Tags, original.ID)
	}
}

func TestAGroupCarryingAllStampsAll(t *testing.T) {
	w := newRowStepWalk(t, nil)
	all := w.systemTag(t)
	staff := w.assumedGroupOf(t, w.people["Coordinator"])
	w.giveGroupTag(t, staff, all)

	row := w.addTenderTagged(t, w.people["Coordinator"], "Road survey")
	if !sameTags(row.Tags, all) {
		t.Fatalf("tags of the row added by a group with all: %v, want %s", row.Tags, all)
	}
}
