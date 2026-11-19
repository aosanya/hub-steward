package voting

import (
	"gorm.io/gorm"

	"github.com/aosanya/mwanachama-backend-shared/spec"
	"github.com/aosanya/mwanachama-backend-shared/specstore"
)

const (
	objectPoll          = "poll"
	objectChoice        = "choice"
	objectParticipation = "participation"
	objectBallot        = "ballot"
)

type store = specstore.Store

func newStore(db *gorm.DB, s *spec.Spec, carriers map[string]any) (*store, error) {
	return specstore.New(db, s, carriers)
}

func newID() string { return specstore.NewID() }

func columnName(field string) string { return specstore.ColumnName(field) }
