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
	return listOf[RaisedItem](m, m.q(ctx, roleRaisedItem).Where("subject_id = ?", subjectID).Order("created_at, id"), roleRaisedItem)
}
