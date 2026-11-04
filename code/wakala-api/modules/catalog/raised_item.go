package mwanachamacatalog

import "context"

func (m *catalogManager) takesRaisedItems() bool {
	_, taken := m.st.Spec().ByRole(roleRaisedItem)
	return taken
}

func (m *catalogManager) RaiseItem(ctx context.Context, r RaisedItem) (RaisedItem, error) {
	r.FiledBy = ""
	r.Channel = ""
	r.SubjectID = ""
	return m.FileRaisedItem(ctx, r)
}

func (m *catalogManager) FileRaisedItem(ctx context.Context, r RaisedItem) (RaisedItem, error) {
	if !m.takesRaisedItems() {
		return RaisedItem{}, ErrRaisedItemsNotTaken
	}
	if !r.OnBehalfIsWhole() || !r.PinIsAPoint() {
		return RaisedItem{}, ErrInvalidRaisedItem
	}
	if err := m.checks(roleRaisedItem, r); err != nil {
		return RaisedItem{}, ErrInvalidRaisedItem
	}
	if err := m.subjectIsAnEntry(ctx, r.SubjectID); err != nil {
		return RaisedItem{}, err
	}
	area, err := m.placeOf(ctx, r)
	if err != nil {
		return RaisedItem{}, err
	}
	r.Area = area
	street, err := m.streetOf(ctx, r)
	if err != nil {
		return RaisedItem{}, err
	}
	r.Street = street
	r.ID = newID()
	r.CreatedAt = m.now()
	row, err := encode(m.st.Object(roleRaisedItem), r)
	if err != nil {
		return RaisedItem{}, err
	}
	if err := m.q(ctx, roleRaisedItem).Create(row).Error; err != nil {
		return RaisedItem{}, err
	}
	return r, nil
}

func (m *catalogManager) ListRaisedItems(ctx context.Context, raisedBy string) ([]RaisedItem, error) {
	if !m.takesRaisedItems() {
		return nil, ErrRaisedItemsNotTaken
	}
	if raisedBy == "" {
		return nil, ErrInvalidRaisedItem
	}
	linked, err := m.entriesLinkedTo(ctx, raisedBy)
	if err != nil {
		return nil, err
	}
	q := m.q(ctx, roleRaisedItem).Where("raised_by = ?", raisedBy)
	if len(linked) > 0 {
		q = m.q(ctx, roleRaisedItem).Where("raised_by = ? OR subject_id IN ?", raisedBy, linked)
	}
	return listOf[RaisedItem](m, q.Order("created_at DESC, id DESC"), roleRaisedItem)
}
