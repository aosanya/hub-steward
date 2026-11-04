package agencies

import (
	"context"
	"errors"

	commmodels "wakalaserver/modules/comm/models"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"
	taskmodels "wakalaserver/modules/taskmanager/models"
)

const SubjectCase = "case"

func (r *registry) caseSubjectStanding(ctx context.Context, instanceID, actorID, caseID string) (commmodels.SubjectStanding, error) {
	if actorID == "" || caseID == "" {
		return commmodels.StandingNone, nil
	}
	c, found, err := r.caseIn(ctx, instanceID, caseID)
	if err != nil || !found {
		return commmodels.StandingNone, err
	}
	if c.RequesterID == actorID {
		return commmodels.StandingAudience, nil
	}
	workers, err := r.caseWorkers(ctx, instanceID, caseID)
	if err != nil {
		return commmodels.StandingNone, err
	}
	for _, w := range workers {
		if w == actorID {
			return commmodels.StandingAnswerer, nil
		}
	}
	standing, err := r.answererWhen(r.IsMember(ctx, instanceID, actorID))
	if err != nil || standing != commmodels.StandingNone {
		return standing, err
	}
	return r.caseGrantStanding(ctx, instanceID, actorID, caseID)
}

const caseReadAction = "taskmanager.case.read"

func (r *registry) caseGrantStanding(ctx context.Context, instanceID, actorID, caseID string) (commmodels.SubjectStanding, error) {
	if r.recordGrants == nil {
		return commmodels.StandingNone, nil
	}
	granted, err := r.recordGrants(ctx, instanceID, actorID, "taskmanager", SubjectCase, caseID, caseReadAction)
	if err != nil || !granted {
		return commmodels.StandingNone, err
	}
	return commmodels.StandingAudience, nil
}

func (r *registry) caseWorkers(ctx context.Context, instanceID, caseID string) ([]string, error) {
	board, err := r.TaskManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	tasks, err := board.ListCaseTasks(ctx, caseID)
	if err != nil {
		return nil, err
	}
	var workers []string
	for _, t := range tasks {
		if t.AssigneeKind == taskmodels.AssigneeActor && t.AssignedTo != "" {
			workers = append(workers, t.AssignedTo)
		}
	}
	return workers, nil
}

func (r *registry) caseSubjectAnswerers(ctx context.Context, instanceID, caseID string) ([]string, error) {
	if caseID == "" {
		return nil, nil
	}
	_, found, err := r.caseIn(ctx, instanceID, caseID)
	if err != nil || !found {
		return nil, err
	}
	operators, err := r.operatorsOf(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	workers, err := r.caseWorkers(ctx, instanceID, caseID)
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	var answerers []string
	for _, id := range append(operators, workers...) {
		if !seen[id] {
			seen[id] = true
			answerers = append(answerers, id)
		}
	}
	return answerers, nil
}

func (r *registry) caseIn(ctx context.Context, instanceID, caseID string) (mwanachamataskmanager.Case, bool, error) {
	board, err := r.TaskManager(ctx, instanceID)
	if err != nil {
		return mwanachamataskmanager.Case{}, false, err
	}
	c, err := board.GetCase(ctx, caseID)
	if errors.Is(err, mwanachamataskmanager.ErrCaseNotFound) {
		return mwanachamataskmanager.Case{}, false, nil
	}
	if err != nil {
		return mwanachamataskmanager.Case{}, false, err
	}
	return c, true, nil
}
