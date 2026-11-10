package ai

import (
	"net/http"
	"strings"
	"testing"

	"wakalaserver/modules/ai/models"
)

func newPersonLimitRig(t *testing.T) *gatewayRig {
	t.Helper()
	rig := newGatewayRig(t, models.ProviderOpenAICompatible)
	rig.reply = func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"usage":{"prompt_tokens":3,"completion_tokens":4}}`))
	}
	return rig
}

func TestAPersonAtTheirDayNumberIsRefusedThroughTheGatewayInTheChatsWords(t *testing.T) {
	rig := newPersonLimitRig(t)
	rig.hub.set(t, 50, 0)
	rig.hub.spend(t, "ana", 50)
	rec := rig.post(rigSeat, "chat", "ana", userAsks)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("a person at their day number through the gateway = %d %s, want 429", rec.Code, rec.Body.String())
	}
	if got := refusalOf(t, rec); !strings.Contains(got, assistantDaySentence) || !strings.HasPrefix(got, "assistant limit: day") {
		t.Errorf("refusal = %q, want the chat's day sentence", got)
	}
	if len(rig.seen) != 0 {
		t.Fatal("the model was called for a person at their limit")
	}
}

func TestAPersonAtTheirMonthNumberIsRefusedThroughTheGateway(t *testing.T) {
	rig := newPersonLimitRig(t)
	rig.hub.set(t, 0, 80)
	rig.hub.spend(t, "ana", 80)
	rec := rig.post(rigSeat, "chat", "ana", userAsks)
	if rec.Code != http.StatusTooManyRequests || !strings.Contains(refusalOf(t, rec), assistantMonthSentence) {
		t.Fatalf("a person at their month number through the gateway = %d %s", rec.Code, rec.Body.String())
	}
	if len(rig.seen) != 0 {
		t.Fatal("the model was called for a person at their limit")
	}
}

func TestAPersonUnderTheirNumberPassesTheGatewayAndTheCallIsCountedAgainstThem(t *testing.T) {
	rig := newPersonLimitRig(t)
	rig.hub.set(t, 20, 0)
	if rec := rig.post(rigSeat, "chat", "ana", userAsks); rec.Code != http.StatusOK {
		t.Fatalf("a person under their number = %d %s", rec.Code, rec.Body.String())
	}
	<-rig.seen
	if rec := rig.post(rigSeat, "chat", "ana", userAsks); rec.Code != http.StatusOK {
		t.Fatalf("seven tokens used of twenty = %d %s", rec.Code, rec.Body.String())
	}
	<-rig.seen
	if rec := rig.post(rigSeat, "chat", "ana", userAsks); rec.Code != http.StatusOK {
		t.Fatalf("fourteen tokens used of twenty = %d %s", rec.Code, rec.Body.String())
	}
	<-rig.seen
	if rec := rig.post(rigSeat, "chat", "ana", userAsks); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("twenty-one tokens used of twenty = %d %s, want 429", rec.Code, rec.Body.String())
	}
	if rec := rig.post(rigSeat, "chat", "otieno", userAsks); rec.Code != http.StatusOK {
		t.Fatalf("another person at the same agency = %d %s, want their own share", rec.Code, rec.Body.String())
	}
}

func TestACallThroughTheGatewayWithNoPersonIsNotHeldToAPersonNumber(t *testing.T) {
	rig := newPersonLimitRig(t)
	rig.hub.set(t, 1, 1)
	rig.hub.spend(t, "ana", 500)
	for i := 0; i < 2; i++ {
		if rec := rig.post(rigSeat, "chat", "", userAsks); rec.Code != http.StatusOK {
			t.Fatalf("call %d with no person = %d %s", i+1, rec.Code, rec.Body.String())
		}
		<-rig.seen
	}
}
