package http

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

type pollRunReadWalk struct {
	stepRunWalk
	polls    string
	groupID  string
	runner   *http.Cookie
	comms    *http.Cookie
	outside  *http.Cookie
	pollID   string
	pollPath string
}

func newPollRunReadWalk(t *testing.T) pollRunReadWalk {
	t.Helper()
	w := newStepRunWalk(t, nil)
	perms := map[string][]string{
		"role-comms":    {"report.publish", "notice.post"},
		"role-mediator": {"form.approve", "poll.run"},
	}
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		granted, ok := perms[roleID]
		if !ok {
			return nil, errors.New("unknown role")
		}
		return granted, nil
	}
	path := "/instances/" + w.instance
	agent := func(subject, roleID string) *http.Cookie {
		cookie := w.cookieFor(t, subject)
		if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": subject}, w.owner); rec.Code != http.StatusCreated {
			t.Fatalf("owner adds agent %s: %d %s", subject, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "PUT", path+"/members/"+subject+"/agency-role", map[string]any{"agency_role_id": roleID}, w.owner); rec.Code != http.StatusOK {
			t.Fatalf("owner links %s to %s: %d %s", subject, roleID, rec.Code, rec.Body.String())
		}
		return cookie
	}
	out := pollRunReadWalk{stepRunWalk: w, polls: path + "/voting/polls"}
	out.runner = agent("agent-mediator", "role-mediator")
	out.comms = agent("agent-comms", "role-comms")

	group := w.call(t, "POST", path+"/actor/groups", map[string]any{"name": "Town hall"}, w.owner)
	if group.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", group.Code, group.Body.String())
	}
	out.groupID, _ = decodeObject(t, group)["id"].(string)

	ctx := context.Background()
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	stranger, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Outside"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, stranger.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	out.outside = w.cookieFor(t, stranger.ID)

	made := w.call(t, "POST", out.polls, map[string]any{
		"question": "Close Mill Row on Sundays?", "mode": "one", "per_group": "once",
		"choices":  []map[string]any{{"label": "yes"}, {"label": "no"}},
		"opens_at": time.Now().Add(-time.Hour).UTC().Format(time.RFC3339), "closes_at": time.Now().Add(48 * time.Hour).UTC().Format(time.RFC3339),
		"group_ids": []string{out.groupID},
	}, out.runner)
	if made.Code != http.StatusCreated {
		t.Fatalf("runner creates the poll: %d %s", made.Code, made.Body.String())
	}
	out.pollID, _ = decodeObject(t, made)["id"].(string)
	out.pollPath = out.polls + "/" + out.pollID
	return out
}

func TestPollRunRead_TheRunnerReadsItsOwnPoll(t *testing.T) {
	w := newPollRunReadWalk(t)
	if rec := w.call(t, "GET", w.pollPath, nil, w.runner); rec.Code != http.StatusOK {
		t.Fatalf("runner reads its poll: %d %s, want 200", rec.Code, rec.Body.String())
	}
}

func TestPollRunRead_TheRunnerListsItsOwnPollsChoices(t *testing.T) {
	w := newPollRunReadWalk(t)
	rec := w.call(t, "GET", w.pollPath+"/choices", nil, w.runner)
	if rec.Code != http.StatusOK {
		t.Fatalf("runner lists its poll's choices: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if got := len(decodeObjects(t, rec)); got != 2 {
		t.Fatalf("runner sees %d choices, want 2", got)
	}
}

func TestPollRunRead_ARoleWithoutPollRunIsStillRefused(t *testing.T) {
	w := newPollRunReadWalk(t)
	for _, suffix := range []string{"", "/choices"} {
		if rec := w.call(t, "GET", w.pollPath+suffix, nil, w.comms); rec.Code != http.StatusForbidden {
			t.Fatalf("comms officer reads %q: %d %s, want 403", suffix, rec.Code, rec.Body.String())
		}
	}
}

func TestPollRunRead_AResidentOutsideThePollsGroupStillGetsNotFoundWhenAnswering(t *testing.T) {
	w := newPollRunReadWalk(t)
	choices := w.call(t, "GET", w.pollPath+"/choices", nil, w.owner)
	if choices.Code != http.StatusOK {
		t.Fatalf("owner lists the choices: %d %s", choices.Code, choices.Body.String())
	}
	choiceID, _ := decodeObjects(t, choices)[0]["id"].(string)
	rec := w.call(t, "POST", w.pollPath+"/answers", map[string]any{"votes": map[string]int{choiceID: 1}}, w.outside)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("outside resident answers: %d %s, want 404", rec.Code, rec.Body.String())
	}
}

func TestPollRunRead_TheRunnerStillCannotReadTheCountUntilTheOwnerDecides(t *testing.T) {
	w := newPollRunReadWalk(t)
	if rec := w.call(t, "GET", w.pollPath+"/count", nil, w.runner); rec.Code != http.StatusForbidden {
		t.Fatalf("runner reads the count: %d %s, want 403", rec.Code, rec.Body.String())
	}
}
