package http

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
	"github.com/aosanya/mwanachama-backend-shared/dispatch"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

var errNoLiveVersion = errors.New("this agency has no published version yet")

type liveRecord struct {
	Code       string                      `json:"code"`
	Name       string                      `json:"name"`
	WorkflowID string                      `json:"workflow_id"`
	FormName   string                      `json:"form_name"`
	Questions  []agencymodels.StepQuestion `json:"questions"`
	CanAddRows bool                        `json:"can_add_rows"`
}

type recordRowRequest struct {
	Answers  map[string]string `json:"answers"`
	OrderID  string            `json:"order_id,omitempty"`
	Replaces string            `json:"replaces,omitempty"`
}

type rowRead struct {
	OrderID string
	ActorID string
	History bool
	Where   []rowCondition
}

const (
	maxWhereConditions      = 20
	maxConditionValueLength = 200
)

type rowConstraint struct {
	question agencymodels.StepQuestion
	rule     agencymodels.RouteRule
	option   string
}

func (c rowConstraint) holdsOptions() bool {
	if c.question.AnswerType != agencymodels.AnswerMultiSelect {
		return false
	}
	return c.rule.Operator == agencymodels.RouteIs || c.rule.Operator == agencymodels.RouteIsNot || c.rule.Operator == agencymodels.RouteContains
}

var whereOperators = []agencymodels.RouteOperator{
	agencymodels.RouteIs, agencymodels.RouteIsNot, agencymodels.RouteContains,
	agencymodels.RouteMoreThan, agencymodels.RouteLessThan, routeOnOrBefore, routeOnOrAfter,
}

const echoedLength = 40

func echoed(text string) string {
	runes := []rune(text)
	if len(runes) <= echoedLength {
		return strconv.Quote(text)
	}
	return strconv.Quote(string(runes[:echoedLength])) + " (cut)"
}

func questionOfRecord(record agencymodels.Record, prompt string) (agencymodels.StepQuestion, bool) {
	prompt = strings.TrimSpace(prompt)
	for _, q := range record.Questions {
		if q.Prompt == prompt {
			return q, true
		}
	}
	for _, q := range record.Questions {
		if strings.EqualFold(q.Prompt, prompt) {
			return q, true
		}
	}
	return agencymodels.StepQuestion{}, false
}

func refusedCondition(number int, reason string) error {
	return badRowError("condition " + strconv.Itoa(number) + " " + reason)
}

func constraintsOf(record agencymodels.Record, where []rowCondition) ([]rowConstraint, error) {
	if len(where) > maxWhereConditions {
		return nil, badRowError("where holds at most " + strconv.Itoa(maxWhereConditions) + " conditions, got " + strconv.Itoa(len(where)))
	}
	out := make([]rowConstraint, 0, len(where))
	for i, c := range where {
		n := i + 1
		q, ok := questionOfRecord(record, c.Question)
		if !ok {
			return nil, refusedCondition(n, "names "+echoed(c.Question)+", which is not a question of "+record.Name)
		}
		operator := agencymodels.RouteOperator(strings.ToLower(strings.TrimSpace(c.Operator)))
		if !slices.Contains(whereOperators, operator) {
			return nil, refusedCondition(n, "has operator "+echoed(c.Operator)+", which is not one of "+joinedOperators())
		}
		value := strings.TrimSpace(c.Value)
		if value == "" {
			return nil, refusedCondition(n, "has no value")
		}
		if utf8.RuneCountInString(value) > maxConditionValueLength {
			return nil, refusedCondition(n, "has a value longer than "+strconv.Itoa(maxConditionValueLength)+" characters")
		}
		constraint := rowConstraint{question: q, rule: agencymodels.RouteRule{Question: q.Prompt, Operator: operator, Value: value}}
		if reason := constraint.unreadable(); reason != "" {
			return nil, refusedCondition(n, reason)
		}
		constraint.option = strings.ToLower(value)
		out = append(out, constraint)
	}
	return out, nil
}

