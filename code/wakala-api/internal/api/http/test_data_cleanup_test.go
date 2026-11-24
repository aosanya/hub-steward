package http

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"testing"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

	"wakalaserver/internal/agencies"
)

const (
	testDataTagName   = "test-data"
	testDataGroupName = "Test data"
)

type cleanupWalk struct {
	rowStepWalk
}

type cleanupReport struct {
	TagID        string         `json:"tag_id"`
	TagName      string         `json:"tag_name"`
	GroupID      string         `json:"group_id"`
	GroupName    string         `json:"group_name"`
	SeatsGranted int            `json:"seats_granted"`
	RowsTagged   map[string]int `json:"rows_tagged"`
}

func (r cleanupReport) rowsTaggedInAll() int {
	total := 0
	for _, n := range r.RowsTagged {
		total += n
	}
	return total
}

func newCleanupWalk(t *testing.T) cleanupWalk {
	t.Helper()
	return cleanupWalk{newRowStepWalk(t, nil)}
}

func (w cleanupWalk) recordsNamed(t *testing.T, names ...string) []agencymodels.Record {
	t.Helper()
	listed, err := w.manager.ListRecords(context.Background(), w.liveID, mwanachamaagency.RecordFilter{})
	if err != nil {
		t.Fatalf("ListRecords: %v", err)
	}
	found := []agencymodels.Record{}
	for _, name := range names {
		i := slices.IndexFunc(listed, func(r agencymodels.Record) bool { return r.Name == name })
		if i < 0 {
			t.Fatalf("the live version has no record %s", name)
		}
		found = append(found, listed[i])
	}
	return found
}

func answersFor(record agencymodels.Record, label string, n int) map[string]string {
	answers := map[string]string{}
	for _, question := range record.Questions {
		switch question.AnswerType {
		case agencymodels.AnswerNumber:
			answers[question.Prompt] = fmt.Sprint(n)
		case agencymodels.AnswerYesNo:
			answers[question.Prompt] = "yes"
		default:
			answers[question.Prompt] = label
		}
	}
	return answers
}

func (w cleanupWalk) seedRow(t *testing.T, record agencymodels.Record, label string, n int, tags ...string) agencymodels.RecordRow {
	t.Helper()
	ids := []string{}
	for _, tag := range tags {
		ids = append(ids, w.tagID(t, tag))
	}
	row, err := w.manager.CreateRecordRow(context.Background(), agencymodels.RecordRow{
		DraftID: w.liveID, RecordID: record.ID, RoleID: record.RoleID, AddedBy: "seed",
		Answers: answersFor(record, label, n), Tags: ids,
	})
	if err != nil {
		t.Fatalf("seed row %s: %v", label, err)
	}
	return row
}

func (w cleanupWalk) seedUntaggedRows(t *testing.T, record agencymodels.Record, count int) {
	t.Helper()
	for i := 0; i < count; i++ {
		w.seedRow(t, record, fmt.Sprintf("%s row %d", record.Name, i+1), i+1)
	}
}

func (w cleanupWalk) runCleanup(t *testing.T, as *http.Cookie) cleanupReport {
	t.Helper()
	rec := w.call(t, "POST", "/instances/"+w.instance+"/test-data-cleanup", nil, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("test-data cleanup: %d %s, want 200", rec.Code, rec.Body.String())
	}
	var report cleanupReport
	decodeInto(t, rec, &report)
	return report
}

func (w cleanupWalk) rowIDsCarrying(t *testing.T, record agencymodels.Record, tagID string) []string {
	t.Helper()
	rows, err := w.manager.ListRecordRows(context.Background(), w.liveID, mwanachamaagency.RecordRowFilter{RecordID: record.ID, Tags: []string{tagID}})
	if err != nil {
		t.Fatalf("ListRecordRows: %v", err)
	}
	ids := []string{}
	for _, row := range rows {
		ids = append(ids, row.ID)
	}
	slices.Sort(ids)
	return ids
}

