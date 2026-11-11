package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"wakalaserver/internal/specs"
	mwanachamaauth "wakalaserver/modules/auth"
	authmodels "wakalaserver/modules/auth/models"
)

const twoProcessRounds = 40
const twoProcessCopies = 24

type processPair struct {
	bases  []string
	client *http.Client
}

func twoProcessPair(t *testing.T) (processPair, *gorm.DB) {
	t.Helper()
	a, b := os.Getenv("WAKALA_TWO_API_A"), os.Getenv("WAKALA_TWO_API_B")
	dsn := os.Getenv("DATABASE_URL")
	if a == "" || b == "" || dsn == "" {
		t.Skip("WAKALA_TWO_API_A, WAKALA_TWO_API_B and DATABASE_URL are not set")
	}
	u, err := url.Parse(dsn)
	if err != nil || (u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost") {
		t.Skip("DATABASE_URL does not point at 127.0.0.1 or localhost")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("open postgres: %v", err)
	}
	return processPair{bases: []string{a, b}, client: &http.Client{Timeout: 30 * time.Second}}, db
}

func keepSessionsInLedger(t *testing.T, w pollAnswerWalk, db *gorm.DB) {
	t.Helper()
	raw, err := specs.Raw("auth")
	if err != nil {
		t.Fatalf("read the auth declaration: %v", err)
	}
	authSpec, err := mwanachamaauth.ParseSpec(raw)
	if err != nil {
		t.Fatalf("parse the auth declaration: %v", err)
	}
	store, err := mwanachamaauth.NewSessionStore(db, authSpec)
	if err != nil {
		t.Fatalf("session store: %v", err)
	}
	for _, cookie := range []*http.Cookie{w.owner, w.inside, w.outside} {
		kept, err := w.deps.Sessions.Verify(context.Background(), cookie.Value)
		if err != nil {
			t.Fatalf("verify a minted session: %v", err)
		}
		_, err = store.Start(context.Background(), authmodels.SessionStart{SubjectID: kept.MemberID, Token: cookie.Value, At: time.Now(), ExpiresAt: kept.ExpiresAt})
		if err != nil {
			t.Fatalf("keep a session in the ledger: %v", err)
		}
	}
}

func (p processPair) post(base, path string, body any, as *http.Cookie) (int, string) {
	raw, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", base+path, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(as)
	return p.send(req)
}

func (p processPair) get(base, path string, as *http.Cookie) (int, string) {
	req, _ := http.NewRequest("GET", base+path, nil)
	req.AddCookie(as)
	return p.send(req)
}

func (p processPair) send(req *http.Request) (int, string) {
	res, err := p.client.Do(req)
	if err != nil {
		return 0, err.Error()
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	return res.StatusCode, string(body)
}

func ballotTables(t *testing.T, db *gorm.DB) []string {
	t.Helper()
	var names []string
	err := db.Raw(`select table_name from information_schema.columns
		where table_schema = current_schema() and column_name in ('response_id', 'votes') and table_name not like '%\_test'
		group by table_name having count(*) = 2`).Scan(&names).Error
	if err != nil || len(names) == 0 {
		t.Fatalf("find the ballot table: %v %v", names, err)
	}
	return names
}

type ballotCounts struct {
	total          int64
	mostOnOneReply int64
}

func countBallots(t *testing.T, db *gorm.DB, tables []string) ballotCounts {
	t.Helper()
	var out ballotCounts
	for _, table := range tables {
		var total, most int64
		db.Raw(fmt.Sprintf(`select count(*) from %q`, table)).Scan(&total)
		db.Raw(fmt.Sprintf(`select coalesce(max(n), 0) from (select count(*) n from %q where response_id is not null and response_id <> '' group by response_id) g`, table)).Scan(&most)
		out.total += total
		if most > out.mostOnOneReply {
			out.mostOnOneReply = most
		}
	}
	return out
}

func tallyOf(t *testing.T, body string) (answered float64, votes float64) {
	t.Helper()
	var count map[string]any
	if err := json.Unmarshal([]byte(body), &count); err != nil {
		t.Fatalf("decode count %q: %v", body, err)
	}
	answered, _ = count["answered"].(float64)
	choices, _ := count["choices"].([]any)
	for _, c := range choices {
		row, _ := c.(map[string]any)
		n, _ := row["votes"].(float64)
		votes += n
	}
	return answered, votes
}

func TestTwoAPIProcessesReplacingOneAnswerLeaveOneBallotOnPostgres(t *testing.T) {
	pair, db := twoProcessPair(t)
	w := newPollAnswerWalkOn(t, db)
	keepSessionsInLedger(t, w, db)
	var tables []string
	statuses := map[int]int{}
	var mu sync.Mutex
	var kept int64
	for round := 1; round <= twoProcessRounds; round++ {
		pollID, _ := w.newPoll(t, true)
		choiceIDs := w.twoChoices(t, pollID)
		if tables == nil {
			tables = ballotTables(t, db)
			kept = countBallots(t, db, tables).total
		}
		path := w.polls + "/" + pollID + "/answers"
		start := make(chan struct{})
		var wg sync.WaitGroup
		for i := 0; i < twoProcessCopies; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				<-start
				code, body := pair.post(pair.bases[i%2], path, map[string]any{"votes": map[string]int{choiceIDs[i%2]: 1}}, w.inside)
				mu.Lock()
				statuses[code]++
				mu.Unlock()
				if code >= http.StatusInternalServerError || code == 0 {
					t.Errorf("round %d copy %d: %d %s", round, i, code, strings.TrimSpace(body))
				}
			}()
		}
		close(start)
		wg.Wait()
		ballots := countBallots(t, db, tables)
		if ballots.mostOnOneReply != 1 || ballots.total != kept+int64(round) {
			t.Fatalf("round %d: %d ballots in total, most on one response %d, want %d and 1; status codes %v", round, ballots.total, ballots.mostOnOneReply, kept+int64(round), statuses)
		}
		for _, base := range pair.bases {
			code, body := pair.get(base, w.polls+"/"+pollID+"/count", w.owner)
			answered, votes := tallyOf(t, body)
			if code != http.StatusOK || answered != 1 || votes != 1 {
				t.Fatalf("round %d on %s: count %d answered %v votes %v: %s", round, base, code, answered, votes, body)
			}
		}
	}
	t.Logf("rounds %d, replaces per round %d, status codes %v", twoProcessRounds, twoProcessCopies, statuses)
}