func (c rowConstraint) unreadable() string {
	q, operator, value := c.question, c.rule.Operator, c.rule.Value
	isDay := operator == routeOnOrBefore || operator == routeOnOrAfter
	switch {
	case operator.Numeric() && q.AnswerType != agencymodels.AnswerNumber && q.AnswerType != agencymodels.AnswerCurrency:
		return "uses " + string(operator) + " on " + echoed(q.Prompt) + ", which does not hold a number"
	case isDay && q.AnswerType != agencymodels.AnswerDate:
		return "uses " + string(operator) + " on " + echoed(q.Prompt) + ", which does not hold a day"
	}
	if _, err := strconv.ParseFloat(value, 64); operator.Numeric() && err != nil {
		return "compares with " + echoed(value) + ", which is not a number"
	}
	if isDay && !isWrittenDay(value) {
		return "compares with " + echoed(value) + ", which is not a day written as " + writtenDayLayout
	}
	if c.holdsOptions() && strings.Contains(value, multiSelectSeparator) {
		return "compares " + echoed(q.Prompt) + " with " + echoed(value) + ", which holds " + strconv.Quote(multiSelectSeparator) + " and so is not one option"
	}
	return ""
}

func joinedOperators() string {
	names := make([]string, len(whereOperators))
	for i, o := range whereOperators {
		names[i] = string(o)
	}
	return strings.Join(names, ", ")
}

func rowMeets(row agencymodels.RecordRow, constraints []rowConstraint) bool {
	held := map[string][]string{}
	for _, c := range constraints {
		answer := row.Answers[c.question.Prompt]
		if !c.holdsOptions() {
			if !ruleHolds(c.rule, answer) {
				return false
			}
			continue
		}
		choices, parsed := held[c.question.Prompt]
		if !parsed {
			choices = multiSelectChoices(answer)
			held[c.question.Prompt] = choices
		}
		if slices.Contains(choices, c.option) == (c.rule.Operator == agencymodels.RouteIsNot) {
			return false
		}
	}
	return true
}

type badRowError string

func (e badRowError) Error() string { return string(e) }

var errRowForbidden = errors.New("forbidden")

var errRowKeptByStep = errors.New("this record is filled through its workflow step")

type directRowClosedError struct{ workflow, workflowCode, action string }

func (e directRowClosedError) Error() string {
	return "Use " + e.workflow + " to " + strings.ToLower(e.workflow)
}

func (e directRowClosedError) body() map[string]string {
	return map[string]string{"error": e.Error(), "workflow": e.workflow, "workflow_code": e.workflowCode, "action": e.action}
}

func generatedWorkflowCode(record agencymodels.Record, action string) string {
	return record.Code + "." + action
}

func directRowClosed(ctx context.Context, m mwanachamaagency.AgencyManager, draftID string, record agencymodels.Record, action string) error {
	code := generatedWorkflowCode(record, action)
	found, err := m.ListWorkflows(ctx, draftID, mwanachamaagency.WorkflowFilter{Code: code})
	if err != nil {
		return err
	}
	i := slices.IndexFunc(found, func(w agencymodels.Workflow) bool { return w.Code == code })
	if i < 0 {
		return fmt.Errorf("the generated workflow %s is not in the live version", code)
	}
	return directRowClosedError{workflow: found[i].Name, workflowCode: code, action: action}
}

func rowActionOfDirectWrite(req recordRowRequest) string {
	if req.Replaces != "" {
		return agencymodels.RowActionEdit
	}
	return agencymodels.RowActionAdd
}

func recordKeptByStep(ctx context.Context, m mwanachamaagency.AgencyManager, draftID string, record agencymodels.Record) (bool, error) {
	if record.WorkflowID == "" {
		return false, nil
	}
	steps, err := m.ListWorkItems(ctx, draftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		return false, err
	}
	names := stepRecordNames(steps)
	return slices.ContainsFunc(steps, func(s agencymodels.WorkItem) bool {
		return stepKeepsRecord(s) && recordIsOfStep(record, s, names[s.ID])
	}), nil
}

func (d *Deps) registerRecordRowRoutes(mux *http.ServeMux, auth callers) {
	base := "/instances/{instanceID}/live-records"
	mux.HandleFunc("GET "+base, auth.require(d.listLiveRecords))
	mux.HandleFunc("GET "+base+"/{recordCode}/rows", auth.require(d.listLiveRecordRows))
	mux.HandleFunc("POST "+base+"/{recordCode}/rows", auth.require(d.addLiveRecordRow))
}

func agencyOfAnyone(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamaagency.AgencyManager, error) {
	if _, err := admittedRole(ctx, reg, instanceID); err != nil {
		return nil, err
	}
	return reg.AgencyManager(ctx, instanceID)
}

