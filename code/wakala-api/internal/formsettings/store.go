package formsettings

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Approval struct {
	ApprovalRequired bool `json:"approval_required"`
}

type approvalRow struct {
	InstanceID       string `gorm:"primaryKey"`
	ApprovalRequired bool
	UpdatedAt        time.Time
}

func (approvalRow) TableName() string { return "agency_forms_approval" }

var ErrNoInstance = errors.New("formsettings: an instance is required")

type Store struct{ db *gorm.DB }

func NewStore(db *gorm.DB) (*Store, error) {
	if err := db.AutoMigrate(&approvalRow{}); err != nil {
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Approval(ctx context.Context, instanceID string) (Approval, error) {
	var rows []approvalRow
	if err := s.db.WithContext(ctx).Where("instance_id = ?", instanceID).Limit(1).Find(&rows).Error; err != nil {
		return Approval{}, err
	}
	if len(rows) == 0 {
		return Approval{}, nil
	}
	return Approval{ApprovalRequired: rows[0].ApprovalRequired}, nil
}

func (s *Store) PutApproval(ctx context.Context, instanceID string, a Approval) (Approval, error) {
	if instanceID == "" {
		return Approval{}, ErrNoInstance
	}
	row := approvalRow{InstanceID: instanceID, ApprovalRequired: a.ApprovalRequired, UpdatedAt: time.Now().UTC()}
	err := s.db.WithContext(ctx).Clauses(clause.OnConflict{UpdateAll: true}).Create(&row).Error
	return a, err
}

func (s *Store) Required(ctx context.Context, instanceID string) (bool, error) {
	a, err := s.Approval(ctx, instanceID)
	return a.ApprovalRequired, err
}
