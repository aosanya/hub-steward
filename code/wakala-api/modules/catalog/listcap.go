package mwanachamacatalog

import (
	"gorm.io/gorm"

	"github.com/aosanya/mwanachama-backend-shared/specstore"
)

var cappedRoles = map[string]bool{
	roleSuggestion:        true,
	roleSuggestionComment: true,
	roleSuggestionMatch:   true,
	rolePageView:          true,
	roleShareLink:         true,
}

func capList(q *gorm.DB, role string) *gorm.DB {
	if cappedRoles[role] {
		return q.Limit(specstore.DefaultListCap)
	}
	return q
}
