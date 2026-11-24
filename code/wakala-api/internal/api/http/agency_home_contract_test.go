package http

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const (
	homeRecord   = agencymodels.HomeTargetRecord
	homeWorkflow = agencymodels.HomeTargetWorkflow
	homeBacklog  = agencymodels.HomeTargetBacklog
	homeMenu     = agencymodels.HomeTargetMenu
	homeFiles    = agencymodels.HomeTargetFiles
)

func orchardHome(w homeWorld, t *testing.T) []agencymodels.DocumentHomeNode {
	t.Helper()
	registers := homeSection("registers", "Registers",
		homeSection("crops", "Crops",
			homeSection("seasons", "Seasons",
				homeEntry("season-log", "Season log", homeRecord, w.rc(t, 2)),
			),
			homeEntry("crate-list", "All crates", homeRecord, w.rc(t, 1)),
			homeEntry("crate-count", "Count crates", homeWorkflow, "W-1"),
		),
		homeEntry("shared-files", "Files", homeFiles, ""),
	)
	registers.Icon = "folder"
	registers.Titles = map[string]string{"sw": "Rejista", "hu": "Nyilvantartasok"}

	work := homeEntry("work", "Work", homeBacklog, "backlog")
	work.Permission = "task.read"

	people := homeEntry("people", "Businesses", homeMenu, "residents/Businesses")
	people.Icon = "people"
	return []agencymodels.DocumentHomeNode{work, registers, people}
}

func TestAgencyHomeContract_AnAgencyThatDeclaresNoHomeAnswersAnEmptyList(t *testing.T) {
	w := newHomeWorld(t)

	items := w.homeFor(t, "test-owner")

	if len(items) != 0 {
		t.Fatalf("an agency with no home answered %d nodes: %v", len(items), items)
	}
}

func TestAgencyHomeContract_AnAgencyWithNoPublishedVersionAnswersAnEmptyListNotAFailure(t *testing.T) {
	w := groupRoleWalk{stepRunWalk: newStepRunWalk(t, nil), groups: map[string]string{}}

	live := w.callTool(t, "test-owner", "agency_list_live_records", map[string]any{"instance_id": w.instance})
	home := w.callTool(t, "test-owner", homeContractTool, map[string]any{"instance_id": w.instance})

	if !live.IsError {
		t.Fatalf("the live-records tool answered an agency with no published version: %v", live.StructuredContent)
	}
	if items := homeItems(t, home); len(items) != 0 {
		t.Errorf("an agency with no published version answered %d nodes: %v", len(items), items)
	}
}

func TestAgencyHomeContract_ANodeKeepsTheShapeItWasPublishedIn(t *testing.T) {
	w := newHomeWorld(t)
	w.declare(t, w.draftID, homeEntry("crate-list", "All crates", homeRecord, w.rc(t, 1)))
	w.publishDraft(t, w.draftID)

	nodes := rawNodes(t, w.homeOf(t, "test-owner"))

	if len(nodes) != 1 {
		t.Fatalf("home = %v, want the one declared node", nodes)
	}
	node, _ := nodes[0].(map[string]any)
	target, nested := node["target"].(map[string]any)
	if !nested || target["type"] != "record" || target["ref"] != w.rc(t, 1) {
		t.Errorf("node = %v, want target {type: record, ref: the record key} as the agency file and the publication's document write it", node)
	}
	if _, flat := node["target_type"]; flat {
		t.Errorf("node = %v, carries target_type beside target, which the published nodes do not", node)
	}
}

func TestAgencyHomeContract_ANestedHomeIsAnsweredExactlyAsPublished(t *testing.T) {
	w := newHomeWorld(t)
	w.declare(t, w.draftID, orchardHome(w, t)...)
	w.publishDraft(t, w.draftID)

	items := w.homeFor(t, "test-owner")

	got := shapeOf(t, items, "target_name")
	want := shapeOf(t, orchardHome(w, t))
	if !reflect.DeepEqual(got, want) {
		gotJSON, _ := json.MarshalIndent(got, "", " ")
		wantJSON, _ := json.MarshalIndent(want, "", " ")
		t.Fatalf("the home answered is not the home published.\ngot:\n%s\nwant:\n%s", gotJSON, wantJSON)
	}
}

func TestAgencyHomeContract_TheDeclaredOrderIsKeptAmongSectionsAndEntriesAlike(t *testing.T) {
	w := newHomeWorld(t)
	w.declare(t, w.draftID,
		homeEntry("zulu", "Zulu", homeFiles, ""),
		homeSection("alpha", "Alpha", homeEntry("yankee", "Yankee", homeRecord, w.rc(t, 1)), homeEntry("bravo", "Bravo", homeRecord, w.rc(t, 2))),
		homeEntry("mike", "Mike", homeFiles, ""),
	)
	w.publishDraft(t, w.draftID)

	items := w.homeFor(t, "test-owner")

	if got, want := homeKeysOf(items), []string{"zulu", "alpha", "mike"}; !slices.Equal(got, want) {
		t.Errorf("top-level order = %v, want the declared %v", got, want)
	}
	alpha, _ := nodeNamed(items, "alpha")
	if got, want := homeKeysOf(entriesOf(alpha)), []string{"yankee", "bravo"}; !slices.Equal(got, want) {
		t.Errorf("section order = %v, want the declared %v", got, want)
	}
}

