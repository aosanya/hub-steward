package mwanachamaagency

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) scenarioNames(ctx context.Context, tx *gorm.DB, where string, args ...any) ([]string, error) {
	q := tx.WithContext(ctx).Table(m.table(roleScenario)).Where(where, args...)
	scenarios, err := list[models.Scenario](m, q, roleScenario)
	if err != nil {
		return nil, err
	}
	names := make([]string, len(scenarios))
	for i, s := range scenarios {
		names[i] = s.Name
	}
	sort.Strings(names)
	return names, nil
}

func (m *agencyManager) refuseWhileScenariosHold(ctx context.Context, tx *gorm.DB, kind, name, where string, args ...any) error {
	names, err := m.scenarioNames(ctx, tx, where, args...)
	if err != nil {
		return err
	}
	if len(names) == 0 {
		return nil
	}
	return fmt.Errorf("%w: %s %q is still used by %s", ErrUsedByScenario, kind, name, quoteAll(names))
}

func (m *agencyManager) refuseRoleHeldByScenario(ctx context.Context, tx *gorm.DB, r models.Role) error {
	return m.refuseWhileScenariosHold(ctx, tx, "role", r.Name,
		"id IN (select scenario_id from "+m.table(roleScenarioActor)+" where role_id = ?)", r.ID)
}

func (m *agencyManager) refuseWorkflowMirroredByScenario(ctx context.Context, tx *gorm.DB, w models.Workflow) error {
	return m.refuseWhileScenariosHold(ctx, tx, "workflow", w.Name, "workflow_id = ?", w.ID)
}

func quoteAll(names []string) string {
	quoted := make([]string, len(names))
	for i, n := range names {
		quoted[i] = fmt.Sprintf("%q", n)
	}
	return strings.Join(quoted, ", ")
}
