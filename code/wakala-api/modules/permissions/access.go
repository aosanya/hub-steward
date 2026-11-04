package mwanachamapermissions

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type AccessLine struct {
	Action    string `json:"action"`
	RoleCode  string `json:"role_code"`
	RoleName  string `json:"role_name"`
	Scope     string `json:"scope"`
	Partition string `json:"partition,omitempty"`
	GrantedBy string `json:"granted_by,omitempty"`
	GrantedAt string `json:"granted_at"`
	EndsAt    string `json:"ends_at,omitempty"`
}

func (m *manager) AccessOf(ctx context.Context, subject, partition string) ([]AccessLine, error) {
	if partition == "" || !isPartition(partition) {
		return nil, ErrInvalidPartition
	}
	if subject == "" {
		return []AccessLine{}, nil
	}

	lines := []AccessLine{}
	err := m.accessQuery(ctx).
		Where("g."+columnName("Subject")+" = ?", subject).
		Where("g."+columnName("Partition")+" in (?, ?)", partition, "").
		Where("g."+columnName("Deleted")+" = false").
		Where(stillRunning("g."), "", endInstant(time.Now())).
		Where("r." + columnName("Deleted") + " = false").
		Order(accessOrder()).
		Scan(&lines).Error
	if err != nil {
		return nil, fmt.Errorf("permissions: access of: %w", err)
	}
	if lines == nil {
		lines = []AccessLine{}
	}
	return lines, nil
}

func (m *manager) accessQuery(ctx context.Context) *gorm.DB {
	grants := m.table(roleGrant)
	actions := m.table(roleRoleAction)
	roles := m.table(roleRole)

	return m.db.WithContext(ctx).
		Table(grants + " g").
		Joins(fmt.Sprintf("join %s ra on ra.%s = g.%s", actions,
			columnName("RoleCode"), columnName("RoleCode"))).
		Joins(fmt.Sprintf("join %s r on r.%s = g.%s", roles,
			columnName("Code"), columnName("RoleCode"))).
		Select(accessColumns())
}

func accessColumns() string {
	return fmt.Sprintf(
		"ra.%s as action, g.%s as role_code, r.%s as role_name, g.%s as scope, "+
			"g.%s as partition, coalesce(g.%s, '') as granted_by, g.%s as granted_at, coalesce(g.%s, '') as ends_at",
		columnName("Action"), columnName("RoleCode"), columnName("Name"), columnName("Scope"),
		columnName("Partition"), columnName("GrantedBy"), columnName("GrantedAt"), columnName("EndsAt"))
}

func accessOrder() string {
	return fmt.Sprintf("ra.%s, g.%s, g.%s, g.%s",
		columnName("Action"), columnName("RoleCode"), columnName("Scope"), columnName("Partition"))
}
