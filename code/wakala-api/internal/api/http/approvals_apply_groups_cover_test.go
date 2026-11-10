package http

import (
	"strings"
	"testing"

	mwanachamasources "wakalaserver/modules/sources"
)

func TestApprovedDocumentIsFiledAsASourceWithItsText(t *testing.T) {
	w := newApplyWorld(t)
	done, err := w.approved(t, "sources_document_create", map[string]any{"title": "Ward charter", "language": "sw", "text": "Habari za wadi"})
	if err != nil {
		t.Fatalf("approved document: %v", err)
	}
	if !strings.Contains(done.Applied, `Filed the source \"Ward charter\"`) {
		t.Fatalf("the approval must record the filing, got %q", done.Applied)
	}
	sm, err := w.reg.SourceManager(w.ctx, w.instanceID)
	if err != nil {
		t.Fatalf("SourceManager: %v", err)
	}
	sources, err := sm.ListSources(w.ctx, mwanachamasources.SourceFilter{})
	if err != nil || len(sources) != 1 || sources[0].Title != "Ward charter" || sources[0].CreatedBy != "owner-1" {
		t.Fatalf("the source must be filed under the approver, got %v %v", sources, err)
	}
	if sources[0].Properties["language"] != "sw" {
		t.Fatalf("the document's language must be kept, got %v", sources[0].Properties)
	}
}

func TestApprovedDocumentWithoutTitleOrTextIsRefused(t *testing.T) {
	w := newApplyWorld(t)
	for _, payload := range []map[string]any{{"title": "Only a title"}, {"text": "Only text"}} {
		if err := w.apply("sources_document_create", payload); err == nil || !strings.Contains(err.Error(), "title and text") {
			t.Fatalf("a document missing its title or text must be refused, got %v for %v", err, payload)
		}
	}
}

func TestApprovedGroupCanBeCreatedAndItsJoinModeChanged(t *testing.T) {
	w := newApplyWorld(t)
	done, err := w.approved(t, "actor_create_group", map[string]any{"name": "Pickers"})
	if err != nil {
		t.Fatalf("approved group: %v", err)
	}
	if !strings.Contains(done.Applied, `Created the group \"Pickers\"`) {
		t.Fatalf("the approval must record the group, got %q", done.Applied)
	}
	um, _, err := actorManagerFor(w.ctx, w.reg, w.instanceID)
	if err != nil {
		t.Fatalf("actorManagerFor: %v", err)
	}
	groups, err := um.ListGroups(w.ctx, "")
	if err != nil {
		t.Fatalf("ListGroups: %v", err)
	}
	var id string
	for _, g := range groups {
		if g.Name == "Pickers" {
			id = g.ID
		}
	}
	if id == "" {
		t.Fatalf("the approved group must exist, got %v", groups)
	}
	if err := w.apply("actor_set_group_join_mode", map[string]any{"group_id": id, "join_mode": "open"}); err != nil {
		t.Fatalf("set group join mode: %v", err)
	}
	if err := w.apply("actor_set_group_join_mode", map[string]any{"group_id": id, "join_mode": "whenever"}); err == nil {
		t.Fatal("an unknown group join mode must be refused")
	}
}

func TestApprovedInvitationNamesExactlyOneInvitee(t *testing.T) {
	w := newApplyWorld(t)
	for _, payload := range []map[string]any{
		{"group_id": "g1"},
		{"group_id": "g1", "actor_id": "a1", "actor_code": "C-1"},
	} {
		if err := w.apply("actor_invite_to_group", payload); err == nil || !strings.Contains(err.Error(), "exactly one") {
			t.Fatalf("an invitation must name exactly one invitee, got %v for %v", err, payload)
		}
	}
}
