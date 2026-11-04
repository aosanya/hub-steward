package agencies

import (
	"context"
	"gorm.io/gorm"
	"time"
)

type Removal struct {
	InstanceID string    `json:"instance_id"`
	UserID     string    `json:"user_id"`
	RemovedBy  string    `json:"removed_by"`
	RemovedAt  time.Time `json:"removed_at"`
}

type removalRow struct {
	ID         uint `gorm:"primaryKey;autoIncrement"`
	InstanceID string
	UserID     string `gorm:"index"`
	RemovedBy  string
	RemovedAt  time.Time
}

func (removalRow) TableName() string { return "agency_member_removals" }

type RemovalRegistry interface {
	RemoveFromAgency(ctx context.Context, instanceID, userID, removedBy string) (Removal, error)
	RemovalsFor(ctx context.Context, userID string) ([]Removal, error)
}

func (r *registry) RemoveFromAgency(ctx context.Context, instanceID, userID, removedBy string) (Removal, error) {
	defer r.tenantChanged(instanceID)
	row := removalRow{InstanceID: instanceID, UserID: userID, RemovedBy: removedBy, RemovedAt: time.Now().UTC()}
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Where("instance_id = ? AND user_id = ?", instanceID, userID).Delete(&memberRow{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrNotAMember
		}
		return tx.Create(&row).Error
	})
	if err != nil {
		return Removal{}, err
	}
	return Removal{InstanceID: row.InstanceID, UserID: row.UserID, RemovedBy: row.RemovedBy, RemovedAt: row.RemovedAt}, nil
}

func (r *registry) RemovalsFor(ctx context.Context, userID string) ([]Removal, error) {
	var rows []removalRow
	if err := r.db.WithContext(ctx).Where("user_id = ?", userID).Order("removed_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]Removal, 0, len(rows))
	for _, row := range rows {
		out = append(out, Removal{InstanceID: row.InstanceID, UserID: row.UserID, RemovedBy: row.RemovedBy, RemovedAt: row.RemovedAt})
	}
	return out, nil
}
