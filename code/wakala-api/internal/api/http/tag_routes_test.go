package http

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

type tagWalk struct {
	groupRoleWalk
}

func (w tagWalk) tagsPath() string { return "/instances/" + w.instance + "/tags" }

func (w tagWalk) groupTagsPath() string { return "/instances/" + w.instance + "/group-tags" }

func (w tagWalk) create(t *testing.T, name string) string {
	t.Helper()
	rec := w.call(t, "POST", w.tagsPath(), map[string]any{"name": name}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create tag %q: %d %s", name, rec.Code, rec.Body.String())
	}
	id, _ := decodeObject(t, rec)["id"].(string)
	return id
}

func (w tagWalk) names(t *testing.T, path string) []string {
	t.Helper()
	rec := w.call(t, "GET", path, nil, w.ownerInFirstGroup(t))
	if rec.Code != http.StatusOK {
		t.Fatalf("list %s: %d %s", path, rec.Code, rec.Body.String())
	}
	items, _ := decodeObject(t, rec)["items"].([]any)
	names := make([]string, 0, len(items))
	for _, item := range items {
		names = append(names, item.(map[string]any)["name"].(string))
	}
	return names
}

func (w tagWalk) give(t *testing.T, group, tagID string, as *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	return w.call(t, "POST", w.groupTagsPath(), map[string]any{"group_id": group, "tag_id": tagID}, as)
}

