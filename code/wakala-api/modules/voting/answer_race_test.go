package voting

import (
	"context"
	"errors"
	"testing"

	"gorm.io/gorm"
)

func (f *pollsFixture) rivalAnswersAfterTheLookup(t *testing.T, pollID, by string) {
	t.Helper()
	table := f.pm.st.Table(objectParticipation)
	armed := true
	err := f.db.Callback().Query().After("gorm:query").Register("rival:"+t.Name(), func(tx *gorm.DB) {
		if !armed || tx.Statement.Table != table {
			return
		}
		armed = false
		rival := Participation{ID: newID(), PollID: pollID, AnsweredBy: by, AnsweredAt: f.pm.now()}
		if err := f.pm.st.Insert(context.Background(), objectParticipation, rival); err != nil {
			t.Errorf("rival answer: %v", err)
		}
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestALosingRaceOnAFirstAnswerIsAlreadyAnsweredNotAStoreError(t *testing.T) {
	f := newPolls(t)
	ctx := context.Background()
	p := f.poll(t, nil)
	choices, _ := f.pm.ListChoices(ctx, p.ID)
	f.rivalAnswersAfterTheLookup(t, p.ID, "amina")
	_, err := f.pm.AnswerPoll(ctx, Answer{PollID: p.ID, AnsweredBy: "amina", Votes: map[string]int{choices[0].ID: 1}})
	if !errors.Is(err, ErrAlreadyAnswered) {
		t.Fatalf("got %v, want ErrAlreadyAnswered", err)
	}
	count, err := f.pm.CountPoll(ctx, p.ID)
	if err != nil || count.Answered != 1 {
		t.Fatalf("%+v %v", count, err)
	}
}

func TestALosingRaceOnAChangeableAnswerReplacesTheWinner(t *testing.T) {
	f := newPolls(t)
	ctx := context.Background()
	p := f.poll(t, func(p *Poll) { p.ChangeAllowed = true })
	choices, _ := f.pm.ListChoices(ctx, p.ID)
	f.rivalAnswersAfterTheLookup(t, p.ID, "amina")
	if _, err := f.pm.AnswerPoll(ctx, Answer{PollID: p.ID, AnsweredBy: "amina", Votes: map[string]int{choices[2].ID: 1}}); err != nil {
		t.Fatalf("got %v, want the answer to replace the one that won the race", err)
	}
	count, err := f.pm.CountPoll(ctx, p.ID)
	if err != nil || count.Answered != 1 || count.Choices[2].Votes != 1 {
		t.Fatalf("%+v %v", count, err)
	}
}
