package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"slices"
	"strings"
	"testing"
)

type projectPartyWalk struct {
	businessRegisterWalk
	rows map[string]string
}

func projectParties(t *testing.T) projectPartyWalk {
	t.Helper()
	b := businessRegister(t)
	cacheMountedSet(t, b.instance, mountedSet{modules: map[string]bool{"taskmanager": true}})
	rows := map[string]string{}
	for _, name := range []string{"Lakeshore Central Bank", "Highland Farmers Federation", "Rivermouth Insurance Authority", "Northern Lakes Development Fund", "Meridian Climate Facility", "Harbour Commission for Development"} {
		rows[name] = b.addBusiness(t, name, b.alpha, "front desk", "", "")
	}
	return projectPartyWalk{businessRegisterWalk: b, rows: rows}
}

func (p projectPartyWalk) projectsPath(query url.Values) string {
	path := "/instances/" + p.instance + "/taskmanager/projects"
	if len(query) > 0 {
		path += "?" + query.Encode()
	}
	return path
}

func (p projectPartyWalk) makeProject(t *testing.T, name, contractReference string) string {
	t.Helper()
	rec := p.call(t, "POST", p.projectsPath(nil), map[string]any{"name": name, "contract_reference": contractReference}, p.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create project %s: %d %s", name, rec.Code, rec.Body.String())
	}
	id, _ := decodeObject(t, rec)["id"].(string)
	return id
}

func (p projectPartyWalk) addParty(t *testing.T, projectID, role, rowID, name string) {
	t.Helper()
	rec := p.tryAddParty(t, projectID, role, rowID, name)
	if rec.Code != http.StatusCreated {
		t.Fatalf("add %s %s to %s: %d %s", role, name, projectID, rec.Code, rec.Body.String())
	}
}

func (p projectPartyWalk) tryAddParty(t *testing.T, projectID, role, rowID, name string) *httptest.ResponseRecorder {
	t.Helper()
	return p.call(t, "POST", p.projectsPath(nil)+"/"+projectID+"/parties", map[string]any{"role": role, "record_row_id": rowID, "party_name": name}, p.owner)
}

func (p projectPartyWalk) listed(t *testing.T, query url.Values) []string {
	t.Helper()
	rec := p.call(t, "GET", p.projectsPath(query), nil, p.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("list projects %v: %d %s", query, rec.Code, rec.Body.String())
	}
	var projects []struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &projects); err != nil {
		t.Fatalf("decode %q: %v", rec.Body.String(), err)
	}
	names := []string{}
	for _, project := range projects {
		names = append(names, project.Name)
	}
	slices.Sort(names)
	return names
}

func expectProjects(t *testing.T, what string, got []string, want ...string) {
	t.Helper()
	if !slices.Equal(got, want) {
		t.Errorf("%s: got %v, want %v", what, got, want)
	}
}

func (p projectPartyWalk) worked(t *testing.T) {
	t.Helper()
	bank, federation, authority := p.rows["Lakeshore Central Bank"], p.rows["Highland Farmers Federation"], p.rows["Rivermouth Insurance Authority"]
	lakes, climate, harbour := p.rows["Northern Lakes Development Fund"], p.rows["Meridian Climate Facility"], p.rows["Harbour Commission for Development"]
	scorecard := p.makeProject(t, "inclusion scorecard", "NLDF/TA/2026/014")
	training := p.makeProject(t, "savings group training", "NLDF/TA/2026/021")
	insurance := p.makeProject(t, "crop insurance design", "MCF-ADV-0037")
	p.addParty(t, scorecard, "client", bank, "Lakeshore Central Bank")
	p.addParty(t, scorecard, "donor", lakes, "Northern Lakes Development Fund")
	p.addParty(t, training, "client", federation, "Highland Farmers Federation")
	p.addParty(t, training, "donor", lakes, "Northern Lakes Development Fund")
	p.addParty(t, training, "donor", harbour, "Harbour Commission for Development")
	p.addParty(t, insurance, "client", authority, "Rivermouth Insurance Authority")
	p.addParty(t, insurance, "donor", climate, "Meridian Climate Facility")
}

