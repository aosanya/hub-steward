package mwanachamapermissions

import (
	"fmt"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/shared/spec"
)

const partitionColumn = "partition"

func addPartition(db *gorm.DB, s *spec.Spec) error {
	o, ok := s.ByRole(roleGrant)
	if !ok {
		return nil
	}
	table := s.TableFor(o)
	if db.Migrator().HasColumn(table, partitionColumn) {
		return nil
	}
	err := db.Exec(fmt.Sprintf("alter table %s add column %s text not null default ''", table, partitionColumn)).Error
	if err != nil {
		return fmt.Errorf("permissions: add partition: %w", err)
	}
	if db.Dialector.Name() != "postgres" {
		return nil
	}
	return rekeyGrants(db, table, o)
}

func rekeyGrants(db *gorm.DB, table string, o spec.Object) error {
	var constraint string
	err := db.Raw("select conname from pg_constraint where conrelid = ?::regclass and contype = 'p'", table).
		Scan(&constraint).Error
	if err != nil {
		return fmt.Errorf("permissions: read grant key: %w", err)
	}
	var primaries []string
	for _, f := range o.Fields {
		if f.Primary {
			primaries = append(primaries, f.Name)
		}
	}
	stmt := fmt.Sprintf("alter table %s add primary key (%s)", table, strings.Join(primaries, ", "))
	if constraint != "" {
		stmt = fmt.Sprintf("alter table %s drop constraint %s, add primary key (%s)", table, constraint, strings.Join(primaries, ", "))
	}
	if err := db.Exec(stmt).Error; err != nil {
		return fmt.Errorf("permissions: rekey grants: %w", err)
	}
	return nil
}

const endsAtColumn = "ends_at"

func addEndsAt(db *gorm.DB, s *spec.Spec) error {
	o, ok := s.ByRole(roleGrant)
	if !ok {
		return nil
	}
	table := s.TableFor(o)
	if db.Migrator().HasColumn(table, endsAtColumn) {
		return nil
	}
	err := db.Exec(fmt.Sprintf("alter table %s add column %s text not null default ''", table, endsAtColumn)).Error
	if err != nil {
		return fmt.Errorf("permissions: add ends_at: %w", err)
	}
	return nil
}
