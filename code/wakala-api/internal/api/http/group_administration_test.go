package http

import (
	"context"
	"net/http"
	"slices"
	"strings"
	"testing"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"

	"wakalaserver/internal/agencies"
)

func (w tagWalk) roleCarriesGroupManagement(role string) {
	held := w.deps.rolePermissionsOverride
	roleID := w.roles[role]
	w.deps.rolePermissionsOverride = func(ctx context.Context, id string) ([]string, error) {
		codes, err := held(ctx, id)
		if err != nil || id != roleID {
			return codes, err
		}
		return append(slices.Clone(codes), groupManagePermission), nil
	}
}

func (w stepRunWalk) firstGroup(t *testing.T) string {
	t.Helper()
	rec := w.call(t, "GET", "/instances/"+w.instance+"/my-groups", nil, w.owner)
	groups, _ := decodeObject(t, rec)["groups"].([]any)
	if len(groups) != 1 {
		t.Fatalf("groups of the owner: %s, want the first group only", rec.Body.String())
	}
	return groups[0].(map[string]any)["id"].(string)
}

func (w stepRunWalk) assume(t *testing.T, as *http.Cookie, groupID string) {
	t.Helper()
	rec := w.call(t, "PUT", "/instances/"+w.instance+"/my-group", map[string]any{"group_id": groupID}, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("assume %s: %d %s", groupID, rec.Code, rec.Body.String())
	}
}

func (w stepRunWalk) ownerInFirstGroup(t *testing.T) *http.Cookie {
	t.Helper()
	as := w.cookieFor(t, "test-owner")
	w.assume(t, as, w.firstGroup(t))
	return as
}

func (w tagWalk) administratorSeatedInFirstGroup(t *testing.T, name string) *http.Cookie {
	t.Helper()
	ctx := context.Background()
	actorID, as := w.resident(t, name)
	um := w.directory(t)
	kinds, err := um.ListRoleKinds(ctx)
	if err != nil {
		t.Fatalf("ListRoleKinds: %v", err)
	}
	for _, kind := range kinds {
		if kind.Name == agencies.FirstGroupRoleKindName {
			seat := mwanachamaactor.ActorRoleAssignment{ActorID: actorID, GroupID: w.firstGroup(t), KindID: kind.ID}
			if _, err := um.GrantRole(ctx, seat); err != nil {
				t.Fatalf("GrantRole: %v", err)
			}
			w.assume(t, as, seat.GroupID)
			return as
		}
	}
	t.Fatalf("no Administrator role kind in %v", kinds)
	return nil
}

type administrationCall struct {
	name         string
	method, path string
	body         map[string]any
	want         int
}

func (w tagWalk) administrationCalls(group, tagID, other string) []administrationCall {
	return []administrationCall{
		{"give a tag", "POST", w.groupTagsPath(), map[string]any{"group_id": group, "tag_id": tagID}, http.StatusCreated},
		{"take a tag", "DELETE", w.groupTagsPath() + "/" + group + "/" + tagID, nil, http.StatusOK},
		{"disable a group", "POST", "/instances/" + w.instance + "/groups/" + other + "/disable", nil, http.StatusOK},
		{"list disabled groups", "GET", "/instances/" + w.instance + "/disabled-groups", nil, http.StatusOK},
		{"enable a group", "POST", "/instances/" + w.instance + "/groups/" + other + "/enable", nil, http.StatusOK},
	}
}

func (w tagWalk) requireAdministered(t *testing.T, who string, as *http.Cookie) {
	t.Helper()
	group, other, tagID := w.group(t, "Support"), w.group(t, "Field"), w.create(t, "tag of "+who)
	for _, c := range w.administrationCalls(group, tagID, other) {
		if rec := w.call(t, c.method, c.path, c.body, as); rec.Code != c.want {
			t.Errorf("%s: %s: %d %s, want %d", who, c.name, rec.Code, rec.Body.String(), c.want)
		}
	}
}

func (w tagWalk) requireRefusedAll(t *testing.T, who string, as *http.Cookie, want int) {
	t.Helper()
	group, other, tagID := w.group(t, "Support"), w.group(t, "Field"), w.create(t, "tag of "+who)
	before, tagsBefore := w.disabledGroups(t), w.names(t, w.tagsPath()+"?group_id="+group)
	for _, c := range w.administrationCalls(group, tagID, other) {
		if rec := w.call(t, c.method, c.path, c.body, as); rec.Code != want {
			t.Errorf("%s: %s: %d %s, want %d", who, c.name, rec.Code, rec.Body.String(), want)
		}
	}
	if names := w.names(t, w.tagsPath()+"?group_id="+group); !slices.Equal(names, tagsBefore) {
		t.Errorf("%s: tags of the group after the refused calls: %v, want %v", who, names, tagsBefore)
	}
	if after := w.disabledGroups(t); !slices.Equal(before, after) {
		t.Errorf("%s: disabled groups after the refused calls: %v, want %v", who, after, before)
	}
}

func (w tagWalk) disabledGroups(t *testing.T) []string {
	t.Helper()
	rec := w.call(t, "GET", "/instances/"+w.instance+"/disabled-groups", nil, w.ownerInFirstGroup(t))
	if rec.Code != http.StatusOK {
		t.Fatalf("list disabled groups: %d %s", rec.Code, rec.Body.String())
	}
	ids := []string{}
	for _, id := range decodeObject(t, rec)["group_ids"].([]any) {
		ids = append(ids, id.(string))
	}
	slices.Sort(ids)
	return ids
}

