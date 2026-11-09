package agencies

import (
	"context"
	"errors"
	"slices"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrGroupRoleInvalid = errors.New("agencies: a group role needs an instance, a group and a role")

type GroupRole struct {
	InstanceID   string    `json:"instance_id"`
	GroupID      string    `json:"group_id"`
	AgencyRoleID string    `json:"agency_role_id"`
	CreatedAt    time.Time `json:"created_at"`
}

type GroupRoles interface {
	GiveGroupRole(ctx context.Context, instanceID, groupID, agencyRoleID string) error
	TakeGroupRole(ctx context.Context, instanceID, groupID, agencyRoleID string) error
	GroupRoleIDs(ctx context.Context, instanceID, groupID string) ([]string, error)
	ListGroupRoles(ctx context.Context, instanceID string) ([]GroupRole, error)
	RoleIDsThroughGroups(ctx context.Context, instanceID, userID string) ([]string, error)
}

type groupRoleRow struct {
	InstanceID   string `gorm:"primaryKey"`
	GroupID      string `gorm:"primaryKey"`
	AgencyRoleID string `gorm:"primaryKey"`
	CreatedAt    time.Time
}

func (groupRoleRow) TableName() string { return "agency_group_roles" }

func migrateGroupRoles(db *gorm.DB) error {
	return db.AutoMigrate(&groupRoleRow{})
}

func (r *registry) GiveGroupRole(ctx context.Context, instanceID, groupID, agencyRoleID string) error {
	instanceID, groupID, agencyRoleID = strings.TrimSpace(instanceID), strings.TrimSpace(groupID), strings.TrimSpace(agencyRoleID)
	if blank(instanceID, groupID, agencyRoleID) {
		return ErrGroupRoleInvalid
	}
	defer r.tenantChanged(instanceID)
	row := groupRoleRow{InstanceID: instanceID, GroupID: groupID, AgencyRoleID: agencyRoleID, CreatedAt: time.Now().UTC()}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error
}

func (r *registry) TakeGroupRole(ctx context.Context, instanceID, groupID, agencyRoleID string) error {
	if blank(instanceID, groupID, agencyRoleID) {
		return ErrGroupRoleInvalid
	}
	defer r.tenantChanged(instanceID)
	return r.db.WithContext(ctx).
		Where("instance_id = ? AND group_id = ? AND agency_role_id = ?", instanceID, groupID, agencyRoleID).
		Delete(&groupRoleRow{}).Error
}

func (r *registry) GroupRoleIDs(ctx context.Context, instanceID, groupID string) ([]string, error) {
	if blank(instanceID, groupID) {
		return []string{}, nil
	}
	var ids []string
	err := r.db.WithContext(ctx).Model(&groupRoleRow{}).
		Where("instance_id = ? AND group_id = ?", instanceID, groupID).
		Order("agency_role_id").Pluck("agency_role_id", &ids).Error
	if ids == nil {
		ids = []string{}
	}
	return ids, err
}

func (r *registry) ListGroupRoles(ctx context.Context, instanceID string) ([]GroupRole, error) {
	var rows []groupRoleRow
	if err := r.db.WithContext(ctx).Where("instance_id = ?", instanceID).
		Order("group_id, agency_role_id").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]GroupRole, 0, len(rows))
	for _, row := range rows {
		out = append(out, GroupRole{InstanceID: row.InstanceID, GroupID: row.GroupID, AgencyRoleID: row.AgencyRoleID, CreatedAt: row.CreatedAt})
	}
	return out, nil
}

func (r *registry) RoleIDsThroughGroups(ctx context.Context, instanceID, userID string) ([]string, error) {
	groups, err := r.groupsOf(ctx, instanceID, userID)
	if err != nil || len(groups) == 0 {
		return []string{}, err
	}
	var ids []string
	err = r.db.WithContext(ctx).Model(&groupRoleRow{}).
		Where("instance_id = ? AND group_id IN ?", instanceID, groups).
		Distinct().Pluck("agency_role_id", &ids).Error
	if err != nil {
		return nil, err
	}
	slices.Sort(ids)
	if ids == nil {
		ids = []string{}
	}
	return ids, nil
}
