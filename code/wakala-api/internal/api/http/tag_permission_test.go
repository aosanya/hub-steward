package http

import (
	"context"
	"net/http"
	"slices"
	"strings"
	"testing"
)

const tagManagePermission = "tag.manage"

func (w tagWalk) roleCarriesTagManagement(role string) {
	held := w.deps.rolePermissionsOverride
	roleID := w.roles[role]
	w.deps.rolePermissionsOverride = func(ctx context.Context, id string) ([]string, error) {
		codes, err := held(ctx, id)
		if err != nil || id != roleID {
			return codes, err
		}
		return append(slices.Clone(codes), tagManagePermission), nil
	}
}

func (w tagWalk) tagCalls(id string) []struct {
	method, path string
	body         map[string]any
} {
	return []struct {
		method, path string
		body         map[string]any
	}{
		{"POST", w.tagsPath(), map[string]any{"name": "south"}},
		{"PUT", w.tagsPath() + "/" + id, map[string]any{"name": "east"}},
		{"DELETE", w.tagsPath() + "/" + id, nil},
	}
}

func runTagPermissionWalks(t *testing.T, build func(*testing.T) tagWalk) {
	t.Run("a role carrying the permission creates, renames and deletes a tag", func(t *testing.T) {
		w := build(t)
		w.roleCarriesTagManagement("Worker")
		_, kofi := w.resident(t, "Kofi", "Dev")
		w.giveRole(t, "Dev", "Worker")

		rec := w.call(t, "POST", w.tagsPath(), map[string]any{"name": "north"}, kofi)
		if rec.Code != http.StatusCreated {
			t.Fatalf("create: %d %s, want 201", rec.Code, rec.Body.String())
		}
		id, _ := decodeObject(t, rec)["id"].(string)
		rec = w.call(t, "PUT", w.tagsPath()+"/"+id, map[string]any{"name": "emea"}, kofi)
		if got := decodeObject(t, rec); rec.Code != http.StatusOK || got["id"] != id || got["name"] != "emea" {
			t.Fatalf("rename: %d %s, want 200 with the same id", rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "DELETE", w.tagsPath()+"/"+id, nil, kofi); rec.Code != http.StatusOK {
			t.Fatalf("delete: %d %s, want 200", rec.Code, rec.Body.String())
		}
		if names := w.names(t, w.tagsPath()); len(names) != 1 {
			t.Fatalf("tags: %v, want [all]", names)
		}
	})

	t.Run("a person whose roles lack the permission is refused with 403 and nothing changes", func(t *testing.T) {
		w := build(t)
		w.roleCarriesTagManagement("Worker")
		id := w.create(t, "north")
		_, noRole := w.resident(t, "Amina", "Support")
		_, reader := w.resident(t, "Juma", "Reading")
		w.giveRole(t, "Reading", "Reader")
		for name, as := range map[string]*http.Cookie{"a resident with no role": noRole, "a resident holding another role": reader} {
			for _, c := range w.tagCalls(id) {
				if rec := w.call(t, c.method, c.path, c.body, as); rec.Code != http.StatusForbidden {
					t.Errorf("%s %s %s: %d %s, want 403", name, c.method, c.path, rec.Code, rec.Body.String())
				}
			}
		}
		if names := w.names(t, w.tagsPath()); len(names) != 2 || names[1] != "north" {
			t.Fatalf("tags after the refused calls: %v", names)
		}
	})

	t.Run("the refusal names the permission", func(t *testing.T) {
		w := build(t)
		_, amina := w.resident(t, "Amina", "Support")
		rec := w.call(t, "POST", w.tagsPath(), map[string]any{"name": "south"}, amina)
		if rec.Code != http.StatusForbidden || !strings.Contains(rec.Body.String(), tagManagePermission) {
			t.Fatalf("create: %d %s, want 403 naming %s", rec.Code, rec.Body.String(), tagManagePermission)
		}
	})

	t.Run("a stranger to the Instance still gets 404 on the three calls", func(t *testing.T) {
		w := build(t)
		id := w.create(t, "north")
		stranger := w.cookieFor(t, "a-stranger")
		for _, c := range w.tagCalls(id) {
			if rec := w.call(t, c.method, c.path, c.body, stranger); rec.Code != http.StatusNotFound {
				t.Errorf("a stranger %s %s: %d, want 404", c.method, c.path, rec.Code)
			}
		}
	})

	t.Run("the permission does not open giving a tag to a group, taking one off or listing", func(t *testing.T) {
		w := build(t)
		w.roleCarriesTagManagement("Worker")
		_, kofi := w.resident(t, "Kofi", "Dev")
		w.giveRole(t, "Dev", "Worker")
		group := w.group(t, "Support")
		id := w.create(t, "north")
		if rec := w.give(t, group, id, kofi); rec.Code < 400 {
			t.Fatalf("a holder gives a tag to a group: %d %s, want a refusal", rec.Code, rec.Body.String())
		}
		if rec := w.give(t, group, id, w.ownerInFirstGroup(t)); rec.Code != http.StatusCreated {
			t.Fatalf("the owner gives a tag to a group: %d %s, want 201", rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "DELETE", w.groupTagsPath()+"/"+group+"/"+id, nil, kofi); rec.Code < 400 {
			t.Fatalf("a holder takes a tag off a group: %d %s, want a refusal", rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "GET", w.tagsPath(), nil, kofi); rec.Code < 400 {
			t.Fatalf("a holder lists tags: %d, want a refusal", rec.Code)
		}
		if names := w.names(t, w.tagsPath()+"?group_id="+group); len(names) != 1 {
			t.Fatalf("tags of the group: %v, want [north]", names)
		}
	})

	t.Run("the owner needs no role for the permission", func(t *testing.T) {
		w := build(t)
		id := w.create(t, "north")
		for _, c := range w.tagCalls(id) {
			if rec := w.call(t, c.method, c.path, c.body, w.owner); rec.Code >= 400 {
				t.Errorf("the owner %s %s: %d %s", c.method, c.path, rec.Code, rec.Body.String())
			}
		}
	})
}

func TestTagPermission(t *testing.T) {
	runTagPermissionWalks(t, func(t *testing.T) tagWalk {
		return tagWalk{newGroupRoleWalk(t)}
	})
}

func TestTagPermissionBehindTheAccountRouter(t *testing.T) {
	runTagPermissionWalks(t, func(t *testing.T) tagWalk {
		return tagWalk{newGroupRoleWalkBehindTheAccountRouter(t)}
	})
}
