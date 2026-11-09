package mwanachamataskmanager

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"wakalaserver/modules/taskmanager/models"
)

const defaultBacklogName = "default"

var ErrUnknownBacklog = errors.New("unknown backlog")

func (m *taskManager) narrowList(ctx context.Context, q *gorm.DB, filter TaskFilter, states []models.TaskState, now time.Time) (*gorm.DB, error) {
	if filter.Repo != "" {
		q = q.Where("project_name = ?", filter.Repo)
	}
	if filter.Backlog != "" && !strings.EqualFold(filter.Backlog, defaultBacklogName) {
		return nil, fmt.Errorf("%w: %q", ErrUnknownBacklog, filter.Backlog)
	}
	if filter.Step != "" {
		statuses, ok := statusesOfStep(states, filter.Step)
		if !ok {
			return nil, fmt.Errorf("%w: %q", ErrUnknownTaskState, filter.Step)
		}
		q = q.Where("status IN ?", statuses)
	}
	if filter.Tag != "" {
		q = q.Where("id IN ?", m.taskIDsWithTag(ctx, filter.Tag))
	}
	if filter.UntouchedDays > 0 {
		cutoff := now.AddDate(0, 0, -filter.UntouchedDays).Format(time.RFC3339)
		q = q.Where("updated_at < ?", cutoff)
	}
	return q, nil
}

func statusesOfStep(states []models.TaskState, step string) ([]string, bool) {
	for _, s := range states {
		if !strings.EqualFold(s.Name, step) {
			continue
		}
		out := make([]string, 0, len(s.Statuses))
		for _, status := range s.Statuses {
			out = append(out, string(status))
		}
		return out, true
	}
	return nil, false
}

func (m *taskManager) taskIDsWithTag(ctx context.Context, name string) []string {
	var tagIDs []string
	if err := m.store.Query(ctx, roleTag).Where("name = ?", name).Pluck("id", &tagIDs).Error; err != nil || len(tagIDs) == 0 {
		return []string{""}
	}
	var taskIDs []string
	if err := m.store.Query(ctx, roleTagging).Where("tag_id IN ?", tagIDs).Pluck("task_id", &taskIDs).Error; err != nil || len(taskIDs) == 0 {
		return []string{""}
	}
	return taskIDs
}
