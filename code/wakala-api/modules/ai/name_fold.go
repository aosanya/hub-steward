package ai

import (
	"gorm.io/gorm"

	"wakalaserver/modules/shared/plaintext"
)

type heldName struct {
	Name string
}

func anyNameFolds(q *gorm.DB, name string) (bool, error) {
	var held []heldName
	if err := q.Select("name").Find(&held).Error; err != nil {
		return false, err
	}
	for _, other := range held {
		if plaintext.SameName(other.Name, name) {
			return true, nil
		}
	}
	return false, nil
}
