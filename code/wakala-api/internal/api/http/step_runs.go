package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"sort"
	"strings"
	"sync"

	"github.com/google/uuid"
	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"

	"wakalaserver/internal/accounts"
)

const (
	submitStepAnswersTool   = "agency_submit_step_answers"
	submitStepAnswersAction = "instance.step_answers.submit"

	stepStateStart   = "start"
	stepStateWaiting = "waiting"
)

var (
	errStepNotFound   = errors.New("this agency has no such form step")
	errStepNotWaiting = errors.New("that run is not waiting for this step")
	errStepNoRegister = errors.New("this step has no register yet, so the agency has to be published again")
)

type formStep struct {
	step     agencymodels.WorkItem
	record   agencymodels.Record
	routedBy []agencymodels.WorkItem
}

type stepAnswer struct {
	text   string
	labels []string
	listed bool
}

func (a *stepAnswer) UnmarshalJSON(data []byte) error {
	var text string
	if err := json.Unmarshal(data, &text); err == nil {
		*a = stepAnswer{text: text}
		return nil
	}
	var labels []string
	if err := json.Unmarshal(data, &labels); err != nil {
		return errors.New("an answer is a string, or a list of strings for a multi-select question")
	}
	*a = stepAnswer{labels: labels, listed: true}
	return nil
}

type stepAnswersRequest struct {
	Answers map[string]stepAnswer `json:"answers"`
	OrderID string                `json:"order_id,omitempty"`
}

const multiSelectSeparator = ", "

func textAnswers(answers map[string]string) map[string]stepAnswer {
	out := make(map[string]stepAnswer, len(answers))
	for prompt, text := range answers {
		out[prompt] = stepAnswer{text: text}
	}
	return out
}

func resolveStepAnswers(questions []agencymodels.StepQuestion, given map[string]stepAnswer) (map[string]string, error) {
	asked := make(map[string]agencymodels.StepQuestion, len(questions))
	for _, q := range questions {
		asked[q.Prompt] = q
	}
	out := make(map[string]string, len(given))
	for prompt, a := range given {
		q, known := asked[prompt]
		if a.listed && (!known || q.AnswerType != agencymodels.AnswerMultiSelect) {
			return nil, badRowError("only a multi-select question takes a list of answers: " + prompt)
		}
		if !known || q.AnswerType != agencymodels.AnswerMultiSelect {
			out[prompt] = a.text
			continue
		}
		labels := a.labels
		if !a.listed {
			labels = splitChosen(q, strings.TrimSpace(a.text))
		}
		for _, label := range labels {
			if len(q.Options) > 0 && !slices.Contains(q.Options, label) {
				return nil, badRowError("the answer to " + prompt + " is some of " + strings.Join(q.Options, multiSelectSeparator) + ", got " + label)
			}
		}
		out[prompt] = strings.Join(labels, multiSelectSeparator)
	}
	return out, nil
}

func splitChosen(q agencymodels.StepQuestion, text string) []string {
	if text == "" {
		return nil
	}
	if slices.Contains(q.Options, text) {
		return []string{text}
	}
	return strings.Split(text, multiSelectSeparator)
}

type sendLocks struct {
	mu   sync.Mutex
	held map[string]*sendLock
}

type sendLock struct {
	mu      sync.Mutex
	waiting int
}

var stepSendLocks = &sendLocks{held: map[string]*sendLock{}}

func (l *sendLocks) acquire(key string) func() {
	l.mu.Lock()
	lock, ok := l.held[key]
	if !ok {
		lock = &sendLock{}
		l.held[key] = lock
	}
	lock.waiting++
	l.mu.Unlock()
	lock.mu.Lock()
	return func() {
		lock.mu.Unlock()
		l.mu.Lock()
		lock.waiting--
		if lock.waiting == 0 {
			delete(l.held, key)
		}
		l.mu.Unlock()
	}
}

type stepAnswersResult struct {
	StepID     string    `json:"step_id"`
	OrderID    string    `json:"order_id"`
	RecordCode string    `json:"record_code"`
	RowID      string    `json:"row_id"`
	Done       bool      `json:"done"`
	NextStep   *openStep `json:"next_step"`
}

