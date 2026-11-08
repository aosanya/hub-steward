package http

import (
	"context"
	"net/http"
	"testing"

	"wakalaserver/internal/agencies"
)

func TestMemberRemoval_ResidentCannotDoRemoveAnotherResident(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	ctx := context.Background()
	for _, id := range []string{"resident-wren", "resident-lark"} {
		if err := w.deps.Registry.AddMember(ctx, w.instance, id, agencies.RoleResident); err != nil {
			t.Fatalf("AddMember %s: %v", id, err)
		}
	}
	wren := w.cookieFor(t, "resident-wren")
	remove := "/instances/" + w.instance + "/members/resident-lark"

	if rec := w.call(t, "DELETE", remove, nil, wren); rec.Code < 400 {
		t.Fatalf("resident removing another resident: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "DELETE", remove, nil, w.people["Volunteer"]); rec.Code < 400 {
		t.Fatalf("seated resident removing another resident: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if role, err := w.deps.Registry.RoleOf(ctx, w.instance, "resident-lark"); err != nil || role != agencies.RoleResident {
		t.Fatalf("resident after refused removals: role %q err %v, want still a resident", role, err)
	}

	if rec := w.call(t, "DELETE", remove, nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner removing the resident: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