func TestAgencyHomeContract_ARecordOrWorkflowTargetThePublishedVersionNeverHeldIsDropped(t *testing.T) {
	w := newHomeWorld(t)
	w.declare(t, w.draftID,
		homeSection("mixed", "Mixed",
			homeEntry("kept-record", "Kept record", homeRecord, w.rc(t, 1)),
			homeEntry("gone-record", "Gone record", homeRecord, "RC-99"),
			homeEntry("kept-workflow", "Kept workflow", homeWorkflow, "W-1"),
			homeEntry("gone-workflow", "Gone workflow", homeWorkflow, "W-99"),
			homeEntry("last", "Last", homeFiles, ""),
		),
		homeEntry("loose-gone", "Loose gone record", homeRecord, "RC-98"),
		homeEntry("loose-kept", "Loose kept", homeFiles, ""),
	)
	w.publishDraft(t, w.draftID)

	items := w.homeFor(t, "test-owner")

	if got, want := homeKeysOf(items), []string{"mixed", "loose-kept"}; !slices.Equal(got, want) {
		t.Fatalf("top-level keys = %v, want %v: the loose entry with a target that is gone is dropped and nothing else", got, want)
	}
	mixed, _ := nodeNamed(items, "mixed")
	if got, want := homeKeysOf(entriesOf(mixed)), []string{"kept-record", "kept-workflow", "last"}; !slices.Equal(got, want) {
		t.Errorf("section keys = %v, want %v: only the record and workflow nodes whose target is gone are dropped, in order", got, want)
	}
}

func TestAgencyHomeContract_ARecordTheNextPublicationRemovesDisappearsFromHome(t *testing.T) {
	w := newHomeWorld(t)
	ctx := context.Background()
	visits, err := w.mgr.CreateRecord(ctx, agencymodels.Record{
		DraftID: w.draftID, WorkflowID: w.workflow, Name: "Visit log", RoleID: w.roles["Reader"], FormName: "Visit",
		Questions: []agencymodels.StepQuestion{{Prompt: "Visitor", AnswerType: agencymodels.AnswerFreeText, Required: true}},
	})
	if err != nil {
		t.Fatalf("CreateRecord: %v", err)
	}
	w.declare(t, w.draftID,
		homeEntry("visit-log", "Visit log", homeRecord, visits.Code),
		homeEntry("crate-list", "All crates", homeRecord, w.rc(t, 1)),
	)
	w.publishDraft(t, w.draftID)
	if got, want := homeKeysOf(w.homeFor(t, "test-owner")), []string{"visit-log", "crate-list"}; !slices.Equal(got, want) {
		t.Fatalf("while the published version holds %s the home lists %v, want %v", visits.Code, got, want)
	}

	if err := w.mgr.DeleteRecord(ctx, visits.ID); err != nil {
		t.Fatalf("DeleteRecord: %v", err)
	}
	w.publishDraft(t, w.draftID)

	if got, want := homeKeysOf(w.homeFor(t, "test-owner")), []string{"crate-list"}; !slices.Equal(got, want) {
		t.Errorf("once the published version no longer holds %s the home lists %v, want %v", visits.Code, got, want)
	}
}

func TestAgencyHomeContract_AWorkflowTheNextPublicationRemovesDisappearsFromHome(t *testing.T) {
	w := newHomeWorld(t)
	ctx := context.Background()
	season, err := w.mgr.CreateWorkflow(ctx, agencymodels.Workflow{DraftID: w.draftID, Name: "Seasonal count"})
	if err != nil {
		t.Fatalf("CreateWorkflow: %v", err)
	}
	goal, err := w.mgr.CreateGoal(ctx, agencymodels.Goal{DraftID: w.draftID, Title: "Every season is counted"})
	if err != nil {
		t.Fatalf("CreateGoal: %v", err)
	}
	objective, err := w.mgr.CreateObjective(ctx, agencymodels.Objective{DraftID: w.draftID, GoalID: goal.ID, Title: "Count each season"})
	if err != nil {
		t.Fatalf("CreateObjective: %v", err)
	}
	link, err := w.mgr.CreateWorkflowObjective(ctx, agencymodels.WorkflowObjective{DraftID: w.draftID, WorkflowID: season.ID, ObjectiveID: objective.ID})
	if err != nil {
		t.Fatalf("CreateWorkflowObjective: %v", err)
	}
	if _, err := w.mgr.CreateWorkItem(ctx, agencymodels.WorkItem{
		DraftID: w.draftID, WorkflowID: season.ID, Title: "Count the season", Ordinality: 1, Kind: agencymodels.StepKindFillForm, RoleID: w.roles["Reader"], FormName: "Season",
		Questions: []agencymodels.StepQuestion{{Prompt: "Crates", AnswerType: agencymodels.AnswerNumber, Required: true}},
	}); err != nil {
		t.Fatalf("CreateWorkItem: %v", err)
	}
	w.declare(t, w.draftID,
		homeEntry("season-count", "Count a season", homeWorkflow, season.Code),
		homeEntry("crate-count", "Count crates", homeWorkflow, "W-1"),
	)
	w.publishDraft(t, w.draftID)
	if got, want := homeKeysOf(w.homeFor(t, "test-owner")), []string{"season-count", "crate-count"}; !slices.Equal(got, want) {
		t.Fatalf("while the published version holds %s the home lists %v, want %v", season.Code, got, want)
	}

	if err := w.mgr.DeleteWorkflowObjective(ctx, link.ID); err != nil {
		t.Fatalf("DeleteWorkflowObjective: %v", err)
	}
	if err := w.mgr.DeleteWorkflow(ctx, season.ID); err != nil {
		t.Fatalf("DeleteWorkflow: %v", err)
	}
	w.publishDraft(t, w.draftID)

	if got, want := homeKeysOf(w.homeFor(t, "test-owner")), []string{"crate-count"}; !slices.Equal(got, want) {
		t.Errorf("once the published version no longer holds %s the home lists %v, want %v", season.Code, got, want)
	}
}