func runGroupAdministrationWalks(t *testing.T, build func(*testing.T) tagWalk) {
	t.Run("the owner logged in as the first group gives and takes a tag and disables and enables a group", func(t *testing.T) {
		w := build(t)
		w.requireAdministered(t, "the owner in the first group", w.ownerInFirstGroup(t))
	})

	t.Run("a person seated as Administrator in the first group does the same", func(t *testing.T) {
		w := build(t)
		w.requireAdministered(t, "an Administrator seat", w.administratorSeatedInFirstGroup(t, "Kofi"))
	})

	t.Run("a person whose role in the assumed group carries group.manage does the same", func(t *testing.T) {
		w := build(t)
		w.roleCarriesGroupManagement("Worker")
		_, kofi := w.resident(t, "Kofi", "Dev")
		w.giveRole(t, "Dev", "Worker")
		w.requireAdministered(t, "a Worker carrying group.manage", kofi)
	})

	t.Run("a person whose roles lack group.manage is refused with 403 naming it and nothing changes", func(t *testing.T) {
		w := build(t)
		w.roleCarriesGroupManagement("Worker")
		_, noRole := w.resident(t, "Amina", "Support")
		_, reader := w.resident(t, "Juma", "Reading")
		w.giveRole(t, "Reading", "Reader")
		w.requireRefusedAll(t, "a resident with no role", noRole, http.StatusForbidden)
		w.requireRefusedAll(t, "a resident holding another role", reader, http.StatusForbidden)
		group := w.group(t, "Support")
		rec := w.give(t, group, w.create(t, "south"), reader)
		if !strings.Contains(rec.Body.String(), groupManagePermission) {
			t.Errorf("the refusal reads %s, want it to name %s", rec.Body.String(), groupManagePermission)
		}
	})

	t.Run("the owner with no administrator seat in the assumed group is refused", func(t *testing.T) {
		w := build(t)
		w.requireRefusedAll(t, "the owner in a group where it holds no seat", w.owner, http.StatusForbidden)
	})

	t.Run("the owner with no assumed group is refused", func(t *testing.T) {
		w := build(t)
		w.requireRefusedAll(t, "the owner with no assumed group", w.cookieFor(t, "test-owner"), http.StatusForbidden)
	})

	t.Run("a person with no assumed group is refused", func(t *testing.T) {
		w := build(t)
		w.roleCarriesGroupManagement("Worker")
		_, kofi := w.resident(t, "Kofi", "Dev")
		w.giveRole(t, "Dev", "Worker")
		w.assumeNothing(t, kofi)
		w.requireRefusedAll(t, "a Worker with no assumed group", kofi, http.StatusForbidden)
	})

	t.Run("a group.manage seat in another group does not count while the assumed group has none", func(t *testing.T) {
		w := build(t)
		w.roleCarriesGroupManagement("Worker")
		_, kofi := w.resident(t, "Kofi", "Dev", "Reading")
		w.giveRole(t, "Dev", "Worker")
		w.giveRole(t, "Reading", "Reader")
		w.assume(t, kofi, w.group(t, "Reading"))
		w.requireRefusedAll(t, "a Worker logged in as the reading group", kofi, http.StatusForbidden)
		w.assume(t, kofi, w.group(t, "Dev"))
		w.requireAdministered(t, "the same person logged in as the dev group", kofi)
	})

	t.Run("the administrator of a disabled group is refused as a person with no group", func(t *testing.T) {
		w := build(t)
		w.roleCarriesGroupManagement("Worker")
		_, kofi := w.resident(t, "Kofi", "Dev")
		w.giveRole(t, "Dev", "Worker")
		dev := w.group(t, "Dev")
		if rec := w.call(t, "POST", "/instances/"+w.instance+"/groups/"+dev+"/disable", nil, w.ownerInFirstGroup(t)); rec.Code != http.StatusOK {
			t.Fatalf("disable Dev: %d %s", rec.Code, rec.Body.String())
		}
		w.requireRefusedAll(t, "the Worker of a disabled group", kofi, http.StatusForbidden)
	})

	t.Run("a stranger to the Instance still gets 404", func(t *testing.T) {
		w := build(t)
		w.requireRefusedAll(t, "a stranger", w.cookieFor(t, "a-stranger"), http.StatusNotFound)
	})

	t.Run("group.manage opens neither tag creation nor listing tags nor the group-role routes", func(t *testing.T) {
		w := build(t)
		administrator := w.administratorSeatedInFirstGroup(t, "Kofi")
		if rec := w.call(t, "GET", w.tagsPath(), nil, administrator); rec.Code < 400 {
			t.Errorf("an administrator lists tags: %d, want a refusal while listing stays owner-only", rec.Code)
		}
		group := w.group(t, "Support")
		rec := w.call(t, "POST", w.groupRolesPath(), map[string]any{"group_id": group, "agency_role_id": w.roles["Reader"]}, administrator)
		if rec.Code < 400 {
			t.Errorf("an administrator gives a group a role: %d, want a refusal while it stays owner-only", rec.Code)
		}
	})
}

func TestGroupAdministration(t *testing.T) {
	runGroupAdministrationWalks(t, func(t *testing.T) tagWalk {
		return tagWalk{newGroupRoleWalk(t)}
	})
}

func TestGroupAdministrationBehindTheAccountRouter(t *testing.T) {
	runGroupAdministrationWalks(t, func(t *testing.T) tagWalk {
		return tagWalk{newGroupRoleWalkBehindTheAccountRouter(t)}
	})
}
