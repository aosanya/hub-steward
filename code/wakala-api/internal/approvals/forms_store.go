package approvals

import "gorm.io/gorm"

type FormsStore struct{}

func (FormsStore) TableFor(slug string) string { return TableFor(slug) }

func (FormsStore) Open(db *gorm.DB, slug string) error {
	_, err := Open(db, slug)
	return err
}
