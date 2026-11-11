package voting

import (
	"gorm.io/gorm"

	"wakalaserver/modules/shared/spec"
)

func Provision(db *gorm.DB, s *spec.Spec) error {
	if err := spec.Migrate(db, s); err != nil {
		return err
	}
	_, err := keepLatestBallotOfEachResponse(db, s)
	return err
}
