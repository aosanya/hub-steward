package agencies

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrDisabledGroupInvalid = errors.New("agencies: a disabled group needs an instance and a group")

type DisabledGroups interface {
	DisableGroup(ctx context.Context, instanceID, groupID string) error
	EnableGroup(ctx context.Context, instanceID, groupID string) error
	DisabledGroupIDs(ctx context.Context, instanceID string) ([]string, error)
}

type disabledGroupRow struct {
	InstanceID string `gorm:"primaryKey"`
	GroupID    string `gorm:"primaryKey"`
	DisabledAt time.Time
}

func (disabledGroupRow) TableName() string { return "agency_group_disabled" }

func migrateDisabledGroups(db *gorm.DB) error {
	return db.AutoMigrate(&disabledGroupRow{})
}

func (r *registry) DisableGroup(ctx context.Context, instanceID, groupID string) error {
	instanceID, groupID = strings.TrimSpace(instanceID), strings.TrimSpace(groupID)
	if blank(instanceID, groupID) {
		return ErrDisabledGroupInvalid
	}
	if _, err := r.readInstance(ctx, instanceID); err != nil {
		return err
	}
	row := disabledGroupRow{InstanceID: instanceID, GroupID: groupID, DisabledAt: time.Now().UTC()}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error
}

func (r *registry) EnableGroup(ctx context.Context, instanceID, groupID string) error {
	if blank(instanceID, groupID) {
		return ErrDisabledGroupInvalid
	}
	if _, err := r.readInstance(ctx, instanceID); err != nil {
		return err
	}
	return r.db.WithContext(ctx).
		Where("instance_id = ? AND group_id = ?", instanceID, groupID).
		Delete(&disabledGroupRow{}).Error
}

func (r *registry) DisabledGroupIDs(ctx context.Context, instanceID string) ([]string, error) {
	ids := []string{}
	if blank(instanceID) {
		return ids, nil
	}
	err := r.db.WithContext(ctx).Model(&disabledGroupRow{}).
		Where("instance_id = ?", instanceID).Order("group_id").Pluck("group_id", &ids).Error
	return ids, err
}

func (r *registry) groupDisabled(ctx context.Context, instanceID, groupID string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&disabledGroupRow{}).
		Where("instance_id = ? AND group_id = ?", instanceID, groupID).Count(&count).Error
	return count > 0, err
}
