package agencies

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	RoleOwner    = "owner"
	RoleAgent    = "agent"
	RoleResident = "resident"
)

var operatorRoles = []string{RoleOwner, RoleAgent}

var ErrNotAMember = errors.New("agencies: not a member of that instance")

type memberRow struct {
	InstanceID   string `gorm:"primaryKey"`
	UserID       string `gorm:"primaryKey"`
	Role         string
	AgencyRoleID string
	CreatedAt    time.Time
}

func (memberRow) TableName() string { return "agency_instance_members" }

func (r *registry) AddMember(ctx context.Context, instanceID, userID, role string) error {
	defer r.tenantChanged(strings.TrimSpace(instanceID))
	instanceID, userID = strings.TrimSpace(instanceID), strings.TrimSpace(userID)
	if instanceID == "" || userID == "" {
		return errors.New("agencies: a membership needs an instance and a caller")
	}
	if _, err := r.GetInstance(ctx, instanceID); err != nil {
		return err
	}
	if role == "" {
		role = RoleAgent
	}
	row := memberRow{InstanceID: instanceID, UserID: userID, Role: role, CreatedAt: time.Now().UTC()}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "instance_id"}, {Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"role"}),
	}).Create(&row).Error
}

func (r *registry) RemoveMember(ctx context.Context, instanceID, userID string) error {
	defer r.tenantChanged(instanceID)
	return r.db.WithContext(ctx).
		Where("instance_id = ? AND user_id = ?", instanceID, userID).
		Delete(&memberRow{}).Error
}

func (r *registry) IsMember(ctx context.Context, instanceID, userID string) (bool, error) {
	if blank(instanceID, userID) {
		return false, nil
	}
	st, err := r.standingOf(ctx, instanceID, userID)
	if err != nil {
		return false, err
	}
	return st.Member && (st.Role == RoleOwner || st.Role == RoleAgent), nil
}

func (r *registry) RoleOf(ctx context.Context, instanceID, userID string) (string, error) {
	if blank(instanceID, userID) {
		return "", nil
	}
	st, err := r.standingOf(ctx, instanceID, userID)
	if err != nil {
		return "", err
	}
	return st.Role, nil
}

func (r *registry) InstancesFor(ctx context.Context, userID string) ([]Instance, error) {
	memberships, err := r.membershipsWhere(ctx, userID, operatorRoles)
	if err != nil {
		return nil, err
	}
	out := make([]Instance, 0, len(memberships))
	for _, m := range memberships {
		out = append(out, m.Instance)
	}
	return out, nil
}

func (r *registry) MembershipsFor(ctx context.Context, userID string) ([]Membership, error) {
	return r.membershipsWhere(ctx, userID, nil)
}

func (r *registry) membershipsWhere(ctx context.Context, userID string, roles []string) ([]Membership, error) {
	if strings.TrimSpace(userID) == "" {
		return []Membership{}, nil
	}
	q := r.db.WithContext(ctx).Table("agency_instance_members AS m").
		Select(standingColumns).
		Joins("JOIN agency_instances AS i ON i.id = m.instance_id").
		Where("m.user_id = ?", userID)
	if roles != nil {
		q = q.Where("m.role IN ?", roles)
	}
	var rows []standingRow
	if err := q.Order("i.created_at").Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]Membership, 0, len(rows))
	for _, row := range rows {
		out = append(out, Membership{Instance: row.instance(), Role: row.Role})
	}
	return out, nil
}

func (r *registry) Members(ctx context.Context, instanceID string) ([]Member, error) {
	var rows []memberRow
	if err := r.db.WithContext(ctx).
		Where("instance_id = ?", instanceID).Order("created_at").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]Member, 0, len(rows))
	for _, row := range rows {
		out = append(out, Member{InstanceID: row.InstanceID, UserID: row.UserID, Role: row.Role, CreatedAt: row.CreatedAt})
	}
	return out, nil
}

type Member struct {
	InstanceID string    `json:"instance_id"`
	UserID     string    `json:"user_id"`
	Role       string    `json:"role"`
	CreatedAt  time.Time `json:"created_at"`
}

type Membership struct {
	Instance
	Role string `json:"role"`
}

func migrateMembers(db *gorm.DB) error {
	return db.AutoMigrate(&memberRow{}, &joinRequestRow{}, &removalRow{})
}

func (r *registry) SetAgencyRole(ctx context.Context, instanceID, userID, agencyRoleID string) error {
	defer r.tenantChanged(instanceID)
	res := r.db.WithContext(ctx).Model(&memberRow{}).
		Where("instance_id = ? AND user_id = ?", instanceID, userID).
		Update("agency_role_id", agencyRoleID)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrNotAMember
	}
	return nil
}

func (r *registry) AgencyRoleOf(ctx context.Context, instanceID, userID string) (string, error) {
	st, err := r.standingOf(ctx, instanceID, userID)
	if err != nil {
		return "", err
	}
	return st.AgencyRoleID, nil
}
