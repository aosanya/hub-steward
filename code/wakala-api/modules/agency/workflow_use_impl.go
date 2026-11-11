package mwanachamaagency

import (
	"context"
	"fmt"
	"sort"

	"wakalaserver/modules/agency/models"
)

type RunLister func(ctx context.Context) ([]models.WorkflowRunUse, error)

func WithRunLister(list RunLister) Option {
	return func(m *agencyManager) { m.runs = list }
}

func (m *agencyManager) ListDefaultWorkflows(ctx context.Context) ([]models.Workflow, error) {
	cancel := models.Workflow{
		Code:        models.CancelWorkflowCode,
		Name:        "Cancel",
		Description: "At once",
		Default:     true,
	}
	out, err := m.withUse(ctx, []models.Workflow{cancel})
	if err != nil {
		return nil, fmt.Errorf("ListDefaultWorkflows: %w", err)
	}
	return out, nil
}

func (m *agencyManager) withUse(ctx context.Context, workflows []models.Workflow) ([]models.Workflow, error) {
	if len(workflows) == 0 {
		return workflows, nil
	}
	versions := map[string][]int{}
	if m.runs != nil {
		runs, err := m.runs(ctx)
		if err != nil {
			return nil, fmt.Errorf("the orders under way: %w", err)
		}
		for _, r := range runs {
			versions[r.WorkflowCode] = append(versions[r.WorkflowCode], r.WorkflowVersion)
		}
	}
	published, err := m.publishedVersion(ctx)
	if err != nil {
		return nil, err
	}
	for i := range workflows {
		orders := versions[workflows[i].Code]
		workflows[i].InUse = len(orders) > 0
		workflows[i].OrdersUnderWay = len(orders)
		workflows[i].OrderVersions = distinctSorted(orders)
		if !workflows[i].Default {
			workflows[i].Version = published
		}
	}
	return workflows, nil
}

func (m *agencyManager) publishedVersion(ctx context.Context) (int, error) {
	published, err := m.ListPublications(ctx, PublicationFilter{Channel: models.DefaultChannel})
	if err != nil {
		return 0, fmt.Errorf("the published version: %w", err)
	}
	version := 0
	for _, p := range published {
		version = max(version, p.Version)
	}
	return version, nil
}

func distinctSorted(in []int) []int {
	seen := map[int]bool{}
	var out []int
	for _, v := range in {
		if !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
	}
	sort.Ints(out)
	return out
}
