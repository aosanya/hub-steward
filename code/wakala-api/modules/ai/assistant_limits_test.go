package ai

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"wakalaserver/modules/ai/models"
)

const limitsAgency = "agency-1"

type limitsHub struct {
	m       Manager
	account Account
	calls   *atomic.Int32
	clock   *time.Time
	owners  map[string]bool
}

func newLimitsHub(t *testing.T) *limitsHub {
	t.Helper()
	calls := &atomic.Int32{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"hi"},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":4}}`))
	}))
	t.Cleanup(server.Close)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	s, err := SpecFor("limits")
	if err != nil {
		t.Fatal(err)
	}
	if err := Provision(db, s); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 11, 10, 15, 0, 0, 0, time.UTC)
	h := &limitsHub{calls: calls, clock: &now, owners: map[string]bool{}}
	m, err := NewManager(db, s,
		WithMasterKey([]byte("0123456789abcdef0123456789abcdef")),
		WithChatClient(server.Client()),
		WithClock(func() time.Time { return *h.clock }),
		WithOwnerCheck(func(_ context.Context, person string) (bool, error) { return h.owners[person], nil }),
	)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	account, err := m.CreateAccount(ctx, limitsAgency, Account{Name: "assistant", Provider: models.ProviderOpenAICompatible, BaseURL: server.URL, ModelName: "m", Status: models.StatusEnabled, ChatEnabled: true})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := m.SetAccountKey(ctx, limitsAgency, account.ID, KeyInput{Key: "k"}); err != nil {
		t.Fatal(err)
	}
	h.m, h.account = m, account
	return h
}

func (h *limitsHub) set(t *testing.T, day, month int) {
	t.Helper()
	if _, err := h.m.SetAssistantLimits(context.Background(), limitsAgency, AssistantLimits{TokensPerPersonDay: day, TokensPerPersonMonth: month}); err != nil {
		t.Fatal(err)
	}
}

func (h *limitsHub) spend(t *testing.T, person string, tokens int) {
	t.Helper()
	if _, err := h.m.RecordUsage(context.Background(), limitsAgency, UsageInput{AccountID: h.account.ID, TokensIn: tokens, Kind: models.KindChat, Person: person}); err != nil {
		t.Fatal(err)
	}
}

func (h *limitsHub) ask(person, claimed string) (ChatReply, error) {
	in := ChatInput{Messages: []ChatMessage{{Role: "user", Content: "hello"}}, Kind: models.KindChat, Person: claimed}
	return h.m.ChatAccountAs(context.Background(), limitsAgency, h.account.ID, person, in)
}

func TestAssistantLimitsAreReadBackAsSet(t *testing.T) {
	h := newLimitsHub(t)
	got, err := h.m.GetAssistantLimits(context.Background(), limitsAgency)
	if err != nil || got.TokensPerPersonDay != 0 || got.TokensPerPersonMonth != 0 {
		t.Fatalf("a hub that never set them = %+v, %v; want no limit", got, err)
	}
	h.set(t, 20000, 300000)
	got, err = h.m.GetAssistantLimits(context.Background(), limitsAgency)
	if err != nil || got.TokensPerPersonDay != 20000 || got.TokensPerPersonMonth != 300000 {
		t.Fatalf("limits read back = %+v, %v", got, err)
	}
}

func TestAssistantLimitsRefuseANegativeNumber(t *testing.T) {
	h := newLimitsHub(t)
	_, err := h.m.SetAssistantLimits(context.Background(), limitsAgency, AssistantLimits{TokensPerPersonDay: -1})
	if !errors.Is(err, ErrInvalidAccount) {
		t.Fatalf("a negative day number = %v, want ErrInvalidAccount", err)
	}
}

func TestAPersonWhoUsedTheirDayIsRefusedBeforeTheModelIsCalled(t *testing.T) {
	h := newLimitsHub(t)
	h.set(t, 100, 0)
	h.spend(t, "ana", 100)
	_, err := h.ask("ana", "")
	if !errors.Is(err, ErrAssistantLimit) || !strings.HasPrefix(err.Error(), "assistant limit: day") {
		t.Fatalf("error = %v, want one starting 'assistant limit: day'", err)
	}
	if h.calls.Load() != 0 {
		t.Fatal("the model was called for a person at the limit")
	}
}

