package voting

import (
	"context"
	"fmt"
	"strings"

	"wakalaserver/modules/shared/specstore"

	"wakalaserver/modules/voting/models"
)

func (m *pollManager) CreatePoll(ctx context.Context, in Poll) (Poll, error) {
	if in.CreatedBy == "" {
		return Poll{}, ErrNoCreator
	}
	in.State = models.StateDraft
	in.PublishedAt, in.PublishedBy, in.PublishedGroupIDs = "", "", nil
	in, err := m.startFromSettings(ctx, in)
	if err != nil {
		return Poll{}, err
	}
	if err := m.checks(objectPoll, in, ErrInvalidPoll); err != nil {
		return Poll{}, err
	}
	if err := settingsHold(in); err != nil {
		return Poll{}, fmt.Errorf("%w: %s", ErrInvalidPoll, err)
	}
	if err := m.groupsBelong(ctx, in.GroupIDs); err != nil {
		return Poll{}, err
	}
	choices, err := m.choicesHold(in)
	if err != nil {
		return Poll{}, err
	}
	in.ID = newID()
	in.CreatedAt = m.now()
	in.Choices = nil
	if err := m.st.Insert(ctx, objectPoll, in); err != nil {
		return Poll{}, fmt.Errorf("CreatePoll: %w", err)
	}
	for i := range choices {
		choices[i].ID = newID()
		choices[i].PollID = in.ID
		choices[i].Position = i + 1
		choices[i].CreatedAt = in.CreatedAt
		if err := m.st.Insert(ctx, objectChoice, choices[i]); err != nil {
			return Poll{}, fmt.Errorf("CreatePoll: %w", err)
		}
	}
	in.Choices = choices
	return in, nil
}

func (m *pollManager) groupsBelong(ctx context.Context, groupIDs []string) error {
	for _, g := range groupIDs {
		if strings.TrimSpace(g) == "" {
			return fmt.Errorf("%w: a poll goes to groups that have an id", ErrInvalidPoll)
		}
		if m.exists == nil {
			continue
		}
		found, err := m.exists(ctx, g)
		if err != nil {
			return fmt.Errorf("CreatePoll: %w", err)
		}
		if !found {
			return fmt.Errorf("%w: group %q is not a group of this agency", ErrInvalidPoll, g)
		}
	}
	return nil
}

func (m *pollManager) choicesHold(p Poll) ([]Choice, error) {
	out := make([]Choice, 0, len(p.Choices))
	for _, c := range p.Choices {
		c.PollID = "pending"
		if err := m.checks(objectChoice, c, ErrInvalidChoice); err != nil {
			return nil, err
		}
		out = append(out, Choice{Label: c.Label})
	}
	if p.Mode == models.ModeUpTo && len(out) > 0 && p.MaxChoices > len(out) {
		return nil, fmt.Errorf("%w: max_choices %d is more than the poll's %d choices",
			ErrInvalidPoll, p.MaxChoices, len(out))
	}
	return out, nil
}

func settingsHold(p Poll) error {
	if len(p.GroupIDs) == 0 {
		return fmt.Errorf("a poll goes to at least one group")
	}
	if p.ClosesAt <= p.OpensAt {
		return fmt.Errorf("closes_at falls after opens_at")
	}
	if p.Mode == models.ModeUpTo && p.MaxChoices < 1 {
		return fmt.Errorf("an up_to poll names how many choices it allows")
	}
	if p.Mode == models.ModeQuadratic && p.Budget < 1 {
		return fmt.Errorf("a quadratic poll gives a budget of at least 1")
	}
	return nil
}

func (m *pollManager) GetPoll(ctx context.Context, pollID string) (Poll, error) {
	var out Poll
	q := m.st.Query(ctx, objectPoll).Where("id = ?", pollID)
	if err := m.st.Take(q, objectPoll, &out, ErrPollNotFound); err != nil {
		return Poll{}, err
	}
	return out, nil
}

func (m *pollManager) AddChoice(ctx context.Context, in Choice) (Choice, error) {
	if err := m.checks(objectChoice, in, ErrInvalidChoice); err != nil {
		return Choice{}, err
	}
	p, err := m.GetPoll(ctx, in.PollID)
	if err != nil {
		return Choice{}, err
	}
	if p.State != models.StateDraft {
		return Choice{}, ErrPollNotDraft
	}
	existing, err := m.ListChoices(ctx, in.PollID)
	if err != nil {
		return Choice{}, err
	}
	in.ID = newID()
	in.Position = len(existing) + 1
	in.CreatedAt = m.now()
	if err := m.st.Insert(ctx, objectChoice, in); err != nil {
		return Choice{}, fmt.Errorf("AddChoice: %w", err)
	}
	return in, nil
}

func (m *pollManager) ListChoices(ctx context.Context, pollID string) ([]Choice, error) {
	if _, err := m.GetPoll(ctx, pollID); err != nil {
		return nil, err
	}
	q := m.st.Query(ctx, objectChoice).Where("poll_id = ?", pollID).Order("position asc")
	out, err := specstore.List[Choice](m.st, q, objectChoice)
	if err != nil {
		return nil, fmt.Errorf("ListChoices: %w", err)
	}
	return out, nil
}
