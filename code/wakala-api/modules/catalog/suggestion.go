package mwanachamacatalog

import (
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/catalog/models"
)

func (m *catalogManager) suggestions(ctx context.Context) *gorm.DB {
	return m.q(ctx, roleSuggestion)
}

func (m *catalogManager) comments(ctx context.Context) *gorm.DB {
	return m.q(ctx, roleSuggestionComment)
}

func (m *catalogManager) matches(ctx context.Context) *gorm.DB {
	return m.q(ctx, roleSuggestionMatch)
}

func (m *catalogManager) findSuggestion(ctx context.Context, id string) (Suggestion, error) {
	var s Suggestion
	err := m.take(m.suggestions(ctx).Where("id = ?", id), roleSuggestion, &s, ErrSuggestionNotFound)
	return s, err
}

func (m *catalogManager) FileSuggestion(ctx context.Context, s Suggestion) (Suggestion, error) {
	if err := m.needs(roleSuggestion); err != nil {
		return Suggestion{}, err
	}
	anonymous := isAnonymous(ctx)
	asked := s.Slug
	s.Status = models.SuggestionStatusProposed
	s.Attempts = 0
	s.DecidedAt = ""
	if anonymous {
		s.Priority = 0
		s.Source = ""
		s.RunRef = ""
	}
	if s.Priority == 0 {
		s.Priority = models.DefaultSuggestionPriority
	}
	if s.Source == "" {
		s.Source = models.SuggestionSourceRun
	}
	if err := m.checks(roleSuggestion, s); err != nil || s.Attempts < 0 {
		return Suggestion{}, ErrInvalidSuggestion
	}

	filed, err := m.fileOnce(ctx, s)
	if !anonymous {
		return filed, err
	}
	if errors.Is(err, ErrSuggestionDuplicate) {
		s.Slug = parkedSlug(asked)
		filed, err = m.fileOnce(ctx, s)
	}
	if err == nil {
		filed.Slug = asked
	}
	return filed, err
}

func parkedSlug(slug string) string {
	return slug + "-" + strings.ReplaceAll(newID(), "-", "")[:8]
}

func (m *catalogManager) fileOnce(ctx context.Context, s Suggestion) (Suggestion, error) {
	if _, err := m.findEntry(ctx, s.Slug); err == nil {
		return Suggestion{}, ErrSuggestionDuplicate
	} else if !errors.Is(err, ErrEntryNotFound) {
		return Suggestion{}, err
	}
	var n int64
	if err := m.suggestions(ctx).Where("slug = ?", s.Slug).Count(&n).Error; err != nil {
		return Suggestion{}, err
	}
	if n > 0 {
		return Suggestion{}, ErrSuggestionDuplicate
	}

	s.ID = newID()
	s.CreatedAt = m.now()
	if err := m.insert(ctx, roleSuggestion, s); err != nil {
		if isUniqueViolation(err) {
			return Suggestion{}, ErrSuggestionDuplicate
		}
		return Suggestion{}, err
	}
	return s, nil
}

func (m *catalogManager) GetSuggestion(ctx context.Context, id string) (Suggestion, error) {
	if err := m.needs(roleSuggestion); err != nil {
		return Suggestion{}, err
	}
	return m.findSuggestion(ctx, id)
}

func (m *catalogManager) ListSuggestions(ctx context.Context, statuses ...SuggestionStatus) ([]Suggestion, error) {
	if err := m.needs(roleSuggestion); err != nil {
		return nil, err
	}
	q := m.suggestions(ctx)
	if len(statuses) > 0 {
		in := make([]string, 0, len(statuses))
		for _, s := range statuses {
			in = append(in, string(s))
		}
		q = q.Where("status IN ?", in)
	}
	return listOf[Suggestion](m, q.Order("priority, created_at"), roleSuggestion)
}

