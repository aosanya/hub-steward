package mwanachamaratings

import (
	"gorm.io/gorm"

	"wakalaserver/modules/shared/spec"
	"wakalaserver/modules/shared/specstore"
)

const (
	roleRating     = "rating"
	roleSimilarity = "similarity"
	roleSetting    = "setting"
)

type store = specstore.Store

func newStore(db *gorm.DB, s *spec.Spec, carriers map[string]any) (*store, error) {
	return specstore.New(db, s, carriers)
}

func encode(o spec.Object, v any) (map[string]any, error) { return specstore.Encode(o, v) }

const (
	RoleRating     = roleRating
	RoleSimilarity = roleSimilarity
	RoleSetting    = roleSetting
)
