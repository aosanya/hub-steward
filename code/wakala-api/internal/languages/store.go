package languages

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type agencyRow struct {
	InstanceID     string `gorm:"primaryKey"`
	StudioDefault  string
	Content        string
	ContentDefault string
	UpdatedAt      time.Time
}

func (agencyRow) TableName() string { return "agency_languages" }

type personRow struct {
	AccountID string `gorm:"primaryKey"`
	Language  string
	UpdatedAt time.Time
}

func (personRow) TableName() string { return "operator_studio_languages" }

type Store struct{ db *gorm.DB }

func NewStore(db *gorm.DB) (*Store, error) {
	if err := db.AutoMigrate(&agencyRow{}, &personRow{}); err != nil {
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Agency(ctx context.Context, instanceID string) (Agency, error) {
	var row agencyRow
	err := s.db.WithContext(ctx).Where("instance_id = ?", instanceID).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return DefaultAgency(), nil
	}
	if err != nil {
		return Agency{}, err
	}
	return Agency{StudioDefault: row.StudioDefault, Content: strings.Split(row.Content, ","), ContentDefault: row.ContentDefault}, nil
}

func (s *Store) PutAgency(ctx context.Context, instanceID string, a Agency) (Agency, error) {
	if strings.TrimSpace(instanceID) == "" {
		return Agency{}, ErrNoInstance
	}
	a, err := Validate(a)
	if err != nil {
		return Agency{}, err
	}
	row := agencyRow{InstanceID: instanceID, StudioDefault: a.StudioDefault, Content: strings.Join(a.Content, ","), ContentDefault: a.ContentDefault, UpdatedAt: time.Now().UTC()}
	err = s.db.WithContext(ctx).Clauses(clause.OnConflict{UpdateAll: true}).Create(&row).Error
	return a, err
}

func (s *Store) Person(ctx context.Context, accountID string) (string, error) {
	var row personRow
	err := s.db.WithContext(ctx).Where("account_id = ?", accountID).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", nil
	}
	return row.Language, err
}

func (s *Store) PutPerson(ctx context.Context, accountID, code string) (string, error) {
	if strings.TrimSpace(accountID) == "" {
		return "", ErrNoPerson
	}
	if strings.TrimSpace(code) == "" {
		err := s.db.WithContext(ctx).Where("account_id = ?", accountID).Delete(&personRow{}).Error
		return "", err
	}
	n, err := Normalize(code)
	if err != nil {
		return "", err
	}
	row := personRow{AccountID: accountID, Language: n, UpdatedAt: time.Now().UTC()}
	err = s.db.WithContext(ctx).Clauses(clause.OnConflict{UpdateAll: true}).Create(&row).Error
	return n, err
}
