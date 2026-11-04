package mwanachamacatalog

import (
	"context"
	"errors"
)

func (m *catalogManager) takesAttachments() bool {
	_, attached := m.st.Spec().ByRole(roleRaisedItemFile)
	return attached && m.takesRaisedItems()
}

func (m *catalogManager) AttachFiles(ctx context.Context, raisedItemID, raiser string, fileIDs []string) ([]RaisedItemFile, error) {
	if !m.takesAttachments() {
		return nil, ErrAttachmentsNotTaken
	}
	if raiser == "" || len(fileIDs) == 0 {
		return nil, ErrInvalidAttachment
	}
	var raised RaisedItem
	if err := m.take(m.q(ctx, roleRaisedItem).Where("id = ? AND raised_by = ?", raisedItemID, raiser), roleRaisedItem, &raised, ErrRaisedItemNotFound); err != nil {
		return nil, err
	}
	for _, id := range fileIDs {
		if id == "" {
			return nil, ErrInvalidAttachment
		}
	}
	for _, id := range fileIDs {
		f := RaisedItemFile{ID: newID(), RaisedItemID: raised.ID, FileID: id, AttachedBy: raiser, AttachedAt: m.now()}
		if err := m.checks(roleRaisedItemFile, f); err != nil {
			return nil, ErrInvalidAttachment
		}
		if _, err := m.attachmentOf(ctx, raised.ID, id); err == nil {
			continue
		} else if !errors.Is(err, ErrAttachmentNotFound) {
			return nil, err
		}
		row, err := encode(m.st.Object(roleRaisedItemFile), f)
		if err != nil {
			return nil, err
		}
		if err := m.q(ctx, roleRaisedItemFile).Create(row).Error; err != nil {
			if _, again := m.attachmentOf(ctx, raised.ID, id); again == nil {
				continue
			}
			return nil, err
		}
	}
	return m.ListRaisedItemFiles(ctx, raised.ID)
}

func (m *catalogManager) attachmentOf(ctx context.Context, raisedItemID, fileID string) (RaisedItemFile, error) {
	var f RaisedItemFile
	err := m.take(m.q(ctx, roleRaisedItemFile).Where("raised_item_id = ? AND file_id = ?", raisedItemID, fileID), roleRaisedItemFile, &f, ErrAttachmentNotFound)
	return f, err
}

func (m *catalogManager) ApproveFileForPublishing(ctx context.Context, raisedItemID, fileID, approvedBy string) (RaisedItemFile, error) {
	if !m.takesAttachments() {
		return RaisedItemFile{}, ErrAttachmentsNotTaken
	}
	if approvedBy == "" {
		return RaisedItemFile{}, ErrInvalidAttachment
	}
	var raised RaisedItem
	if err := m.take(m.q(ctx, roleRaisedItem).Where("id = ?", raisedItemID), roleRaisedItem, &raised, ErrRaisedItemNotFound); err != nil {
		return RaisedItemFile{}, err
	}
	if !raised.Publishable {
		return RaisedItemFile{}, ErrRaisedItemNotPublishable
	}
	f, err := m.attachmentOf(ctx, raised.ID, fileID)
	if err != nil {
		return RaisedItemFile{}, err
	}
	if f.ApprovedForPublishing() {
		return f, nil
	}
	f.ApprovedBy = approvedBy
	f.ApprovedAt = m.now()
	res := m.q(ctx, roleRaisedItemFile).Where("id = ? AND approved_at = ?", f.ID, "").Updates(map[string]any{"approved_by": f.ApprovedBy, "approved_at": f.ApprovedAt})
	if res.Error != nil {
		return RaisedItemFile{}, res.Error
	}
	if res.RowsAffected == 0 {
		return m.attachmentOf(ctx, raised.ID, fileID)
	}
	return f, nil
}

func (m *catalogManager) ListRaisedItemFiles(ctx context.Context, raisedItemID string) ([]RaisedItemFile, error) {
	if !m.takesAttachments() {
		return nil, ErrAttachmentsNotTaken
	}
	return listOf[RaisedItemFile](m, m.q(ctx, roleRaisedItemFile).Where("raised_item_id = ?", raisedItemID).Order("attached_at, id"), roleRaisedItemFile)
}

func (m *catalogManager) publishedFilesOf(ctx context.Context, grouped []RaisedItem) ([]string, error) {
	files := []string{}
	if !m.takesAttachments() {
		return files, nil
	}
	for _, r := range grouped {
		attached, err := m.ListRaisedItemFiles(ctx, r.ID)
		if err != nil {
			return nil, err
		}
		for _, f := range attached {
			if f.ApprovedForPublishing() {
				files = append(files, f.FileID)
			}
		}
	}
	return files, nil
}

func (m *catalogManager) WithdrawFileApproval(ctx context.Context, raisedItemID, fileID string) (RaisedItemFile, error) {
	if !m.takesAttachments() {
		return RaisedItemFile{}, ErrAttachmentsNotTaken
	}
	f, err := m.attachmentOf(ctx, raisedItemID, fileID)
	if err != nil {
		return RaisedItemFile{}, err
	}
	if err := m.q(ctx, roleRaisedItemFile).Where("id = ?", f.ID).Updates(map[string]any{"approved_by": "", "approved_at": ""}).Error; err != nil {
		return RaisedItemFile{}, err
	}
	f.ApprovedBy, f.ApprovedAt = "", ""
	return f, nil
}

func (m *catalogManager) DetachFile(ctx context.Context, raisedItemID, raiser, fileID string) error {
	if !m.takesAttachments() {
		return ErrAttachmentsNotTaken
	}
	if raiser == "" {
		return ErrRaisedItemNotFound
	}
	var raised RaisedItem
	if err := m.take(m.q(ctx, roleRaisedItem).Where("id = ? AND raised_by = ?", raisedItemID, raiser), roleRaisedItem, &raised, ErrRaisedItemNotFound); err != nil {
		return err
	}
	f, err := m.attachmentOf(ctx, raised.ID, fileID)
	if err != nil {
		return err
	}
	if f.ApprovedForPublishing() {
		return ErrAttachmentApproved
	}
	res := m.q(ctx, roleRaisedItemFile).Where("id = ? AND approved_at = ?", f.ID, "").Delete(map[string]any{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrAttachmentApproved
	}
	return nil
}
