package voting

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"gorm.io/gorm"

	"wakalaserver/modules/shared/spec"
	"wakalaserver/modules/shared/specstore"

	"wakalaserver/modules/voting/models"
)

type doubleBallots struct {
	pm      PollManager
	db      *gorm.DB
	s       *spec.Spec
	pollID  string
	choices []Choice
}

func seedDoubleBallots(t *testing.T, pm PollManager, db *gorm.DB, s *spec.Spec, pollID string) doubleBallots {
	t.Helper()
	ctx := context.Background()
	choices, err := pm.ListChoices(ctx, pollID)
	if err != nil {
		t.Fatal(err)
	}
	for len(choices) < 3 {
		if _, err := pm.AddChoice(ctx, Choice{PollID: pollID, Label: "Extra choice", Position: len(choices) + 1}); err != nil {
			t.Fatal(err)
		}
		if choices, err = pm.ListChoices(ctx, pollID); err != nil {
			t.Fatal(err)
		}
	}
	pm.UseGroups(func(context.Context, string) ([]string, error) { return []string{"ward-a"}, nil })
	d := doubleBallots{pm: pm, db: db, s: s, pollID: pollID, choices: choices}
	for _, member := range []string{"amina", "otieno", "wanjiru"} {
		if _, err := pm.AnswerPoll(ctx, Answer{PollID: pollID, AnsweredBy: member, GroupID: "ward-a", Votes: map[string]int{choices[0].ID: 1}}); err != nil {
			t.Fatalf("AnswerPoll %s: %v", member, err)
		}
	}
	responses, err := pm.ListResponses(ctx, pollID)
	if err != nil {
		t.Fatal(err)
	}
	byMember := map[string]Response{}
	for _, r := range responses.Items {
		byMember[r.AnsweredBy] = r
	}
	st, err := newStore(db, s, map[string]any{objectBallot: models.Ballot{}})
	if err != nil {
		t.Fatal(err)
	}
	cast := func(response Response, id, choice, at string) {
		t.Helper()
		b := Ballot{ID: id, PollID: pollID, ResponseID: response.ResponseID, GroupID: response.GroupID, Votes: map[string]int{choice: 1}, CastAt: at}
		if err := st.Insert(ctx, objectBallot, b); err != nil {
			t.Fatal(err)
		}
	}
	base := time.Now().UTC()
	stamp := func(minutes int) string {
		return base.Add(time.Duration(minutes) * time.Minute).Format(specstore.TimeLayout)
	}
	cast(byMember["amina"], "ballot-amina-newer", choices[1].ID, stamp(60))
	cast(byMember["otieno"], "ballot-otieno-older", choices[2].ID, stamp(-120))
	cast(byMember["otieno"], "ballot-otieno-newer", choices[1].ID, stamp(120))
	for _, id := range []string{"secret-1", "secret-2"} {
		secret := Ballot{ID: id, PollID: pollID, Votes: map[string]int{choices[2].ID: 1}, CastAt: stamp(10)}
		if err := st.Insert(ctx, objectBallot, secret); err != nil {
			t.Fatal(err)
		}
	}
	return d
}

func (d doubleBallots) votesOnEachChoice(t *testing.T) []int {
	t.Helper()
	count, err := d.pm.CountPoll(context.Background(), d.pollID)
	if err != nil {
		t.Fatal(err)
	}
	out := make([]int, len(count.Choices))
	for i, c := range count.Choices {
		out[i] = c.Votes
	}
	return out
}

func equalInts(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func runDoubleBallotRepair(t *testing.T, pm PollManager, db *gorm.DB, s *spec.Spec, pollID string) {
	t.Helper()
	d := seedDoubleBallots(t, pm, db, s, pollID)
	if before := d.votesOnEachChoice(t); !equalInts(before, []int{3, 2, 3}) {
		t.Fatalf("seeded count %v, want the doubled count [3 2 3]", before)
	}
	removed, err := keepLatestBallotOfEachResponse(db, s)
	if err != nil || removed != 3 {
		t.Fatalf("removed %d, %v; want the three earlier ballots", removed, err)
	}
	if after := d.votesOnEachChoice(t); !equalInts(after, []int{1, 2, 2}) {
		t.Fatalf("repaired count %v, want the latest ballot of each response and the two secret ballots [1 2 2]", after)
	}
	removed, err = keepLatestBallotOfEachResponse(db, s)
	if err != nil || removed != 0 {
		t.Fatalf("second run removed %d, %v; want nothing", removed, err)
	}
	if err := Provision(db, s); err != nil {
		t.Fatalf("Provision again: %v", err)
	}
	if again := d.votesOnEachChoice(t); !equalInts(again, []int{1, 2, 2}) {
		t.Fatalf("count after a second Provision %v, want it unchanged [1 2 2]", again)
	}
}

func TestProvisionKeepsTheLatestBallotOfAResponseThatHoldsTwoOnSQLite(t *testing.T) {
	f := newPolls(t)
	p := f.poll(t, func(p *Poll) { p.ChangeAllowed = true })
	d := seedDoubleBallots(t, f.pm, f.db, f.s, p.ID)
	if err := Provision(f.db, f.s); err != nil {
		t.Fatalf("Provision: %v", err)
	}
	if after := d.votesOnEachChoice(t); !equalInts(after, []int{1, 2, 2}) {
		t.Fatalf("count after Provision %v, want [1 2 2]", after)
	}
}

func TestTheRepairCountsWhatItRemovedAndRemovesNothingTheSecondTimeOnSQLite(t *testing.T) {
	f := newPolls(t)
	p := f.poll(t, func(p *Poll) { p.ChangeAllowed = true })
	runDoubleBallotRepair(t, f.pm, f.db, f.s, p.ID)
}

func TestTwoProcessesRepairingTheSameDatabaseLeaveOneBallotPerResponseOnPostgres(t *testing.T) {
	pm, db, s, id := publishedPollFixture(t)
	d := seedDoubleBallots(t, pm, db, s, id)
	var wg sync.WaitGroup
	var total atomic.Int64
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			n, err := keepLatestBallotOfEachResponse(db, s)
			if err != nil {
				t.Errorf("repair: %v", err)
			}
			total.Add(n)
		}()
	}
	wg.Wait()
	if total.Load() != 3 {
		t.Fatalf("the four runs removed %d between them, want 3", total.Load())
	}
	if after := d.votesOnEachChoice(t); !equalInts(after, []int{1, 2, 2}) {
		t.Fatalf("count %v, want [1 2 2]", after)
	}
}

func TestProvisionRepairsDoubledBallotsOnPostgres(t *testing.T) {
	pm, db, s, id := publishedPollFixture(t)
	runDoubleBallotRepair(t, pm, db, s, id)
}
