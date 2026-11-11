package voting

import (
	"context"
	"errors"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"wakalaserver/modules/shared/specstore"
)

const rivalWait = 400 * time.Millisecond

func newPollsOnManyConnections(t *testing.T) *pollsFixture {
	t.Helper()
	dsn := "file:" + filepath.Join(t.TempDir(), "voting.db") + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { sqlDB.Close() })
	s, err := SpecFor("cover")
	if err != nil {
		t.Fatal(err)
	}
	if err := Provision(db, s); err != nil {
		t.Fatalf("Provision: %v", err)
	}
	pm, err := NewPollManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	impl := pm.(*pollManager)
	f := &pollsFixture{pm: impl, db: db, s: s, now: time.Now().UTC()}
	impl.now = func() string { return f.now.Format(specstore.TimeLayout) }
	impl.UseGroups(func(context.Context, string) ([]string, error) { return []string{"ward-a"}, nil })
	return f
}

func (f *pollsFixture) ballotsOf(t *testing.T, pollID string) int {
	t.Helper()
	var n int64
	if err := f.pm.st.Query(context.Background(), objectBallot).Where("poll_id = ?", pollID).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return int(n)
}

func (f *pollsFixture) onceAfterParticipationInsert(t *testing.T, run func()) {
	t.Helper()
	table := f.pm.st.Table(objectParticipation)
	var armed atomic.Bool
	armed.Store(true)
	err := f.db.Callback().Create().After("gorm:create").Register("after-participation:"+t.Name(), func(tx *gorm.DB) {
		if tx.Statement.Table != table || !armed.CompareAndSwap(true, false) {
			return
		}
		done := make(chan struct{})
		go func() {
			defer close(done)
			run()
		}()
		select {
		case <-done:
		case <-time.After(rivalWait):
		}
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestTwoReplacesThatInterleaveLeaveOneBallotSetNotTwo(t *testing.T) {
	f := newPollsOnManyConnections(t)
	ctx := context.Background()
	p := f.poll(t, func(p *Poll) { p.ChangeAllowed = true })
	choices, _ := f.pm.ListChoices(ctx, p.ID)
	if _, err := f.pm.AnswerPoll(ctx, Answer{PollID: p.ID, AnsweredBy: "amina", Votes: map[string]int{choices[0].ID: 1}}); err != nil {
		t.Fatal(err)
	}
	var rivalErr atomic.Value
	f.onceAfterParticipationInsert(t, func() {
		if _, err := f.pm.AnswerPoll(ctx, Answer{PollID: p.ID, AnsweredBy: "amina", Votes: map[string]int{choices[2].ID: 1}}); err != nil {
			rivalErr.Store(err)
		}
	})
	if _, err := f.pm.AnswerPoll(ctx, Answer{PollID: p.ID, AnsweredBy: "amina", Votes: map[string]int{choices[1].ID: 1}}); err != nil {
		t.Fatalf("the replace failed: %v", err)
	}
	time.Sleep(rivalWait)
	if err, _ := rivalErr.Load().(error); err != nil {
		t.Fatalf("the rival replace failed: %v", err)
	}
	if got := f.ballotsOf(t, p.ID); got != 1 {
		t.Fatalf("the poll holds %d ballots for one member, want 1", got)
	}
	count, err := f.pm.CountPoll(ctx, p.ID)
	if err != nil || count.Answered != 1 {
		t.Fatalf("%+v %v", count, err)
	}
	total := 0
	for _, c := range count.Choices {
		total += c.Votes
	}
	if total != 1 {
		t.Fatalf("the count holds %d votes for one member, want 1: %+v", total, count)
	}
}

func TestACountReadBetweenTheDeleteAndTheInsertOfAReplaceStillSeesTheMember(t *testing.T) {
	f := newPollsOnManyConnections(t)
	ctx := context.Background()
	p := f.poll(t, func(p *Poll) { p.ChangeAllowed = true })
	choices, _ := f.pm.ListChoices(ctx, p.ID)
	if _, err := f.pm.AnswerPoll(ctx, Answer{PollID: p.ID, AnsweredBy: "amina", Votes: map[string]int{choices[0].ID: 1}}); err != nil {
		t.Fatal(err)
	}
	var seen atomic.Value
	var wg sync.WaitGroup
	table := f.pm.st.Table(objectParticipation)
	var armed atomic.Bool
	armed.Store(true)
	err := f.db.Callback().Delete().After("gorm:delete").Register("count-after-delete:"+t.Name(), func(tx *gorm.DB) {
		if tx.Statement.Table != table || !armed.CompareAndSwap(true, false) {
			return
		}
		wg.Add(1)
		defer wg.Wait()
		go func() {
			defer wg.Done()
			c, err := f.pm.CountPoll(ctx, p.ID)
			if err == nil {
				seen.Store(c)
			}
		}()
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.pm.AnswerPoll(ctx, Answer{PollID: p.ID, AnsweredBy: "amina", Votes: map[string]int{choices[1].ID: 1}}); err != nil {
		t.Fatal(err)
	}
	c, ok := seen.Load().(Count)
	if !ok {
		t.Fatal("the concurrent count read never answered")
	}
	votes := 0
	for _, ch := range c.Choices {
		votes += ch.Votes
	}
	if c.Answered != 1 || votes != 1 {
		t.Fatalf("a count read during a replace saw %d answered and %d votes, want 1 and 1", c.Answered, votes)
	}
}

func TestAReplaceThatFailsOnTheBallotKeepsTheEarlierAnswerWhole(t *testing.T) {
	f := newPollsOnManyConnections(t)
	ctx := context.Background()
	p := f.poll(t, func(p *Poll) { p.ChangeAllowed = true })
	choices, _ := f.pm.ListChoices(ctx, p.ID)
	if _, err := f.pm.AnswerPoll(ctx, Answer{PollID: p.ID, AnsweredBy: "amina", Votes: map[string]int{choices[0].ID: 1}}); err != nil {
		t.Fatal(err)
	}
	table := f.pm.st.Table(objectBallot)
	err := f.db.Callback().Create().Before("gorm:create").Register("ballot-fails:"+t.Name(), func(tx *gorm.DB) {
		if tx.Statement.Table == table {
			_ = tx.AddError(errors.New("disk full"))
		}
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.pm.AnswerPoll(ctx, Answer{PollID: p.ID, AnsweredBy: "amina", Votes: map[string]int{choices[1].ID: 1}}); err == nil {
		t.Fatal("the replace should have failed")
	}
	count, err := f.pm.CountPoll(ctx, p.ID)
	if err != nil || count.Answered != 1 || count.Choices[0].Votes != 1 || count.Choices[1].Votes != 0 {
		t.Fatalf("the earlier answer was lost: %+v %v", count, err)
	}
}