func TestProjectPartiesOverHTTP_AProjectListsByEachDonorRowTheClientRowAndTheContractReference(t *testing.T) {
	p := projectParties(t)
	p.worked(t)

	expectProjects(t, "first donor row", p.listed(t, url.Values{"party_role": {"donor"}, "party_row_id": {p.rows["Northern Lakes Development Fund"]}}), "inclusion scorecard", "savings group training")
	expectProjects(t, "second donor row", p.listed(t, url.Values{"party_role": {"donor"}, "party_row_id": {p.rows["Harbour Commission for Development"]}}), "savings group training")
	expectProjects(t, "client row", p.listed(t, url.Values{"party_role": {"client"}, "party_row_id": {p.rows["Rivermouth Insurance Authority"]}}), "crop insurance design")
	expectProjects(t, "contract reference", p.listed(t, url.Values{"contract_reference": {"MCF-ADV-0037"}}), "crop insurance design")
	expectProjects(t, "a donor row held in the client role", p.listed(t, url.Values{"party_role": {"client"}, "party_row_id": {p.rows["Northern Lakes Development Fund"]}}))
}

func TestProjectPartiesOverHTTP_ACorrectedRowStillListsTheProjectByItsOldId(t *testing.T) {
	p := projectParties(t)
	p.worked(t)
	oldBank := p.rows["Lakeshore Central Bank"]
	renamedBank := p.addBusiness(t, "Lakeshore National Bank", p.alpha, "front desk", "", oldBank)

	expectProjects(t, "the old row id", p.listed(t, url.Values{"party_row_id": {oldBank}}), "inclusion scorecard")
	expectProjects(t, "the new row id", p.listed(t, url.Values{"party_row_id": {renamedBank}}), "inclusion scorecard")
	expectProjects(t, "the new row id in upper case", p.listed(t, url.Values{"party_row_id": {strings.ToUpper(renamedBank)}}), "inclusion scorecard")
	expectProjects(t, "an unrelated row", p.listed(t, url.Values{"party_row_id": {p.rows["Meridian Climate Facility"]}}), "crop insurance design")
}

func TestProjectPartiesOverHTTP_ARowNoLiveRecordRowHoldsIsRefused(t *testing.T) {
	p := projectParties(t)
	project := p.makeProject(t, "flood risk pool", "MCF-ADV-0041")

	unknown := "6f1c9a52-3d7e-4b8a-9c40-2e5d71a8b3f6"
	rec := p.tryAddParty(t, project, "donor", unknown, "Nobody Foundation")
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), unknown) {
		t.Fatalf("add a donor no record row holds: %d %s, want 400 naming %s", rec.Code, rec.Body.String(), unknown)
	}
	expectProjects(t, "the refused row", p.listed(t, url.Values{"party_row_id": {unknown}}))

	known := p.tryAddParty(t, project, "donor", p.rows["Meridian Climate Facility"], "Meridian Climate Facility")
	if known.Code != http.StatusCreated {
		t.Fatalf("add a donor a record row holds: %d %s, want 201", known.Code, known.Body.String())
	}
}

func TestProjectPartiesOverTheTools_AnUnknownRowIsRefusedAndACorrectedRowIsFound(t *testing.T) {
	p := projectParties(t)
	project := p.makeProject(t, "rural lending study", "NLDF/TA/2026/030")
	walk := designAgentWalk{stepRunWalk: p.stepRunWalk}
	fund := p.rows["Northern Lakes Development Fund"]

	unknown := "6f1c9a52-3d7e-4b8a-9c40-2e5d71a8b3f6"
	refused := walk.mcpCall(t, "test-owner", "taskmanager_project_party_add", map[string]any{"instance_id": p.instance, "projectID": project, "role": "donor", "record_row_id": unknown, "party_name": "Nobody Foundation"})
	if !refused.IsError || !strings.Contains(toolErrorText(refused), unknown) {
		t.Fatalf("add an unknown row: error=%v %q, want an error naming %s", refused.IsError, toolErrorText(refused), unknown)
	}

	added := walk.mcpCall(t, "test-owner", "taskmanager_project_party_add", map[string]any{"instance_id": p.instance, "projectID": project, "role": "donor", "record_row_id": fund, "party_name": "Northern Lakes Development Fund"})
	if added.IsError {
		t.Fatalf("add a known row: %s", toolErrorText(added))
	}
	renamed := p.addBusiness(t, "Northern Lakes Fund", p.alpha, "front desk", "", fund)
	listed := walk.mcpCall(t, "test-owner", "taskmanager_project_list", map[string]any{"instance_id": p.instance, "party_row_id": renamed})
	if listed.IsError {
		t.Fatalf("list by the corrected row: %s", toolErrorText(listed))
	}
	encoded, err := json.Marshal(listed.StructuredContent)
	if err != nil {
		t.Fatalf("structured content does not encode: %v", err)
	}
	if !strings.Contains(string(encoded), "rural lending study") {
		t.Fatalf("list by the new row id = %s, want the project held under the old id", encoded)
	}
}