func TestAnotherPersonIsNotCutOffByTheFirstPersonsUse(t *testing.T) {
	h := newLimitsHub(t)
	h.set(t, 100, 0)
	h.spend(t, "ana", 500)
	if _, err := h.ask("ben", ""); err != nil {
		t.Fatalf("ben, who used nothing, = %v", err)
	}
	if h.calls.Load() != 1 {
		t.Fatal("the model was not called for ben")
	}
}

func TestAPersonWhoUsedTheirMonthIsRefusedWhenTodayIsStillOpen(t *testing.T) {
	h := newLimitsHub(t)
	h.set(t, 1000, 100)
	earlier := h.clock.AddDate(0, 0, -5)
	*h.clock = earlier
	h.spend(t, "ana", 100)
	*h.clock = earlier.AddDate(0, 0, 5)
	_, err := h.ask("ana", "")
	if !errors.Is(err, ErrAssistantLimit) || !strings.HasPrefix(err.Error(), "assistant limit: month") {
		t.Fatalf("error = %v, want one starting 'assistant limit: month'", err)
	}
	if h.calls.Load() != 0 {
		t.Fatal("the model was called for a person at the month limit")
	}
}

func TestLastMonthsUseIsNotCountedThisMonth(t *testing.T) {
	h := newLimitsHub(t)
	h.set(t, 0, 100)
	*h.clock = time.Date(2026, 10, 31, 23, 0, 0, 0, time.UTC)
	h.spend(t, "ana", 500)
	*h.clock = time.Date(2026, 11, 1, 0, 30, 0, 0, time.UTC)
	if _, err := h.ask("ana", ""); err != nil {
		t.Fatalf("a new month = %v, want the share back", err)
	}
}

func TestTheCallerNotTheBodyDecidesWhoseShareIsCounted(t *testing.T) {
	h := newLimitsHub(t)
	h.set(t, 100, 0)
	h.spend(t, "ana", 100)
	if _, err := h.ask("ana", "ben"); !errors.Is(err, ErrAssistantLimit) {
		t.Fatalf("ana naming ben in the body = %v, want ana's own limit to apply", err)
	}
	if _, err := h.ask("ben", "ana"); err != nil {
		t.Fatalf("ben naming ana in the body = %v, want ben's own count to apply", err)
	}
}

func TestACallThroughTheModelIsCountedForTheCaller(t *testing.T) {
	h := newLimitsHub(t)
	h.set(t, 7, 0)
	if _, err := h.ask("ana", "ben"); err != nil {
		t.Fatal(err)
	}
	if _, err := h.ask("ana", ""); !errors.Is(err, ErrAssistantLimit) {
		t.Fatalf("second ask after 7 tokens against a 7 token day = %v, want the limit", err)
	}
}

func TestACallWithNoCallerPersonIsNotLimitedPerPerson(t *testing.T) {
	h := newLimitsHub(t)
	h.set(t, 1, 1)
	h.spend(t, "", 100)
	if _, err := h.ask("", ""); err != nil {
		t.Fatalf("a call with no person = %v, want no per-person limit", err)
	}
}

func (h *limitsHub) askAs(person, roleID string) error {
	in := ChatInput{Messages: []ChatMessage{{Role: "user", Content: "hello"}}, RoleID: roleID, Kind: models.KindChat}
	_, err := h.m.ChatAccountAs(context.Background(), limitsAgency, h.account.ID, person, in)
	return err
}

func (h *limitsHub) role(t *testing.T) AIRole {
	t.Helper()
	role, err := h.m.CreateAIRole(context.Background(), limitsAgency, models.AIRoleInput{Name: "triager", Status: "enabled"})
	if err != nil {
		t.Fatal(err)
	}
	return role
}

func TestAPersonNamingAnAIRoleIsStillHeldToTheirOwnShare(t *testing.T) {
	h := newLimitsHub(t)
	h.set(t, 1, 1)
	h.spend(t, "ana", 100)
	if err := h.askAs("ana", h.role(t).ID); !errors.Is(err, ErrAssistantLimit) {
		t.Fatalf("a person naming an AI role = %v, want their own limit to apply", err)
	}
}

func TestACallForAnAIRoleWithNoCallerPersonIsNotLimitedPerPerson(t *testing.T) {
	h := newLimitsHub(t)
	h.set(t, 1, 1)
	h.spend(t, "ana", 100)
	if err := h.askAs("", h.role(t).ID); err != nil {
		t.Fatalf("an AI role's call with no person = %v, want the role's own limits only", err)
	}
}
