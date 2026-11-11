package http

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
)

type voiceSendRace struct {
	consentWalk
	base       string
	formID     string
	questionID string
	groups     []string
}

func newVoiceSendRace(t *testing.T, oneVoice string, lockedAfterSend bool) voiceSendRace {
	t.Helper()
	cw := newConsentWalkOn(t, localPostgresOrSkip(t))
	publishMechanicsConsent(t, cw)
	if agreed := cw.call(t, "POST", "/instances/"+cw.instance+"/custody/consent/agree", map[string]any{}, cw.resident); agreed.Code != http.StatusCreated {
		t.Fatalf("resident agrees: %d %s", agreed.Code, agreed.Body.String())
	}
	ctx := context.Background()
	um, err := cw.reg.ActorManager(ctx, cw.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	second, err := um.CreateGroup(ctx, mwanachamaactor.Group{Name: "Second ward group"})
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	if _, err := um.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: cw.actorID, GroupID: second.ID}); err != nil {
		t.Fatalf("AssignGroup: %v", err)
	}
	groups := []string{cw.groupID, second.ID}
	base := "/instances/" + cw.instance + "/forms/forms"
	created := cw.call(t, "POST", base, map[string]any{
		"title": "Ward consultation", "closes_at": "2099-01-01T00:00:00Z", "originator_chapter_id": cw.groupID,
		"audience": "member", "collection_mode": "self", "locked_after_send": lockedAfterSend, "one_voice": oneVoice,
	}, cw.owner)
	if created.Code != http.StatusCreated {
		t.Fatalf("create form: %d %s", created.Code, created.Body.String())
	}
	formID, _ := decodeObject(t, created)["id"].(string)
	question := cw.call(t, "POST", base+"/"+formID+"/questions", map[string]any{"prompt": "Your view", "answer_type": "free_text"}, cw.owner)
	if question.Code != http.StatusCreated {
		t.Fatalf("add question: %d %s", question.Code, question.Body.String())
	}
	asked, _ := decodeObject(t, question)["question"].(map[string]any)
	questionID, _ := asked["id"].(string)
	for _, group := range groups {
		if target := cw.call(t, "POST", base+"/"+formID+"/targets", map[string]any{"chapter_id": group}, cw.owner); target.Code != http.StatusCreated {
			t.Fatalf("add target: %d %s", target.Code, target.Body.String())
		}
	}
	if published := cw.call(t, "POST", base+"/"+formID+"/publish", map[string]any{}, cw.owner); published.Code != http.StatusOK && published.Code != http.StatusCreated {
		t.Fatalf("publish form: %d %s", published.Code, published.Body.String())
	}
	return voiceSendRace{consentWalk: cw, base: base, formID: formID, questionID: questionID, groups: groups}
}

func (r voiceSendRace) sendTogetherAsBothGroups(t *testing.T, copies int) []int {
	t.Helper()
	codes := make([]int, copies)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range codes {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			path := fmt.Sprintf("%s/%s/answers?as=%s", r.base, r.formID, r.groups[i%len(r.groups)])
			body := map[string]any{"answers": []map[string]any{{"question_id": r.questionID, "value_text": fmt.Sprintf("view %d", i)}}}
			codes[i] = r.call(t, "POST", path, body, r.resident).Code
		}()
	}
	close(start)
	wg.Wait()
	return codes
}

func (r voiceSendRace) voicesHeld(t *testing.T) int {
	t.Helper()
	listed := r.call(t, "GET", r.base+"/"+r.formID+"/answers", nil, r.owner)
	if listed.Code != http.StatusOK {
		t.Fatalf("owner reads the answers: %d %s", listed.Code, listed.Body.String())
	}
	return len(decodeObjects(t, listed))
}

func TestFormSend_UnderRefuseFifteenSendsAsTwoGroupsAtOnceKeepOneVoice(t *testing.T) {
	for round := 0; round < 5; round++ {
		r := newVoiceSendRace(t, "refuse", false)
		codes := r.sendTogetherAsBothGroups(t, 15)
		kept := 0
		for _, code := range codes {
			switch code {
			case http.StatusOK:
				kept++
			case http.StatusConflict:
			default:
				t.Fatalf("round %d: simultaneous sends answered %v, want only 200 and 409", round, codes)
			}
		}
		if kept < 1 {
			t.Fatalf("round %d: no send was kept: %v", round, codes)
		}
		if held := r.voicesHeld(t); held != 1 {
			t.Fatalf("round %d: %d answers held for the one resident, want 1: %v", round, held, codes)
		}
	}
}

func TestFormSend_UnderFlagFifteenSendsAsTwoGroupsAtOnceNeverFailAndCountOneVoice(t *testing.T) {
	for round := 0; round < 5; round++ {
		r := newVoiceSendRace(t, "flag", false)
		codes := r.sendTogetherAsBothGroups(t, 15)
		for _, code := range codes {
			if code != http.StatusOK {
				t.Fatalf("round %d: simultaneous sends answered %v, want only 200", round, code)
			}
		}
		if held := r.voicesHeld(t); held != 1 {
			t.Fatalf("round %d: %d answers counted for the one resident, want 1", round, held)
		}
	}
}

func TestFormSend_WithSeveralVoicesAllowedTwoGroupsAtOnceKeepOneSendEach(t *testing.T) {
	r := newVoiceSendRace(t, "", false)
	codes := r.sendTogetherAsBothGroups(t, 15)
	for _, code := range codes {
		if code != http.StatusOK {
			t.Fatalf("simultaneous sends answered %v, want only 200", codes)
		}
	}
	if held := r.voicesHeld(t); held != 2 {
		t.Fatalf("%d answers held, want 2: one for each group", held)
	}
}
