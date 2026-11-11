package voting

import (
	"fmt"
	"log/slog"

	"gorm.io/gorm"

	"wakalaserver/modules/shared/spec"
)

func keepLatestBallotOfEachResponse(db *gorm.DB, s *spec.Spec) (int64, error) {
	o, ok := s.ByRole(objectBallot)
	if !ok {
		return 0, nil
	}
	table := s.TableFor(o)
	if !db.Migrator().HasTable(table) {
		return 0, nil
	}
	var removed int64
	err := db.Transaction(func(tx *gorm.DB) error {
		if tx.Dialector.Name() == "postgres" {
			if err := tx.Exec("select pg_advisory_xact_lock(hashtext(?))", table).Error; err != nil {
				return err
			}
		}
		stmt := fmt.Sprintf(`delete from %[1]s
where response_id is not null and response_id <> ''
and exists (
	select 1 from %[1]s later
	where later.response_id = %[1]s.response_id
	and (later.cast_at > %[1]s.cast_at or (later.cast_at = %[1]s.cast_at and later.id > %[1]s.id))
)`, table)
		res := tx.Exec(stmt)
		removed = res.RowsAffected
		return res.Error
	})
	if err != nil {
		return 0, fmt.Errorf("voting: keep the latest ballot of each response in %s: %w", table, err)
	}
	if removed > 0 {
		slog.Warn("voting: removed earlier ballots from responses that held more than one", "table", table, "removed", removed)
	}
	return removed, nil
}
