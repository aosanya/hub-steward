package mwanachamaagency

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

type plannedActor struct {
	existing   *models.ScenarioActor
	name       string
	roleID     string
	ordinality int
}

type scenarioSet struct {
	setActors  bool
	actors     []plannedActor
	dropActors []string
	setInputs  bool
	inputs     []models.ScenarioInput
	dropInputs []string
}

func inputKey(stepID, field string) string {
	return stepID + "\x00" + field
}

func (m *agencyManager) planScenarioSet(ctx context.Context, tx *gorm.DB, s models.Scenario, request models.Scenario) (scenarioSet, error) {
	var set scenarioSet
	if request.Actors != nil {
		set.setActors = true
		if err := m.planActors(ctx, tx, s, request.Actors, &set); err != nil {
			return scenarioSet{}, err
		}
	}
	if request.Inputs != nil {
		set.setInputs = true
		if err := m.planInputs(ctx, tx, s, request.Inputs, &set); err != nil {
			return scenarioSet{}, err
		}
	}
	return set, nil
}

func (m *agencyManager) planActors(ctx context.Context, tx *gorm.DB, s models.Scenario, requested []models.ScenarioActor, set *scenarioSet) error {
	stored, err := m.storedActors(ctx, tx, s.ID)
	if err != nil {
		return err
	}
	built, err := m.builtInActors(ctx, tx, s.DraftID, s.ID)
	if err != nil {
		return err
	}
	byID := make(map[string]*models.ScenarioActor, len(stored))
	for i := range stored {
		byID[stored[i].ID] = &stored[i]
	}

	var entries []models.ScenarioActor
	for _, a := range requested {
		if !a.BuiltIn {
			entries = append(entries, a)
		}
	}
	claimed := make(map[string]bool, len(entries))
	matches := make([]*models.ScenarioActor, len(entries))
	for i, e := range entries {
		if e.ID == "" {
			continue
		}
		held, ok := byID[e.ID]
		if !ok {
			return fmt.Errorf("%w: %q is not an actor of this scenario", ErrScenarioActorNotFound, e.ID)
		}
		if claimed[e.ID] {
			return invalidScenario("actor %q is named twice in one update", e.ID)
		}
		claimed[e.ID] = true
		matches[i] = held
	}
	for i, e := range entries {
		if e.ID != "" {
			continue
		}
		for j := range stored {
			if !claimed[stored[j].ID] && sameName(stored[j].Name, e.Name) {
				claimed[stored[j].ID] = true
				matches[i] = &stored[j]
				break
			}
		}
	}

	roles := map[string]models.Role{}
	names := make([]string, 0, len(entries)+len(built))
	for _, b := range built {
		names = append(names, b.Name)
	}
	for i, e := range entries {
		name := strings.TrimSpace(e.Name)
		if name == "" {
			return invalidScenario("an actor needs a name")
		}
		if e.Kind != "" && e.Kind != models.ActorKindRole {
			return invalidScenario("the agents and the System are built in; an actor you add holds a role")
		}
		roleID := e.RoleID
		if roleID == "" && matches[i] != nil {
			roleID = matches[i].RoleID
		}
		if roleID == "" {
			return invalidScenario("an actor holds an agency role")
		}
		if _, ok := roles[roleID]; !ok {
			var r models.Role
			rq := scopeQuery(tx.WithContext(ctx).Table(m.table(roleRole)), s.DraftID).Where("id = ?", roleID)
			if err := m.take(rq, roleRole, &r, ErrRoleNotFound); err != nil {
				return err
			}
			roles[roleID] = r
		}
		for _, other := range names {
			if sameName(other, name) {
				return fmt.Errorf("%w: %q is already an actor of this scenario", ErrDuplicateScenarioActor, name)
			}
		}
		names = append(names, name)
		set.actors = append(set.actors, plannedActor{existing: matches[i], name: name, roleID: roleID, ordinality: i + 1})
	}
	for _, a := range stored {
		if !claimed[a.ID] {
			set.dropActors = append(set.dropActors, a.ID)
		}
	}
	return nil
}

func (m *agencyManager) planInputs(ctx context.Context, tx *gorm.DB, s models.Scenario, requested []models.ScenarioInput, set *scenarioSet) error {
	stored, err := m.storedInputs(ctx, tx, s.ID)
	if err != nil {
		return err
	}
	asked := make(map[string]bool, len(requested))
	for _, in := range requested {
		if err := m.checkInput(ctx, tx, s, in); err != nil {
			return err
		}
		key := inputKey(in.StepID, in.Field)
		if asked[key] {
			return invalidScenario("field %q of step %s is fixed twice in one update", in.Field, in.StepID)
		}
		asked[key] = true
		set.inputs = append(set.inputs, in)
	}
	for _, in := range stored {
		if !asked[inputKey(in.StepID, in.Field)] {
			set.dropInputs = append(set.dropInputs, in.ID)
		}
	}
	return nil
}

func (m *agencyManager) applyScenarioSet(ctx context.Context, tx *gorm.DB, s models.Scenario, set scenarioSet) error {
	if set.setActors {
		for _, id := range set.dropActors {
			if err := m.deleteWhere(ctx, tx, roleScenarioActor, "id = ?", id); err != nil {
				return err
			}
		}
		now := models.NowRFC3339()
		for _, p := range set.actors {
			if p.existing == nil {
				row := models.ScenarioActor{
					ID: newID(), ScenarioID: s.ID, DraftID: s.DraftID, Name: p.name,
					Kind: models.ActorKindRole, RoleID: p.roleID, Ordinality: p.ordinality, CreatedAt: now, LastUpdated: now,
				}
				if err := m.insertRow(ctx, tx, roleScenarioActor, row); err != nil {
					return err
				}
				continue
			}
			row := *p.existing
			if row.Name == p.name && row.RoleID == p.roleID && row.Ordinality == p.ordinality {
				continue
			}
			row.Name, row.RoleID, row.Ordinality, row.LastUpdated = p.name, p.roleID, p.ordinality, now
			if err := m.writeUpdate(ctx, tx, roleScenarioActor, row.ID, row, ErrScenarioActorNotFound); err != nil {
				return err
			}
		}
	}
	if set.setInputs {
		for _, id := range set.dropInputs {
			if err := m.deleteWhere(ctx, tx, roleScenarioInput, "id = ?", id); err != nil {
				return err
			}
		}
		for _, in := range set.inputs {
			if _, err := m.writeInput(ctx, tx, s, in); err != nil {
				return err
			}
		}
	}
	return nil
}
