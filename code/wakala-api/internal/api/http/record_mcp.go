package http

import (
	"context"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	agencymcp "github.com/aosanya/mwanachama-backend-agency/mcp"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
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

const listLiveRecordRowsDescription = "The current rows of one live record, oldest first, as the caller may see them: the role that adds rows to the record sees all of them, anyone else only the rows that name them, so a lead who searches a pool must hold the record's adding role (the record's viewer role is not read here). Narrow to one group order with order_id, or to the rows whose person-picked question holds one actor id with answer_actor_id. history true reads the rows that a replacing row corrected. where narrows by answers: a list of at most 20 {question, operator, value}, every one of which must hold, each value at most 200 characters; operators are is, is_not, contains, more_than, less_than, on_or_before and on_or_after, in any letter case. On a multi-select question, whose options a row keeps joined with a semicolon and a space, is and contains both hold when the answer has the value as one whole option (case ignored, a piece of an option does not count), is_not holds when it does not, and a value that holds a semicolon is refused; on any other question is and is_not compare the whole answer and contains matches a piece of the text. more_than and less_than need a number or currency question; on_or_before and on_or_after need a date question, compare written days (2027-03-01) and include the day itself. A condition that names no question of the record, uses an operator the question cannot answer, or cannot be read is refused with its number."

type rowCondition struct {
	Question string `json:"question" jsonschema:"the prompt of one of the record's questions, as agency_list_live_records names it"`
	Operator string `json:"operator" jsonschema:"is, is_not, contains, more_than, less_than, on_or_before or on_or_after"`
	Value    string `json:"value" jsonschema:"what the answer is compared with; a day is written as 2027-03-01 and a number in digits"`
}

type listLiveRecordsParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the agency whose live records to list"`
}

type listLiveRecordRowsParams struct {
	InstanceID string         `json:"instance_id" jsonschema:"the agency the record belongs to"`
	RecordCode string         `json:"record_code" jsonschema:"the record's code, as agency_list_live_records names it, such as RC-1"`
	OrderID    string         `json:"order_id,omitempty" jsonschema:"only the rows added from this group order"`
	ActorID    string         `json:"answer_actor_id,omitempty" jsonschema:"only the rows where a person-picked question (a single choice picked from a list such as members) holds this actor id"`
	History    bool           `json:"history,omitempty" jsonschema:"true reads the rows that were corrected by a replacing row instead of the current ones"`
	Where      []rowCondition `json:"where,omitempty" jsonschema:"conditions on the answers, every one of which must hold; only the rows that meet them are returned"`
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
		Description: listLiveRecordRowsDescription,
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
	out, err := d.liveRowsOf(ctx, p.InstanceID, p.RecordCode, rowRead{OrderID: p.OrderID, ActorID: p.ActorID, History: p.History, Where: p.Where})
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
