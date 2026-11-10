package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"wakalaserver/internal/agencies"
	mwanachamaactor "wakalaserver/modules/actor"
)

type invitedNamesDirectory struct {
	mwanachamaactor.UserManager
	groups map[string]string
	broken bool
	asked  []string
}

func (d *invitedNamesDirectory) GetGroup(_ context.Context, id string) (mwanachamaactor.Group, error) {
	d.asked = append(d.asked, id)
	if d.broken {
		return mwanachamaactor.Group{}, errors.New("directory down")
	}
	name, ok := d.groups[id]
	if !ok {
		return mwanachamaactor.Group{}, mwanachamaactor.ErrGroupNotFound
	}
	return mwanachamaactor.Group{Name: name}, nil
}

type invitedNamesRegistry struct {
	agencies.Registry
	directory mwanachamaactor.UserManager
	err       error
}

func (r invitedNamesRegistry) ActorManager(context.Context, string) (mwanachamaactor.UserManager, error) {
	return r.directory, r.err
}

func invitedNamesRow(fields map[string]string) map[string]json.RawMessage {
	row := map[string]json.RawMessage{}
	for k, v := range fields {
		row[k], _ = json.Marshal(v)
	}
	return row
}

func TestInvitationListRowsCarryTheGroupName(t *testing.T) {
	directory := &invitedNamesDirectory{groups: map[string]string{"g1": "Gardeners"}}
	reg := invitedNamesRegistry{directory: directory}
	rewrite := invitedGroupNamesRewrite(reg, "actor.invitation.list_mine")
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rows := []map[string]json.RawMessage{
		invitedNamesRow(map[string]string{"group_id": "g1"}),
		invitedNamesRow(map[string]string{"group_id": "g1"}),
		invitedNamesRow(map[string]string{"group_id": "deleted"}),
	}
	out, err := rewrite(req, rows)
	if err != nil {
		t.Fatal(err)
	}
	names := []string{stringField(out[0], groupNameField), stringField(out[1], groupNameField), stringField(out[2], groupNameField)}
	if names[0] != "Gardeners" || names[1] != "Gardeners" || names[2] != "" {
		t.Fatalf("names %v: a group that is gone must read as an empty name, others by name", names)
	}
	if len(directory.asked) != 2 {
		t.Fatalf("each group is looked up once, asked %v", directory.asked)
	}
}

func TestNotificationRowsAreNamedOnlyForGroupInvitations(t *testing.T) {
	directory := &invitedNamesDirectory{groups: map[string]string{"g1": "Gardeners"}}
	rewrite := invitedGroupNamesRewrite(invitedNamesRegistry{directory: directory}, "comm.notification.list")
	rows := []map[string]json.RawMessage{
		invitedNamesRow(map[string]string{"Event": "group_invited", "SubjectKind": "group", "SubjectID": "g1"}),
		invitedNamesRow(map[string]string{"Event": "group_invited", "SubjectKind": "task", "SubjectID": "g1"}),
		invitedNamesRow(map[string]string{"Event": "something_else", "SubjectKind": "group", "SubjectID": "g1"}),
	}
	out, err := rewrite(httptest.NewRequest(http.MethodGet, "/", nil), rows)
	if err != nil {
		t.Fatal(err)
	}
	if stringField(out[0], groupNameField) != "Gardeners" {
		t.Fatal("a group invitation notice must carry the group name")
	}
	if _, named := out[1][groupNameField]; named {
		t.Fatal("a notice about another subject must stay as it was")
	}
	if _, named := out[2][groupNameField]; named {
		t.Fatal("another event must stay as it was")
	}
}

func TestOtherListsAreNotRewritten(t *testing.T) {
	if invitedGroupNamesRewrite(invitedNamesRegistry{}, "actor.group.list") != nil {
		t.Fatal("a list that names no groups must have no rewrite")
	}
	served := false
	handler := withInvitedGroupNames(invitedNamesRegistry{}, "actor.group.list", func(w http.ResponseWriter, r *http.Request) {
		served = true
		w.WriteHeader(http.StatusTeapot)
	})
	rec := httptest.NewRecorder()
	handler(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if !served || rec.Code != http.StatusTeapot {
		t.Fatalf("the plain handler must be served untouched, got %d", rec.Code)
	}
}

func TestNamingRowsHandlesEmptyAndFailingDirectories(t *testing.T) {
	field := groupNamedLists["actor.invitation.list_mine"]
	ctx := context.Background()

	out, err := field.nameEach(ctx, invitedNamesRegistry{}, "i", nil)
	if err != nil || out == nil || len(out) != 0 {
		t.Fatalf("no rows must give an empty list, not null: %v %v", out, err)
	}

	untouched := []map[string]json.RawMessage{invitedNamesRow(map[string]string{"other": "x"})}
	untouched[0]["group_id"] = nil
	notice := groupNamedLists["comm.notification.list"]
	same, err := notice.nameEach(ctx, invitedNamesRegistry{err: errors.New("never asked")}, "i", untouched)
	if err != nil || len(same) != 1 {
		t.Fatalf("rows with nothing to name must pass without asking the directory: %v", err)
	}

	rows := []map[string]json.RawMessage{invitedNamesRow(map[string]string{"group_id": "g1"})}
	if _, err := field.nameEach(ctx, invitedNamesRegistry{err: agencies.ErrInstanceNotFound}, "i", rows); !errors.Is(err, agencies.ErrInstanceNotFound) {
		t.Fatalf("an unknown agency must be reported, got %v", err)
	}
	broken := &invitedNamesDirectory{broken: true}
	if _, err := field.nameEach(ctx, invitedNamesRegistry{directory: broken}, "i", rows); err == nil {
		t.Fatal("a failing directory must fail the list, not hide the names")
	}
}

func TestGroupNamesByIDSkipsBlankIDs(t *testing.T) {
	directory := &invitedNamesDirectory{groups: map[string]string{"g1": "Gardeners"}}
	names, err := groupNamesByID(context.Background(), directory, []string{"", "g1", "g1"})
	if err != nil || len(names) != 1 || names["g1"] != "Gardeners" || len(directory.asked) != 1 {
		t.Fatalf("names %v asked %v err %v", names, directory.asked, err)
	}
}
