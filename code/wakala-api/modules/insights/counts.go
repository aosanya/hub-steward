package mwanachamainsights

import (
	"context"
	"fmt"
	"sort"

	"wakalaserver/modules/insights/models"
	"wakalaserver/modules/shared/disclosure"
)

type SubjectCount struct {
	SubjectID  string `json:"subject_id"`
	Count      int    `json:"count"`
	Suppressed bool   `json:"suppressed,omitempty"`
}

type SubjectCounts struct {
	Items          []SubjectCount `json:"items"`
	Total          int            `json:"total"`
	TotalPublished bool           `json:"total_published"`
	Minimum        int            `json:"minimum"`
}

const DefaultMinimumCount = 5

func (m *insightManager) CountInsightsBySubject(ctx context.Context) (SubjectCounts, error) {
	return CountBySubject(ctx, m, DefaultMinimumCount)
}

func CountBySubject(ctx context.Context, im InsightManager, minimum int) (SubjectCounts, error) {
	items, err := im.ListInsights(ctx, InsightFilter{})
	if err != nil {
		return SubjectCounts{}, fmt.Errorf("CountBySubject: %w", err)
	}
	return DiscloseBySubject(items, minimum)
}

func DiscloseBySubject(items []models.Insight, minimum int) (SubjectCounts, error) {
	tally := map[string]int{}
	for _, in := range items {
		tally[in.SubjectID]++
	}
	keys := make([]string, 0, len(tally))
	for k := range tally {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	cells := make([]disclosure.Cell, len(keys))
	for i, k := range keys {
		cells[i] = disclosure.Cell{Key: k, Count: tally[k]}
	}
	cells, _, err := disclosure.FoldSmall(cells, minimum)
	if err != nil {
		return SubjectCounts{}, err
	}
	res, err := disclosure.Apply(cells, minimum)
	if err != nil {
		return SubjectCounts{}, err
	}
	out := SubjectCounts{Items: make([]SubjectCount, len(res.Outcomes)), Total: res.Total, TotalPublished: res.TotalPublished, Minimum: minimum}
	for i, o := range res.Outcomes {
		out.Items[i] = SubjectCount{SubjectID: o.Key, Count: o.Count, Suppressed: !o.Published}
	}
	return out, nil
}
