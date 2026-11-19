package voting

import (
	"context"
	"fmt"

	"github.com/aosanya/mwanachama-backend-shared/specstore"
)

type Response struct {
	ResponseID string         `json:"response_id"`
	PollID     string         `json:"poll_id"`
	AnsweredBy string         `json:"answered_by"`
	GroupID    string         `json:"group_id,omitempty"`
	AnsweredAt string         `json:"answered_at"`
	Votes      map[string]int `json:"votes"`
}

type Responses struct {
	Items []Response `json:"items"`
}

func (m *pollManager) ListResponses(ctx context.Context, pollID string) (Responses, error) {
	return m.responses(ctx, pollID, "")
}

func (m *pollManager) ReadOwnResponses(ctx context.Context, pollID, caller string) (Responses, error) {
	if caller == "" {
		return Responses{}, ErrNoReader
	}
	return m.responses(ctx, pollID, caller)
}

func (m *pollManager) responses(ctx context.Context, pollID, by string) (Responses, error) {
	p, err := m.GetPoll(ctx, pollID)
	if err != nil {
		return Responses{}, err
	}
	q := m.st.Query(ctx, objectParticipation).Where("poll_id = ?", p.ID)
	if by != "" {
		q = q.Where("answered_by = ?", by)
	}
	parts, err := specstore.List[Participation](m.st, q.Order("answered_at, id"), objectParticipation)
	if err != nil {
		return Responses{}, fmt.Errorf("responses: %w", err)
	}
	ballots, err := specstore.List[Ballot](m.st, m.st.Query(ctx, objectBallot).Where("poll_id = ?", p.ID), objectBallot)
	if err != nil {
		return Responses{}, fmt.Errorf("responses: %w", err)
	}
	votes := make(map[string]map[string]int, len(ballots))
	for _, b := range ballots {
		if b.ResponseID != "" {
			votes[b.ResponseID] = b.Votes
		}
	}
	out := Responses{Items: make([]Response, 0, len(parts))}
	for _, pt := range parts {
		out.Items = append(out.Items, Response{ResponseID: pt.ID, PollID: pt.PollID, AnsweredBy: pt.AnsweredBy, GroupID: pt.GroupID, AnsweredAt: pt.AnsweredAt, Votes: votes[pt.ID]})
	}
	return out, nil
}
