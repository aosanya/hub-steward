package mwanachamacouncil

import (
	"fmt"

	"gorm.io/gorm"

	"github.com/aosanya/mwanachama-backend-shared/spec"
)

const Module = "council"

func Provision(db *gorm.DB, s *spec.Spec) error {
	if s == nil {
		return fmt.Errorf("provision: no spec")
	}
	if s.Module != Module {
		return fmt.Errorf("provision: the spec declares module %q, and this is %s", s.Module, Module)
	}
	if err := spec.Migrate(db, s); err != nil {
		return fmt.Errorf("provision %s/%s: %w", s.Domain, s.Instance, err)
	}
	return nil
}
