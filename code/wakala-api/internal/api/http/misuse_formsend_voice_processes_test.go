package http

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/languages"
	"wakalaserver/internal/session"
	mwanachamainsights "wakalaserver/modules/insights"
)

const voiceProcessRounds = 6
const voiceProcessCopies = 16

func secondConnectionTo(t *testing.T, first *gorm.DB) *gorm.DB {
	t.Helper()
	var second *gorm.DB
	switch first.Dialector.Name() {
	case "postgres":
		var schema string
		if err := first.Raw("select current_schema()").Scan(&schema).Error; err != nil {
			t.Fatalf("read the schema: %v", err)
		}
		u, err := url.Parse(os.Getenv("DATABASE_URL"))
		if err != nil {
			t.Fatalf("parse DATABASE_URL: %v", err)
		}
		query := u.Query()
		query.Set("search_path", schema)
		u.RawQuery = query.Encode()
		second, err = gorm.Open(postgres.Open(u.String()), &gorm.Config{})
		if err != nil {
			t.Fatalf("second connection: %v", err)
		}
	default:
		var files []struct {
			Name string
			File string
		}
		if err := first.Raw("pragma database_list").Scan(&files).Error; err != nil || len(files) == 0 {
			t.Fatalf("read the database file: %v", err)
		}
		second = openSharedFile(t, files[0].File)
	}
	t.Cleanup(func() {
		if sqlDB, err := second.DB(); err == nil {
			sqlDB.Close()
		}
	})
	return second
}

func secondProcessOn(t *testing.T, db *gorm.DB, sessions session.Manager) http.Handler {
	t.Helper()
	var registry agencies.Registry
	reg, err := agencies.NewRegistry(db, agencies.StartingApproved(),
		agencies.WithConsentRequired(ConsentRequired(func() agencies.Registry { return registry })),
		agencies.WithModuleMounted(ModuleMounted(func() agencies.Registry { return registry })),
	)
	if err != nil {
		t.Fatalf("second NewRegistry: %v", err)
	}
	registry = reg
	insightSpec, err := mwanachamainsights.SpecFor("test")
	if err != nil {
		t.Fatalf("insights SpecFor: %v", err)
	}
	insights, err := mwanachamainsights.NewInsightManager(db, insightSpec)
	if err != nil {
		t.Fatalf("NewInsightManager: %v", err)
	}
	languageStore, err := languages.NewStore(db)
	if err != nil {
		t.Fatalf("languages NewStore: %v", err)
	}
	deps := &Deps{Registry: reg, Insights: insights, Languages: languageStore, Sessions: sessions, AdminToken: "test-admin-token"}
	ApplyCaches(deps)
	return NewRouter(deps)
}

func (r voiceSendRace) sendTogetherAcross(t *testing.T, handlers []http.Handler, copies int) []int {
	t.Helper()
	codes := make([]int, copies)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range codes {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			path := fmt.Sprintf("%s/%s/answers?as=%s", r.base, r.formID, r.groups[(i/len(handlers))%len(r.groups)])
			body := map[string]any{"answers": []map[string]any{{"question_id": r.questionID, "value_text": fmt.Sprintf("view %d", i)}}}
			codes[i] = callOn(handlers[i%len(handlers)], "POST", path, body, r.resident).Code
		}()
	}
	close(start)
	wg.Wait()
	return codes
}

func twoProcessVoiceRace(t *testing.T, first *gorm.DB, oneVoice string) {
	t.Helper()
	for round := 0; round < voiceProcessRounds; round++ {
		r := newVoiceSendRaceOn(t, first, oneVoice, false)
		secondDB := secondConnectionTo(t, first)
		handlers := []http.Handler{r.handler, secondProcessOn(t, secondDB, r.deps.Sessions)}
		codes := r.sendTogetherAcross(t, handlers, voiceProcessCopies)
		kept := 0
		for _, code := range codes {
			switch {
			case code == http.StatusOK:
				kept++
			case code == http.StatusConflict && oneVoice == "refuse":
			default:
				t.Fatalf("%s round %d: split over two processes the sends answered %v", oneVoice, round, codes)
			}
		}
		if kept < 1 {
			t.Fatalf("%s round %d: no send was kept: %v", oneVoice, round, codes)
		}
		if held := r.voicesHeld(t); held != 1 {
			t.Fatalf("%s round %d: %d voices held for one resident across two processes, want 1: %v", oneVoice, round, held, codes)
		}
	}
}

func TestFormSend_UnderRefuseTwoProcessesSharingAPostgresKeepOneVoice(t *testing.T) {
	twoProcessVoiceRace(t, localPostgresOrSkip(t), "refuse")
}

func TestFormSend_UnderFlagTwoProcessesSharingAPostgresCountOneVoice(t *testing.T) {
	twoProcessVoiceRace(t, localPostgresOrSkip(t), "flag")
}

func TestFormSend_UnderRefuseTwoProcessesSharingASqliteFileKeepOneVoice(t *testing.T) {
	twoProcessVoiceRace(t, openSharedFile(t, filepath.Join(t.TempDir(), "wakala.db")), "refuse")
}

func TestFormSend_UnderFlagTwoProcessesSharingASqliteFileCountOneVoice(t *testing.T) {
	twoProcessVoiceRace(t, openSharedFile(t, filepath.Join(t.TempDir(), "wakala.db")), "flag")
}
