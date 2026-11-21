package http

import (
	"context"
	"encoding/json"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func homeOver(t *testing.T, w stepRunWalk, subject string) []homeNodeView {
	t.Helper()
	out := designAgentWalk{stepRunWalk: w}.mcpCall(t, subject, getHomeTool, map[string]any{"instance_id": w.instance})
	if out.IsError {
		t.Fatalf("%s: %s, want the Home", getHomeTool, toolErrorText(out))
	}
	encoded, err := json.Marshal(out.StructuredContent)
	if err != nil {
		t.Fatalf("structured content does not encode: %v", err)
	}
	var body agencyHomeView
	if err := json.Unmarshal(encoded, &body); err != nil {
		t.Fatalf("structured content %s does not carry entries: %v", encoded, err)
	}
	return body.Entries
}

func declareHome(t *testing.T, w stepRunWalk, nodes []agencymodels.DocumentHomeNode) {
	t.Helper()
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	var add func(parentID string, nodes []agencymodels.DocumentHomeNode)
	add = func(parentID string, nodes []agencymodels.DocumentHomeNode) {
		for _, node := range nodes {
			row := agencymodels.HomeEntryOfNode(node)
			row.DraftID, row.ParentID = w.draftID, parentID
			created, err := mgr.CreateHomeEntry(ctx, row)
			if err != nil {
				t.Fatalf("CreateHomeEntry %s: %v", node.Key, err)
			}
			add(created.ID, node.Entries)
		}
	}
	add("", nodes)
}

func workflowCodeNamed(t *testing.T, w stepRunWalk, name string) string {
	t.Helper()
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	workflows, err := mgr.ListWorkflows(ctx, w.draftID, mwanachamaagency.WorkflowFilter{})
	if err != nil {
		t.Fatalf("ListWorkflows: %v", err)
	}
	for _, workflow := range workflows {
		if workflow.Name == name {
			return workflow.Code
		}
	}
	t.Fatalf("no workflow named %q", name)
	return ""
}

func TestAgencyHome_AMemberReadsTheDeclaredHomeNestedInDeclaredOrder(t *testing.T) {
	b := businessRegister(t)
	declareHome(t, b.stepRunWalk, []agencymodels.DocumentHomeNode{
		{
			Key: "registers", Title: "Registers", Titles: map[string]string{"sw": "Rejista"}, Icon: "folder",
			Entries: []agencymodels.DocumentHomeNode{
				{
					Key: "trade", Title: "Trade",
					Entries: []agencymodels.DocumentHomeNode{
						{Key: "businesses", Title: "Businesses", Target: &agencymodels.HomeTarget{Type: agencymodels.HomeTargetRecord, Ref: b.register}},
						{Key: "group-order", Title: "Start a group order", Target: &agencymodels.HomeTarget{Type: agencymodels.HomeTargetWorkflow, Ref: workflowCodeNamed(t, b.stepRunWalk, "Group order")}},
					},
				},
				{Key: "shared", Title: "Files", Target: &agencymodels.HomeTarget{Type: agencymodels.HomeTargetFiles}},
			},
		},
		{Key: "work", Title: "Work", Permission: "mount.list", Target: &agencymodels.HomeTarget{Type: agencymodels.HomeTargetBacklog, Ref: "backlog"}},
	})
	b.publish(t)

	home := homeOver(t, b.stepRunWalk, b.alpha)

	if len(home) != 2 || home[0].Key != "registers" || home[1].Key != "work" {
		t.Fatalf("top = %+v, want registers then work", home)
	}
	registers := home[0]
	if registers.Titles["sw"] != "Rejista" || registers.Icon != "folder" || registers.Target != nil || len(registers.Entries) != 2 {
		t.Fatalf("registers = %+v, want a section with its translation and two rows", registers)
	}
	trade := registers.Entries[0]
	if trade.Key != "trade" || len(trade.Entries) != 2 || registers.Entries[1].Key != "shared" {
		t.Fatalf("inside registers = %+v, want trade then shared", registers.Entries)
	}
	if got := trade.Entries[0]; got.Target == nil || got.Target.Type != "record" || got.Target.Ref != b.register {
		t.Fatalf("businesses = %+v, want the record entry", got)
	}
	if got := trade.Entries[1]; got.Target == nil || got.Target.Type != "workflow" || got.TargetName != "Group order" {
		t.Fatalf("group order = %+v, want the workflow entry carrying the workflow's name", got)
	}
	if got := home[1]; got.Permission != "mount.list" || got.Target == nil || got.Target.Type != "backlog" || got.Target.Ref != "backlog" {
		t.Fatalf("work = %+v, want its permission and backlog target", got)
	}
}

func TestAgencyHome_ServesRolesPagesStepsConditionsAndScopesAsDeclared(t *testing.T) {
	b := businessRegister(t)
	code := workflowCodeNamed(t, b.stepRunWalk, "Group order")
	declareHome(t, b.stepRunWalk, []agencymodels.DocumentHomeNode{
		{
			Key: "page", Title: "Business", PageOf: b.register,
			Entries: []agencymodels.DocumentHomeNode{
				{Key: "contacts", Title: "Contacts", Roles: []string{"R-1"}, Target: &agencymodels.HomeTarget{
					Type: agencymodels.HomeTargetRecord, Ref: b.register,
					Where: []agencymodels.HomeCondition{{Question: "Business", Operator: "is", Value: agencymodels.HomeValue{Row: "Business"}}},
				}},
				{Key: "tell", Title: "Tell the group", Target: &agencymodels.HomeTarget{Type: agencymodels.HomeTargetWorkflow, Ref: code, Step: stepCodeNamed(t, b.stepRunWalk, "Tell the group"), Scope: agencymodels.HomeScopeRowOrder}},
				{Key: "gone-step", Title: "Gone step", Target: &agencymodels.HomeTarget{Type: agencymodels.HomeTargetWorkflow, Ref: code, Step: "WI-404", Scope: agencymodels.HomeScopeRowOrder}},
			},
		},
		{Key: "mine", Title: "My work", Target: &agencymodels.HomeTarget{Type: agencymodels.HomeTargetStart}},
	})
	b.publish(t)

	home := homeOver(t, b.stepRunWalk, b.alpha)

	if len(home) != 2 || home[0].PageOf != b.register || len(home[0].Entries) != 2 || home[1].Target == nil || home[1].Target.Type != "start" {
		t.Fatalf("home = %+v, want the row page with its two kept entries, then Start", home)
	}
	contacts := home[0].Entries[0]
	if len(contacts.Roles) != 1 || contacts.Roles[0] != "R-1" || contacts.Target == nil || len(contacts.Target.Where) != 1 || contacts.Target.Where[0].Value.Row != "Business" {
		t.Fatalf("contacts = %+v, want its roles and its tapped-row condition", contacts)
	}
	tell := home[0].Entries[1]
	if tell.Target == nil || tell.Target.Step == "" || tell.StepID == "" || tell.WorkflowID == "" || tell.Target.Scope != "row.order" {
		t.Fatalf("tell = %+v, want the step code, its id, the workflow id and the scope", tell)
	}
}

func stepCodeNamed(t *testing.T, w stepRunWalk, title string) string {
	t.Helper()
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	steps, err := mgr.ListWorkItems(ctx, w.draftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		t.Fatalf("ListWorkItems: %v", err)
	}
	for _, step := range steps {
		if step.Title == title {
			return step.Code
		}
	}
	t.Fatalf("no step titled %q", title)
	return ""
}

func TestAgencyHome_ARecordOrWorkflowThePublishedVersionDoesNotHoldIsLeftOut(t *testing.T) {
	b := businessRegister(t)
	declareHome(t, b.stepRunWalk, []agencymodels.DocumentHomeNode{
		{Key: "gone-record", Title: "Gone record", Target: &agencymodels.HomeTarget{Type: agencymodels.HomeTargetRecord, Ref: "RC-404"}},
		{Key: "gone-workflow", Title: "Gone workflow", Target: &agencymodels.HomeTarget{Type: agencymodels.HomeTargetWorkflow, Ref: "W-404"}},
		{Key: "kept", Title: "Businesses", Target: &agencymodels.HomeTarget{Type: agencymodels.HomeTargetRecord, Ref: b.register}},
	})
	b.publish(t)

	home := homeOver(t, b.stepRunWalk, b.alpha)

	if len(home) != 1 || home[0].Key != "kept" {
		t.Fatalf("home = %+v, want only the entry whose record the published version holds", home)
	}
}

func TestAgencyHome_AnAgencyThatDeclaresNothingGetsAnEmptyList(t *testing.T) {
	b := businessRegister(t)

	if home := homeOver(t, b.stepRunWalk, b.alpha); home == nil || len(home) != 0 {
		t.Fatalf("home = %#v, want an empty list", home)
	}
}

func TestAgencyHome_AnAgencyWithNoPublishedVersionGetsAnEmptyList(t *testing.T) {
	w := newStepRunWalk(t, nil)

	if home := homeOver(t, w, "test-owner"); home == nil || len(home) != 0 {
		t.Fatalf("home = %#v, want an empty list", home)
	}
}

func TestAgencyHome_OnlyThePublishedVersionIsServed(t *testing.T) {
	b := businessRegister(t)
	declareHome(t, b.stepRunWalk, []agencymodels.DocumentHomeNode{
		{Key: "shared", Title: "Files", Target: &agencymodels.HomeTarget{Type: agencymodels.HomeTargetFiles}},
	})

	if home := homeOver(t, b.stepRunWalk, b.alpha); len(home) != 0 {
		t.Fatalf("home = %+v, want nothing before the draft is published", home)
	}
	b.publish(t)
	if home := homeOver(t, b.stepRunWalk, b.alpha); len(home) != 1 || home[0].Key != "shared" {
		t.Fatalf("home = %+v, want the row once it is published", home)
	}
}

func TestImportInstance_KeepsTheHomeOfTheFileAndRefusesABrokenOne(t *testing.T) {
	w := newStepRunWalk(t, nil)
	good := map[string]any{
		"name": "Farms",
		"home": []map[string]any{{"key": "registers", "title": "Registers", "entries": []map[string]any{
			{"key": "shared", "title": "Files", "target": map[string]any{"type": "files"}},
		}}},
	}
	rec := w.call(t, "POST", "/instances/import", good, w.owner)
	if rec.Code != 201 {
		t.Fatalf("import: %d %s", rec.Code, rec.Body.String())
	}
	var res importResult
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if res.Created["home_entries"] != 2 || len(res.Errors) != 0 {
		t.Fatalf("result = %+v, want the two home rows made", res)
	}
	mgr, err := w.deps.Registry.AgencyManager(context.Background(), res.Instance.ID)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	rows, err := mgr.ListHomeEntries(context.Background(), res.DraftID)
	if err != nil || len(agencymodels.NestHomeEntries(rows)) != 1 || len(rows) != 2 {
		t.Fatalf("rows = %+v, %v, want the nested declaration kept", rows, err)
	}

	broken := map[string]map[string]any{
		"a repeated key":                {"name": "Farms again", "home": []map[string]any{{"key": "a", "title": "A"}, {"key": "a", "title": "B"}}},
		"a role the file does not hold": {"name": "Farms again", "home": []map[string]any{{"key": "a", "title": "A", "roles": []string{"R-9"}}}},
	}
	for name, file := range broken {
		if rec := w.call(t, "POST", "/instances/import", file, w.owner); rec.Code != 400 {
			t.Fatalf("import with %s: %d %s, want 400", name, rec.Code, rec.Body.String())
		}
	}
	held := map[string]any{"name": "Farms held", "roles": []map[string]any{{"id": "r1", "code": "R-1", "name": "Director"}}, "home": []map[string]any{{"key": "a", "title": "A", "roles": []string{"R-1"}}}}
	if rec := w.call(t, "POST", "/instances/import", held, w.owner); rec.Code != 201 {
		t.Fatalf("import with a role the file holds: %d %s, want 201", rec.Code, rec.Body.String())
	}
}

func TestAgencyHome_ASectionEmptiedByDroppedTargetsAndAPageWhoseRecordIsGoneAreLeftOut(t *testing.T) {
	b := businessRegister(t)
	declareHome(t, b.stepRunWalk, []agencymodels.DocumentHomeNode{
		{Key: "emptied", Title: "Emptied", Entries: []agencymodels.DocumentHomeNode{
			{Key: "gone", Title: "Gone", Target: &agencymodels.HomeTarget{Type: agencymodels.HomeTargetRecord, Ref: "RC-404"}},
		}},
		{Key: "gone-page", Title: "Gone page", PageOf: "RC-404", Entries: []agencymodels.DocumentHomeNode{
			{Key: "files", Title: "Files", Target: &agencymodels.HomeTarget{Type: agencymodels.HomeTargetFiles}},
		}},
		{Key: "kept", Title: "Kept", Entries: []agencymodels.DocumentHomeNode{
			{Key: "shared", Title: "Files", Target: &agencymodels.HomeTarget{Type: agencymodels.HomeTargetFiles}},
		}},
	})
	b.publish(t)

	home := homeOver(t, b.stepRunWalk, b.alpha)

	if len(home) != 1 || home[0].Key != "kept" {
		t.Fatalf("home = %+v, want only the section that still has an entry", home)
	}
}
