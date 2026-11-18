package mwanachamacatalog

import "context"

func (m *catalogManager) subjectIsAnEntry(ctx context.Context, subjectID string) error {
	if subjectID == "" {
		return nil
	}
	var e Entry
	return m.take(m.entries(ctx).Where("id = ? AND deleted = ?", subjectID, false), roleEntry, &e, ErrEntryNotFound)
}

func (m *catalogManager) ListRaisedItemsOfSubject(ctx context.Context, subjectID string) ([]RaisedItem, error) {
	if !m.takesRaisedItems() {
		return nil, ErrRaisedItemsNotTaken
	}
	if subjectID == "" {
		return nil, ErrInvalidRaisedItem
	}
	q := m.q(ctx, roleRaisedItem).Where("subject_id = ?", subjectID)
	if !isAgencyOwner(ctx) {
		q = q.Where("anonymous = ?", false)
	}
	return listOf[RaisedItem](m, q.Order("created_at, id"), roleRaisedItem)
}
