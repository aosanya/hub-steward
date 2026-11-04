package mwanachamaagency

import (
	"context"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"wakalaserver/modules/shared/spec"
	"wakalaserver/modules/shared/specstore"

	"wakalaserver/modules/agency/models"
)

func Provision(db *gorm.DB, s *spec.Spec) error {
	ready, err := upToDate(db, s)
	if err != nil {
		return err
	}
	if !ready {
		if err := collapseDuplicateObjectiveLinks(db, s); err != nil {
			return err
		}
		if err := spec.Migrate(db, s); err != nil {
			return err
		}
		if err := seed(db, s); err != nil {
			return err
		}
	}
	return carryObjectiveLinksForward(db, s)
}

func collapseDuplicateObjectiveLinks(db *gorm.DB, s *spec.Spec) error {
	table := tableFor(s, roleWorkflowObjective)
	held, err := tablesNamed(db, []string{table})
	if err != nil {
		return err
	}
	if !held[table] {
		return nil
	}
	err = db.Exec(`delete from ` + table + ` where id in (
		select id from (
			select id, row_number() over (
				partition by workflow_id, objective_id order by deleted, created_at, id) as position
			from ` + table + `) ranked
		where position > 1)`).Error
	if err != nil {
		return fmt.Errorf("agency: collapse duplicate workflow objective links: %w", err)
	}
	return nil
}

func carryObjectiveLinksForward(db *gorm.DB, s *spec.Spec) error {
	items := tableFor(s, roleWorkItem)
	older, err := hasColumn(db, items, retiredObjectiveColumn)
	if err != nil {
		return err
	}
	if !older {
		return nil
	}
	links := tableFor(s, roleWorkflowObjective)
	var pairs []struct {
		DraftID     string
		WorkflowID  string
		ObjectiveID string
	}
	err = db.Raw(`select distinct wi.draft_id, wi.workflow_id, wi.objective_id
		from ` + items + ` wi
		join ` + tableFor(s, roleWorkflow) + ` w on w.id = wi.workflow_id and w.draft_id = wi.draft_id
		join ` + tableFor(s, roleObjective) + ` o on o.id = wi.objective_id and o.draft_id = wi.draft_id
		where wi.objective_id <> '' and coalesce(wi.deleted, false) = false
			and not exists (select 1 from ` + links + ` l
				where l.workflow_id = wi.workflow_id and l.objective_id = wi.objective_id)
		order by wi.draft_id, wi.workflow_id, wi.objective_id`).Scan(&pairs).Error
	if err != nil {
		return fmt.Errorf("agency: read the older step objectives: %w", err)
	}
	object := mustObject(s, roleWorkflowObjective)
	return db.Transaction(func(tx *gorm.DB) error {
		for _, p := range pairs {
			now := models.NowRFC3339()
			row, err := specstore.Encode(object, models.WorkflowObjective{
				ID:          specstore.NewID(),
				DraftID:     p.DraftID,
				WorkflowID:  p.WorkflowID,
				ObjectiveID: p.ObjectiveID,
				CreatedAt:   now,
				LastUpdated: now,
			})
			if err != nil {
				return fmt.Errorf("agency: carry the step objectives forward: %w", err)
			}
			if err := tx.Table(links).Clauses(clause.OnConflict{DoNothing: true}).Create(row).Error; err != nil {
				return fmt.Errorf("agency: carry the step objectives forward: %w", err)
			}
		}
		return nil
	})
}

func upToDate(db *gorm.DB, s *spec.Spec) (bool, error) {
	declared := make([]string, 0, len(s.Objects))
	for _, o := range s.Objects {
		declared = append(declared, s.TableFor(o))
	}

	held, err := tablesNamed(db, declared)
	if err != nil {
		return false, err
	}
	for _, name := range declared {
		if !held[name] {
			return false, nil
		}
	}

	columned, err := columnsHeld(db, s)
	if err != nil {
		return false, err
	}
	if !columned {
		return false, nil
	}

	indexed, err := indexesHeld(db, s, roleWorkflowObjective)
	if err != nil {
		return false, err
	}
	if !indexed {
		return false, nil
	}

	var drafts int64
	if err := db.Table(tableFor(s, roleDraft)).Count(&drafts).Error; err != nil {
		return false, fmt.Errorf("agency: read the drafts: %w", err)
	}
	if drafts == 0 {
		return false, nil
	}

	var codes int64
	if err := db.Table(tableFor(s, roleModule)).
		Distinct("code").Count(&codes).Error; err != nil {
		return false, fmt.Errorf("agency: read the module catalog: %w", err)
	}
	return int(codes) >= len(models.ModuleCatalog), nil
}

const postgresIdentifierLimit = 63

type heldColumn struct {
	TableName  string
	ColumnName string
}

