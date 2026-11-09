package http

import (
	"context"
	"net/http"
	"slices"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
	agencymodels "wakalaserver/modules/agency/models"

	"wakalaserver/internal/agencies"
)

var boardQuestions = []agencymodels.StepQuestion{{Prompt: "Reason", AnswerType: agencymodels.AnswerFreeText, Required: true}}

func TestMyRoles_ReportsThePermissionCodesOfTheCallersRole(t *testing.T) {
	w := newStepRunWalk(t, []stepSpec{
		{title: "Read the board", form: "Board", role: "Reader", questions: boardQuestions},
		{title: "Manage the board", form: "Manage", role: "Manager", questions: boardQuestions},
	})
	perms := map[string][]string{
		w.roles["Reader"]:  {"task.read"},
		w.roles["Manager"]: {"task.read", "backlog.manage", "task.read"},
	}
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		return perms[roleID], nil
	}
	path := "/instances/" + w.instance

	seat := func(subject, role string) *http.Cookie {
		c := w.cookieFor(t, subject)
		if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": subject}, w.owner); rec.Code != http.StatusCreated {
			t.Fatalf("owner adds %s: %d %s", subject, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "PUT", path+"/members/"+subject+"/agency-role", map[string]any{"agency_role_id": w.roles[role]}, w.owner); rec.Code != http.StatusOK {
			t.Fatalf("owner links %s to %s: %d %s", subject, role, rec.Code, rec.Body.String())
		}
		return c
	}
	reader := seat("agent-reader", "Reader")
	manager := seat("agent-manager", "Manager")
	stranger := w.cookieFor(t, "agent-stranger")

	codesFor := func(as *http.Cookie) []string {
		rec := w.call(t, "GET", path+"/my-roles", nil, as)
		if rec.Code != http.StatusOK {
			t.Fatalf("my-roles: %d %s", rec.Code, rec.Body.String())
		}
		raw, ok := decodeObject(t, rec)["permissions"].([]any)
		if !ok {
			t.Fatalf("permissions missing or not a list in %s", rec.Body.String())
		}
		out := make([]string, 0, len(raw))
		for _, c := range raw {
			out = append(out, c.(string))
		}
		return out
	}

	if got := codesFor(reader); !slices.Equal(got, []string{"task.read"}) {
		t.Fatalf("reader permissions = %v, want [task.read]", got)
	}
	if got := codesFor(manager); !slices.Equal(got, []string{"backlog.manage", "task.read"}) {
		t.Fatalf("manager permissions = %v, want [backlog.manage task.read]", got)
	}
	owner := codesFor(w.owner)
	if !slices.Contains(owner, "backlog.manage") || !slices.Contains(owner, "task.edit") || !slices.Equal(owner, allPermissionCodes()) {
		t.Fatalf("owner permissions = %v, want every catalog code", owner)
	}
	if rec := w.call(t, "GET", path+"/my-roles", nil, stranger); rec.Code != http.StatusNotFound {
		t.Fatalf("stranger my-roles: %d %s, want 404", rec.Code, rec.Body.String())
	}
}

func TestMyRoles_AResidentWithNoRoleHoldsNoPermissions(t *testing.T) {
	w := newStepRunWalk(t, nil)
	ctx := context.Background()
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	actor, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Resident one"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, actor.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	rec := w.call(t, "GET", "/instances/"+w.instance+"/my-roles", nil, w.cookieFor(t, actor.ID))
	if rec.Code != http.StatusOK {
		t.Fatalf("resident my-roles: %d %s", rec.Code, rec.Body.String())
	}
	list, ok := decodeObject(t, rec)["permissions"].([]any)
	if !ok || len(list) != 0 {
		t.Fatalf("resident permissions = %v, want an empty list", decodeObject(t, rec)["permissions"])
	}
}
