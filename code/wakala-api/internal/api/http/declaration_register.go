package http

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"sort"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const (
	declarationListAction = "instance.declaration.list"
	declarationListTool   = "agency_list_declarations"
	declarationStepCode   = "WI-56-1"
	declarationFlowCode   = "W-56"
)

type declaredRow struct {
	RowID      string            `json:"row_id"`
	ActorID    string            `json:"actor_id"`
	Name       string            `json:"name"`
	DeclaredOn string            `json:"declared_on"`
	Answers    map[string]string `json:"answers"`
	Own        bool              `json:"own"`
}

type undeclaredPerson struct {
	ActorID string `json:"actor_id"`
	Name    string `json:"name"`
}

type declarationRegister struct {
	Declared         []declaredRow      `json:"declared"`
	NotDeclared      []undeclaredPerson `json:"not_declared"`
	NotDeclaredCount int                `json:"not_declared_count"`
	Total            int                `json:"total"`
	CanReadAll       bool               `json:"can_read_all"`
}

type mcpDeclarationsParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the Agency Instance"`
}

func emptyDeclarationRegister() declarationRegister {
	return declarationRegister{Declared: []declaredRow{}, NotDeclared: []undeclaredPerson{}}
}

func (d *Deps) registerDeclarationRegisterRoute(mux *http.ServeMux, auth callers) {
	mux.HandleFunc("GET /instances/{instanceID}/declarations", auth.require(func(w http.ResponseWriter, r *http.Request) {
		out, err := d.declarationsFor(r.Context(), r.PathValue("instanceID"))
		if err != nil {
			writeRecordErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}))
}

func (d *Deps) registerDeclarationRegisterMCPTool(server *mcp.Server) {
	mcp.AddTool(server, &mcp.Tool{
		Name:        declarationListTool,
		Title:       "List Declarations Of Interest",
		Description: "Read the register of declarations of interest: who has declared, with their answers and the date, and who has not. A caller holding the permission declaration.read (and the owner) sees everyone, with can_read_all true. Anyone else sees only their own declaration, if they made one, and can_read_all false.",
	}, d.mcpListDeclarations)
}

func (d *Deps) mcpListDeclarations(ctx context.Context, _ *mcp.CallToolRequest, p mcpDeclarationsParams) (*mcp.CallToolResult, declarationRegister, error) {
	out, err := d.declarationsFor(ctx, p.InstanceID)
	if err != nil {
		return nil, declarationRegister{}, err
	}
	return textResult("Found %d declaration(s) and %d person(s) yet to declare", len(out.Declared), out.NotDeclaredCount), out, nil
}

func (d *Deps) declarationsFor(ctx context.Context, instanceID string) (declarationRegister, error) {
	role, err := admittedRole(ctx, d.Registry, instanceID)
	if err != nil {
		return declarationRegister{}, err
	}
	m, err := d.Registry.AgencyManager(ctx, instanceID)
	if err != nil {
		return declarationRegister{}, err
	}
	step, record, drafts, found, err := declarationStepOf(ctx, m)
	if err != nil || !found {
		return emptyDeclarationRegister(), err
	}
	current, err := currentRowsOfRecord(ctx, m, drafts, record.Code)
	if err != nil {
		return declarationRegister{}, err
	}
	caller := accounts.IDFromContext(ctx)
	readAll := d.holdsDeclarationRead(ctx, instanceID, role)
	newest := newestRowPerPerson(current)
	if !readAll {
		own := []agencymodels.RecordRow{}
		if row, ok := newest[caller]; ok {
			own = append(own, row)
		}
		return d.declarationRegisterOf(ctx, instanceID, own, nil, caller, false), nil
	}
	holders, err := d.declarationHolders(ctx, m, instanceID, stepActorRoleID(step))
	if err != nil {
		return declarationRegister{}, err
	}
	var missing []string
	for _, id := range holders {
		if _, declared := newest[id]; !declared {
			missing = append(missing, id)
		}
	}
	rows := make([]agencymodels.RecordRow, 0, len(newest))
	for _, row := range newest {
		rows = append(rows, row)
	}
	out := d.declarationRegisterOf(ctx, instanceID, rows, missing, caller, true)
	out.Total = len(holders)
	return out, nil
}

func (d *Deps) declarationRegisterOf(ctx context.Context, instanceID string, rows []agencymodels.RecordRow, missing []string, caller string, canReadAll bool) declarationRegister {
	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].CreatedAt != rows[j].CreatedAt {
			return rows[i].CreatedAt < rows[j].CreatedAt
		}
		return rows[i].ID < rows[j].ID
	})
	ids := slices.Clone(missing)
	for _, row := range rows {
		ids = append(ids, row.AddedBy)
	}
	names := d.namesOfPeople(ctx, instanceID, ids)
	out := emptyDeclarationRegister()
	out.CanReadAll = canReadAll
	for _, row := range rows {
		out.Declared = append(out.Declared, declaredRow{
			RowID: row.ID, ActorID: row.AddedBy, Name: names[row.AddedBy], DeclaredOn: row.CreatedAt,
			Answers: answersOf(row), Own: row.AddedBy == caller,
		})
	}
	for _, id := range missing {
		out.NotDeclared = append(out.NotDeclared, undeclaredPerson{ActorID: id, Name: names[id]})
	}
	out.NotDeclaredCount = len(out.NotDeclared)
	return out
}

