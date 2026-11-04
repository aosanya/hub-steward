package mwanachamacatalog

import (
	"context"
	"errors"
	"strconv"
	"time"
)

const (
	AnswerClockSetting = "raised_item.answer_within_days"
	DefaultAnswerClock = 10
)

func (m *catalogManager) answerClock(ctx context.Context) (int, error) {
	s, err := m.GetSetting(ctx, AnswerClockSetting)
	if errors.Is(err, ErrSettingNotFound) {
		return DefaultAnswerClock, nil
	}
	if err != nil {
		return 0, err
	}
	days, err := strconv.Atoi(s.Value)
	if err != nil || days < 1 {
		return 0, ErrInvalidSetting
	}
	return days, nil
}

func isWeekday(t time.Time) bool {
	d := t.Weekday()
	return d != time.Saturday && d != time.Sunday
}

func weekdaysBefore(t time.Time, n int) time.Time {
	for n > 0 {
		t = t.AddDate(0, 0, -1)
		if isWeekday(t) {
			n--
		}
	}
	return t
}

func (m *catalogManager) ListOverdueRaisedItems(ctx context.Context, at string) ([]RaisedItem, error) {
	if !m.takesRaisedItems() {
		return nil, ErrRaisedItemsNotTaken
	}
	if at == "" {
		at = m.now()
	}
	when, err := time.Parse(time.RFC3339, at)
	if err != nil {
		return nil, ErrInvalidRaisedItem
	}
	days, err := m.answerClock(ctx)
	if err != nil {
		return nil, err
	}
	cutoff := weekdaysBefore(when.UTC(), days).Format(time.RFC3339)
	q := m.q(ctx, roleRaisedItem).Where("created_at <= ?", cutoff)
	if m.sendsReplies() {
		q = q.Where("id NOT IN (?)", m.q(ctx, roleReply).Select("raised_item_id"))
	}
	if m.makesRemovals() {
		q = q.Where("id NOT IN (?)", m.q(ctx, roleRemoval).Select("raised_item_id"))
	}
	return listOf[RaisedItem](m, q.Order("created_at, id"), roleRaisedItem)
}
