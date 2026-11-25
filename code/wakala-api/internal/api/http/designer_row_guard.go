package http

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

const (
	designerRowCreateAction = "agency.record_row.create"
	designerRowListAction   = "agency.record_row.list"
	designerRowTagAction    = "agency.record_row.add_tag"
	designerRowRetireAction = "agency.record_row.retire"
	designerRowReturnAction = "agency.record_row.return"
)

var designerRowTools = map[string]string{
	"agency_create_record_row":  designerRowCreateAction,
	"agency_list_record_rows":   designerRowListAction,
	"agency_add_record_row_tag": designerRowTagAction,
	"agency_retire_record_row":  designerRowRetireAction,
	"agency_return_record_row":  designerRowReturnAction,
}

type designerRowCall struct {
	DraftID    string   `json:"draft_id"`
	RecordID   string   `json:"record_id"`
	RecordCode string   `json:"record_code"`
	RowID      string   `json:"row_id"`
	Replaces   string   `json:"replaces"`
	Tags       []string `json:"tags"`
}

func isDesignerRowAction(action string) bool {
	switch action {
	case designerRowCreateAction, designerRowListAction, designerRowTagAction, designerRowRetireAction, designerRowReturnAction:
		return true
	}
	return false
}

func (d *Deps) designerRowVerdict(ctx context.Context, instanceID, action string, call designerRowCall) ([]string, error) {
	m, err := agencyOfAnyone(ctx, d.Registry, instanceID)
	if err != nil {
		return nil, err
	}
	reach, err := d.rowReachOfCaller(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	if reach.reachesNoRow() {
		return nil, errRowForbidden
	}
	codes, err := d.callerRowCodes(ctx, instanceID, m)
	if err != nil {
		return nil, err
	}
	switch action {
	case designerRowCreateAction:
		return nil, d.designerCreateVerdict(ctx, m, codes, reach, call)
	case designerRowListAction:
		return reach.listTags(), d.designerListVerdict(ctx, m, codes, call)
	}
	row, found, err := designerRowOf(ctx, m, call)
	if err != nil || !found || !reach.reaches(row) {
		return nil, errRowForbidden
	}
	if action == designerRowReturnAction {
		return nil, nil
	}
	record, err := recordOfDraft(ctx, m, row.DraftID, row.RecordID, "")
	if err != nil {
		return nil, errRowForbidden
	}
	needs := agencymodels.RowActionAdd
	if action == designerRowRetireAction {
		needs = agencymodels.RowActionDelete
	}
	if !codes.allow(record, needs, anyFieldOfRecord) {
		return nil, errRowForbidden
	}
	return nil, nil
}

func (d *Deps) designerCreateVerdict(ctx context.Context, m mwanachamaagency.AgencyManager, codes rowCodes, reach rowReach, call designerRowCall) error {
	record, err := recordOfDraft(ctx, m, call.DraftID, call.RecordID, call.RecordCode)
	if err != nil {
		return errRowForbidden
	}
	needs := agencymodels.RowActionAdd
	if call.Replaces != "" {
		needs = agencymodels.RowActionEdit
		row, found, err := designerRowOf(ctx, m, designerRowCall{DraftID: call.DraftID, RowID: call.Replaces})
		if err != nil || !found || !reach.reaches(row) {
			return errRowForbidden
		}
	}
	if !codes.allow(record, needs, anyFieldOfRecord) {
		return errRowForbidden
	}
	return nil
}

func (d *Deps) designerListVerdict(ctx context.Context, m mwanachamaagency.AgencyManager, codes rowCodes, call designerRowCall) error {
	if call.RecordID != "" || call.RecordCode != "" {
		record, err := recordOfDraft(ctx, m, call.DraftID, call.RecordID, call.RecordCode)
		if err != nil || !codes.allow(record, mwanachamaagency.RecordViewAction, anyFieldOfRecord) {
			return errRowForbidden
		}
		return nil
	}
	records, err := m.ListRecords(ctx, call.DraftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		return errRowForbidden
	}
	for _, record := range records {
		if !record.Deleted && !codes.allow(record, mwanachamaagency.RecordViewAction, anyFieldOfRecord) {
			return errRowForbidden
		}
	}
	return nil
}

func recordOfDraft(ctx context.Context, m mwanachamaagency.AgencyManager, draftID, recordID, recordCode string) (agencymodels.Record, error) {
	records, err := m.ListRecords(ctx, draftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		return agencymodels.Record{}, err
	}
	for _, record := range records {
		if (recordID != "" && record.ID == recordID) || (recordCode != "" && (record.Code == recordCode || record.Key == recordCode)) {
			return record, nil
		}
	}
	return agencymodels.Record{}, mwanachamaagency.ErrRecordNotFound
}

func designerRowOf(ctx context.Context, m mwanachamaagency.AgencyManager, call designerRowCall) (agencymodels.RecordRow, bool, error) {
	drafts, err := draftsOfEveryPublication(ctx, m)
	if err != nil {
		return agencymodels.RecordRow{}, false, err
	}
	if call.DraftID != "" {
		drafts = append([]string{call.DraftID}, drafts...)
	}
	for _, draftID := range drafts {
		rows, err := m.ListRecordRows(ctx, draftID, mwanachamaagency.RecordRowFilter{IncludeRetired: true, IncludeReturned: true})
		if err != nil {
			return agencymodels.RecordRow{}, false, err
		}
		for _, row := range rows {
			if row.ID == call.RowID {
				return row, true, nil
			}
		}
	}
	return agencymodels.RecordRow{}, false, nil
}

func (d *Deps) guardDesignerRowRequest(w http.ResponseWriter, r *http.Request, instanceID, action string) bool {
	call := designerRowCall{DraftID: r.URL.Query().Get("draft_id"), RecordID: r.URL.Query().Get("record_id"), RecordCode: r.URL.Query().Get("record_code"), RowID: r.PathValue("row_id")}
	if action == designerRowCreateAction {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			writeErr(w, http.StatusBadRequest, "invalid request body")
			return false
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		_ = json.Unmarshal(body, &call)
	}
	narrow, err := d.designerRowVerdict(r.Context(), instanceID, action, call)
	if err != nil {
		writeRecordErr(w, err)
		return false
	}
	if action == designerRowListAction && narrow != nil {
		query := r.URL.Query()
		query.Del("tags")
		for _, tag := range narrow {
			query.Add("tags", tag)
		}
		r.URL.RawQuery = query.Encode()
	}
	return true
}

func (d *Deps) guardDesignerRowTools(server *mcp.Server) {
	server.AddReceivingMiddleware(func(next mcp.MethodHandler) mcp.MethodHandler {
		return func(ctx context.Context, method string, req mcp.Request) (mcp.Result, error) {
			call, ok := req.(*mcp.CallToolRequest)
			if !ok || method != "tools/call" || call.Params == nil {
				return next(ctx, method, req)
			}
			action, guarded := designerRowTools[call.Params.Name]
			if !guarded {
				return next(ctx, method, req)
			}
			args := map[string]json.RawMessage{}
			if json.Unmarshal(call.Params.Arguments, &args) != nil {
				return next(ctx, method, req)
			}
			var instanceID string
			if json.Unmarshal(args["instance_id"], &instanceID) != nil || instanceID == "" {
				return next(ctx, method, req)
			}
			var row designerRowCall
			_ = json.Unmarshal(call.Params.Arguments, &row)
			ctx = context.WithValue(ctx, partitionKey{}, instanceID)
			narrow, err := d.designerRowVerdict(ctx, instanceID, action, row)
			if err != nil {
				return toolError(err), nil
			}
			if action == designerRowListAction && narrow != nil {
				tags, _ := json.Marshal(narrow)
				args["tags"] = tags
				call.Params.Arguments, _ = json.Marshal(args)
			}
			return next(ctx, method, req)
		}
	})
}
