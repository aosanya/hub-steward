package http

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"sort"
	"strconv"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

	"wakalaserver/internal/accounts"
)

const (
	callerSentStepsAction = "instance.my_sent_steps.read"
	callerSentStepsTool   = "agency_list_my_sent_steps"

	defaultSentStepsPage = 50
	largestSentStepsPage = 200
)

type sentStep struct {
	StepID       string            `json:"step_id"`
	Title        string            `json:"title"`
	FormName     string            `json:"form_name"`
	WorkflowID   string            `json:"workflow_id"`
	WorkflowName string            `json:"workflow_name"`
	RecordCode   string            `json:"record_code"`
	OrderID      string            `json:"order_id"`
	RowID        string            `json:"row_id"`
	SentAt       string            `json:"sent_at"`
	Answers      map[string]string `json:"answers"`
	Fields       []answerField     `json:"fields"`
	RowAction    string            `json:"row_action,omitempty"`
	Generated    bool              `json:"generated,omitempty"`
}

type sentSteps struct {
	Items []sentStep `json:"items"`
}

type mcpSentStepsParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the Agency Instance"`
	Limit      int    `json:"limit,omitempty" jsonschema:"how many sent steps to return: 50 when absent or zero, 200 at most"`
	After      string `json:"after,omitempty" jsonschema:"the row_id of the last sent step of the page before, to read the next page"`

	IncludeGenerated bool `json:"include_generated,omitempty" jsonschema:"true to list the runs of the generated Add, Edit and Delete workflows too (generated true, with their row_action); they are left out otherwise"`
}

func (d *Deps) registerCallerSentStepsRoute(mux *http.ServeMux, auth callers) {
	mux.HandleFunc("GET /instances/{instanceID}/my-sent-steps", auth.require(func(w http.ResponseWriter, r *http.Request) {
		limit := 0
		if raw := r.URL.Query().Get("limit"); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil {
				writeErr(w, http.StatusBadRequest, "limit is a whole number")
				return
			}
			limit = parsed
		}
		out, err := d.sentStepsFor(r.Context(), r.PathValue("instanceID"), limit, r.URL.Query().Get("after"), r.URL.Query().Get("include_generated") == "true")
		if err != nil {
			writeRecordErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out.Items)
	}))
}

func (d *Deps) registerCallerSentStepsMCPTool(server *mcp.Server) {
	mcp.AddTool(server, &mcp.Tool{
		Name:        callerSentStepsTool,
		Title:       "List My Sent Steps",
		Description: "List the form steps the caller has sent, newest first: step id, title, form name, workflow id and name, the register's code, the run's order_id, the saved row's id, sent_at and the answers. Only rows the caller added, and only the current row when one was corrected. Runs of the generated Add, Edit and Delete workflows are left out unless include_generated is true. Pass limit (50 by default, 200 at most) and after, the row_id of the last item of the page before, to read on.",
	}, d.mcpListMySentSteps)
}

func (d *Deps) mcpListMySentSteps(ctx context.Context, _ *mcp.CallToolRequest, p mcpSentStepsParams) (*mcp.CallToolResult, sentSteps, error) {
	out, err := d.sentStepsFor(ctx, p.InstanceID, p.Limit, p.After, p.IncludeGenerated)
	if err != nil {
		return nil, sentSteps{}, err
	}
	return textResult("Found %d sent step(s)", len(out.Items)), out, nil
}

func (d *Deps) sentStepsFor(ctx context.Context, instanceID string, limit int, after string, includeGenerated bool) (sentSteps, error) {
	if err := d.requireAgentMay(ctx, instanceID, callerSentStepsAction); err != nil {
		return sentSteps{}, err
	}
	if limit < 0 {
		return sentSteps{}, badRowError("a page is not negative")
	}
	if limit == 0 {
		limit = defaultSentStepsPage
	}
	limit = min(limit, largestSentStepsPage)
	m, err := agencyOfAnyone(ctx, d.Registry, instanceID)
	if err != nil {
		return sentSteps{}, err
	}
	every, err := callerSentSteps(ctx, m, accounts.IDFromContext(ctx), includeGenerated)
	if err != nil {
		if errors.Is(err, errNoLiveVersion) {
			return sentSteps{Items: []sentStep{}}, nil
		}
		return sentSteps{}, err
	}
	page, err := pageOfSentSteps(every, limit, after)
	if err != nil {
		return sentSteps{}, err
	}
	return sentSteps{Items: page}, nil
}

