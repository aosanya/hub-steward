package http

import (
	"context"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	agencymcp "wakalaserver/modules/agency/mcp"
	agencymodels "wakalaserver/modules/agency/models"
)

const (
	listLiveRecordsTool    = "agency_list_live_records"
	listLiveRecordRowsTool = "agency_list_live_record_rows"
	addLiveRecordRowTool   = "agency_add_live_record_row"
)

const (
	listLiveRecordsAction    = "instance.live_record.list"
	listLiveRecordRowsAction = "instance.live_record_row.list"
	addLiveRecordRowAction   = "instance.live_record_row.add"
)

func liveRecordToolActions() map[string]string {
	return map[string]string{
		listLiveRecordsTool:    listLiveRecordsAction,
		listLiveRecordRowsTool: listLiveRecordRowsAction,
		addLiveRecordRowTool:   addLiveRecordRowAction,
	}
}

type listLiveRecordsParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the agency whose live records to list"`
}

type listLiveRecordRowsParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the agency the record belongs to"`
	RecordCode string `json:"record_code" jsonschema:"the record's code, as agency_list_live_records names it, such as RC-1"`
	OrderID    string `json:"order_id,omitempty" jsonschema:"only the rows added from this group order"`
	History    bool   `json:"history,omitempty" jsonschema:"true reads the rows that were corrected by a replacing row instead of the current ones"`
}

type addLiveRecordRowParams struct {
	InstanceID string            `json:"instance_id" jsonschema:"the agency the record belongs to"`
	RecordCode string            `json:"record_code" jsonschema:"the record's code, as agency_list_live_records names it, such as RC-1"`
	Answers    map[string]string `json:"answers" jsonschema:"the answer to each question of the record's form, by the question's prompt"`
	OrderID    string            `json:"order_id,omitempty" jsonschema:"the one group order the row is added from"`
	Replaces   string            `json:"replaces,omitempty" jsonschema:"the id of a saved row this one corrects; the old row stays as history"`
}

func (d *Deps) registerLiveRecordMCPTools(server *mcp.Server) {
	if d.Registry == nil {
		return
	}
	mcp.AddTool(server, &mcp.Tool{
		Name:        listLiveRecordsTool,
		Title:       "List the live records",
		Description: "Every record the agency's published version keeps, with the form each row is added with and whether the caller may add rows to it.",
	}, d.mcpListLiveRecords)
	mcp.AddTool(server, &mcp.Tool{
		Name:        listLiveRecordRowsTool,
		Title:       "List a live record's rows",
		Description: "The current rows of one live record, oldest first, as the caller may see them: a role that adds rows sees all of them, anyone else only the rows that name them. Narrow to one group order with order_id. history true reads the rows that a replacing row corrected.",
	}, d.mcpListLiveRecordRows)
	mcp.AddTool(server, &mcp.Tool{
		Name:        addLiveRecordRowTool,
		Title:       "Add a row to a live record",
		Description: "Add one row to a live record, from one group order (order_id). To correct a saved row, add a replacing row with replaces set to its id: the old row stays as history and the new one carries corrected_on. The same answers saved twice within a minute are refused.",
	}, d.mcpAddLiveRecordRow)
}

func (d *Deps) mcpListLiveRecords(ctx context.Context, _ *mcp.CallToolRequest, p listLiveRecordsParams) (*mcp.CallToolResult, agencymcp.ListResult[liveRecord], error) {
	out, err := d.liveRecordsOf(ctx, p.InstanceID)
	if err != nil {
		return nil, agencymcp.ListResult[liveRecord]{}, err
	}
	return textResult("Found %d live record(s)", len(out)), agencymcp.ListResult[liveRecord]{Items: out}, nil
}

func (d *Deps) mcpListLiveRecordRows(ctx context.Context, _ *mcp.CallToolRequest, p listLiveRecordRowsParams) (*mcp.CallToolResult, agencymcp.ListResult[agencymodels.RecordRow], error) {
	out, err := d.liveRowsOf(ctx, p.InstanceID, p.RecordCode, rowRead{OrderID: p.OrderID, History: p.History})
	if err != nil {
		return nil, agencymcp.ListResult[agencymodels.RecordRow]{}, err
	}
	return textResult("Found %d row(s)", len(out)), agencymcp.ListResult[agencymodels.RecordRow]{Items: out}, nil
}

func (d *Deps) mcpAddLiveRecordRow(ctx context.Context, _ *mcp.CallToolRequest, p addLiveRecordRowParams) (*mcp.CallToolResult, agencymodels.RecordRow, error) {
	row, err := d.addLiveRow(ctx, p.InstanceID, p.RecordCode, recordRowRequest{Answers: p.Answers, OrderID: p.OrderID, Replaces: p.Replaces})
	if err != nil {
		return nil, agencymodels.RecordRow{}, err
	}
	return textResult("Added row %s", row.ID), row, nil
}