func (w cleanupWalk) allRows(t *testing.T, record agencymodels.Record) []agencymodels.RecordRow {
	t.Helper()
	rows, err := w.manager.ListRecordRows(context.Background(), w.liveID, mwanachamaagency.RecordRowFilter{RecordID: record.ID})
	if err != nil {
		t.Fatalf("ListRecordRows: %v", err)
	}
	return rows
}

func (w cleanupWalk) directory(t *testing.T) mwanachamaactor.UserManager {
	t.Helper()
	um, err := w.deps.Registry.ActorManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	return um
}

func (w cleanupWalk) groupsNamed(t *testing.T, name string) []mwanachamaactor.Group {
	t.Helper()
	groups, err := w.directory(t).ListGroups(context.Background(), "")
	if err != nil {
		t.Fatalf("ListGroups: %v", err)
	}
	named := []mwanachamaactor.Group{}
	for _, group := range groups {
		if group.Name == name {
			named = append(named, group)
		}
	}
	return named
}

func (w cleanupWalk) kindsHeldIn(t *testing.T, actorID, inGroup string) []string {
	t.Helper()
	seats, err := w.directory(t).ListRoleAssignmentsForActor(context.Background(), actorID, true)
	if err != nil {
		t.Fatalf("ListRoleAssignmentsForActor %s: %v", actorID, err)
	}
	kinds := []string{}
	for _, seat := range seats {
		if seat.GroupID == inGroup {
			kinds = append(kinds, seat.KindID)
		}
	}
	slices.Sort(kinds)
	return slices.Compact(kinds)
}

func (w cleanupWalk) kindsHeldOutside(t *testing.T, actorID, group string) []string {
	t.Helper()
	seats, err := w.directory(t).ListRoleAssignmentsForActor(context.Background(), actorID, true)
	if err != nil {
		t.Fatalf("ListRoleAssignmentsForActor %s: %v", actorID, err)
	}
	kinds := []string{}
	for _, seat := range seats {
		if seat.GroupID != group {
			kinds = append(kinds, seat.KindID)
		}
	}
	slices.Sort(kinds)
	return slices.Compact(kinds)
}

func (w cleanupWalk) seatCount(t *testing.T, groupID string) int {
	t.Helper()
	seats, err := w.directory(t).ListRoleAssignmentsForGroup(context.Background(), groupID, true)
	if err != nil {
		t.Fatalf("ListRoleAssignmentsForGroup: %v", err)
	}
	return len(seats)
}

func TestTheTestDataCleanupTagsEveryUntaggedRowOnceAndReportsTheCountPerRecord(t *testing.T) {
	w := newCleanupWalk(t)
	records := w.recordsNamed(t, "Tenders", "Report a referral", "Close the referral")
	counts := []int{3, 2, 1}
	for i, count := range counts {
		w.seedUntaggedRows(t, records[i], count)
	}
	emea := w.seedRow(t, records[2], "Emea row", 99, "emea")

	first := w.runCleanup(t, w.owner)

	if first.TagName != testDataTagName || first.TagID != w.tagID(t, testDataTagName) {
		t.Fatalf("the cleanup reports tag %q (%s), want the tag %s", first.TagName, first.TagID, testDataTagName)
	}
	for i, count := range counts {
		if got := first.RowsTagged[records[i].Identity()]; got != count {
			t.Errorf("rows tagged in %s: %d, want %d (%v)", records[i].Name, got, count, first.RowsTagged)
		}
		if got := len(w.rowIDsCarrying(t, records[i], first.TagID)); got != count {
			t.Errorf("rows of %s that carry %s: %d, want %d", records[i].Name, testDataTagName, got, count)
		}
	}
	for _, row := range w.allRows(t, records[2]) {
		if row.ID == emea.ID && !slices.Equal(row.Tags, emea.Tags) {
			t.Errorf("a row that already carried a tag now has %v, want %v", row.Tags, emea.Tags)
		}
	}

	before := map[string][]string{}
	for _, record := range records {
		before[record.ID] = w.rowIDsCarrying(t, record, first.TagID)
	}
	second := w.runCleanup(t, w.owner)
	if second.rowsTaggedInAll() != 0 {
		t.Errorf("the second run tagged %v, want no row", second.RowsTagged)
	}
	if second.TagID != first.TagID {
		t.Errorf("the second run uses tag %s, want the first run's %s", second.TagID, first.TagID)
	}
	for _, record := range records {
		if after := w.rowIDsCarrying(t, record, first.TagID); !slices.Equal(after, before[record.ID]) {
			t.Errorf("rows of %s that carry the tag changed on the second run: %v then %v", record.Name, before[record.ID], after)
		}
	}
}