type mcpSubmitStepAnswersParams struct {
	InstanceID string            `json:"instance_id" jsonschema:"the Agency Instance"`
	StepID     string            `json:"step_id" jsonschema:"the step's id, as agency_list_my_open_steps names it"`
	Answers    map[string]string `json:"answers" jsonschema:"the answer to each question of the step's form, by the question's prompt; a multi-select answer is its chosen options joined by a comma and a space"`
	OrderID    string            `json:"order_id,omitempty" jsonschema:"the run the step belongs to: empty on a workflow's first step, which starts a new run, and the run's order_id on every later step"`
}

func (d *Deps) registerSubmitStepAnswersRoute(mux *http.ServeMux, auth callers) {
	mux.HandleFunc("POST /instances/{instanceID}/steps/{stepID}/answers", auth.require(func(w http.ResponseWriter, r *http.Request) {
		var req stepAnswersRequest
		if err := readJSON(r, &req); err != nil {
			writeErr(w, http.StatusBadRequest, "invalid request body")
			return
		}
		out, err := d.submitStepAnswers(r.Context(), r.PathValue("instanceID"), r.PathValue("stepID"), req)
		if err != nil {
			writeStepErr(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, out)
	}))
}

func (d *Deps) registerSubmitStepAnswersMCPTool(server *mcp.Server) {
	mcp.AddTool(server, &mcp.Tool{
		Name:        submitStepAnswersTool,
		Title:       "Submit a Step's Answers",
		Description: "Send the answers to a live workflow step's form. Only a member who holds the step's role may send it. The answers are checked against the step's questions and saved as a row of the step's register; the first step of a workflow starts a new run (leave order_id empty) and returns its order_id, and the next step of that run, held by another role, then appears in that role's agency_list_my_open_steps with available true.",
	}, d.mcpSubmitStepAnswers)
}

func (d *Deps) mcpSubmitStepAnswers(ctx context.Context, _ *mcp.CallToolRequest, p mcpSubmitStepAnswersParams) (*mcp.CallToolResult, stepAnswersResult, error) {
	out, err := d.submitStepAnswers(ctx, p.InstanceID, p.StepID, stepAnswersRequest{Answers: textAnswers(p.Answers), OrderID: p.OrderID})
	if err != nil {
		return nil, stepAnswersResult{}, err
	}
	return textResult("Saved the answers to step %s in run %s", out.StepID, out.OrderID), out, nil
}

func writeStepErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errStepNotFound):
		writeErr(w, http.StatusNotFound, err.Error())
	case errors.Is(err, errStepNotWaiting), errors.Is(err, errStepNoRegister):
		writeErr(w, http.StatusConflict, err.Error())
	default:
		writeRecordErr(w, err)
	}
}

func formStepsByWorkflow(steps []agencymodels.WorkItem, records []agencymodels.Record) map[string][]formStep {
	out := map[string][]formStep{}
	names := stepRecordNames(steps)
	routed := routesTo(steps)
	for _, s := range steps {
		if !stepKeepsRecord(s) {
			continue
		}
		if r, ok := recordOfStep(records, s, names[s.ID]); ok {
			out[s.WorkflowID] = append(out[s.WorkflowID], formStep{step: s, record: r, routedBy: routed[s.ID]})
		}
	}
	for id := range out {
		chain := out[id]
		sort.SliceStable(chain, func(i, j int) bool { return chain[i].step.Ordinality < chain[j].step.Ordinality })
		out[id] = chain
	}
	return out
}

type stepRun struct {
	orderID string
	since   string
	done    []bool
	skipped []bool
	answers []map[string]string
}

func (r stepRun) next() int {
	for i, done := range r.done {
		if !done && !r.skipped[i] {
			return i
		}
	}
	return -1
}

