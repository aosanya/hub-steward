package mwanachamapermissions

import (
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/shared/spec"
)

const (
	formerPermissionTable  = "powers"
	formerPermissionColumn = "power"
	permissionColumn       = "permission"
)

func renamePowerToPermission(db *gorm.DB, s *spec.Spec) error {
	o, ok := s.ByRole(rolePermission)
	if !ok {
		return nil
	}
	if err := renameFormerTable(db, s, o); err != nil {
		return err
	}
	return renameFormerColumn(db, s.TableFor(o))
}

func renameFormerTable(db *gorm.DB, s *spec.Spec, o spec.Object) error {
	former := o
	former.Table = formerPermissionTable
	from, to := s.TableFor(former), s.TableFor(o)
	if from == to || !db.Migrator().HasTable(from) || db.Migrator().HasTable(to) {
		return nil
	}
	if err := db.Exec(fmt.Sprintf("alter table %s rename to %s", from, to)).Error; err != nil {
		return fmt.Errorf("permissions: rename %s: %w", from, err)
	}
	return nil
}

func renameFormerColumn(db *gorm.DB, table string) error {
	if !db.Migrator().HasTable(table) ||
		!db.Migrator().HasColumn(table, formerPermissionColumn) ||
		db.Migrator().HasColumn(table, permissionColumn) {
		return nil
	}
	stmt := fmt.Sprintf("alter table %s rename column %s to %s", table, formerPermissionColumn, permissionColumn)
	if err := db.Exec(stmt).Error; err != nil {
		return fmt.Errorf("permissions: rename %s.%s: %w", table, formerPermissionColumn, err)
	}
	return nil
}