func TestTheTestDataCleanupMakesOneGroupWithTheTagAndSeatsEveryoneInTheirOwnRoles(t *testing.T) {
	w := newCleanupWalk(t)
	w.seedUntaggedRows(t, w.record, 3)
	oldTeam := w.groupCarrying(t, "Old team")
	anna := w.callerIn(t, "anna", "Coordinator", oldTeam)
	w.grantSeat(t, "ben", oldTeam, w.roles["Liaison"])
	w.grantSeat(t, "ben", oldTeam, w.roles["Volunteer"])
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, "ben", agencies.RoleAgent); err != nil {
		t.Fatalf("AddMember ben: %v", err)
	}

	first := w.runCleanup(t, w.owner)

	groups := w.groupsNamed(t, testDataGroupName)
	if len(groups) != 1 || groups[0].ID != first.GroupID || first.GroupName != testDataGroupName {
		t.Fatalf("groups named %q: %v, report names %q (%s), want exactly the reported one", testDataGroupName, groups, first.GroupName, first.GroupID)
	}
	carried, err := w.tagStore(t).GroupTags(context.Background(), w.instance, first.GroupID)
	if err != nil || len(carried) != 1 || carried[0].ID != first.TagID {
		t.Fatalf("tags of the Test data group: %v (%v), want only %s", carried, err, testDataTagName)
	}
	for _, person := range []string{"anna", "ben", "test-owner"} {
		own := w.kindsHeldOutside(t, person, first.GroupID)
		there := w.kindsHeldIn(t, person, first.GroupID)
		if len(own) == 0 || !slices.Equal(own, there) {
			t.Errorf("%s holds roles %v elsewhere and %v in Test data, want the same roles in both", person, own, there)
		}
	}

	w.assumeDirectly(t, anna, "anna", first.GroupID)
	wantTenders(t, "a person who assumed Test data", w.tendersListedFor(t, anna), "Tenders row 1", "Tenders row 2", "Tenders row 3")

	seats := w.seatCount(t, first.GroupID)
	second := w.runCleanup(t, w.owner)
	if second.GroupID != first.GroupID || len(w.groupsNamed(t, testDataGroupName)) != 1 {
		t.Errorf("the second run made another group: %s then %s", first.GroupID, second.GroupID)
	}
	if second.SeatsGranted != 0 || w.seatCount(t, first.GroupID) != seats {
		t.Errorf("the second run granted %d seats and the group holds %d, want none granted and %d held", second.SeatsGranted, w.seatCount(t, first.GroupID), seats)
	}
}

func (w cleanupWalk) tendersListedFor(t *testing.T, as *http.Cookie) []string {
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

func TestTheTestDataCleanupIsRefusedToAnyoneButTheOwnerAndChangesNothing(t *testing.T) {
	w := newCleanupWalk(t)
	w.seedUntaggedRows(t, w.record, 2)
	member := w.callerIn(t, "anna", "Coordinator", w.groupCarrying(t, "Old team"))

	rec := w.call(t, "POST", "/instances/"+w.instance+"/test-data-cleanup", nil, member)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("the cleanup run by a member: %d %s, want 403", rec.Code, rec.Body.String())
	}
	listed, err := w.tagStore(t).ListTags(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("ListTags: %v", err)
	}
	for _, tag := range listed {
		if tag.Name == testDataTagName {
			t.Errorf("a refused cleanup made the tag %s", testDataTagName)
		}
	}
	if len(w.groupsNamed(t, testDataGroupName)) != 0 {
		t.Errorf("a refused cleanup made the group %s", testDataGroupName)
	}
}
