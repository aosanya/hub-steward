package mwanachamaassetmanager

import (
	"gorm.io/gorm"

	"wakalaserver/modules/shared/spec"
)

func Provision(db *gorm.DB, s *spec.Spec) error {
	return spec.Migrate(db, s)
}