func (d *Deps) namesOfPeople(ctx context.Context, instanceID string, ids []string) map[string]string {
	names := make(map[string]string, len(ids))
	for _, id := range ids {
		names[id] = unnamedPerson
	}
	if len(ids) == 0 {
		return names
	}
	directory, err := d.Registry.ActorManager(ctx, instanceID)
	if err != nil {
		return names
	}
	held, err := directory.GetActors(ctx, ids)
	if err != nil {
		return names
	}
	for _, a := range held {
		names[a.ID] = personNameOf(a)
	}
	return names
}

func newestRowPerPerson(rows []agencymodels.RecordRow) map[string]agencymodels.RecordRow {
	newest := map[string]agencymodels.RecordRow{}
	for _, row := range rows {
		have, ok := newest[row.AddedBy]
		if !ok || row.CreatedAt > have.CreatedAt || (row.CreatedAt == have.CreatedAt && row.ID > have.ID) {
			newest[row.AddedBy] = row
		}
	}
	return newest
}

func declarationStepOf(ctx context.Context, m mwanachamaagency.AgencyManager) (agencymodels.WorkItem, agencymodels.Record, []string, bool, error) {
	none := func(err error) (agencymodels.WorkItem, agencymodels.Record, []string, bool, error) {
		return agencymodels.WorkItem{}, agencymodels.Record{}, nil, false, err
	}
	draftID, err := liveDraftOf(ctx, m)
	if err != nil {
		if errors.Is(err, errNoLiveVersion) {
			return none(nil)
		}
		return none(err)
	}
	steps, err := m.ListWorkItems(ctx, draftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		return none(err)
	}
	names := stepRecordNames(steps)
	records, err := m.ListRecords(ctx, draftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		return none(err)
	}
	flows, err := m.ListWorkflows(ctx, draftID, mwanachamaagency.WorkflowFilter{})
	if err != nil {
		return none(err)
	}
	s, ok := declarationStepIn(steps, flows)
	if !ok {
		return none(nil)
	}
	record, ok := recordOfStep(records, s, names[s.ID])
	if !ok {
		return none(nil)
	}
	drafts, err := draftsOfEveryPublication(ctx, m)
	if err != nil {
		return none(err)
	}
	return s, record, drafts, true, nil
}

func declarationStepIn(steps []agencymodels.WorkItem, flows []agencymodels.Workflow) (agencymodels.WorkItem, bool) {
	for _, s := range steps {
		if !s.Deleted && s.Code == declarationStepCode {
			return s, true
		}
	}
	flowID := ""
	for _, f := range flows {
		if !f.Deleted && f.Code == declarationFlowCode {
			flowID = f.ID
		}
	}
	if flowID == "" {
		return agencymodels.WorkItem{}, false
	}
	first := agencymodels.WorkItem{}
	found := false
	for _, s := range steps {
		if s.Deleted || s.WorkflowID != flowID || !stepKeepsRecord(s) {
			continue
		}
		if !found || s.Ordinality < first.Ordinality {
			first, found = s, true
		}
	}
	return first, found
}

func (d *Deps) declarationHolders(ctx context.Context, m mwanachamaagency.AgencyManager, instanceID, stepRoleID string) ([]string, error) {
	members, err := d.Registry.Members(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	var holders []string
	for _, member := range members {
		if member.Role != agencies.RoleAgent {
			continue
		}
		held, err := d.rolesHeldBy(ctx, instanceID, member.UserID)
		if err != nil {
			return nil, err
		}
		if slices.ContainsFunc(held, func(id string) bool { return sameAgencyRole(ctx, m, id, stepRoleID) }) {
			holders = append(holders, member.UserID)
		}
	}
	return holders, nil
}

func (d *Deps) rolesHeldBy(ctx context.Context, instanceID, userID string) ([]string, error) {
	var held []string
	if links, ok := d.Registry.(agencies.AgencyRoleLinks); ok {
		seat, err := links.AgencyRoleOf(ctx, instanceID, userID)
		if err != nil {
			return nil, err
		}
		if seat != "" {
			held = append(held, seat)
		}
	}
	if groupRoles, ok := d.Registry.(agencies.GroupRoles); ok {
		through, err := groupRoles.RoleIDsThroughGroups(ctx, instanceID, userID)
		if err != nil {
			return nil, err
		}
		held = append(held, through...)
	}
	return held, nil
}

func (d *Deps) holdsDeclarationRead(ctx context.Context, instanceID, role string) bool {
	ctx = withPartitionContext(ctx, instanceID)
	switch role {
	case agencies.RoleOwner:
		return true
	case agencies.RoleAgent:
		return d.heldRolesAllow(ctx, d.Registry, declarationListAction)
	case agencies.RoleResident:
		return d.residentHolds(ctx, instanceID, declarationListAction)
	}
	return false
}
