package agencies

import (
	"context"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	mwanachamataskmanager "wakalaserver/modules/taskmanager"
)

type promiseOutcomeClaim struct {
	TaskID    string `gorm:"primaryKey"`
	Outcome   string
	Note      string `gorm:"type:text"`
	CreatedAt time.Time
}

func (promiseOutcomeClaim) TableName() string { return "promise_outcome_claims" }

func migratePromiseOutcomes(db *gorm.DB) error {
	return db.AutoMigrate(&promiseOutcomeClaim{})
}

type promiseOutcomes struct {
	db    *gorm.DB
	locks keyedLocks
}

func newPromiseOutcomes(db *gorm.DB) *promiseOutcomes {
	return &promiseOutcomes{db: db}
}

var unclaimedPromiseOutcomes = newPromiseOutcomes(nil)

type outcomeGuarded interface {
	promiseOutcomes() *promiseOutcomes
}

func promiseOutcomesOf(board mwanachamataskmanager.TaskManager) *promiseOutcomes {
	if guarded, ok := board.(outcomeGuarded); ok && guarded.promiseOutcomes() != nil {
		return guarded.promiseOutcomes()
	}
	return unclaimedPromiseOutcomes
}

func (b limitedBoard) promiseOutcomes() *promiseOutcomes { return b.outcomes }

func (p *promiseOutcomes) hold(taskID string) func() {
	return p.locks.acquire(taskID)
}

func (p *promiseOutcomes) claim(ctx context.Context, taskID string, outcome PromiseOutcome, note string) (promiseOutcomeClaim, bool, error) {
	mine := promiseOutcomeClaim{TaskID: taskID, Outcome: string(outcome), Note: note, CreatedAt: time.Now().UTC()}
	if p.db == nil {
		return mine, true, nil
	}
	res := p.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&mine)
	if res.Error != nil {
		return promiseOutcomeClaim{}, false, res.Error
	}
	if res.RowsAffected == 1 {
		return mine, true, nil
	}
	var held promiseOutcomeClaim
	if err := p.db.WithContext(ctx).Where("task_id = ?", taskID).Take(&held).Error; err != nil {
		return promiseOutcomeClaim{}, false, err
	}
	return held, false, nil
}

func (p *promiseOutcomes) release(ctx context.Context, taskID string) error {
	if p.db == nil {
		return nil
	}
	return p.db.WithContext(ctx).Where("task_id = ?", taskID).Delete(&promiseOutcomeClaim{}).Error
}