func TestAgencyHomeContract_ASectionLeftEmptyByDroppedTargetsShowsNoneOfThem(t *testing.T) {
	w := newHomeWorld(t)
	w.declare(t, w.draftID,
		homeSection("outer", "Outer",
			homeSection("inner", "Inner", homeEntry("only-gone", "Only gone", homeRecord, "RC-97")),
		),
		homeSection("pair", "Pair",
			homeEntry("gone-one", "Gone one", homeRecord, "RC-96"),
			homeEntry("gone-two", "Gone two", homeWorkflow, "W-96"),
		),
		homeEntry("steady", "Steady", homeFiles, ""),
	)
	w.publishDraft(t, w.draftID)

	items := w.homeFor(t, "test-owner")

	if refs := targetRefsOf(items); len(refs) != 1 || refs[0] != "" {
		t.Errorf("targets left in the home = %v, want only the files entry (every record and workflow target is gone)", refs)
	}
	if _, found := nodeNamed(items, "steady"); !found {
		t.Errorf("the entry beside the emptied sections was lost: %v", homeKeysOf(items))
	}
	for _, key := range []string{"outer", "inner", "pair"} {
		if node, found := nodeNamed(items, key); found && len(targetRefsOf(entriesOf(node))) != 0 {
			t.Errorf("section %s still holds %v although every entry in it is gone", key, targetRefsOf(entriesOf(node)))
		}
	}
}

func TestAgencyHomeContract_ABacklogMenuOrFilesTargetIsPassedOnWhateverItRefersTo(t *testing.T) {
	w := newHomeWorld(t)
	declared := []agencymodels.DocumentHomeNode{
		homeEntry("board", "Board", homeBacklog, "no-such-backlog-id"),
		homeEntry("menu-item", "A menu item", homeMenu, "nowhere/Nothing"),
		homeEntry("files", "Files", homeFiles, ""),
	}
	w.declare(t, w.draftID, declared...)
	w.publishDraft(t, w.draftID)

	items := w.homeFor(t, "test-owner")

	if got, want := shapeOf(t, items, "target_name"), shapeOf(t, declared); !reflect.DeepEqual(got, want) {
		t.Fatalf("the hub changed targets the app decides on.\ngot  %v\nwant %v", got, want)
	}
}

func TestAgencyHomeContract_AWorkflowNodeCarriesTheWorkflowsName(t *testing.T) {
	w := newHomeWorld(t)
	w.declare(t, w.draftID,
		homeSection("jobs", "Jobs", homeEntry("start-count", "Count crates", homeWorkflow, "W-1")),
	)
	w.publishDraft(t, w.draftID)

	items := w.homeFor(t, "test-owner")

	node, found := nodeNamed(items, "start-count")
	if !found {
		t.Fatalf("the workflow node is missing: %v", homeKeysOf(items))
	}
	if node["target_name"] != "Case referral" {
		t.Errorf("target_name = %#v, want the published workflow's name \"Case referral\"", node["target_name"])
	}
	target, _ := node["target"].(map[string]any)
	if target["type"] != "workflow" || target["ref"] != "W-1" {
		t.Errorf("target = %v, want the declared workflow W-1 kept beside target_name", target)
	}
}

