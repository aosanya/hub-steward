package agencies

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm/clause"
)

var ErrAlreadyOwner = errors.New("agencies: that caller already owns this instance")

type AgentGrants interface {
	GrantAgentRole(ctx context.Context, instanceID, userID, agencyRoleID string) error
}

func (r *registry) GrantAgentRole(ctx context.Context, instanceID, userID, agencyRoleID string) error {
	instanceID, userID, agencyRoleID = strings.TrimSpace(instanceID), strings.TrimSpace(userID), strings.TrimSpace(agencyRoleID)
	if instanceID == "" || userID == "" || agencyRoleID == "" {
		return errors.New("agencies: a grant needs an instance, a caller and an agency role")
	}
	defer r.tenantChanged(instanceID)
	if _, err := r.GetInstance(ctx, instanceID); err != nil {
		return err
	}
	row := memberRow{InstanceID: instanceID, UserID: userID, Role: RoleAgent, AgencyRoleID: agencyRoleID, CreatedAt: time.Now().UTC()}
	res := r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "instance_id"}, {Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"role", "agency_role_id"}),
		Where:     clause.Where{Exprs: []clause.Expression{clause.Neq{Column: clause.Column{Table: clause.CurrentTable, Name: "role"}, Value: RoleOwner}}},
	}).Create(&row)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrAlreadyOwner
	}
	return nil
}
