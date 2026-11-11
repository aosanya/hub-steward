package voting

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"wakalaserver/modules/voting/models"
)

type Answer struct {
	PollID     string         `json:"poll_id"`
	AnsweredBy string         `json:"answered_by"`
	GroupID    string         `json:"group_id,omitempty"`
	Votes      map[string]int `json:"votes"`
}

type Groups func(ctx context.Context, caller string) ([]string, error)

type GroupExists func(ctx context.Context, groupID string) (bool, error)

func (m *pollManager) UseGroups(fn Groups) { m.groups = fn }

func (m *pollManager) UseGroupExists(fn GroupExists) { m.exists = fn }

func (m *pollManager) callerGroups(ctx context.Context, caller string) ([]string, error) {
	if m.groups == nil {
		return nil, nil
	}
	return m.groups(ctx, caller)
}

func (m *pollManager) AnswerPoll(ctx context.Context, in Answer) (Participation, error) {
	if in.AnsweredBy == "" {
		return Participation{}, ErrNoAnswerer
	}
	p, err := m.GetPoll(ctx, in.PollID)
	if err != nil {
		return Participation{}, err
	}
	now := m.now()
	if !insideWindow(p, now) {
		return Participation{}, ErrOutsideWindow
	}
	callerGroups, err := m.callerGroups(ctx, in.AnsweredBy)
	if err != nil {
		return Participation{}, fmt.Errorf("AnswerPoll: %w", err)
	}
	group, err := answeringGroup(p, in.GroupID, callerGroups)
	if err != nil {
		return Participation{}, err
	}
	choices, err := m.ListChoices(ctx, p.ID)
	if err != nil {
		return Participation{}, err
	}
	if err := votesFit(p, choices, in.Votes); err != nil {
		return Participation{}, fmt.Errorf("%w: %s", ErrInvalidAnswer, err)
	}
	prior, err := m.priorParticipation(ctx, p.ID, in.AnsweredBy, group)
	if err != nil {
		return Participation{}, err
	}
	if prior != nil && !p.ChangeAllowed {
		return Participation{}, ErrAlreadyAnswered
	}
	return m.record(ctx, p.ID, in.AnsweredBy, group, in.Votes, prior, now)
}

func insideWindow(p Poll, now string) bool {
	at, err := time.Parse(time.RFC3339Nano, now)
	if err != nil {
		return false
	}
	opens, err := time.Parse(time.RFC3339Nano, p.OpensAt)
	if err != nil {
		return false
	}
	closes, err := time.Parse(time.RFC3339Nano, p.ClosesAt)
	if err != nil {
		return false
	}
	return !at.Before(opens) && at.Before(closes)
}

func answeringGroup(p Poll, named string, callerGroups []string) (string, error) {
	if p.PerGroup == models.PerGroupEach {
		if named == "" || !slices.Contains(p.GroupIDs, named) || !slices.Contains(callerGroups, named) {
			return "", ErrNotInPollGroups
		}
		return named, nil
	}
	for _, g := range callerGroups {
		if slices.Contains(p.GroupIDs, g) {
			return "", nil
		}
	}
	return "", ErrNotInPollGroups
}

func votesFit(p Poll, choices []Choice, votes map[string]int) error {
	if len(votes) == 0 {
		return errors.New("an answer places at least one vote")
	}
	known := make(map[string]bool, len(choices))
	for _, c := range choices {
		known[c.ID] = true
	}
	cost := 0
	for id, n := range votes {
		if !known[id] {
			return fmt.Errorf("choice %q is not on this poll", id)
		}
		if n < 1 {
			return fmt.Errorf("choice %q is given %d votes; a vote placed is at least one", id, n)
		}
		if p.Mode != models.ModeQuadratic && n != 1 {
			return fmt.Errorf("choice %q is given %d votes; this poll takes one per choice", id, n)
		}
		cost += n * n
	}
	switch p.Mode {
	case models.ModeOne:
		if len(votes) != 1 {
			return errors.New("this poll takes exactly one choice")
		}
	case models.ModeUpTo:
		if len(votes) > p.MaxChoices {
			return fmt.Errorf("this poll takes at most %d choices", p.MaxChoices)
		}
	case models.ModeQuadratic:
		if cost > p.Budget {
			return fmt.Errorf("the votes cost %d credits; the budget is %d", cost, p.Budget)
		}
	}
	return nil
}

func (m *pollManager) priorParticipation(ctx context.Context, pollID, by, group string) (*Participation, error) {
	var out Participation
	q := m.st.Query(ctx, objectParticipation).
		Where("poll_id = ? AND answered_by = ? AND group_id = ?", pollID, by, group)
	err := m.st.Take(q, objectParticipation, &out, ErrPollNotFound)
	if errors.Is(err, ErrPollNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (m *pollManager) record(ctx context.Context, pollID, by, group string, votes map[string]int, prior *Participation, now string) (Participation, error) {
	part := Participation{ID: newID(), PollID: pollID, AnsweredBy: by, GroupID: group, AnsweredAt: now}
	if prior != nil {
		part.ID = prior.ID
		if err := m.forget(ctx, prior.ID); err != nil {
			return Participation{}, err
		}
	}
	if err := m.st.Insert(ctx, objectParticipation, part); err != nil {
		return Participation{}, fmt.Errorf("AnswerPoll: %w", err)
	}
	ballot := Ballot{ID: newID(), PollID: pollID, ResponseID: part.ID, GroupID: group, Votes: votes, CastAt: now}
	if err := m.st.Insert(ctx, objectBallot, ballot); err != nil {
		return Participation{}, fmt.Errorf("AnswerPoll: %w", err)
	}
	return part, nil
}

func (m *pollManager) forget(ctx context.Context, responseID string) error {
	if err := m.st.Query(ctx, objectBallot).Where("response_id = ?", responseID).Delete(nil).Error; err != nil {
		return fmt.Errorf("AnswerPoll: %w", err)
	}
	if err := m.st.Query(ctx, objectParticipation).Where("id = ?", responseID).Delete(nil).Error; err != nil {
		return fmt.Errorf("AnswerPoll: %w", err)
	}
	return nil
}