func (m *catalogManager) DecideSuggestion(ctx context.Context, id string, status SuggestionStatus, priority *int) (Suggestion, error) {
	if err := m.needs(roleSuggestion); err != nil {
		return Suggestion{}, err
	}
	switch status {
	case models.SuggestionStatusProposed, models.SuggestionStatusApproved, models.SuggestionStatusRejected:
	default:
		return Suggestion{}, ErrSuggestionStatus
	}
	existing, err := m.findSuggestion(ctx, id)
	if err != nil {
		return Suggestion{}, err
	}
	if existing.Status == models.SuggestionStatusBuilt {
		return Suggestion{}, ErrSuggestionStatus
	}

	updates := map[string]any{"status": string(status), "decided_at": m.now()}
	if status == models.SuggestionStatusProposed {
		updates["decided_at"] = ""
	}
	if status == models.SuggestionStatusApproved {
		updates["attempts"] = 0
	}
	if priority != nil {
		updates["priority"] = *priority
	}
	res := m.suggestions(ctx).
		Where("id = ? AND status <> ?", existing.ID, string(models.SuggestionStatusBuilt)).
		Updates(updates)
	if res.Error != nil {
		return Suggestion{}, res.Error
	}
	if res.RowsAffected == 0 {
		return Suggestion{}, ErrSuggestionStatus
	}
	return m.GetSuggestion(ctx, id)
}

func (m *catalogManager) RecordSuggestionAttempt(ctx context.Context, id, runRef, comment string) (Suggestion, error) {
	if err := m.needs(roleSuggestion); err != nil {
		return Suggestion{}, err
	}
	if strings.TrimSpace(comment) == "" {
		return Suggestion{}, ErrAttemptNeedsComment
	}
	attempts, err := m.countAttempt(ctx, id)
	if err != nil {
		return Suggestion{}, err
	}
	if !m.declares(roleSuggestionComment) {
		return m.GetSuggestion(ctx, id)
	}
	note := models.SuggestionComment{
		ID:           newID(),
		SuggestionID: id,
		Author:       models.CommentAuthorRun,
		RunRef:       runRef,
		Attempt:      attempts,
		Body:         strings.TrimSpace(comment),
		CreatedAt:    m.now(),
	}
	if err := m.insert(ctx, roleSuggestionComment, note); err != nil {
		return Suggestion{}, err
	}
	return m.GetSuggestion(ctx, id)
}

func (m *catalogManager) countAttempt(ctx context.Context, id string) (int, error) {
	for ctx.Err() == nil {
		existing, err := m.findSuggestion(ctx, id)
		if err != nil {
			return 0, err
		}
		if existing.Status != models.SuggestionStatusApproved {
			return 0, ErrSuggestionStatus
		}
		attempts := existing.Attempts + 1
		status := existing.Status
		if attempts >= models.MaxSuggestionAttempts {
			status = models.SuggestionStatusStalled
		}
		res := m.suggestions(ctx).
			Where("id = ? AND status = ? AND attempts = ?", existing.ID, string(models.SuggestionStatusApproved), existing.Attempts).
			Updates(map[string]any{"attempts": attempts, "status": string(status)})
		if res.Error != nil {
			return 0, res.Error
		}
		if res.RowsAffected > 0 {
			return attempts, nil
		}
	}
	return 0, ctx.Err()
}

func (m *catalogManager) CommentOnSuggestion(ctx context.Context, id string, author CommentAuthor, body string) (SuggestionComment, error) {
	if err := m.needs(roleSuggestion, roleSuggestionComment); err != nil {
		return SuggestionComment{}, err
	}
	existing, err := m.findSuggestion(ctx, id)
	if err != nil {
		return SuggestionComment{}, err
	}
	c := models.SuggestionComment{
		ID:           newID(),
		SuggestionID: existing.ID,
		Author:       author,
		Body:         strings.TrimSpace(body),
		CreatedAt:    m.now(),
	}
	if err := m.checks(roleSuggestionComment, c); err != nil {
		return SuggestionComment{}, ErrInvalidComment
	}
	if err := m.insert(ctx, roleSuggestionComment, c); err != nil {
		return SuggestionComment{}, err
	}
	return c, nil
}

func (m *catalogManager) ListSuggestionComments(ctx context.Context, id string) ([]SuggestionComment, error) {
	if err := m.needs(roleSuggestion, roleSuggestionComment); err != nil {
		return nil, err
	}
	if _, err := m.findSuggestion(ctx, id); err != nil {
		return nil, err
	}
	return listOf[SuggestionComment](m,
		m.comments(ctx).Where("suggestion_id = ?", id).Order("created_at, id"),
		roleSuggestionComment)
}

