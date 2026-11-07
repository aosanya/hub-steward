package voting

import (
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

func (m *pollManager) minimumCount() int {
	if m.minimum < 2 {
		return DefaultMinimumCount
	}
	return m.minimum
}

func Disclose(c Count, minimum int) (Count, error) {
	cells := make([]disclosure.Cell, len(c.Choices))
	for i, ch := range c.Choices {
		cells[i] = disclosure.Cell{Key: ch.ChoiceID, Count: ch.Votes}
	}
	smallRun := c.Answered > 0 && c.Answered < minimum
	res, err := disclosure.Apply(cells, minimum)
	if err != nil {
		return Count{}, err
	}
	out := Count{PollID: c.PollID, Answered: c.Answered, Minimum: minimum, Choices: make([]ChoiceCount, len(c.Choices))}
	anyHidden := smallRun
	for i, ch := range c.Choices {
		o := res.Outcomes[i]
		hide := smallRun || !o.Published
		out.Choices[i] = ChoiceCount{ChoiceID: ch.ChoiceID, Label: ch.Label, Position: ch.Position}
		if hide {
			out.Choices[i].Suppressed = true
			anyHidden = true
			continue
		}
		out.Choices[i].Votes = ch.Votes
	}
	if anyHidden || !res.TotalPublished {
		out.AnsweredSuppressed = true
		out.Answered = 0
	}
	return out, nil
}
