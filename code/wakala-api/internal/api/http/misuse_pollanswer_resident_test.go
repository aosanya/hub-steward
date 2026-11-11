package http

import (
	"context"
	"net/http"
	"testing"
	"time"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

type pollAnswerWalk struct {
	stepRunWalk
	polls    string
	groupID  string
	outside  *http.Cookie
	inside   *http.Cookie
	pollID   string
	choiceID string
}

func newPollAnswerWalk(t *testing.T) pollAnswerWalk {
	t.Helper()
	w := newStepRunWalk(t, nil)
	ctx := context.Background()
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	ward := w.call(t, "POST", "/instances/"+w.instance+"/actor/groups", map[string]any{"name": "Kertvaros"}, w.owner)
	groupID, _ := decodeObject(t, ward)["id"].(string)
	resident := func(name string, group string) *http.Cookie {
		actor, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: name})
		if err != nil {
			t.Fatalf("CreateActor: %v", err)
		}
		if err := w.deps.Registry.AddMember(ctx, w.instance, actor.ID, agencies.RoleResident); err != nil {
			t.Fatalf("AddMember: %v", err)
		}
		if group != "" {
			if _, err := um.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: actor.ID, GroupID: group}); err != nil {
				t.Fatalf("AssignGroup: %v", err)
			}
		}
		return w.cookieFor(t, actor.ID)
	}
	out := pollAnswerWalk{stepRunWalk: w, groupID: groupID, polls: "/instances/" + w.instance + "/voting/polls"}
	out.inside = resident("Inside", groupID)
	out.outside = resident("Outside", "")
	made := w.call(t, "POST", out.polls, map[string]any{
		"question": "Bench colour", "mode": "one", "per_group": "once", "group_ids": []string{groupID},
		"opens_at": time.Now().Add(-time.Hour).UTC().Format(time.RFC3339), "closes_at": time.Now().Add(time.Hour).UTC().Format(time.RFC3339),
		"choices": []map[string]any{{"label": "green"}, {"label": "blue"}},
	}, w.owner)
	if made.Code != http.StatusCreated {
		t.Fatalf("owner creates the poll: %d %s", made.Code, made.Body.String())
	}
	out.pollID, _ = decodeObject(t, made)["id"].(string)
	choices := w.call(t, "GET", out.polls+"/"+out.pollID+"/choices", nil, out.inside)
	if choices.Code != http.StatusOK {
		t.Fatalf("resident lists the choices: %d %s", choices.Code, choices.Body.String())
	}
	out.choiceID, _ = decodeObjects(t, choices)[0]["id"].(string)
	return out
}

func (w pollAnswerWalk) answer(t *testing.T, as *http.Cookie) int {
	t.Helper()
	return w.call(t, "POST", w.polls+"/"+w.pollID+"/answers", map[string]any{"votes": map[string]int{w.choiceID: 1}}, as).Code
}

func TestPollAnswer_AResidentInThePollsGroupAnswersOnceAndIsRefusedASecondTime(t *testing.T) {
	w := newPollAnswerWalk(t)
	if code := w.answer(t, w.inside); code != http.StatusCreated {
		t.Fatalf("resident in the poll's group answers: %d, want 201", code)
	}
	if code := w.answer(t, w.inside); code != http.StatusConflict {
		t.Fatalf("the same resident answers again: %d, want 409", code)
	}
}

func TestPollAnswer_AResidentOutsideThePollsGroupIsRefused(t *testing.T) {
	w := newPollAnswerWalk(t)
	if code := w.answer(t, w.outside); code != http.StatusNotFound {
		t.Fatalf("resident outside the poll's group answers: %d, want 404", code)
	}
}

func TestPollAnswer_AResidentCannotMakeOrCountAPoll(t *testing.T) {
	w := newPollAnswerWalk(t)
	if rec := w.call(t, "POST", w.polls, map[string]any{"question": "q"}, w.inside); rec.Code != http.StatusForbidden {
		t.Fatalf("resident makes a poll: %d %s, want 403", rec.Code, rec.Body.String())
	}
	for _, path := range []string{"/count", "/responses"} {
		if rec := w.call(t, "GET", w.polls+"/"+w.pollID+path, nil, w.inside); rec.Code != http.StatusForbidden {
			t.Fatalf("resident reads %s: %d %s, want 403", path, rec.Code, rec.Body.String())
		}
	}
}

func TestPollAnswer_TheOwnerInThePollsGroupAnswersOnce(t *testing.T) {
	w := newPollAnswerWalk(t)
	ctx := context.Background()
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	actor, err := um.EnsureActor(ctx, "test-owner")
	if err != nil {
		t.Fatalf("EnsureActor: %v", err)
	}
	if _, err := um.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: actor.ID, GroupID: w.groupID}); err != nil {
		t.Fatalf("AssignGroup: %v", err)
	}
	if code := w.answer(t, w.owner); code != http.StatusCreated {
		t.Fatalf("owner seated in the poll's group answers: %d, want 201", code)
	}
}