func TestAgencyHomeContract_TheDeclarationIsReadFromThePublishedVersionNotTheOpenDraft(t *testing.T) {
	w := newHomeWorld(t)
	published := []agencymodels.DocumentHomeNode{
		homeSection("registers", "Registers", homeEntry("crate-list", "All crates", homeRecord, w.rc(t, 1))),
		homeEntry("crate-count", "Count crates", homeWorkflow, "W-1"),
	}
	w.declare(t, w.draftID, published...)
	w.publishDraft(t, w.draftID)

	ctx := context.Background()
	next := w.nextDraft(t)
	w.declare(t, next, homeEntry("draft-only", "Draft only", homeFiles, ""))
	renamed, err := w.mgr.ListWorkflows(ctx, next, mwanachamaagency.WorkflowFilter{})
	if err != nil || len(renamed) == 0 {
		t.Fatalf("ListWorkflows in the next draft: %v %v", renamed, err)
	}
	renamed[0].Name = "Renamed in the draft"
	if _, err := w.mgr.UpdateWorkflow(ctx, renamed[0]); err != nil {
		t.Fatalf("UpdateWorkflow: %v", err)
	}

	items := w.homeFor(t, "test-owner")

	if got, want := shapeOf(t, items, "target_name"), shapeOf(t, published); !reflect.DeepEqual(got, want) {
		t.Fatalf("an open draft changed the home.\ngot  %v\nwant %v", got, want)
	}
	if _, found := nodeNamed(items, "draft-only"); found {
		t.Errorf("the open draft's node draft-only is in the home: %v", homeKeysOf(items))
	}
	if node, _ := nodeNamed(items, "crate-count"); node["target_name"] != "Case referral" {
		t.Errorf("target_name = %#v, want the published name \"Case referral\", not the draft's rename", node["target_name"])
	}

	w.publishDraft(t, next)

	after := w.homeFor(t, "test-owner")
	if got, want := homeKeysOf(after), []string{"registers", "crate-count", "draft-only"}; !slices.Equal(got, want) {
		t.Errorf("after the next draft is published the home lists %v, want %v", got, want)
	}
	if node, _ := nodeNamed(after, "crate-count"); node["target_name"] != "Renamed in the draft" {
		t.Errorf("target_name = %#v after publishing, want \"Renamed in the draft\"", node["target_name"])
	}
}

func TestAgencyHomeContract_AFileThatDeclaresAHomeIsServedOnceItsImportIsPublished(t *testing.T) {
	w := newStepRunWalk(t, nil)
	declared := []agencymodels.DocumentHomeNode{
		homeSection("harvest", "Harvest", homeEntry("crate-list", "All crates", homeRecord, "crates"), homeEntry("crate-count", "Count crates", homeWorkflow, "W-1")),
		homeEntry("files", "Files", homeFiles, ""),
	}
	file := map[string]any{
		"name":                "Orchard co-op",
		"agency":              map[string]any{"name": "Orchard co-op"},
		"roles":               []map[string]any{{"id": "r1", "code": "R-1", "name": "Picker"}},
		"goals":               []map[string]any{{"id": "g1", "code": "G-1", "title": "Every crate is counted"}},
		"objectives":          []map[string]any{{"id": "o1", "code": "O-1", "goal_id": "g1", "title": "Count each crate"}},
		"workflows":           []map[string]any{{"id": "w1", "code": "W-1", "name": "Crate count"}},
		"workflow_objectives": []map[string]any{{"workflow_id": "w1", "objective_id": "o1"}},
		"work_items": []map[string]any{{
			"id": "s1", "code": "WI-1", "workflow_id": "w1", "title": "Count crates", "ordinality": 1, "kind": "fill_form", "role_id": "r1", "form_name": "Crates",
			"questions": []map[string]any{{"prompt": "Crates", "answer_type": "number", "required": true}},
		}},
		"records": []map[string]any{{
			"id": "c1", "code": "crates", "workflow_id": "w1", "name": "Crates", "role_id": "r1", "form_name": "Crates",
			"questions": []map[string]any{{"prompt": "Crates", "answer_type": "number", "required": true}},
		}},
		"home": declared,
	}
	rec := w.call(t, "POST", "/instances/import", file, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("import: %d %s", rec.Code, rec.Body.String())
	}
	var result importResult
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode import result: %v", err)
	}
	if len(result.Errors) > 0 {
		t.Fatalf("the import reported %d errors: %q", len(result.Errors), result.Errors)
	}
	published := w.call(t, "POST", "/instances/"+result.Instance.ID+"/publications", map[string]any{"draft_id": result.DraftID}, w.owner)
	if published.Code != http.StatusCreated {
		t.Fatalf("publish the imported draft: %d %s", published.Code, published.Body.String())
	}

	out := groupRoleWalk{stepRunWalk: w, groups: map[string]string{}}.callTool(t, "test-owner", homeContractTool, map[string]any{"instance_id": result.Instance.ID})

	items := homeItems(t, out)
	if got, want := shapeOf(t, items, "target_name"), rekeyed(shapeOf(t, declared), "crates", w.importedRecordKey(t, result.Instance.ID, result.DraftID, "Crates")); !reflect.DeepEqual(got, want) {
		t.Fatalf("the imported file's home is not the home served.\ngot  %v\nwant %v", got, want)
	}
	if node, _ := nodeNamed(items, "crate-count"); node["target_name"] != "Crate count" {
		t.Errorf("target_name = %#v, want the imported workflow's name \"Crate count\"", node["target_name"])
	}
}

func TestAgencyHomeContract_EveryPersonWhoMayOpenTheAgencyMayCallIt(t *testing.T) {
	w := newHomeWorld(t)
	w.declare(t, w.draftID, homeEntry("crate-list", "All crates", homeRecord, w.rc(t, 1)))
	w.publishDraft(t, w.draftID)
	bare, _ := w.resident(t, "Amina")
	grouped, _ := w.resident(t, "Bela", "Support")
	w.giveRole(t, "Support", "Reader")
	for name, subject := range map[string]string{"the owner": "test-owner", "a resident with no role": bare, "a resident whose group holds a role": grouped} {
		t.Run(name, func(t *testing.T) {
			items := w.homeFor(t, subject)
			if got, want := homeKeysOf(items), []string{"crate-list"}; !slices.Equal(got, want) {
				t.Errorf("%s reads %v, want %v", name, got, want)
			}
		})
	}
}