func columnsHeld(db *gorm.DB, s *spec.Spec) (bool, error) {
	tables := make([]string, 0, len(s.Objects))
	for _, o := range s.Objects {
		tables = append(tables, s.TableFor(o))
	}
	query := `select table_name, column_name from information_schema.columns
		where table_schema = current_schema() and table_name in ?`
	if db.Dialector.Name() != "postgres" {
		query = `select m.name as table_name, p.name as column_name
			from sqlite_master m, pragma_table_info(m.name) p
			where m.type = 'table' and m.name in ?`
	}
	var found []heldColumn
	if err := db.Raw(query, tables).Scan(&found).Error; err != nil {
		return false, fmt.Errorf("agency: read the column set: %w", err)
	}
	held := make(map[string]bool, len(found))
	for _, c := range found {
		held[c.TableName+"."+c.ColumnName] = true
	}
	for _, o := range s.Objects {
		for _, f := range o.Fields {
			if !held[s.TableFor(o)+"."+f.Name] {
				return false, nil
			}
		}
	}
	return true, nil
}

func indexesHeld(db *gorm.DB, s *spec.Spec, role string) (bool, error) {
	o := mustObject(s, role)
	query := `select indexname from pg_indexes where schemaname = current_schema() and indexname in ?`
	postgres := db.Dialector.Name() == "postgres"
	if !postgres {
		query = `select name from sqlite_master where type = 'index' and name in ?`
	}
	names := make([]string, 0, len(o.Indexes))
	for _, idx := range o.Indexes {
		name := s.IndexFor(o, idx)
		if postgres && len(name) > postgresIdentifierLimit {
			name = name[:postgresIdentifierLimit]
		}
		names = append(names, name)
	}
	var found []string
	if err := db.Raw(query, names).Scan(&found).Error; err != nil {
		return false, fmt.Errorf("agency: read the index set: %w", err)
	}
	held := make(map[string]bool, len(found))
	for _, name := range found {
		held[name] = true
	}
	for _, name := range names {
		if !held[name] {
			return false, nil
		}
	}
	return true, nil
}

func tablesNamed(db *gorm.DB, names []string) (map[string]bool, error) {
	query := `select table_name from information_schema.tables
		where table_schema = current_schema() and table_name in ?`
	if db.Dialector.Name() != "postgres" {
		query = `select name from sqlite_master where type = 'table' and name in ?`
	}
	var found []string
	if err := db.Raw(query, names).Scan(&found).Error; err != nil {
		return nil, fmt.Errorf("agency: read the table set: %w", err)
	}
	held := make(map[string]bool, len(found))
	for _, name := range found {
		held[name] = true
	}
	return held, nil
}

func seed(db *gorm.DB, s *spec.Spec) error {
	draftID, err := ensureWorkingDraft(db, s)
	if err != nil {
		return err
	}
	if draftID != "" {
		if err := adoptUnscopedRows(db, s, draftID); err != nil {
			return err
		}
	}
	if err := backfillCodes(db, s); err != nil {
		return err
	}
	if draftID != "" {
		if err := backfillModules(db, s, draftID); err != nil {
			return err
		}
	}
	return raiseSequencesPastExistingCodes(db, s)
}

func tableFor(s *spec.Spec, role string) string {
	o, ok := s.ByRole(role)
	if !ok {
		return ""
	}
	return s.TableFor(o)
}

func ensureWorkingDraft(db *gorm.DB, s *spec.Spec) (string, error) {
	drafts := tableFor(s, roleDraft)

	var open []map[string]any
	if err := db.Table(drafts).Where("status = ?", string(models.DraftStatusOpen)).
		Order("created_at").Limit(1).Find(&open).Error; err != nil {
		return "", fmt.Errorf("agency: read the working draft: %w", err)
	}
	if len(open) == 1 {
		id, _ := open[0]["id"].(string)
		return id, nil
	}

	var held int64
	if err := db.Table(drafts).Count(&held).Error; err != nil {
		return "", fmt.Errorf("agency: read the drafts: %w", err)
	}
	if held > 0 {
		return "", nil
	}

	now := models.NowRFC3339()
	row, err := specstore.Encode(mustObject(s, roleDraft), models.Draft{
		ID:          specstore.NewID(),
		Description: "Initial draft",
		Status:      models.DraftStatusOpen,
		CreatedAt:   now,
		LastUpdated: now,
	})
	if err != nil {
		return "", fmt.Errorf("agency: seed the working draft: %w", err)
	}
	if err := db.Table(drafts).Create(row).Error; err != nil {
		return "", fmt.Errorf("agency: seed the working draft: %w", err)
	}
	return row["id"].(string), nil
}

func adoptUnscopedRows(db *gorm.DB, s *spec.Spec, draftID string) error {
	for _, role := range draftScopedRoles {
		table := tableFor(s, role)
		if table == "" {
			continue
		}
		if err := db.Table(table).Where("draft_id IS NULL OR draft_id = ?", "").
			Updates(map[string]any{"draft_id": draftID}).Error; err != nil {
			return fmt.Errorf("agency: adopt unscoped rows in %s: %w", table, err)
		}
	}
	return nil
}

