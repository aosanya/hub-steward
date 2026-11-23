package http

import (
	"context"
	"fmt"
	"log/slog"
	"reflect"
	"sort"
	"strings"
	"unicode"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func stepKeepsRecord(s agencymodels.WorkItem) bool {
	return !s.Deleted && s.RowRecord == "" && stepTakesAnswers(s) && stepActorRoleID(s) != "" && s.FormName != "" && len(s.Questions) > 0
}

func stepRecordKey(workflowID, name string) string {
	return workflowID + "\x00" + strings.ToLower(strings.TrimSpace(name))
}

func recordNameOfCode(code, fallback string) string {
	if keepableCode.MatchString(code) {
		return fallback
	}
	words := []rune(strings.ReplaceAll(code, "_", " "))
	words[0] = unicode.ToUpper(words[0])
	return string(words)
}

func stepRecordNames(steps []agencymodels.WorkItem) map[string]string {
	kept := make([]agencymodels.WorkItem, 0, len(steps))
	for _, s := range steps {
		if stepKeepsRecord(s) {
			kept = append(kept, s)
		}
	}
	sort.SliceStable(kept, func(i, j int) bool { return kept[i].Ordinality < kept[j].Ordinality })
	seen := map[string]int{}
	names := make(map[string]string, len(kept))
	for _, s := range kept {
		if s.RecordCode != "" {
			names[s.ID] = recordNameOfCode(s.RecordCode, s.Title)
			continue
		}
		key := stepRecordKey(s.WorkflowID, s.Title)
		seen[key]++
		if seen[key] == 1 {
			names[s.ID] = s.Title
			continue
		}
		names[s.ID] = fmt.Sprintf("%s (%d)", s.Title, seen[key])
	}
	return names
}

func recordIsOfStep(r agencymodels.Record, s agencymodels.WorkItem, name string) bool {
	if s.RecordCode != "" {
		return r.WorkflowID == s.WorkflowID && r.Code == s.RecordCode
	}
	return stepRecordKey(r.WorkflowID, r.Name) == stepRecordKey(s.WorkflowID, name)
}

func recordOfStep(records []agencymodels.Record, s agencymodels.WorkItem, name string) (agencymodels.Record, bool) {
	for _, r := range records {
		if !r.Deleted && recordIsOfStep(r, s, name) {
			return r, true
		}
	}
	return agencymodels.Record{}, false
}

func recordMatchesStep(r agencymodels.Record, s agencymodels.WorkItem) bool {
	return r.RoleID == stepActorRoleID(s) && r.FormName == s.FormName && reflect.DeepEqual(r.Questions, s.Questions)
}

func keptRecordCode(ctx context.Context, s agencymodels.WorkItem) context.Context {
	if s.RecordCode == "" {
		return ctx
	}
	return mwanachamaagency.WithKeptCode(ctx, s.RecordCode)
}

func (m rolesPublished) ensureStepRecords(ctx context.Context, draftID string) error {
	steps, err := m.AgencyManager.ListWorkItems(ctx, draftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		return err
	}
	records, err := m.AgencyManager.ListRecords(ctx, draftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		return err
	}
	names := stepRecordNames(steps)
	for _, s := range steps {
		if !stepKeepsRecord(s) {
			continue
		}
		have, ok := recordOfStep(records, s, names[s.ID])
		switch {
		case !ok:
			created, err := m.AgencyManager.CreateRecord(keptRecordCode(ctx, s), agencymodels.Record{
				DraftID: draftID, WorkflowID: s.WorkflowID, Name: names[s.ID],
				RoleID: stepActorRoleID(s), FormName: s.FormName, Questions: s.Questions,
			})
			if err != nil {
				return err
			}
			records = append(records, created)
		case !recordMatchesStep(have, s):
			have.RoleID, have.FormName, have.Questions = stepActorRoleID(s), s.FormName, s.Questions
			if _, err := m.AgencyManager.UpdateRecord(ctx, have); err != nil {
				return err
			}
		}
	}
	return nil
}

func (m rolesPublished) ensureStepRecordsBeforePublish(ctx context.Context, draftID string) {
	if err := m.ensureStepRecords(ctx, draftID); err != nil {
		slog.Warn("step records not synced", "instance", m.instanceID, "draft", draftID, "err", err)
	}
}