func TestAgencyHomeContract_ANonMemberIsRefusedAsTheLiveRecordsToolRefuses(t *testing.T) {
	w := newHomeWorld(t)
	w.declare(t, w.draftID, homeEntry("crate-list", "All crates", homeRecord, w.rc(t, 1)))
	w.publishDraft(t, w.draftID)

	live := w.callTool(t, "a-stranger", "agency_list_live_records", map[string]any{"instance_id": w.instance})
	home := w.homeOf(t, "a-stranger")

	if !live.IsError || !strings.Contains(refusalText(live), instanceNotFoundText) {
		t.Fatalf("the live-records tool answered a stranger with %q (error %v), want %q", refusalText(live), live.IsError, instanceNotFoundText)
	}
	if !home.IsError {
		t.Fatalf("%s answered a stranger: %v", homeContractTool, home.StructuredContent)
	}
	if refusalText(home) != refusalText(live) {
		t.Errorf("a stranger is refused with %q, the live-records tool refuses with %q", refusalText(home), refusalText(live))
	}
}

func TestAgencyHomeContract_AMemberOfAnotherAgencyIsRefusedAsAStranger(t *testing.T) {
	w := newHomeWorld(t)
	w.declare(t, w.draftID, homeEntry("crate-list", "All crates", homeRecord, w.rc(t, 1)))
	w.publishDraft(t, w.draftID)
	ctx := context.Background()
	neighbouring, err := w.deps.Registry.CreateInstance(ctx, "Neighbouring co-op")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, neighbouring.ID, "neighbour", agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}

	home := w.homeOf(t, "neighbour")

	if !home.IsError || !strings.Contains(refusalText(home), instanceNotFoundText) {
		t.Fatalf("a member of another agency got %q (error %v), want %q", refusalText(home), home.IsError, instanceNotFoundText)
	}
}

func TestAgencyHomeContract_TheToolIsInTheMCPRosterOfEveryMountConfiguration(t *testing.T) {
	for _, mounts := range rosterConfigurations {
		t.Run(mounts.name, func(t *testing.T) {
			roster := rosterFor(t, mounts)
			count := 0
			for _, name := range roster {
				if name == homeContractTool {
					count++
				}
			}
			if count != 1 {
				t.Errorf("%s lists %s %d times, want once (the roster pins in mcp_roster_pin_test.go and testdata/mcp_roster/no-mounts.txt must take it in)", mounts.name, homeContractTool, count)
			}
		})
	}
}

func TestAgencyHomeContract_TheToolNamesTheAgencyByInstanceIDAndNothingElseIsRequired(t *testing.T) {
	w := newHomeWorld(t)
	ctx := accounts.WithID(context.Background(), "test-owner")
	serverSide, clientSide := mcp.NewInMemoryTransports()
	session, err := newMCPServer(w.deps).Connect(ctx, serverSide, nil)
	if err != nil {
		t.Fatalf("connect server: %v", err)
	}
	t.Cleanup(func() { session.Close() })
	client, err := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil).Connect(ctx, clientSide, nil)
	if err != nil {
		t.Fatalf("connect client: %v", err)
	}
	t.Cleanup(func() { client.Close() })

	var found *mcp.Tool
	for tool, err := range client.Tools(ctx, nil) {
		if err != nil {
			t.Fatalf("list tools: %v", err)
		}
		if tool.Name == homeContractTool {
			found = tool
		}
	}

	if found == nil {
		t.Fatalf("%s is not listed", homeContractTool)
	}
	schema, _ := found.InputSchema.(map[string]any)
	properties, _ := schema["properties"].(map[string]any)
	if _, ok := properties["instance_id"]; !ok {
		t.Errorf("%s input schema %s has no instance_id", homeContractTool, schemaText(t, found))
	}
	if required, _ := schema["required"].([]any); len(required) != 1 || required[0] != "instance_id" {
		t.Errorf("%s requires %v, want only instance_id", homeContractTool, required)
	}
}

func TestAgencyHomeContract_AResidentWhoseGroupHoldsARoleSeesTheToolBesideTheLiveRecordsTool(t *testing.T) {
	w := newHomeWorld(t)
	runsModules(t, w.instance, "agency", "forms", "actor", "taskmanager")
	_, amina := w.resident(t, "Amina", "Support")
	w.giveRole(t, "Support", "Reader")
	server := httptest.NewServer(w.handler)
	t.Cleanup(server.Close)

	seen := toolsOverMCP(t, server.URL, amina)

	for _, tool := range []string{"agency_list_live_records", homeContractTool} {
		if !slices.Contains(seen, tool) {
			t.Errorf("a resident whose group holds a role cannot see %s among %d tools", tool, len(seen))
		}
	}
}

