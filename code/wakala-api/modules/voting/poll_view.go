package voting

import "context"

func (m *pollManager) ShowPoll(ctx context.Context, pollID string) (PollRead, error) {
	p, err := m.GetPoll(ctx, pollID)
	if err != nil {
		return nil, err
	}
	return p, nil
}
