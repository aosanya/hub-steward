package voting

import (
	"context"
	"fmt"

	"wakalaserver/modules/shared/disclosure"
)

const DefaultMinimumCount = 5

func SetMinimumCount(pm PollManager, minimum int) error {
	m, ok := pm.(*pollManager)
	if !ok {
		return fmt.Errorf("SetMinimumCount: unsupported manager %T", pm)
	}
	if minimum < 2 {
		return disclosure.ErrThreshold
	}
	m.minimum = minimum
	return nil
}

func (m *pollManager) minimumCount(ctx context.Context) (int, error) {
	if m.minimum >= 2 {
		return m.minimum, nil
	}
	s, err := m.Settings(ctx)
	if err != nil {
		return 0, err
	}
	if s.MinimumCount < 2 {
		return DefaultMinimumCount, nil
	}
	return s.MinimumCount, nil
}

func Disclose(c Count, minimum int) (Count, error) {
	cells := make([]disclosure.Cell, len(c.Choices))
	for i, ch := range c.Choices {
		cells[i] = disclosure.Cell{Key: ch.ChoiceID, Count: ch.Votes}
	}
	smallRun := c.Answered > 0 && c.Answered < minimum
	kept, folded, err := disclosure.FoldSmall(cells, minimum)
	if err != nil {
		return Count{}, err
	}
	res, err := disclosure.Apply(kept, minimum)
	if err != nil {
		return Count{}, err
	}
	outcome := make(map[string]disclosure.Outcome, len(res.Outcomes))
	for _, o := range res.Outcomes {
		outcome[o.Key] = o
	}
	isFolded := make(map[string]bool, len(folded))
	for _, k := range folded {
		isFolded[k] = true
	}
	out := Count{PollID: c.PollID, Answered: c.Answered, Minimum: minimum, Choices: make([]ChoiceCount, len(c.Choices))}
	anyHidden := smallRun
	for i, ch := range c.Choices {
		hide := smallRun || isFolded[ch.ChoiceID] || !outcome[ch.ChoiceID].Published
		out.Choices[i] = ChoiceCount{ChoiceID: ch.ChoiceID, Label: ch.Label, Position: ch.Position}
		if hide {
			out.Choices[i].Suppressed = true
			anyHidden = true
			continue
		}
		out.Choices[i].Votes = ch.Votes
	}
	if len(folded) > 0 {
		o := outcome[disclosure.OtherKey]
		out.Other = &OtherCount{Suppressed: smallRun || !o.Published}
		if !out.Other.Suppressed {
			out.Other.Votes = o.Count
		}
	}
	if anyHidden || !res.TotalPublished {
		out.AnsweredSuppressed = true
		out.Answered = 0
	}
	return out, nil
}