func TestAgencyHomeContract_TheActionIsOneEverySeatedPersonMay(t *testing.T) {
	if !everySeatedAgentMay("instance.home.read") {
		t.Errorf("a seated person may not instance.home.read, so a resident with no role cannot read the Home")
	}
	if everySeatedAgentMay("agency.home_entry.create") || everySeatedAgentMay("agency.home_entry.list") {
		t.Errorf("a seated person may write or read a draft's Home rows")
	}
}

func deliverHome(w homeWorld, t *testing.T, stepCode string) []agencymodels.DocumentHomeNode {
	projects := homeEntry("projects", "Projects", homeRecord, w.rc(t, 1))
	projects.Roles = []string{"R-1", "R-2"}
	projects.Permission = "task.read"

	days := homeEntry("days", "Days worked", homeRecord, w.rc(t, 2))
	days.Target.Where = []agencymodels.HomeCondition{
		{Question: "Project", Operator: "is", Value: agencymodels.HomeValue{Row: "Project title"}},
		{Question: "Status", Operator: "is_not", Value: agencymodels.HomeValue{Literal: "closed"}},
	}
	report := homeEntry("report", "Progress report", homeWorkflow, "W-1")
	report.Target.Step, report.Target.Scope = stepCode, agencymodels.HomeScopeRowOrder
	page := homeSection("project-page", "Project", days, report)
	page.PageOf = w.rc(t, 1)

	deliver := homeSection("deliver", "Deliver work", projects, page)
	deliver.Icon = "folder"
	deliver.Titles = map[string]string{"sw": "Kazi"}
	return []agencymodels.DocumentHomeNode{
		deliver,
		homeEntry("mine", "My work", agencymodels.HomeTargetStart, ""),
		homeEntry("running", "Running", agencymodels.HomeTargetOngoing, ""),
		homeEntry("shared", "Files", homeFiles, ""),
	}
}

func TestAgencyHomeContract_RolesPageOfStepScopeWhereStartAndOngoingAreAnsweredAsPublished(t *testing.T) {
	w := newHomeWorld(t)
	declared := deliverHome(w, t, w.stepCodeOf(t, w.workflow))
	w.declare(t, w.draftID, declared...)
	w.publishDraft(t, w.draftID)

	items := w.homeFor(t, "test-owner")

	got, want := shapeOf(t, items, "target_name"), shapeOf(t, declared)
	if !reflect.DeepEqual(got, want) {
		gotJSON, _ := json.MarshalIndent(got, "", " ")
		wantJSON, _ := json.MarshalIndent(want, "", " ")
		t.Fatalf("the home answered is not the home published.\ngot:\n%s\nwant:\n%s", gotJSON, wantJSON)
	}
}

func TestAgencyHomeContract_TheHubLeavesRolesAndPermissionsToTheApp(t *testing.T) {
	w := newHomeWorld(t)
	declared := deliverHome(w, t, w.stepCodeOf(t, w.workflow))
	w.declare(t, w.draftID, declared...)
	w.publishDraft(t, w.draftID)
	bare, _ := w.resident(t, "Amina")

	asOwner := shapeOf(t, w.homeFor(t, "test-owner"))
	asBare := shapeOf(t, w.homeFor(t, bare))

	if !reflect.DeepEqual(asOwner, asBare) {
		t.Errorf("a resident with no role reads a different home from the owner: the hub filtered by roles or permission, which the app decides.\nowner %v\nresident %v", asOwner, asBare)
	}
}

func TestAgencyHomeContract_ARowPageAndItsRecordAndWorkflowEntriesAreDroppedOnlyWhenTheirTargetIsGone(t *testing.T) {
	w := newHomeWorld(t)
	step := w.stepCodeOf(t, w.workflow)
	goneRecord := homeEntry("gone-days", "Gone days", homeRecord, "RC-99")
	goneRecord.Target.Where = []agencymodels.HomeCondition{{Question: "Project", Operator: "is", Value: agencymodels.HomeValue{Row: "Project title"}}}
	goneReport := homeEntry("gone-report", "Gone report", homeWorkflow, "W-99")
	goneReport.Target.Step, goneReport.Target.Scope = "WI-99", agencymodels.HomeScopeRowOrder
	keptReport := homeEntry("kept-report", "Kept report", homeWorkflow, "W-1")
	keptReport.Target.Step, keptReport.Target.Scope = step, agencymodels.HomeScopeRowOrder
	page := homeSection("project-page", "Project", goneRecord, keptReport, goneReport, homeEntry("kept-days", "Kept days", homeRecord, w.rc(t, 2)))
	page.PageOf = w.rc(t, 1)
	w.declare(t, w.draftID, homeSection("deliver", "Deliver", homeEntry("projects", "Projects", homeRecord, w.rc(t, 1)), page))
	w.publishDraft(t, w.draftID)

	items := w.homeFor(t, "test-owner")

	node, found := nodeNamed(items, "project-page")
	if !found {
		t.Fatalf("the row page whose record is held was lost: %v", homeKeysOf(items))
	}
	if got, want := homeKeysOf(entriesOf(node)), []string{"kept-report", "kept-days"}; !slices.Equal(got, want) {
		t.Errorf("row page holds %v, want %v", got, want)
	}
	if pageOf := node["page_of"]; pageOf != w.rc(t, 1) {
		t.Errorf("page_of = %#v, want the record key kept as published", pageOf)
	}
}

