package http

import (
	"fmt"
	"net/http"
	"sync"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/languages"
	"wakalaserver/internal/session"
	mwanachamainsights "wakalaserver/modules/insights"
)

const sendsPerRound = 8

const roundsPerMode = 10

func secondServerOnSameDatabase(t *testing.T, first *gorm.DB, sessions session.Manager) http.Handler {
	t.Helper()
	dialector, ok := first.Dialector.(*postgres.Dialector)
	if !ok {
		t.Fatalf("dialector is %T, want postgres", first.Dialector)
	}
	db, err := gorm.Open(postgres.Open(dialector.Config.DSN), &gorm.Config{})
	if err != nil {
		t.Fatalf("second server opens its own connection: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	var registry agencies.Registry
	reg, err := agencies.NewRegistry(db, agencies.StartingApproved(),
		agencies.WithConsentRequired(ConsentRequired(func() agencies.Registry { return registry })),
		agencies.WithModuleMounted(ModuleMounted(func() agencies.Registry { return registry })),
	)
	if err != nil {
		t.Fatalf("second server NewRegistry: %v", err)
	}
	registry = reg
	spec, err := mwanachamainsights.SpecFor("test")
	if err != nil {
		t.Fatalf("insights SpecFor: %v", err)
	}
	insights, err := mwanachamainsights.NewInsightManager(db, spec)
	if err != nil {
		t.Fatalf("second server NewInsightManager: %v", err)
	}
	languageStore, err := languages.NewStore(db)
	if err != nil {
		t.Fatalf("second server languages: %v", err)
	}
	deps := &Deps{Registry: reg, Insights: insights, Languages: languageStore, Sessions: sessions, AdminToken: "test-admin-token"}
	ApplyCaches(deps)
	return NewRouter(deps)
}

func (r voiceSendRace) sendTogetherOnTwoServers(t *testing.T, second http.Handler, copies int) []int {
	t.Helper()
	servers := []http.Handler{r.handler, second}
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
			codes[i] = callOn(servers[(i/len(r.groups))%len(servers)], "POST", path, body, r.resident).Code
		}()
	}
	close(start)
	wg.Wait()
	return codes
}

func TestFormSend_UnderRefuseEightSendsAsTwoGroupsOnTwoServersKeepOneVoice(t *testing.T) {
	db := localPostgresOrSkip(t)
	for round := 0; round < roundsPerMode; round++ {
		r := newVoiceSendRaceOn(t, db, "refuse", false)
		second := secondServerOnSameDatabase(t, db, r.deps.Sessions)
		codes := r.sendTogetherOnTwoServers(t, second, sendsPerRound)
		kept := 0
		for _, code := range codes {
			switch code {
			case http.StatusOK:
				kept++
			case http.StatusConflict:
			default:
				t.Fatalf("round %d: answered %v, want only 200 and 409", round, codes)
			}
		}
		if kept < 1 {
			t.Fatalf("round %d: no send was kept: %v", round, codes)
		}
		if held := r.voicesHeld(t); held != 1 {
			t.Fatalf("round %d: %d voices held, want 1: %v", round, held, codes)
		}
		t.Logf("refuse round %d: codes %v, voices held 1", round, codes)
	}
}

func TestFormSend_UnderFlagEightSendsAsTwoGroupsOnTwoServersCountOneVoice(t *testing.T) {
	db := localPostgresOrSkip(t)
	for round := 0; round < roundsPerMode; round++ {
		r := newVoiceSendRaceOn(t, db, "flag", false)
		second := secondServerOnSameDatabase(t, db, r.deps.Sessions)
		codes := r.sendTogetherOnTwoServers(t, second, sendsPerRound)
		for _, code := range codes {
			if code != http.StatusOK {
				t.Fatalf("round %d: answered %v, want only 200", round, codes)
			}
		}
		if held := r.voicesHeld(t); held != 1 {
			t.Fatalf("round %d: %d voices counted, want 1: %v", round, held, codes)
		}
		t.Logf("flag round %d: codes %v, voices counted 1", round, codes)
	}
}
