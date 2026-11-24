package agencies

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrGroupTagInvalid = errors.New("agencies: a group tag needs an instance, a group and a tag")

type groupTagRow struct {
	InstanceID string `gorm:"primaryKey"`
	GroupID    string `gorm:"primaryKey;index"`
	TagID      string `gorm:"primaryKey;index"`
	CreatedAt  time.Time
}

func (groupTagRow) TableName() string { return "agency_group_tags" }

func migrateGroupTags(db *gorm.DB) error {
	return db.AutoMigrate(&groupTagRow{})
}

func (r *registry) GiveGroupTag(ctx context.Context, instanceID, groupID, tagID string) error {
	instanceID, groupID, tagID = strings.TrimSpace(instanceID), strings.TrimSpace(groupID), strings.TrimSpace(tagID)
	if blank(instanceID, groupID, tagID) {
		return ErrGroupTagInvalid
	}
	if err := r.tagsOfKnownInstance(ctx, instanceID); err != nil {
		return err
	}
	if _, err := r.findTag(ctx, instanceID, tagID); err != nil {
		return err
	}
	defer r.tenantChanged(instanceID)
	row := groupTagRow{InstanceID: instanceID, GroupID: groupID, TagID: tagID, CreatedAt: time.Now().UTC()}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error
}

func (r *registry) TakeGroupTag(ctx context.Context, instanceID, groupID, tagID string) error {
	if blank(instanceID, groupID, tagID) {
		return ErrGroupTagInvalid
	}
	defer r.tenantChanged(instanceID)
	return r.db.WithContext(ctx).
		Where("instance_id = ? AND group_id = ? AND tag_id = ?", instanceID, groupID, tagID).
		Delete(&groupTagRow{}).Error
}

func (r *registry) GroupTags(ctx context.Context, instanceID, groupID string) ([]Tag, error) {
	if blank(instanceID, groupID) {
		return []Tag{}, nil
	}
	if err := r.tagsOfKnownInstance(ctx, instanceID); err != nil {
		return nil, err
	}
	var rows []tagRow
	err := r.db.WithContext(ctx).
		Where("instance_id = ? AND id IN (?)", instanceID,
			r.db.Model(&groupTagRow{}).Select("tag_id").Where("instance_id = ? AND group_id = ?", instanceID, groupID)).
		Order("system DESC, lower(name), name").Find(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]Tag, 0, len(rows))
	for _, row := range rows {
		out = append(out, tagOf(row))
	}
	return out, nil
}
