package notifyrules

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrNoInstance = errors.New("a notification rule needs an instance")

type ruleRow struct {
	InstanceID string `gorm:"primaryKey"`
	Event      string `gorm:"primaryKey"`
	Told       string
	Fallback   string
	Mutable    bool
	UpdatedAt  time.Time
}

func (ruleRow) TableName() string { return "agency_notification_rules" }

type Store struct{ db *gorm.DB }

func NewStore(db *gorm.DB) (*Store, error) {
	if err := db.AutoMigrate(&ruleRow{}); err != nil {
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Stored(ctx context.Context, instanceID string) (map[Event]Rule, error) {
	var rows []ruleRow
	if err := s.db.WithContext(ctx).Where("instance_id = ?", instanceID).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make(map[Event]Rule, len(rows))
	for _, row := range rows {
		r, err := row.rule()
		if err != nil {
			return nil, err
		}
		out[r.Event] = r
	}
	return out, nil
}

func (s *Store) All(ctx context.Context, instanceID string) ([]Rule, error) {
	stored, err := s.Stored(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	out := make([]Rule, 0, len(Events))
	for _, e := range Events {
		r, err := Effective(stored, e)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, nil
}

func (s *Store) Rule(ctx context.Context, instanceID string, e Event) (Rule, error) {
	stored, err := s.Stored(ctx, instanceID)
	if err != nil {
		return Rule{}, err
	}
	return Effective(stored, e)
}

func (s *Store) Put(ctx context.Context, instanceID string, r Rule) (Rule, error) {
	if strings.TrimSpace(instanceID) == "" {
		return Rule{}, ErrNoInstance
	}
	r, err := Validate(r)
	if err != nil {
		return Rule{}, err
	}
	told, _ := json.Marshal(nonNil(r.Told))
	fallback, _ := json.Marshal(nonNil(r.Fallback))
	row := ruleRow{InstanceID: instanceID, Event: string(r.Event), Told: string(told), Fallback: string(fallback), Mutable: r.Mutable, UpdatedAt: time.Now().UTC()}
	err = s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "instance_id"}, {Name: "event"}},
		DoUpdates: clause.AssignmentColumns([]string{"told", "fallback", "mutable", "updated_at"}),
	}).Create(&row).Error
	if err != nil {
		return Rule{}, err
	}
	return row.rule()
}

func (s *Store) Reset(ctx context.Context, instanceID string, e Event) (Rule, error) {
	if _, err := Default(e); err != nil {
		return Rule{}, err
	}
	if err := s.db.WithContext(ctx).Where("instance_id = ? AND event = ?", instanceID, string(e)).Delete(&ruleRow{}).Error; err != nil {
		return Rule{}, err
	}
	return Default(e)
}

func (row ruleRow) rule() (Rule, error) {
	base, err := Default(Event(row.Event))
	if err != nil {
		return Rule{}, err
	}
	r := Rule{Event: base.Event, Mutable: row.Mutable, FixedMute: base.FixedMute}
	if err := json.Unmarshal([]byte(row.Told), &r.Told); err != nil {
		return Rule{}, err
	}
	if err := json.Unmarshal([]byte(row.Fallback), &r.Fallback); err != nil {
		return Rule{}, err
	}
	return r, nil
}

func nonNil(a []Audience) []Audience {
	if a == nil {
		return []Audience{}
	}
	return a
}
