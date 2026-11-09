package mwanachamataskmanager

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"wakalaserver/modules/shared/spec"

	"wakalaserver/modules/taskmanager/models"
)

const (
	accessSetting     = "backlog_access"
	ownerGroupSetting = "backlog_owner_group"
)

var ErrBacklogForbidden = errors.New("backlog access forbidden")

type Groups func(ctx context.Context, callerID string) ([]string, error)

func (m *taskManager) UseGroups(g Groups) { m.groups = g }

type backlogVisibility struct {
	all    bool
	levels map[string]models.AccessLevel
}

func (v backlogVisibility) Sees(backlogID string) bool {
	return v.all || v.levels[backlogID] != ""
}

func (v backlogVisibility) Moves(backlogID string) bool {
	return v.all || v.levels[backlogID] == models.AccessMove
}

func (m *taskManager) storedGrants(ctx context.Context) ([]models.BacklogGrant, error) {
	if _, declared := m.spec.Setting(accessSetting); !declared {
		return nil, nil
	}
	effective, err := spec.ResolveStored(m.db.WithContext(ctx), m.spec, accessSetting)
	if err != nil {
		return nil, fmt.Errorf("backlog access: %w", err)
	}
	return models.ParseGrants(effective.Value)
}

func (m *taskManager) storedOwnerGroup(ctx context.Context) (string, error) {
	if _, declared := m.spec.Setting(ownerGroupSetting); !declared {
		return "", nil
	}
	effective, err := spec.ResolveStored(m.db.WithContext(ctx), m.spec, ownerGroupSetting)
	if err != nil {
		return "", fmt.Errorf("backlog owner group: %w", err)
	}
	group, _ := effective.Value.(string)
	return group, nil
}

func (m *taskManager) storeSetting(ctx context.Context, name string, value any) error {
	now := time.Now().UTC().Format(time.RFC3339)
	if _, err := spec.StoreOverride(m.db.WithContext(ctx), m.spec, name, value, "taskmanager", now); err != nil {
		return fmt.Errorf("%s: %w", name, err)
	}
	return nil
}

func (m *taskManager) backlogVisibility(ctx context.Context, requesterID string) (backlogVisibility, error) {
	if m.groups == nil || requesterID == "" {
		return backlogVisibility{all: true}, nil
	}
	grants, err := m.storedGrants(ctx)
	if err != nil {
		return backlogVisibility{}, err
	}
	owner, err := m.storedOwnerGroup(ctx)
	if err != nil {
		return backlogVisibility{}, err
	}
	if owner == "" && len(grants) == 0 {
		return backlogVisibility{all: true}, nil
	}
	held, err := m.groups(ctx, requesterID)
	if err != nil {
		return backlogVisibility{}, fmt.Errorf("backlog access: groups: %w", err)
	}
	backlogs, err := m.backlogs(ctx)
	if err != nil {
		return backlogVisibility{}, err
	}
	levels := map[string]models.AccessLevel{}
	for _, b := range backlogs {
		if level := models.AccessLevelOf(grants, owner, b.ID, held); level != "" {
			levels[b.ID] = level
		}
	}
	return backlogVisibility{levels: levels}, nil
}

func (m *taskManager) ListBacklogsFor(ctx context.Context, requesterID string) (models.BacklogList, error) {
	list, err := m.ListBacklogs(ctx)
	if err != nil {
		return models.BacklogList{}, err
	}
	visible, err := m.backlogVisibility(ctx, requesterID)
	if err != nil {
		return models.BacklogList{}, err
	}
	kept := make([]models.BacklogSummary, 0, len(list.Items))
	for _, item := range list.Items {
		if visible.Sees(item.ID) {
			kept = append(kept, item)
		}
	}
	return models.BacklogList{Items: kept}, nil
}

func (m *taskManager) MoveTaskToStepAs(ctx context.Context, requesterID, taskID, backlogID, stepID string) (Task, error) {
	visible, err := m.backlogVisibility(ctx, requesterID)
	if err != nil {
		return Task{}, err
	}
	if !visible.all {
		task, err := m.GetTask(ctx, taskID)
		if err != nil {
			return Task{}, err
		}
		if !visible.Moves(task.Backlog) || !visible.Moves(backlogID) {
			return Task{}, fmt.Errorf("%w: moving needs Can move on both backlogs", ErrBacklogForbidden)
		}
	}
	return m.MoveTaskToStep(ctx, taskID, backlogID, stepID)
}

func (m *taskManager) accessOf(ctx context.Context, backlogID string) (models.BacklogAccess, error) {
	backlogs, err := m.backlogs(ctx)
	if err != nil {
		return models.BacklogAccess{}, err
	}
	if _, _, err := locateStep(backlogs, backlogID, ""); err != nil {
		return models.BacklogAccess{}, err
	}
	grants, err := m.storedGrants(ctx)
	if err != nil {
		return models.BacklogAccess{}, err
	}
	owner, err := m.storedOwnerGroup(ctx)
	if err != nil {
		return models.BacklogAccess{}, err
	}
	return models.BacklogAccess{BacklogID: backlogID, OwnerGroup: owner, Groups: models.GrantsFor(grants, backlogID)}, nil
}

func (m *taskManager) ListBacklogAccess(ctx context.Context, backlogID string) (models.BacklogAccess, error) {
	return m.accessOf(ctx, backlogID)
}

func (m *taskManager) GiveBacklogAccess(ctx context.Context, backlogID, groupID, level string) (models.BacklogAccess, error) {
	groupID = strings.TrimSpace(groupID)
	grant := models.BacklogGrant{BacklogID: backlogID, GroupID: groupID, Level: models.AccessLevel(level)}
	if err := models.CheckGrant(grant); err != nil {
		return models.BacklogAccess{}, fmt.Errorf("%w: %s", ErrInvalidBacklog, err)
	}
	if _, err := m.accessOf(ctx, backlogID); err != nil {
		return models.BacklogAccess{}, err
	}
	grants, err := m.storedGrants(ctx)
	if err != nil {
		return models.BacklogAccess{}, err
	}
	if err := m.storeSetting(ctx, accessSetting, models.WithGrant(grants, grant)); err != nil {
		return models.BacklogAccess{}, err
	}
	return m.accessOf(ctx, backlogID)
}

func (m *taskManager) TakeBacklogAccess(ctx context.Context, backlogID, groupID string) (models.BacklogAccess, error) {
	if _, err := m.accessOf(ctx, backlogID); err != nil {
		return models.BacklogAccess{}, err
	}
	grants, err := m.storedGrants(ctx)
	if err != nil {
		return models.BacklogAccess{}, err
	}
	if err := m.storeSetting(ctx, accessSetting, models.WithoutGrant(grants, backlogID, groupID)); err != nil {
		return models.BacklogAccess{}, err
	}
	return m.accessOf(ctx, backlogID)
}

func (m *taskManager) SetBacklogOwnerGroup(ctx context.Context, groupID string) error {
	return m.storeSetting(ctx, ownerGroupSetting, strings.TrimSpace(groupID))
}

func (m *taskManager) pruneGrants(ctx context.Context, kept []models.Backlog) error {
	grants, err := m.storedGrants(ctx)
	if err != nil || len(grants) == 0 {
		return err
	}
	pruned := models.GrantsKept(grants, kept)
	if len(pruned) == len(grants) {
		return nil
	}
	return m.storeSetting(ctx, accessSetting, pruned)
}
