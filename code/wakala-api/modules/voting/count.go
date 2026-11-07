package voting

import (
	"context"
	"fmt"

	"wakalaserver/modules/shared/specstore"
)

type ChoiceCount struct {
	ChoiceID   string `json:"choice_id"`
	Label      string `json:"label"`
	Position   int    `json:"position"`
	Votes      int    `json:"votes"`
	Suppressed bool   `json:"suppressed,omitempty"`
}

type Count struct {
	PollID             string        `json:"poll_id"`
	Choices            []ChoiceCount `json:"choices"`
	Answered           int           `json:"answered"`
	AnsweredSuppressed bool          `json:"answered_suppressed,omitempty"`
	Minimum            int           `json:"minimum,omitempty"`
}

func (m *pollManager) CountPoll(ctx context.Context, pollID string) (Count, error) {
	p, err := m.GetPoll(ctx, pollID)
	if err != nil {
		return Count{}, err
	}
	choices, err := m.ListChoices(ctx, p.ID)
	if err != nil {
		return Count{}, err
	}
	ballots, err := specstore.List[Ballot](m.st, m.st.Query(ctx, objectBallot).Where("poll_id = ?", p.ID), objectBallot)
	if err != nil {
		return Count{}, fmt.Errorf("CountPoll: %w", err)
	}
	var answered int64
	if err := m.st.Query(ctx, objectParticipation).Where("poll_id = ?", p.ID).Count(&answered).Error; err != nil {
		return Count{}, fmt.Errorf("CountPoll: %w", err)
	}
	return Count{PollID: p.ID, Choices: tally(choices, ballots), Answered: int(answered)}, nil
}

func tally(choices []Choice, ballots []Ballot) []ChoiceCount {
	votes := map[string]int{}
	for _, b := range ballots {
		for id, n := range b.Votes {
			votes[id] += n
		}
	}
	out := make([]ChoiceCount, 0, len(choices))
	for _, c := range choices {
		out = append(out, ChoiceCount{ChoiceID: c.ID, Label: c.Label, Position: c.Position, Votes: votes[c.ID]})
	}
	return out
}