func pageOfSentSteps(every []sentStep, limit int, after string) ([]sentStep, error) {
	from := 0
	if after != "" {
		at := slices.IndexFunc(every, func(s sentStep) bool { return s.RowID == after })
		if at < 0 {
			return nil, badRowError("after names none of the caller's sent steps")
		}
		from = at + 1
	}
	return every[from:min(from+limit, len(every))], nil
}

func callerSentSteps(ctx context.Context, m mwanachamaagency.AgencyManager, caller string, includeGenerated bool) ([]sentStep, error) {
	draftID, err := liveDraftOf(ctx, m)
	if err != nil {
		return nil, err
	}
	steps, err := m.ListWorkItems(ctx, draftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		return nil, err
	}
	records, err := m.ListRecords(ctx, draftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		return nil, err
	}
	workflows, err := liveWorkflows(ctx, m, draftID)
	if err != nil {
		return nil, err
	}
	drafts, err := draftsOfEveryPublication(ctx, m)
	if err != nil {
		return nil, err
	}
	sent := []sentStep{}
	for _, chain := range formStepsByWorkflow(steps, records) {
		for _, link := range chain {
			rows, err := currentRowsAddedBy(ctx, m, drafts, link.record.Code, caller)
			if err != nil {
				return nil, err
			}
			for _, row := range rows {
				sent = append(sent, sentStep{
					StepID: link.step.ID, Title: link.step.Title, FormName: link.step.FormName,
					WorkflowID: link.step.WorkflowID, WorkflowName: workflows[link.step.WorkflowID].Name,
					RecordCode: link.record.Identity(), OrderID: row.OrderID, RowID: row.ID, SentAt: row.CreatedAt, Answers: answersOf(row), Fields: answerFieldsOf(link.record, row.Answers),
				})
			}
		}
	}
	rowSteps, err := sentRowSteps(ctx, m, steps, records, workflows, drafts, caller, includeGenerated)
	if err != nil {
		return nil, err
	}
	sent = append(sent, rowSteps...)
	sort.SliceStable(sent, func(i, j int) bool {
		if sent[i].SentAt != sent[j].SentAt {
			return sent[i].SentAt > sent[j].SentAt
		}
		return sent[i].RowID > sent[j].RowID
	})
	return sent, nil
}

func currentRowsAddedBy(ctx context.Context, m mwanachamaagency.AgencyManager, drafts []string, recordCode, person string) ([]agencymodels.RecordRow, error) {
	current, err := currentRowsOfRecord(ctx, m, drafts, recordCode)
	if err != nil {
		return nil, err
	}
	var mine []agencymodels.RecordRow
	for _, row := range current {
		if row.AddedBy == person {
			mine = append(mine, row)
		}
	}
	return mine, nil
}

func currentRowsOfRecord(ctx context.Context, m mwanachamaagency.AgencyManager, drafts []string, recordCode string) ([]agencymodels.RecordRow, error) {
	var every []agencymodels.RecordRow
	for _, id := range drafts {
		found, err := m.ListRecordRows(ctx, id, mwanachamaagency.RecordRowFilter{RecordCode: recordCode, IncludeRetired: true})
		if err != nil {
			return nil, err
		}
		every = append(every, found...)
	}
	replaced := map[string]bool{}
	for _, row := range every {
		if row.Replaces != "" {
			replaced[row.Replaces] = true
		}
	}
	var current []agencymodels.RecordRow
	for _, row := range every {
		if !row.Deleted && !replaced[row.ID] {
			current = append(current, row)
		}
	}
	return current, nil
}

func answersOf(row agencymodels.RecordRow) map[string]string {
	if row.Answers == nil {
		return map[string]string{}
	}
	return row.Answers
}

type answerField struct {
	Key    string `json:"key"`
	Prompt string `json:"prompt"`
	Value  string `json:"value"`
}

func answerFieldsOf(record agencymodels.Record, answers map[string]string) []answerField {
	fields := make([]answerField, 0, len(answers))
	seen := map[string]bool{}
	for _, q := range record.Questions {
		if value, ok := answers[q.Key]; ok && !seen[q.Key] {
			seen[q.Key] = true
			fields = append(fields, answerField{Key: q.Key, Prompt: q.Prompt, Value: value})
		}
	}
	var rest []string
	for key := range answers {
		if !seen[key] {
			rest = append(rest, key)
		}
	}
	sort.Strings(rest)
	for _, key := range rest {
		fields = append(fields, answerField{Key: key, Prompt: key, Value: answers[key]})
	}
	return fields
}
