package mwanachamaworkspace

import (
	"gorm.io/gorm"

	"wakalaserver/modules/shared/spec"
	"wakalaserver/modules/shared/specstore"
)

const (
	roleWorkbook  = "workbook"
	roleReference = "reference"
	roleUse       = "use"
	roleShortcut  = "shortcut"
	roleShare     = "share"

	roleLayout       = "layout"
	roleLayoutChange = "layout_change"
	roleLayoutChoice = "layout_choice"
)

type store = specstore.Store

func newStore(db *gorm.DB, s *spec.Spec, carriers map[string]any) (*store, error) {
	return specstore.New(db, s, carriers)
}

func newID() string { return specstore.NewID() }

func columnName(field string) string { return specstore.ColumnName(field) }

func encode(o spec.Object, v any) (map[string]any, error) { return specstore.Encode(o, v) }

func decode(o spec.Object, row map[string]any, out any) error {
	return specstore.Decode(o, row, out)
}
