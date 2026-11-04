package agencies

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

const (
	ApprovalPending  = "pending"
	ApprovalApproved = "approved"
	ApprovalDeclined = "declined"
)

const ApprovalNoteLimit = 500

var (
	ErrApprovalDecided  = errors.New("agencies: the agency's approval is already decided")
	ErrApprovalNoteLong = errors.New("agencies: the note to the agency's owner is too long")
)

type ApprovalRegistry interface {
	ListPendingInstances(ctx context.Context) ([]Instance, error)
	DecideApproval(ctx context.Context, instanceID string, approve bool, note string) (Instance, error)
}

func approvalOf(stored string) string {
	switch stored {
	case ApprovalPending, ApprovalDeclined:
		return stored
	}
	return ApprovalApproved
}

func StartingApproved() Option {
	return func(r *registry) { r.startsAs = ApprovalApproved }
}

func (r *registry) startingApproval() string {
	if r.startsAs == ApprovalApproved {
		return ApprovalApproved
	}
	return ApprovalPending
}

func (i Instance) Approved() bool { return i.Approval == ApprovalApproved }

func (r *registry) ListPendingInstances(ctx context.Context) ([]Instance, error) {
	var rows []instanceRow
	err := r.db.WithContext(ctx).Where("approval = ?", ApprovalPending).Order("created_at").Order("id").Find(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("ListPendingInstances: %w", err)
	}
	out := make([]Instance, 0, len(rows))
	for _, row := range rows {
		out = append(out, rowToInstance(row))
	}
	return out, nil
}

func (r *registry) DecideApproval(ctx context.Context, instanceID string, approve bool, note string) (Instance, error) {
	note = strings.TrimSpace(note)
	if len([]rune(note)) > ApprovalNoteLimit {
		return Instance{}, ErrApprovalNoteLong
	}
	if _, err := r.GetInstance(ctx, instanceID); err != nil {
		return Instance{}, err
	}
	decision := ApprovalDeclined
	if approve {
		decision = ApprovalApproved
	}
	res := r.db.WithContext(ctx).Model(&instanceRow{}).
		Where("id = ? AND approval = ?", instanceID, ApprovalPending).
		Updates(map[string]any{"approval": decision, "approval_note": note})
	r.tenantChanged(instanceID)
	if res.Error != nil {
		return Instance{}, fmt.Errorf("DecideApproval: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return Instance{}, ErrApprovalDecided
	}
	return r.GetInstance(ctx, instanceID)
}