func runsOf(ctx context.Context, m mwanachamaagency.AgencyManager, chain []formStep) ([]stepRun, error) {
	drafts, err := draftsOfEveryPublication(ctx, m)
	if err != nil {
		return nil, err
	}
	byOrder := map[string]*stepRun{}
	for i, link := range chain {
		for _, draftID := range drafts {
			rows, err := m.ListRecordRows(ctx, draftID, mwanachamaagency.RecordRowFilter{RecordCode: link.record.Code})
			if err != nil {
				return nil, err
			}
			for _, row := range rows {
				if row.Deleted || row.OrderID == "" {
					continue
				}
				run, ok := byOrder[row.OrderID]
				if !ok {
					run = &stepRun{orderID: row.OrderID, since: row.CreatedAt, done: make([]bool, len(chain)), answers: make([]map[string]string, len(chain))}
					byOrder[row.OrderID] = run
				}
				run.done[i] = true
				run.answers[i] = row.Answers
				if row.CreatedAt < run.since {
					run.since = row.CreatedAt
				}
			}
		}
	}
	runs := make([]stepRun, 0, len(byOrder))
	for _, run := range byOrder {
		run.settle(chain)
		runs = append(runs, *run)
	}
	sort.SliceStable(runs, func(i, j int) bool {
		if runs[i].since != runs[j].since {
			return runs[i].since < runs[j].since
		}
		return runs[i].orderID < runs[j].orderID
	})
	return runs, nil
}

func (d *Deps) callerAvailableSteps(ctx context.Context, instanceID string) (openSteps, error) {
	base, err := d.callerOpenSteps(ctx, instanceID)
	if err != nil {
		return openSteps{}, err
	}
	mine := make(map[string]openStep, len(base.Items))
	for _, item := range base.Items {
		mine[item.ID] = item
	}
	items := []openStep{}
	if len(mine) == 0 {
		return openSteps{Items: items}, nil
	}
	m, err := agencyOfAnyone(ctx, d.Registry, instanceID)
	if err != nil {
		return openSteps{}, err
	}
	draftID, err := liveDraftOf(ctx, m)
	if err != nil {
		return openSteps{}, err
	}
	steps, err := m.ListWorkItems(ctx, draftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		return openSteps{}, err
	}
	records, err := m.ListRecords(ctx, draftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		return openSteps{}, err
	}
	chains := formStepsByWorkflow(steps, records)
	workflowIDs := make([]string, 0, len(chains))
	for id := range chains {
		workflowIDs = append(workflowIDs, id)
	}
	sort.Strings(workflowIDs)
	for _, workflowID := range workflowIDs {
		chain := chains[workflowID]
		if item, ok := mine[chain[0].step.ID]; ok {
			item.State, item.RecordCode = stepStateStart, chain[0].record.Code
			items = append(items, item)
		}
		runs, err := runsOf(ctx, m, chain)
		if err != nil {
			return openSteps{}, err
		}
		for _, run := range runs {
			at := run.next()
			if at < 1 {
				continue
			}
			if item, ok := mine[chain[at].step.ID]; ok {
				item.State, item.OrderID, item.RecordCode = stepStateWaiting, run.orderID, chain[at].record.Code
				items = append(items, item)
			}
		}
	}
	return openSteps{Items: items}, nil
}

