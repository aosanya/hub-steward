package mwanachamacatalog

import (
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/catalog/models"
	"wakalaserver/modules/shared/spec"
)

func PutDefinition(db *gorm.DB, s *spec.Spec, values map[string]any) error {
	if v, named := values[kindsSetting]; named {
		if _, err := models.ParseEntryKinds(v); err != nil {
			return fmt.Errorf("catalog: %s: %w", kindsSetting, err)
		}
	}
	if v, named := values[routingSetting]; named {
		if _, err := models.ParseRouting(v); err != nil {
			return fmt.Errorf("catalog: %s: %w", routingSetting, err)
		}
	}
	return spec.PutDefinitionSettings(db, s, values)
}