func TestAgencyHomeContract_AWorkflowNodeWithAStepStillCarriesATargetName(t *testing.T) {
	w := newHomeWorld(t)
	step := w.stepCodeOf(t, w.workflow)
	report := homeEntry("report", "Report", homeWorkflow, "W-1")
	report.Target.Step = step
	w.declare(t, w.draftID, report)
	w.publishDraft(t, w.draftID)

	node, found := nodeNamed(w.homeFor(t, "test-owner"), "report")

	if !found {
		t.Fatalf("the workflow node with a step is missing")
	}
	if name, _ := node["target_name"].(string); name == "" {
		t.Errorf("target_name = %#v, want the workflow's name or the step's title, joined by code", node["target_name"])
	}
	target, _ := node["target"].(map[string]any)
	if target["step"] != step {
		t.Errorf("target = %v, want step %s kept", target, step)
	}
}

type homeImportCase struct {
	name string
	home []map[string]any
}

func homeFile(home any) map[string]any {
	return map[string]any{
		"name":                "Orchard co-op",
		"agency":              map[string]any{"name": "Orchard co-op"},
		"roles":               []map[string]any{{"id": "r1", "code": "R-1", "name": "Picker"}},
		"goals":               []map[string]any{{"id": "g1", "code": "G-1", "title": "Every crate is counted"}},
		"objectives":          []map[string]any{{"id": "o1", "code": "O-1", "goal_id": "g1", "title": "Count each crate"}},
		"workflows":           []map[string]any{{"id": "w1", "code": "W-1", "name": "Crate count"}},
		"workflow_objectives": []map[string]any{{"workflow_id": "w1", "objective_id": "o1"}},
		"work_items": []map[string]any{{
			"id": "s1", "code": "WI-1", "workflow_id": "w1", "title": "Count crates", "ordinality": 1, "kind": "fill_form", "role_id": "r1", "form_name": "Crates",
			"questions": []map[string]any{{"prompt": "Crates", "answer_type": "number", "required": true}},
		}},
		"records": []map[string]any{{
			"id": "c1", "code": "crates", "workflow_id": "w1", "name": "Crates", "role_id": "r1", "form_name": "Crates",
			"questions": []map[string]any{{"prompt": "Crates", "answer_type": "number", "required": true}},
		}},
		"home": home,
	}
}

func node(key string, extra map[string]any) map[string]any {
	out := map[string]any{"key": key, "title": strings.ToUpper(key[:1]) + key[1:]}
	for field, value := range extra {
		out[field] = value
	}
	return out
}

func target(kind, ref string, extra map[string]any) map[string]any {
	out := map[string]any{"type": kind}
	if ref != "" {
		out["ref"] = ref
	}
	for field, value := range extra {
		out[field] = value
	}
	return out
}

func deepChain(levels int) []map[string]any {
	inner := node("leaf", map[string]any{"target": target("files", "", nil)})
	for level := levels - 1; level >= 1; level-- {
		inner = node(fmt.Sprintf("level-%d", level), map[string]any{"entries": []map[string]any{inner}})
	}
	return []map[string]any{inner}
}

func manyEntries(sections, perSection int) []map[string]any {
	var out []map[string]any
	for s := 0; s < sections; s++ {
		var entries []map[string]any
		for e := 0; e < perSection; e++ {
			entries = append(entries, node(fmt.Sprintf("entry-%d-%d", s, e), map[string]any{"target": target("files", "", nil)}))
		}
		out = append(out, node(fmt.Sprintf("section-%d", s), map[string]any{"entries": entries}))
	}
	return out
}

func brokenHomes() []homeImportCase {
	return []homeImportCase{
		{"six levels deep", deepChain(6)},
		{"a section of forty-one nodes", manyEntries(1, 41)},
		{"more than three hundred nodes in all", manyEntries(10, 30)},
		{"a key used twice", []map[string]any{node("same", map[string]any{"target": target("files", "", nil)}), node("same", map[string]any{"target": target("files", "", nil)})}},
		{"a node with both entries and target", []map[string]any{node("both", map[string]any{"target": target("files", "", nil), "entries": []map[string]any{node("inner", map[string]any{"target": target("files", "", nil)})}})}},
		{"an unknown target type", []map[string]any{node("odd", map[string]any{"target": target("calendar", "x", nil)})}},
		{"a target with no ref", []map[string]any{node("bare", map[string]any{"target": target("record", "", nil)})}},
		{"a permission outside the catalogue", []map[string]any{node("gated", map[string]any{"permission": "no.such.permission", "target": target("files", "", nil)})}},
		{"a role the file does not hold", []map[string]any{node("gated", map[string]any{"roles": []string{"R-9"}, "target": target("files", "", nil)})}},
		{"a step on a record target", []map[string]any{node("stepped", map[string]any{"target": target("record", "crates", map[string]any{"step": "WI-1"})})}},
		{"a where on a workflow target", []map[string]any{node("narrowed", map[string]any{"target": target("workflow", "W-1", map[string]any{"where": []map[string]any{{"question": "Crates", "operator": "is", "value": "1"}}})})}},
		{"a scope outside a row page", []map[string]any{node("scoped", map[string]any{"target": target("workflow", "W-1", map[string]any{"step": "WI-1", "scope": "row.order"})})}},
		{"a row placeholder outside a row page", []map[string]any{node("placed", map[string]any{"target": target("record", "crates", map[string]any{"where": []map[string]any{{"question": "Crates", "operator": "is", "value": map[string]any{"row": "Crates"}}}})})}},
		{"page_of on an entry", []map[string]any{node("paged", map[string]any{"page_of": "crates", "target": target("files", "", nil)})}},
		{"two row pages for one record", []map[string]any{node("first", map[string]any{"page_of": "crates", "entries": []map[string]any{}}), node("second", map[string]any{"page_of": "crates", "entries": []map[string]any{}})}},
		{"a blank translation", []map[string]any{node("blank", map[string]any{"titles": map[string]string{"sw": " "}, "target": target("files", "", nil)})}},
		{"a where with an operator that is not one of the seven", []map[string]any{node("page", map[string]any{"page_of": "crates", "entries": []map[string]any{node("rows", map[string]any{"target": target("record", "crates", map[string]any{"where": []map[string]any{{"question": "Crates", "operator": "resembles", "value": "1"}}})})}})}},
		{"a menu target that is not section/item", []map[string]any{node("menu", map[string]any{"target": target("menu", "Businesses", nil)})}},
		{"a ref on a files target", []map[string]any{node("files", map[string]any{"target": target("files", "x", nil)})}},
	}
}