func (d *Deps) submitStepAnswers(ctx context.Context, instanceID, stepID string, req stepAnswersRequest) (stepAnswersResult, error) {
	if err := d.requireAgentMay(ctx, instanceID, submitStepAnswersAction); err != nil {
		return stepAnswersResult{}, err
	}
	m, err := agencyOfAnyone(ctx, d.Registry, instanceID)
	if err != nil {
		return stepAnswersResult{}, err
	}
	held, err := heldAgencyRoles(ctx, d.Registry, instanceID, m)
	if err != nil {
		return stepAnswersResult{}, err
	}
	steps, err := m.ListWorkItems(ctx, held.DraftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		return stepAnswersResult{}, err
	}
	at := slices.IndexFunc(steps, func(s agencymodels.WorkItem) bool { return s.ID == stepID && !s.Deleted })
	if at < 0 || !stepTakesAnswers(steps[at]) {
		return stepAnswersResult{}, errStepNotFound
	}
	step := steps[at]
	if !slices.ContainsFunc(held.Roles, func(r agencymodels.Role) bool { return r.ID == stepActorRoleID(step) }) {
		return stepAnswersResult{}, errRowForbidden
	}
	records, err := m.ListRecords(ctx, held.DraftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		return stepAnswersResult{}, err
	}
	chain := formStepsByWorkflow(steps, records)[step.WorkflowID]
	index := slices.IndexFunc(chain, func(l formStep) bool { return l.step.ID == step.ID })
	if index < 0 {
		return stepAnswersResult{}, errStepNoRegister
	}
	answers, err := resolveStepAnswers(chain[index].record.Questions, req.Answers)
	if err != nil {
		return stepAnswersResult{}, err
	}
	if req.OrderID != "" && index > 0 {
		release := stepSendLocks.acquire(instanceID + "\x00" + req.OrderID)
		defer release()
	}
	orderID, err := runForSubmit(ctx, m, chain, index, req.OrderID)
	if err != nil {
		return stepAnswersResult{}, err
	}
	row, err := m.CreateRecordRow(ctx, agencymodels.RecordRow{
		DraftID: held.DraftID, RecordID: chain[index].record.ID, RoleID: chain[index].record.RoleID,
		AddedBy: accounts.IDFromContext(ctx), Answers: answers, OrderID: orderID,
	})
	if err != nil {
		return stepAnswersResult{}, err
	}
	out := stepAnswersResult{StepID: step.ID, OrderID: orderID, RecordCode: chain[index].record.Code, RowID: row.ID, Done: true}
	following, err := followingStep(ctx, m, chain, orderID)
	if err != nil {
		return stepAnswersResult{}, err
	}
	if following >= 0 {
		next, err := nextStepOf(ctx, m, held.DraftID, chain[following], orderID)
		if err != nil {
			return stepAnswersResult{}, err
		}
		out.NextStep = &next
	}
	return out, nil
}

func followingStep(ctx context.Context, m mwanachamaagency.AgencyManager, chain []formStep, orderID string) (int, error) {
	runs, err := runsOf(ctx, m, chain)
	if err != nil {
		return -1, err
	}
	for _, run := range runs {
		if run.orderID == orderID {
			return run.next(), nil
		}
	}
	return -1, nil
}

func runForSubmit(ctx context.Context, m mwanachamaagency.AgencyManager, chain []formStep, index int, orderID string) (string, error) {
	if index == 0 {
		if orderID != "" {
			return "", badRowError("the first step of a workflow starts a new run, so order_id is left empty")
		}
		return uuid.NewString(), nil
	}
	if orderID == "" {
		return "", badRowError("order_id names the run this step belongs to")
	}
	runs, err := runsOf(ctx, m, chain)
	if err != nil {
		return "", err
	}
	for _, run := range runs {
		if run.orderID == orderID && run.next() == index {
			return orderID, nil
		}
	}
	return "", errStepNotWaiting
}

func nextStepOf(ctx context.Context, m mwanachamaagency.AgencyManager, draftID string, link formStep, orderID string) (openStep, error) {
	roles, err := m.ListRoles(ctx, draftID, mwanachamaagency.RoleFilter{})
	if err != nil {
		return openStep{}, err
	}
	workflows, err := liveWorkflows(ctx, m, draftID)
	if err != nil {
		return openStep{}, err
	}
	next := openStep{
		ID: link.step.ID, Title: link.step.Title, Kind: string(link.step.Kind), WorkflowID: link.step.WorkflowID,
		WorkflowName: workflows[link.step.WorkflowID].Name, OpensIn: opensInOf(workflows[link.step.WorkflowID]),
		RoleID: link.record.RoleID, FormName: link.step.FormName, Questions: link.step.Questions,
		State: stepStateWaiting, OrderID: orderID, RecordCode: link.record.Code,
	}
	for _, r := range roles {
		if r.ID == link.record.RoleID {
			next.RoleName = r.Name
		}
	}
	return next, nil
}
