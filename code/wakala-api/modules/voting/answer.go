package voting

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"wakalaserver/modules/shared/gormutil"
	"wakalaserver/modules/voting/models"
)

const answerAttempts = 5

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
	return m.recordAnswer(ctx, p, in.AnsweredBy, group, in.Votes, now)
}

func (m *pollManager) recordAnswer(ctx context.Context, p Poll, by, group string, votes map[string]int, now string) (Participation, error) {
	for attempt := 0; attempt < answerAttempts; attempt++ {
		prior, err := m.priorParticipation(ctx, p.ID, by, group)
		if err != nil {
			return Participation{}, err
		}
		if prior != nil && !p.ChangeAllowed {
			return Participation{}, ErrAlreadyAnswered
		}
		part, err := m.record(ctx, p.ID, by, group, votes, prior, now)
		if !gormutil.IsUniqueViolation(err) {
			return part, err
		}
	}
	return Participation{}, ErrAlreadyAnswered
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
	}
	ballot := Ballot{ID: newID(), PollID: pollID, ResponseID: part.ID, GroupID: group, Votes: votes, CastAt: now}
	err := m.st.InTransaction(ctx, func(tx *store) error {
		if prior != nil {
			if err := lockParticipation(ctx, tx, prior.ID); err != nil {
				return err
			}
			if err := forget(ctx, tx, prior.ID); err != nil {
				return err
			}
		}
		if err := tx.Insert(ctx, objectParticipation, part); err != nil {
			return fmt.Errorf("AnswerPoll: %w", err)
		}
		if err := tx.Insert(ctx, objectBallot, ballot); err != nil {
			return fmt.Errorf("AnswerPoll: %w", err)
		}
		return nil
	})
	if err != nil {
		return Participation{}, err
	}
	return part, nil
}

func lockParticipation(ctx context.Context, tx *store, responseID string) error {
	q := tx.Query(ctx, objectParticipation)
	if q.Dialector.Name() != "postgres" {
		return nil
	}
	if err := q.Exec("select pg_advisory_xact_lock(hashtext(?))", tx.Table(objectParticipation)+":"+responseID).Error; err != nil {
		return fmt.Errorf("AnswerPoll: %w", err)
	}
	return nil
}

func forget(ctx context.Context, tx *store, responseID string) error {
	if err := tx.Query(ctx, objectBallot).Where("response_id = ?", responseID).Delete(nil).Error; err != nil {
		return fmt.Errorf("AnswerPoll: %w", err)
	}
	if err := tx.Query(ctx, objectParticipation).Where("id = ?", responseID).Delete(nil).Error; err != nil {
		return fmt.Errorf("AnswerPoll: %w", err)
	}
	return nil
}