func TestAgencyHomeContract_AnImportWithABrokenHomeIsRefusedWholeBeforeAnythingIsWritten(t *testing.T) {
	w := newStepRunWalk(t, nil)
	owner := func() int {
		held, err := w.deps.Registry.MembershipsFor(context.Background(), "test-owner")
		if err != nil {
			t.Fatalf("MembershipsFor: %v", err)
		}
		return len(held)
	}
	before := owner()
	valid := w.call(t, "POST", "/instances/import", homeFile([]map[string]any{node("files", map[string]any{"target": target("files", "", nil)})}), w.owner)
	if valid.Code != http.StatusCreated {
		t.Fatalf("control: a file with a valid home: %d %s", valid.Code, valid.Body.String())
	}
	before++
	if got := owner(); got != before {
		t.Fatalf("control: the owner holds %d agencies after one import, want %d", got, before)
	}
	for _, c := range brokenHomes() {
		t.Run(c.name, func(t *testing.T) {
			held := owner()
			rec := w.call(t, "POST", "/instances/import", homeFile(c.home), w.owner)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("import answered %d %s, want 400", rec.Code, rec.Body.String())
			}
			if got := owner(); got != held {
				t.Errorf("a refused import left %d agencies behind", got-held)
			}
		})
	}
}

func TestAgencyHomeContract_AnImportKeepsTheRolesOfTheFileItNamesAndServesTheWholeHome(t *testing.T) {
	w := newStepRunWalk(t, nil)
	home := []map[string]any{
		node("deliver", map[string]any{"icon": "folder", "titles": map[string]string{"sw": "Kazi"}, "entries": []map[string]any{
			node("projects", map[string]any{"roles": []string{"R-1"}, "target": target("record", "crates", nil)}),
			node("project-page", map[string]any{"page_of": "crates", "entries": []map[string]any{
				node("days", map[string]any{"target": target("record", "crates", map[string]any{"where": []map[string]any{{"question": "Crates", "operator": "is", "value": map[string]any{"row": "Crates"}}}})}),
				node("report", map[string]any{"target": target("workflow", "W-1", map[string]any{"step": "WI-1", "scope": "row.order"})}),
			}}),
		}}),
		node("mine", map[string]any{"target": target("start", "", nil)}),
		node("running", map[string]any{"target": target("ongoing", "", nil)}),
	}
	rec := w.call(t, "POST", "/instances/import", homeFile(home), w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("import: %d %s", rec.Code, rec.Body.String())
	}
	var result importResult
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode import result: %v", err)
	}
	if len(result.Errors) > 0 {
		t.Fatalf("the import reported %d errors: %q", len(result.Errors), result.Errors)
	}
	published := w.call(t, "POST", "/instances/"+result.Instance.ID+"/publications", map[string]any{"draft_id": result.DraftID}, w.owner)
	if published.Code != http.StatusCreated {
		t.Fatalf("publish the imported draft: %d %s", published.Code, published.Body.String())
	}

	out := groupRoleWalk{stepRunWalk: w, groups: map[string]string{}}.callTool(t, "test-owner", homeContractTool, map[string]any{"instance_id": result.Instance.ID})

	got, want := shapeOf(t, homeItems(t, out), "target_name"), rekeyed(shapeOf(t, home), "crates", w.importedRecordKey(t, result.Instance.ID, result.DraftID, "Crates"))
	if !reflect.DeepEqual(got, want) {
		gotJSON, _ := json.MarshalIndent(got, "", " ")
		wantJSON, _ := json.MarshalIndent(want, "", " ")
		t.Fatalf("the imported file's home is not the home served.\ngot:\n%s\nwant:\n%s", gotJSON, wantJSON)
	}
}