func runTagRouteWalks(t *testing.T, build func(*testing.T) tagWalk) {
	t.Run("a new instance lists the system tag all", func(t *testing.T) {
		w := build(t)
		rec := w.call(t, "GET", w.tagsPath(), nil, w.ownerInFirstGroup(t))
		items, _ := decodeObject(t, rec)["items"].([]any)
		if rec.Code != http.StatusOK || len(items) != 1 {
			t.Fatalf("list: %d %s", rec.Code, rec.Body.String())
		}
		first := items[0].(map[string]any)
		if first["name"] != "all" || first["system"] != true || first["id"] == "" {
			t.Fatalf("first tag: %v", first)
		}
	})

	t.Run("the owner creates, renames and lists tags", func(t *testing.T) {
		w := build(t)
		id := w.create(t, "north")
		rec := w.call(t, "PUT", w.tagsPath()+"/"+id, map[string]any{"name": "emea"}, w.owner)
		if got := decodeObject(t, rec); rec.Code != http.StatusOK || got["id"] != id || got["name"] != "emea" {
			t.Fatalf("rename: %d %s", rec.Code, rec.Body.String())
		}
		if names := w.names(t, w.tagsPath()); len(names) != 2 || names[1] != "emea" {
			t.Fatalf("tags: %v", names)
		}
	})

	t.Run("a second tag with the same name is a conflict and a blank name is refused", func(t *testing.T) {
		w := build(t)
		w.create(t, "north")
		if rec := w.call(t, "POST", w.tagsPath(), map[string]any{"name": "north"}, w.owner); rec.Code != http.StatusConflict {
			t.Fatalf("duplicate: %d %s, want 409", rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "POST", w.tagsPath(), map[string]any{"name": " "}, w.owner); rec.Code != http.StatusUnprocessableEntity {
			t.Fatalf("blank: %d %s, want 422", rec.Code, rec.Body.String())
		}
	})

	t.Run("all can be neither renamed nor deleted", func(t *testing.T) {
		w := build(t)
		rec := w.call(t, "GET", w.tagsPath(), nil, w.ownerInFirstGroup(t))
		all := decodeObject(t, rec)["items"].([]any)[0].(map[string]any)["id"].(string)
		if rec := w.call(t, "PUT", w.tagsPath()+"/"+all, map[string]any{"name": "everyone"}, w.owner); rec.Code != http.StatusUnprocessableEntity {
			t.Fatalf("rename all: %d %s, want 422", rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "DELETE", w.tagsPath()+"/"+all, nil, w.owner); rec.Code != http.StatusUnprocessableEntity {
			t.Fatalf("delete all: %d %s, want 422", rec.Code, rec.Body.String())
		}
	})

	t.Run("an unknown tag is not found", func(t *testing.T) {
		w := build(t)
		if rec := w.call(t, "PUT", w.tagsPath()+"/nope", map[string]any{"name": "emea"}, w.owner); rec.Code != http.StatusNotFound {
			t.Fatalf("rename: %d, want 404", rec.Code)
		}
		if rec := w.call(t, "DELETE", w.tagsPath()+"/nope", nil, w.owner); rec.Code != http.StatusNotFound {
			t.Fatalf("delete: %d, want 404", rec.Code)
		}
	})

	t.Run("a group is given a tag, lists it, and loses it", func(t *testing.T) {
		w := build(t)
		group := w.group(t, "Support")
		id := w.create(t, "north")
		if rec := w.give(t, group, id, w.ownerInFirstGroup(t)); rec.Code != http.StatusCreated {
			t.Fatalf("give: %d %s", rec.Code, rec.Body.String())
		}
		if rec := w.give(t, group, id, w.ownerInFirstGroup(t)); rec.Code != http.StatusCreated {
			t.Fatalf("give again: %d %s", rec.Code, rec.Body.String())
		}
		if names := w.names(t, w.tagsPath()+"?group_id="+group); len(names) != 1 || names[0] != "north" {
			t.Fatalf("tags of the group: %v", names)
		}
		if rec := w.call(t, "DELETE", w.groupTagsPath()+"/"+group+"/"+id, nil, w.ownerInFirstGroup(t)); rec.Code != http.StatusOK {
			t.Fatalf("take: %d %s", rec.Code, rec.Body.String())
		}
		if names := w.names(t, w.tagsPath()+"?group_id="+group); len(names) != 0 {
			t.Fatalf("tags of the group: %v, want none", names)
		}
	})

	t.Run("any group may be given all, with or without another tag", func(t *testing.T) {
		w := build(t)
		group := w.group(t, "Support")
		id := w.create(t, "north")
		all := decodeObject(t, w.call(t, "GET", w.tagsPath(), nil, w.ownerInFirstGroup(t)))["items"].([]any)[0].(map[string]any)["id"].(string)
		if rec := w.give(t, group, all, w.ownerInFirstGroup(t)); rec.Code != http.StatusCreated {
			t.Fatalf("give all: %d %s", rec.Code, rec.Body.String())
		}
		if rec := w.give(t, group, id, w.ownerInFirstGroup(t)); rec.Code != http.StatusCreated {
			t.Fatalf("give north too: %d %s", rec.Code, rec.Body.String())
		}
		if names := w.names(t, w.tagsPath()+"?group_id="+group); len(names) != 2 {
			t.Fatalf("tags of the group: %v", names)
		}
	})

	t.Run("a tag is given only to a group of the instance and a tag of the instance", func(t *testing.T) {
		w := build(t)
		id := w.create(t, "north")
		if rec := w.give(t, "no-such-group", id, w.ownerInFirstGroup(t)); rec.Code != http.StatusUnprocessableEntity {
			t.Fatalf("unknown group: %d %s, want 422", rec.Code, rec.Body.String())
		}
		if rec := w.give(t, w.group(t, "Support"), "no-such-tag", w.ownerInFirstGroup(t)); rec.Code != http.StatusNotFound {
			t.Fatalf("unknown tag: %d %s, want 404", rec.Code, rec.Body.String())
		}
		if rec := w.give(t, "", id, w.ownerInFirstGroup(t)); rec.Code != http.StatusUnprocessableEntity {
			t.Fatalf("blank group: %d %s, want 422", rec.Code, rec.Body.String())
		}
	})

	t.Run("deleting a tag a group carries is a conflict that names the count", func(t *testing.T) {
		w := build(t)
		group := w.group(t, "Support")
		id := w.create(t, "north")
		w.give(t, group, id, w.ownerInFirstGroup(t))
		rec := w.call(t, "DELETE", w.tagsPath()+"/"+id, nil, w.owner)
		if rec.Code != http.StatusConflict {
			t.Fatalf("delete: %d %s, want 409", rec.Code, rec.Body.String())
		}
		if got := decodeObject(t, rec); got["groups"] != float64(1) || got["rows"] != float64(0) {
			t.Fatalf("refusal body: %v, want groups 1 and rows 0", got)
		}
		w.call(t, "DELETE", w.groupTagsPath()+"/"+group+"/"+id, nil, w.ownerInFirstGroup(t))
		if rec := w.call(t, "DELETE", w.tagsPath()+"/"+id, nil, w.owner); rec.Code != http.StatusOK {
			t.Fatalf("delete after taking it off: %d %s, want 200", rec.Code, rec.Body.String())
		}
		if names := w.names(t, w.tagsPath()); len(names) != 1 {
			t.Fatalf("tags: %v, want [all]", names)
		}
	})

	t.Run("a resident without a role is refused on every tag call", func(t *testing.T) {
		w := build(t)
		_, amina := w.resident(t, "Amina", "Support")
		group := w.group(t, "Support")
		id := w.create(t, "north")
		calls := []struct {
			method, path string
			body         map[string]any
			want         int
		}{
			{"GET", w.tagsPath(), nil, http.StatusForbidden},
			{"POST", w.tagsPath(), map[string]any{"name": "south"}, http.StatusForbidden},
			{"PUT", w.tagsPath() + "/" + id, map[string]any{"name": "south"}, http.StatusForbidden},
			{"DELETE", w.tagsPath() + "/" + id, nil, http.StatusForbidden},
			{"POST", w.groupTagsPath(), map[string]any{"group_id": group, "tag_id": id}, http.StatusForbidden},
			{"DELETE", w.groupTagsPath() + "/" + group + "/" + id, nil, http.StatusForbidden},
		}
		for _, c := range calls {
			if rec := w.call(t, c.method, c.path, c.body, amina); rec.Code != c.want {
				t.Errorf("a resident %s %s: %d, want %d", c.method, c.path, rec.Code, c.want)
			}
		}
		if names := w.names(t, w.tagsPath()); len(names) != 2 || names[1] != "north" {
			t.Fatalf("tags after the refused calls: %v", names)
		}
	})
}

func TestTagRoutes(t *testing.T) {
	runTagRouteWalks(t, func(t *testing.T) tagWalk {
		return tagWalk{newGroupRoleWalk(t)}
	})
}

func TestTagRoutesBehindTheAccountRouter(t *testing.T) {
	runTagRouteWalks(t, func(t *testing.T) tagWalk {
		return tagWalk{newGroupRoleWalkBehindTheAccountRouter(t)}
	})
}