func liveDraftOf(ctx context.Context, m mwanachamaagency.AgencyManager) (string, error) {
	pubs, err := m.ListPublications(ctx, mwanachamaagency.PublicationFilter{Channel: agencymodels.DefaultChannel})
	if err != nil {
		return "", err
	}
	best := agencymodels.AgencyPublication{}
	for _, p := range pubs {
		if p.DraftID != "" && p.Version >= best.Version {
			best = p
		}
	}
	if best.DraftID == "" {
		return "", errNoLiveVersion
	}
	return best.DraftID, nil
}

func draftsOfEveryPublication(ctx context.Context, m mwanachamaagency.AgencyManager) ([]string, error) {
	pubs, err := m.ListPublications(ctx, mwanachamaagency.PublicationFilter{})
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	var out []string
	for _, p := range pubs {
		if p.DraftID != "" && !seen[p.DraftID] {
			seen[p.DraftID] = true
			out = append(out, p.DraftID)
		}
	}
	return out, nil
}

func liveRecordByCode(ctx context.Context, m mwanachamaagency.AgencyManager, draftID, code string) (agencymodels.Record, error) {
	records, err := m.ListRecords(ctx, draftID, mwanachamaagency.RecordFilter{Code: code})
	if err != nil {
		return agencymodels.Record{}, err
	}
	for _, rec := range records {
		if strings.EqualFold(rec.Code, code) {
			return rec, nil
		}
	}
	return agencymodels.Record{}, mwanachamaagency.ErrRecordNotFound
}

const assetsOptionsFrom = "assets"

func isPickedFromAList(q agencymodels.StepQuestion) bool {
	return q.AnswerType == agencymodels.AnswerSingleChoice && q.OptionsFrom != ""
}

func picksAnAsset(q agencymodels.StepQuestion) bool {
	return isPickedFromAList(q) && strings.EqualFold(q.OptionsFrom, assetsOptionsFrom)
}

func picksAPerson(q agencymodels.StepQuestion) bool {
	return isPickedFromAList(q) && !picksAnAsset(q)
}

func rowNames(record agencymodels.Record, row agencymodels.RecordRow, person string) bool {
	for _, q := range record.Questions {
		if picksAPerson(q) && row.Answers[q.Prompt] == person {
			return true
		}
	}
	return false
}

func writeRecordErr(w http.ResponseWriter, err error) {
	var bad badRowError
	var closed directRowClosedError
	switch {
	case errors.Is(err, agencies.ErrInstanceNotFound),
		errors.Is(err, mwanachamaagency.ErrRecordNotFound),
		errors.Is(err, errNoLiveVersion):
		writeErr(w, http.StatusNotFound, err.Error())
	case errors.Is(err, errRowForbidden), errors.Is(err, dispatch.ErrForbidden):
		writeErr(w, http.StatusForbidden, "forbidden")
	case errors.As(err, &closed):
		writeJSON(w, http.StatusForbidden, closed.body())
	case errors.Is(err, errRowKeptByStep), errors.Is(err, mwanachamaagency.ErrRecordRowRefused):
		writeErr(w, http.StatusForbidden, err.Error())
	case errors.Is(err, mwanachamaagency.ErrDuplicateRecordRow):
		writeErr(w, http.StatusConflict, err.Error())
	case errors.As(err, &bad), errors.Is(err, mwanachamaagency.ErrInvalidRecordRow):
		writeErr(w, http.StatusBadRequest, err.Error())
	default:
		writeErr(w, http.StatusInternalServerError, "internal error")
	}
}

func (d *Deps) liveRecordsOf(ctx context.Context, instanceID string) ([]liveRecord, error) {
	if err := d.requireAgentMay(ctx, instanceID, listLiveRecordsAction); err != nil {
		return nil, err
	}
	reg := d.Registry
	m, err := agencyOfAnyone(ctx, reg, instanceID)
	if err != nil {
		return nil, err
	}
	draftID, err := liveDraftOf(ctx, m)
	if err != nil {
		return nil, err
	}
	records, err := m.ListRecords(ctx, draftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		return nil, err
	}
	out := make([]liveRecord, 0, len(records))
	for _, rec := range records {
		kept, err := recordKeptByStep(ctx, m, draftID, rec)
		if err != nil {
			return nil, err
		}
		out = append(out, liveRecord{
			Code: rec.Code, Name: rec.Name, WorkflowID: rec.WorkflowID, FormName: rec.FormName,
			Questions: rec.Questions, CanAddRows: !kept && callerMayAddRows(ctx, reg, instanceID, m, rec),
		})
	}
	return out, nil
}