func backfillCodes(db *gorm.DB, s *spec.Spec) error {
	sequences := tableFor(s, roleCodeSequence)
	for _, c := range codedRoles {
		table := tableFor(s, c.role)
		err := db.Transaction(func(tx *gorm.DB) error {
			var ids []string
			if err := tx.Table(table).Where("code = '' OR code IS NULL").
				Order("created_at").Pluck("id", &ids).Error; err != nil {
				return err
			}
			for _, id := range ids {
				code, err := nextCode(context.Background(), tx, sequences, c.entityType, c.prefix)
				if err != nil {
					return err
				}
				if err := tx.Table(table).Where("id = ?", id).Update("code", code).Error; err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			return fmt.Errorf("agency: backfill codes in %s: %w", table, err)
		}
	}
	return nil
}

// raiseSequencesPastExistingCodes moves each counter past every code the
// tables already hold. A counter behind its own table mints a code that
// exists — which is what an import does, since an imported row keeps the
// code it was exported with, and what a database restored from elsewhere
// would do too.
func raiseSequencesPastExistingCodes(db *gorm.DB, s *spec.Spec) error {
	sequences := tableFor(s, roleCodeSequence)
	for _, c := range codedRoles {
		var codes []string
		if err := db.Table(tableFor(s, c.role)).Pluck("code", &codes).Error; err != nil {
			return fmt.Errorf("agency: read codes in %s: %w", tableFor(s, c.role), err)
		}
		highest := 0
		for _, code := range codes {
			if n := numberIn(code, c.prefix); n > highest {
				highest = n
			}
		}
		if highest == 0 {
			continue
		}
		if err := raiseSequence(context.Background(), db, sequences, c.entityType, highest+1); err != nil {
			return err
		}
	}
	return nil
}

func backfillModules(db *gorm.DB, s *spec.Spec, draftID string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		return seedModuleCatalog(tx, s, draftID)
	})
}

func seedModuleCatalog(tx *gorm.DB, s *spec.Spec, draftID string) error {
	table := tableFor(s, roleModule)
	object := mustObject(s, roleModule)
	for _, entry := range models.ModuleCatalog {
		var count int64
		if err := tx.Table(table).Where("code = ? AND draft_id = ?", entry.Code, draftID).
			Count(&count).Error; err != nil {
			return fmt.Errorf("agency: seed the module catalog: %w", err)
		}
		if count > 0 {
			continue
		}
		now := models.NowRFC3339()
		row, err := specstore.Encode(object, models.Module{
			ID:          specstore.NewID(),
			Code:        entry.Code,
			DraftID:     draftID,
			Name:        entry.Name,
			Description: entry.Description,
			Enabled:     entry.Enabled,
			Locked:      entry.Locked,
			Icon:        entry.Icon,
			CreatedAt:   now,
			LastUpdated: now,
		})
		if err != nil {
			return fmt.Errorf("agency: seed the module catalog: %w", err)
		}
		if err := tx.Table(table).Create(row).Error; err != nil {
			return fmt.Errorf("agency: seed the module catalog: %w", err)
		}
	}
	return nil
}

func mustObject(s *spec.Spec, role string) spec.Object {
	o, ok := s.ByRole(role)
	if !ok {
		panic("agency: the spec fills no object for the role " + role)
	}
	return o
}

var draftScopedRoles = []string{
	roleGoal, roleObjective, roleWorkflow, roleWorkItem, roleEventFlowStep,
	roleRole, roleRoleAssignment, roleWorkflowObjective, roleModule,
	roleValue, roleRule, roleControl, roleControlAttachment, roleIssue, roleRecord, roleMeasure, roleRisk, roleRiskPathway,
}

var codedRoles = []struct {
	role       string
	entityType string
	prefix     string
}{
	{roleGoal, "goal", "G"},
	{roleObjective, "objective", "O"},
	{roleRole, "role", "R"},
	{roleWorkflow, "workflow", "W"},
	{roleWorkItem, "workitem", "WI"},
	{roleValue, "value", "V"},
	{roleRule, "rule", "RU"},
	{roleControl, "control", "C"},
	{roleRecord, "record", "RC"},
	{roleRisk, "risk", "RK"},
	{roleRiskPathway, "risk_pathway", "RP"},
	{roleHazard, "hazard", "H"},
	{roleThreat, "threat", "T"},
	{roleConsequence, "consequence", "Q"},
}

const retiredPublicationColumn = "status"

const retiredObjectiveColumn = "objective_id"

const timestampColumn = "last_updated"

func hasColumn(db *gorm.DB, table, column string) (bool, error) {
	var found []int
	q := `select 1 from pragma_table_info(?) where name = ?`
	if db.Dialector.Name() == "postgres" {
		q = `select 1 from information_schema.columns where table_name = ? and column_name = ?`
	}
	if err := db.Raw(q, table, column).Scan(&found).Error; err != nil {
		return false, fmt.Errorf("agency: read columns of %s: %w", table, err)
	}
	return len(found) > 0, nil
}

func declaresColumn(o spec.Object, column string) bool {
	for _, f := range o.Fields {
		if f.Name == column {
			return true
		}
	}
	return false
}
