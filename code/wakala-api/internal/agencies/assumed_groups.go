package agencies

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrAssumedGroupInvalid = errors.New("agencies: an assumed group needs a session, an instance, a person and a group")

type AssumedGroups interface {
	AssumeGroup(ctx context.Context, sessionKey, instanceID, memberID, groupID string, endsAt time.Time) error
	AssumedGroupOf(ctx context.Context, sessionKey, instanceID, memberID string) (string, error)
}

type assumedGroupRow struct {
	SessionKey string `gorm:"primaryKey"`
	InstanceID string `gorm:"primaryKey"`
	MemberID   string
	GroupID    string
	EndsAt     int64 `gorm:"index"`
}

func (assumedGroupRow) TableName() string { return "agency_assumed_groups" }

func migrateAssumedGroups(db *gorm.DB) error {
	return db.AutoMigrate(&assumedGroupRow{})
}

func (r *registry) AssumeGroup(ctx context.Context, sessionKey, instanceID, memberID, groupID string, endsAt time.Time) error {
	sessionKey, instanceID, memberID, groupID = strings.TrimSpace(sessionKey), strings.TrimSpace(instanceID), strings.TrimSpace(memberID), strings.TrimSpace(groupID)
	if blank(sessionKey, instanceID, memberID, groupID) {
		return ErrAssumedGroupInvalid
	}
	db := r.db.WithContext(ctx)
	if err := db.Where("ends_at <= ?", time.Now().UTC().Unix()).Delete(&assumedGroupRow{}).Error; err != nil {
		return err
	}
	row := assumedGroupRow{SessionKey: sessionKey, InstanceID: instanceID, MemberID: memberID, GroupID: groupID, EndsAt: endsAt.UTC().Unix()}
	return db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "session_key"}, {Name: "instance_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"member_id", "group_id", "ends_at"}),
	}).Create(&row).Error
}

func (r *registry) AssumedGroupOf(ctx context.Context, sessionKey, instanceID, memberID string) (string, error) {
	if blank(sessionKey, instanceID, memberID) {
		return "", nil
	}
	var rows []assumedGroupRow
	err := r.db.WithContext(ctx).
		Where("session_key = ? AND instance_id = ? AND member_id = ? AND ends_at > ?", sessionKey, instanceID, memberID, time.Now().UTC().Unix()).
		Limit(1).Find(&rows).Error
	if err != nil || len(rows) == 0 {
		return "", err
	}
	return rows[0].GroupID, nil
}
