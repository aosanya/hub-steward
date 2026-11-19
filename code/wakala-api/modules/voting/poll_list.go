package voting

import (
	"context"
	"fmt"
	"slices"

	"wakalaserver/modules/shared/specstore"
)

func (m *pollManager) ListOpenPolls(ctx context.Context, caller string) ([]OpenPoll, error) {
	if caller == "" {
		return nil, ErrNoReader
	}
	groups, err := m.callerGroups(ctx, caller)
	if err != nil {
		return nil, fmt.Errorf("ListOpenPolls: %w", err)
	}
	out := []OpenPoll{}
	polls, err := m.openPollsOf(ctx, groups, caller)
	if err != nil || len(polls) == 0 {
		return out, err
	}
	ids := pollIDs(polls)
	choices, err := m.choicesByPoll(ctx, ids)
	if err != nil {
		return nil, err
	}
	answered, err := m.answeredBy(ctx, ids, caller)
	if err != nil {
		return nil, err
	}
	for _, p := range polls {
		view := OpenPoll{
			PollRespondentView: p.RespondentView(),
			Choices:            choices[p.ID],
			Answered:           answered[p.ID],
			Mine:               p.CreatedBy == caller,
			InAudience:         sharesAGroup(p.GroupIDs, groups),
		}
		if view.Choices == nil {
			view.Choices = []Choice{}
		}
		out = append(out, view)
	}
	return out, nil
}

func (m *pollManager) openPollsOf(ctx context.Context, groups []string, caller string) ([]Poll, error) {
	all, err := specstore.List[Poll](m.st, m.st.Query(ctx, objectPoll).Order("created_at, id"), objectPoll)
	if err != nil {
		return nil, fmt.Errorf("ListOpenPolls: %w", err)
	}
	now := m.now()
	open := []Poll{}
	for _, p := range all {
		if insideWindow(p, now) && (sharesAGroup(p.GroupIDs, groups) || p.CreatedBy == caller) {
			open = append(open, p)
		}
	}
	return open, nil
}

func sharesAGroup(pollGroups, callerGroups []string) bool {
	return slices.ContainsFunc(callerGroups, func(g string) bool { return slices.Contains(pollGroups, g) })
}

func pollIDs(polls []Poll) []string {
	ids := make([]string, 0, len(polls))
	for _, p := range polls {
		ids = append(ids, p.ID)
	}
	return ids
}

func (m *pollManager) choicesByPoll(ctx context.Context, ids []string) (map[string][]Choice, error) {
	q := m.st.Query(ctx, objectChoice).Where("poll_id IN ?", ids).Order("position asc, id")
	all, err := specstore.List[Choice](m.st, q, objectChoice)
	if err != nil {
		return nil, fmt.Errorf("ListOpenPolls: %w", err)
	}
	out := make(map[string][]Choice, len(ids))
	for _, c := range all {
		out[c.PollID] = append(out[c.PollID], c)
	}
	return out, nil
}

func (m *pollManager) answeredBy(ctx context.Context, ids []string, caller string) (map[string]bool, error) {
	q := m.st.Query(ctx, objectParticipation).Where("poll_id IN ? AND answered_by = ?", ids, caller)
	all, err := specstore.List[Participation](m.st, q, objectParticipation)
	if err != nil {
		return nil, fmt.Errorf("ListOpenPolls: %w", err)
	}
	out := make(map[string]bool, len(all))
	for _, pt := range all {
		out[pt.PollID] = true
	}
	return out, nil
}
