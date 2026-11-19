package mwanachamainsights

import (
	"gorm.io/gorm"

	"github.com/aosanya/mwanachama-backend-shared/spec"
)

var legacy = spec.Legacy{
	Columns: map[string]string{
		"agency_id": "subject_id",
		"draft_id":  "context_id",
	},
	IndexPrefixes: []string{"idx_"},
}

func Provision(db *gorm.DB, s *spec.Spec) error {
	ready, err := spec.Adopted(db, s)
	if err != nil {
		return err
	}
	if ready {
		return nil
	}
	if err := spec.AdoptLegacy(db, s, legacy); err != nil {
		return err
	}
	return spec.Migrate(db, s)
}
