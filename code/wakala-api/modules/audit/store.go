package mwanachamaaudit

import (
	"gorm.io/gorm"

	"wakalaserver/modules/shared/spec"
	"wakalaserver/modules/shared/specstore"
)

const roleEntry = "entry"

type store = specstore.Store

func newStore(db *gorm.DB, s *spec.Spec, carriers map[string]any) (*store, error) {
	return specstore.New(db, s, carriers)
}

func newID() string { return specstore.NewID() }

func columnName(field string) string { return specstore.ColumnName(field) }
