package http

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

type firstGroupWalk struct {
	stepRunWalk
}

func newFirstGroupWalk(t *testing.T) firstGroupWalk {
	t.Helper()
	return firstGroupWalk{newStepRunWalk(t, nil)}
}

func (w firstGroupWalk) createInstance(t *testing.T, name string) string {
	t.Helper()
	rec := w.call(t, "POST", "/instances", map[string]any{"name": name}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create %s: %d %s", name, rec.Code, rec.Body.String())
	}
	id, _ := decodeObject(t, rec)["id"].(string)
	return id
}

func (w firstGroupWalk) myGroups(t *testing.T, instance string) []map[string]any {
	t.Helper()
	rec := w.call(t, "GET", "/instances/"+instance+"/my-groups", nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("my-groups of %s: %d %s", instance, rec.Code, rec.Body.String())
	}
	var out []map[string]any
	for _, g := range decodeObject(t, rec)["groups"].([]any) {
		out = append(out, g.(map[string]any))
	}
	return out
}

func (w firstGroupWalk) directoryGroups(t *testing.T, instance string) int {
	t.Helper()
	directory, err := w.deps.Registry.ActorManager(context.Background(), instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	groups, err := directory.ListGroups(context.Background(), "")
	if err != nil {
		t.Fatalf("ListGroups: %v", err)
	}
	return len(groups)
}

func roleNames(group map[string]any) []string {
	var out []string
	for _, r := range group["roles"].([]any) {
		out = append(out, r.(string))
	}
	return out
}

func TestFirstGroup_NewInstanceSeatsItsOwnerAsAdministrator(t *testing.T) {
	w := newFirstGroupWalk(t)
	instance := w.createInstance(t, "Water board")

	groups := w.myGroups(t, instance)
	if len(groups) != 1 {
		t.Fatalf("groups of the owner of a new Instance: %v, want one", groups)
	}
	if groups[0]["name"] != "Administrators" {
		t.Fatalf("name of the first group: %v, want Administrators", groups[0]["name"])
	}
	if roles := roleNames(groups[0]); len(roles) != 1 || roles[0] != "Administrator" {
		t.Fatalf("roles of the owner in the first group: %v, want Administrator", roles)
	}
}

func TestFirstGroup_OwnerAssumesTheFirstGroup(t *testing.T) {
	w := newFirstGroupWalk(t)
	instance := w.createInstance(t, "Water board")
	groups := w.myGroups(t, instance)
	if len(groups) != 1 {
		t.Fatalf("groups of the owner of a new Instance: %v, want one", groups)
	}

	rec := w.call(t, "PUT", "/instances/"+instance+"/my-group", map[string]any{"group_id": groups[0]["id"]}, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("owner assumes the first group: %d %s, want 200", rec.Code, rec.Body.String())
	}
	read := w.call(t, "GET", "/instances/"+instance+"/my-group", nil, w.owner)
	group, _ := decodeObject(t, read)["group"].(map[string]any)
	if group["id"] != groups[0]["id"] {
		t.Fatalf("assumed group: %s, want %v", read.Body.String(), groups[0]["id"])
	}
}

func TestFirstGroup_InstanceCreatedBeforeIsUntouched(t *testing.T) {
	w := newFirstGroupWalk(t)
	ctx := context.Background()
	older, err := w.deps.Registry.CreateInstance(ctx, "Older board")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, older.ID, "test-owner", agencies.RoleOwner); err != nil {
		t.Fatalf("AddMember: %v", err)
	}

	if groups := w.myGroups(t, older.ID); len(groups) != 0 {
		t.Fatalf("groups of the owner of an older Instance: %v, want none", groups)
	}
	if got := w.directoryGroups(t, older.ID); got != 0 {
		t.Fatalf("groups in the directory of an older Instance: %d, want none", got)
	}
}

func TestFirstGroup_EachNewInstanceGetsOneGroupOfItsOwn(t *testing.T) {
	w := newFirstGroupWalk(t)
	first := w.createInstance(t, "Water board")
	second := w.createInstance(t, "Road board")

	for _, instance := range []string{first, second} {
		if got := w.directoryGroups(t, instance); got != 1 {
			t.Fatalf("groups in the directory of %s: %d, want one", instance, got)
		}
	}
}

func TestFirstGroup_SeatingTheOwnerAgainMakesNoSecondGroup(t *testing.T) {
	w := newFirstGroupWalk(t)
	instance := w.createInstance(t, "Water board")

	if err := agencies.SeatOwnerInFirstGroup(context.Background(), w.deps.Registry, instance, "test-owner"); err != nil {
		t.Fatalf("seat the owner again: %v", err)
	}
	if got := w.directoryGroups(t, instance); got != 1 {
		t.Fatalf("groups after seating twice: %d, want one", got)
	}
	if groups := w.myGroups(t, instance); len(groups) != 1 || len(roleNames(groups[0])) != 1 {
		t.Fatalf("groups of the owner after seating twice: %v, want one group and one seat", groups)
	}
}

func TestFirstGroup_AgentToolSeatsTheOwner(t *testing.T) {
	w := newFirstGroupWalk(t)
	ctx := accounts.WithID(context.Background(), "test-owner")

	_, out, err := w.deps.mcpCreateInstance(ctx, nil, mcpCreateInstanceParams{Name: "Water board"})
	if err != nil {
		t.Fatalf("agency_create_instance: %v", err)
	}
	if groups := w.myGroups(t, out.ID); len(groups) != 1 || groups[0]["name"] != "Administrators" {
		t.Fatalf("groups of the owner after the tool: %v, want Administrators", groups)
	}
}

func TestFirstGroup_ImportedInstanceSeatsItsOwner(t *testing.T) {
	w := newFirstGroupWalk(t)
	raw, err := os.ReadFile(filepath.Join("testdata", "git_mounted_agency.json"))
	if err != nil {
		t.Fatalf("read the fixture: %v", err)
	}
	rec := w.call(t, "POST", "/instances/import", json.RawMessage(raw), w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("import: %d %s", rec.Code, rec.Body.String())
	}
	var result importResult
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode import result: %v", err)
	}

	if groups := w.myGroups(t, result.Instance.ID); len(groups) != 1 || groups[0]["name"] != "Administrators" {
		t.Fatalf("groups of the owner of an imported Instance: %v, want Administrators", groups)
	}
}