func (m *catalogManager) upsertMatch(ctx context.Context, suggestionID, slug, runRef, note string) (SuggestionMatch, error) {
	if _, err := m.findEntry(ctx, slug); err != nil {
		return SuggestionMatch{}, err
	}
	match := models.SuggestionMatch{
		SuggestionID: suggestionID, Slug: slug, RunRef: runRef, Note: note, MetAt: m.now(),
	}
	refresh := func() (int64, error) {
		res := m.matches(ctx).Where("suggestion_id = ? AND slug = ?", suggestionID, slug).
			Updates(map[string]any{"run_ref": runRef, "note": note, "met_at": match.MetAt})
		return res.RowsAffected, res.Error
	}
	refreshed, err := refresh()
	if err != nil {
		return SuggestionMatch{}, err
	}
	if refreshed > 0 {
		return match, nil
	}
	if err := m.insert(ctx, roleSuggestionMatch, match); err != nil {
		if !isUniqueViolation(err) {
			return SuggestionMatch{}, err
		}
		if _, err := refresh(); err != nil {
			return SuggestionMatch{}, err
		}
	}
	return match, nil
}

func (m *catalogManager) AttachSuggestion(ctx context.Context, id, slug, note string) (SuggestionMatch, error) {
	if err := m.needs(roleSuggestion, roleSuggestionMatch); err != nil {
		return SuggestionMatch{}, err
	}
	existing, err := m.findSuggestion(ctx, id)
	if err != nil {
		return SuggestionMatch{}, err
	}
	if !countsAsRaised(existing.Status) {
		return SuggestionMatch{}, ErrSuggestionStatus
	}
	return m.upsertMatch(ctx, existing.ID, slug, existing.RunRef, note)
}

func countsAsRaised(status SuggestionStatus) bool {
	switch status {
	case models.SuggestionStatusProposed, models.SuggestionStatusApproved, models.SuggestionStatusBuilt:
		return true
	}
	return false
}

func (m *catalogManager) raisedSuggestionIDs(ctx context.Context) *gorm.DB {
	return m.suggestions(ctx).Select("id").Where("status IN ?", []string{
		string(models.SuggestionStatusProposed),
		string(models.SuggestionStatusApproved),
		string(models.SuggestionStatusBuilt),
	})
}

func (m *catalogManager) FulfilSuggestion(ctx context.Context, id, slug, runRef, note string) (Suggestion, error) {
	if err := m.needs(roleSuggestion, roleSuggestionMatch); err != nil {
		return Suggestion{}, err
	}
	existing, err := m.findSuggestion(ctx, id)
	if err != nil {
		return Suggestion{}, err
	}
	switch existing.Status {
	case models.SuggestionStatusApproved, models.SuggestionStatusBuilt:
	default:
		return Suggestion{}, ErrSuggestionStatus
	}
	if _, err := m.findEntry(ctx, slug); err != nil {
		return Suggestion{}, err
	}
	res := m.suggestions(ctx).
		Where("id = ? AND status IN ?", existing.ID, []string{
			string(models.SuggestionStatusApproved), string(models.SuggestionStatusBuilt),
		}).
		Update("status", string(models.SuggestionStatusBuilt))
	if res.Error != nil {
		return Suggestion{}, res.Error
	}
	if res.RowsAffected == 0 {
		return Suggestion{}, ErrSuggestionStatus
	}
	if _, err := m.upsertMatch(ctx, existing.ID, slug, runRef, note); err != nil {
		return Suggestion{}, err
	}
	return m.GetSuggestion(ctx, id)
}

func (m *catalogManager) ListSuggestionMatches(ctx context.Context, id string) ([]SuggestionMatch, error) {
	if err := m.needs(roleSuggestion, roleSuggestionMatch); err != nil {
		return nil, err
	}
	if _, err := m.findSuggestion(ctx, id); err != nil {
		return nil, err
	}
	return listOf[SuggestionMatch](m,
		m.matches(ctx).Where("suggestion_id = ? AND suggestion_id IN (?)", id, m.raisedSuggestionIDs(ctx)).Order("slug"),
		roleSuggestionMatch)
}

func (m *catalogManager) ListEntryMatches(ctx context.Context, slug string) ([]SuggestionMatch, error) {
	if err := m.needs(roleSuggestion, roleSuggestionMatch); err != nil {
		return nil, err
	}
	if _, err := m.findEntry(ctx, slug); err != nil {
		return nil, err
	}
	return listOf[SuggestionMatch](m,
		m.matches(ctx).Where("slug = ? AND suggestion_id IN (?)", slug, m.raisedSuggestionIDs(ctx)).Order("met_at, suggestion_id"),
		roleSuggestionMatch)
}
