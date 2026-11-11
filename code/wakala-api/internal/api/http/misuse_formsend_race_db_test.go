package http

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"sync"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func localPostgresOrSkip(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL is not set")
	}
	u, err := url.Parse(dsn)
	if err != nil || (u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost") {
		t.Skip("DATABASE_URL does not point at 127.0.0.1 or localhost")
	}
	admin, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open postgres: %v", err)
	}
	schema := fmt.Sprintf("race_%d", time.Now().UnixNano())
	if err := admin.Exec("create schema " + schema).Error; err != nil {
		t.Fatalf("create schema: %v", err)
	}
	query := u.Query()
	query.Set("search_path", schema)
	u.RawQuery = query.Encode()
	db, err := gorm.Open(postgres.Open(u.String()), &gorm.Config{})
	if err != nil {
		t.Fatalf("open postgres in %s: %v", schema, err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
		admin.Exec("drop schema " + schema + " cascade")
		if sqlDB, err := admin.DB(); err == nil {
			sqlDB.Close()
		}
	})
	return db
}

type formSendRace struct {
	consentWalk
	path       string
	questionID string
}

func newFormSendRace(t *testing.T, lockedAfterSend bool) formSendRace {
	t.Helper()
	cw := newConsentWalkOn(t, localPostgresOrSkip(t))
	publishMechanicsConsent(t, cw)
	if agreed := cw.call(t, "POST", "/instances/"+cw.instance+"/custody/consent/agree", map[string]any{}, cw.resident); agreed.Code != http.StatusCreated {
		t.Fatalf("resident agrees: %d %s", agreed.Code, agreed.Body.String())
	}
	formID, questionID := openFormForGroupLocked(t, cw, lockedAfterSend)
	return formSendRace{consentWalk: cw, path: "/instances/" + cw.instance + "/forms/forms/" + formID + "/answers", questionID: questionID}
}

func (r formSendRace) sendTogether(t *testing.T, copies int) []int {
	t.Helper()
	codes := make([]int, copies)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range codes {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			body := map[string]any{"answers": []map[string]any{{"question_id": r.questionID, "value_text": fmt.Sprintf("view %d", i)}}}
			codes[i] = r.call(t, "POST", r.path, body, r.resident).Code
		}()
	}
	close(start)
	wg.Wait()
	return codes
}

func (r formSendRace) answersHeld(t *testing.T) int {
	t.Helper()
	mine := r.call(t, "GET", r.path+"/mine", nil, r.resident)
	if mine.Code != http.StatusOK {
		t.Fatalf("resident reads their answers: %d %s", mine.Code, mine.Body.String())
	}
	return len(decodeObjects(t, mine))
}

func TestFormSend_FifteenSendsAtOnceNeverFailAndLeaveOneAnswer(t *testing.T) {
	for round := 0; round < 5; round++ {
		r := newFormSendRace(t, false)
		codes := r.sendTogether(t, 15)
		for _, code := range codes {
			if code != http.StatusOK {
				t.Fatalf("round %d: simultaneous sends answered %v, want only 200", round, codes)
			}
		}
		if held := r.answersHeld(t); held != 1 {
			t.Fatalf("round %d: %d answers held, want 1", round, held)
		}
	}
}

func TestFormSend_FifteenSendsAtOnceToALockedFormGiveOneSendAndTheRestConflict(t *testing.T) {
	for round := 0; round < 5; round++ {
		r := newFormSendRace(t, true)
		codes := r.sendTogether(t, 15)
		sent := 0
		for _, code := range codes {
			switch code {
			case http.StatusOK:
				sent++
			case http.StatusConflict:
			default:
				t.Fatalf("round %d: simultaneous sends answered %v, want only 200 and 409", round, codes)
			}
		}
		if sent != 1 {
			t.Fatalf("round %d: %d sends were kept, want 1: %v", round, sent, codes)
		}
		if held := r.answersHeld(t); held != 1 {
			t.Fatalf("round %d: %d answers held, want 1", round, held)
		}
	}
}