func (d *Deps) liveRowsOf(ctx context.Context, instanceID, recordCode string, read rowRead) ([]agencymodels.RecordRow, error) {
	if err := d.requireAgentMay(ctx, instanceID, listLiveRecordRowsAction); err != nil {
		return nil, err
	}
	reg := d.Registry
	m, err := agencyOfAnyone(ctx, reg, instanceID)
	if err != nil {
		return nil, err
	}
	draftID, err := liveDraftOf(ctx, m)
	if err != nil {
		return nil, err
	}
	record, err := liveRecordByCode(ctx, m, draftID, recordCode)
	if err != nil {
		return nil, err
	}
	constraints, err := constraintsOf(record, read.Where)
	if err != nil {
		return nil, err
	}
	drafts, err := draftsOfEveryPublication(ctx, m)
	if err != nil {
		return nil, err
	}
	var every []agencymodels.RecordRow
	for _, id := range drafts {
		found, err := m.ListRecordRows(ctx, id, mwanachamaagency.RecordRowFilter{RecordCode: record.Code, OrderID: read.OrderID, IncludeRetired: true})
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
	caller := accounts.IDFromContext(ctx)
	seesAll := callerMaySeeEveryRow(ctx, reg, instanceID, m, record)
	rows := []agencymodels.RecordRow{}
	for _, row := range every {
		if (replaced[row.ID] || row.Deleted) == read.History && (seesAll || rowNames(record, row, caller)) && (read.ActorID == "" || rowNames(record, row, read.ActorID)) && rowMeets(row, constraints) {
			rows = append(rows, row)
		}
	}
	sort.SliceStable(rows, func(i, j int) bool { return rows[i].CreatedAt < rows[j].CreatedAt })
	return rows, nil
}

func (d *Deps) addLiveRow(ctx context.Context, instanceID, recordCode string, req recordRowRequest) (agencymodels.RecordRow, error) {
	if err := d.requireAgentMay(ctx, instanceID, addLiveRecordRowAction); err != nil {
		return agencymodels.RecordRow{}, err
	}
	reg := d.Registry
	m, err := agencyOfAnyone(ctx, reg, instanceID)
	if err != nil {
		return agencymodels.RecordRow{}, err
	}
	draftID, err := liveDraftOf(ctx, m)
	if err != nil {
		return agencymodels.RecordRow{}, err
	}
	record, err := liveRecordByCode(ctx, m, draftID, recordCode)
	if err != nil {
		return agencymodels.RecordRow{}, err
	}
	if !callerMayAddRows(ctx, reg, instanceID, m, record) {
		return agencymodels.RecordRow{}, errRowForbidden
	}
	kept, err := recordKeptByStep(ctx, m, draftID, record)
	if err != nil {
		return agencymodels.RecordRow{}, err
	}
	if kept {
		return agencymodels.RecordRow{}, errRowKeptByStep
	}
	if !callerIsPlatformOwner(ctx, reg, instanceID) {
		return agencymodels.RecordRow{}, directRowClosed(ctx, m, draftID, record, rowActionOfDirectWrite(req))
	}
	return d.writeRow(ctx, instanceID, m, draftID, record, rowWrite{Answers: req.Answers, OrderID: req.OrderID, Replaces: req.Replaces})
}

type rowWrite struct {
	Answers   map[string]string
	PlaceRefs map[string]string
	OrderID   string
	Replaces  string
	SendKey   string
}

func (d *Deps) writeRow(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, draftID string, record agencymodels.Record, write rowWrite) (agencymodels.RecordRow, error) {
	reg := d.Registry
	if msg := namesAStranger(ctx, reg, instanceID, record, write.Answers); msg != "" {
		return agencymodels.RecordRow{}, badRowError(msg)
	}
	real, err := d.rowRunIsReal(ctx, instanceID, m, record, write.OrderID)
	if err != nil {
		return agencymodels.RecordRow{}, err
	}
	if !real {
		return agencymodels.RecordRow{}, badRowError(unknownRunMessage)
	}
	ctx, err = withChosenDetails(ctx, reg, instanceID, record.Code)
	if err != nil {
		return agencymodels.RecordRow{}, err
	}
	return m.CreateRecordRow(ctx, agencymodels.RecordRow{
		DraftID: draftID, RecordID: record.ID, RoleID: record.RoleID,
		AddedBy: accounts.IDFromContext(ctx), Answers: write.Answers, PlaceRefs: write.PlaceRefs,
		OrderID: write.OrderID, Replaces: write.Replaces, SendKey: write.SendKey,
	})
}

func (d *Deps) listLiveRecords(w http.ResponseWriter, r *http.Request) {
	out, err := d.liveRecordsOf(r.Context(), r.PathValue("instanceID"))
	if err != nil {
		writeRecordErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (d *Deps) addLiveRecordRow(w http.ResponseWriter, r *http.Request) {
	var req recordRowRequest
	if err := readJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body")
		return
	}
	row, err := d.addLiveRow(r.Context(), r.PathValue("instanceID"), r.PathValue("recordCode"), req)
	if err != nil {
		writeRecordErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, row)
}

func (d *Deps) listLiveRecordRows(w http.ResponseWriter, r *http.Request) {
	if r.URL.Query().Has("where") {
		writeErr(w, http.StatusBadRequest, "where narrows the "+listLiveRecordRowsTool+" tool only; this route lists every row the caller may see")
		return
	}
	read := rowRead{OrderID: r.URL.Query().Get("order_id"), ActorID: r.URL.Query().Get("answer_actor_id"), History: r.URL.Query().Get("history") == "true"}
	rows, err := d.liveRowsOf(r.Context(), r.PathValue("instanceID"), r.PathValue("recordCode"), read)
	if err != nil {
		writeRecordErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

func callerIsPlatformOwner(ctx context.Context, reg agencies.Registry, instanceID string) bool {
	role, err := reg.RoleOf(ctx, instanceID, accounts.IDFromContext(ctx))
	return err == nil && role == agencies.RoleOwner
}

func callerMayDoRowAction(ctx context.Context, reg agencies.Registry, instanceID string, m mwanachamaagency.AgencyManager, record agencymodels.Record, action string) bool {
	return callerIsOwnerOrHolds(ctx, reg, instanceID, m, record.RoleOfRowAction(action))
}

func callerMayAddRows(ctx context.Context, reg agencies.Registry, instanceID string, m mwanachamaagency.AgencyManager, record agencymodels.Record) bool {
	return callerIsOwnerOrHolds(ctx, reg, instanceID, m, record.RoleID)
}

func callerMaySeeEveryRow(ctx context.Context, reg agencies.Registry, instanceID string, m mwanachamaagency.AgencyManager, record agencymodels.Record) bool {
	return callerMayAddRows(ctx, reg, instanceID, m, record) || callerIsOwnerOrHolds(ctx, reg, instanceID, m, record.ViewerRoleID)
}

func callerIsOwnerOrHolds(ctx context.Context, reg agencies.Registry, instanceID string, m mwanachamaagency.AgencyManager, roleID string) bool {
	role, err := reg.RoleOf(ctx, instanceID, accounts.IDFromContext(ctx))
	if err != nil {
		return false
	}
	if role == agencies.RoleOwner {
		return true
	}
	if roleID == "" || (role != agencies.RoleAgent && role != agencies.RoleResident) {
		return false
	}
	held, err := callerRoleKeys(ctx, reg, instanceID)
	return err == nil && keysHoldRole(ctx, m, held, roleID)
}

func keysHoldRole(ctx context.Context, m mwanachamaagency.AgencyManager, keys map[string]bool, roleID string) bool {
	if keys[roleID] {
		return true
	}
	want, err := m.GetRole(ctx, roleID)
	return err == nil && want.Code != "" && keys[want.Code]
}

func namesAStranger(ctx context.Context, reg agencies.Registry, instanceID string, record agencymodels.Record, answers map[string]string) string {
	for _, q := range record.Questions {
		person := strings.TrimSpace(answers[q.Prompt])
		if !isPickedFromAList(q) || person == "" {
			continue
		}
		if picksAnAsset(q) {
			if !isAssetOfAgency(ctx, reg, instanceID, person) {
				return q.Prompt + " is not an asset of this agency"
			}
			continue
		}
		if !isPersonOfAgency(ctx, reg, instanceID, person) {
			return q.Prompt + " is not a member of this agency"
		}
	}
	return ""
}

func isAssetOfAgency(ctx context.Context, reg agencies.Registry, instanceID, asset string) bool {
	assets, err := reg.AssetManager(ctx, instanceID)
	if err != nil {
		return false
	}
	_, err = assets.GetAsset(ctx, asset)
	return err == nil
}

func isPersonOfAgency(ctx context.Context, reg agencies.Registry, instanceID, person string) bool {
	if role, err := reg.RoleOf(ctx, instanceID, person); err == nil && role != "" {
		return true
	}
	directory, err := reg.ActorManager(ctx, instanceID)
	if err != nil {
		return false
	}
	_, err = directory.GetActor(ctx, person)
	return err == nil
}
