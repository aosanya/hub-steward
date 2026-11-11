package http

import (
	"context"
	"net/http"
	"sort"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

const runEngineOwner = "test-owner"

func runEngineWalk(t *testing.T) stepRunWalk {
	t.Helper()
	w := referral(t)
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	mods, err := mgr.ListModules(ctx, w.draftID, mwanachamaagency.ModuleFilter{})
	if err != nil {
		t.Fatalf("ListModules: %v", err)
	}
	for _, m := range mods {
		if m.Code == "taskmanager" {
			if _, err := mgr.SetModuleEnabled(ctx, w.draftID, m.ID, true); err != nil {
				t.Fatalf("SetModuleEnabled: %v", err)
			}
		}
	}
	w.publish(t)
	agencyMountedSets.forget(w.instance)
	return w
}

func (w stepRunWalk) ownerTakesRole(t *testing.T, role string) {
	t.Helper()
	ctx := context.Background()
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	actor, err := um.EnsureActor(ctx, runEngineOwner)
	if err != nil {
		t.Fatalf("EnsureActor: %v", err)
	}
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	published, err := mgr.GetRole(ctx, w.roles[role])
	if err != nil {
		t.Fatalf("GetRole: %v", err)
	}
	kind, err := um.RoleKindForDefinitionRole(ctx, definitionRoleID(agencymodels.DocumentRole{ID: published.ID, Code: published.Code}))
	if err != nil {
		t.Fatalf("RoleKindForDefinitionRole %s: %v", role, err)
	}
	groups, err := um.ListGroups(ctx, "")
	if err != nil || len(groups) == 0 {
		t.Fatalf("ListGroups: %v %d", err, len(groups))
	}
	if _, err := um.GrantRole(ctx, mwanachamaactor.ActorRoleAssignment{ActorID: actor.ID, GroupID: groups[0].ID, KindID: kind.ID}); err != nil {
		t.Fatalf("GrantRole: %v", err)
	}
}

type publishedReferral struct {
	version  int
	workflow string
	steps    []string
}

func publishedReferralOf(t *testing.T, w stepRunWalk) publishedReferral {
	t.Helper()
	mgr, err := w.deps.Registry.AgencyManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	publication, err := mgr.GetPublicationForChannel(context.Background(), "")
	if err != nil {
		t.Fatalf("GetPublicationForChannel: %v", err)
	}
	items := append([]agencymodels.DocumentWorkItem(nil), publication.Document.WorkItems...)
	sort.SliceStable(items, func(i, j int) bool { return items[i].Ordinality < items[j].Ordinality })
	out := publishedReferral{version: publication.Version, workflow: publication.Document.Workflows[0].Code}
	for _, item := range items {
		out.steps = append(out.steps, item.Code)
	}
	if out.workflow == "" || len(out.steps) != 3 {
		t.Fatalf("published referral has workflow %q and steps %v", out.workflow, out.steps)
	}
	return out
}

func (w stepRunWalk) startRun(t *testing.T, as *http.Cookie, code string, version int) (int, string) {
	t.Helper()
	rec := w.call(t, "POST", "/instances/"+w.instance+"/taskmanager/workflow-runs/start", map[string]any{"workflow_code": code, "workflow_version": version}, as)
	if rec.Code != http.StatusCreated {
		return rec.Code, ""
	}
	id, _ := decodeObject(t, rec)["id"].(string)
	return rec.Code, id
}

func (w stepRunWalk) beginStep(t *testing.T, as *http.Cookie, run string, body map[string]any) int {
	t.Helper()
	return w.call(t, "POST", "/instances/"+w.instance+"/taskmanager/workflow-runs/"+run+"/step", body, as).Code
}

func TestRunEngine_OwnerCannotStartAWorkflowOrVersionThatIsNotPublished(t *testing.T) {
	w := runEngineWalk(t)
	published := publishedReferralOf(t, w)

	if code, _ := w.startRun(t, w.owner, "W-999", 99); code < 400 || code >= 500 {
		t.Fatalf("owner starts a run of a workflow that does not exist: %d, want 4xx", code)
	}
	if code, _ := w.startRun(t, w.owner, published.workflow, published.version+41); code < 400 || code >= 500 {
		t.Fatalf("owner starts a run of a version that is not published: %d, want 4xx", code)
	}
	if code, _ := w.startRun(t, w.owner, published.workflow, published.version); code != http.StatusCreated {
		t.Fatalf("owner starts a run of the published workflow and version: %d, want 201", code)
	}
}

func TestRunEngine_StepsFollowThePublishedWorkflowInOrder(t *testing.T) {
	w := runEngineWalk(t)
	published := publishedReferralOf(t, w)
	for _, role := range []string{"Volunteer", "Liaison", "Coordinator"} {
		w.ownerTakesRole(t, role)
	}

	_, run := w.startRun(t, w.owner, published.workflow, published.version)
	if run == "" {
		t.Fatal("the run did not start")
	}

	if got := w.beginStep(t, w.owner, run, map[string]any{"step_code": "ZZZ-999"}); got != http.StatusConflict {
		t.Fatalf("a step that belongs to no workflow: %d, want 409", got)
	}
	if got := w.beginStep(t, w.owner, run, map[string]any{"step_code": published.steps[2]}); got != http.StatusConflict {
		t.Fatalf("a jump straight to the last step: %d, want 409", got)
	}
	if got := w.beginStep(t, w.owner, run, map[string]any{"step_code": published.steps[0], "limit_minutes": 5, "cancel_workflow_code": "W-NOPE-777"}); got != http.StatusBadRequest {
		t.Fatalf("a cancel workflow that does not exist: %d, want 400", got)
	}
	if got := w.beginStep(t, w.owner, run, map[string]any{"step_code": published.steps[0]}); got != http.StatusOK {
		t.Fatalf("the first step: %d, want 200", got)
	}
	if got := w.beginStep(t, w.owner, run, map[string]any{"step_code": published.steps[0]}); got != http.StatusConflict {
		t.Fatalf("the first step again: %d, want 409", got)
	}
	if got := w.beginStep(t, w.owner, run, map[string]any{"step_code": published.steps[2]}); got != http.StatusConflict {
		t.Fatalf("skipping the second step: %d, want 409", got)
	}
	if got := w.beginStep(t, w.owner, run, map[string]any{"step_code": published.steps[1]}); got != http.StatusOK {
		t.Fatalf("the second step: %d, want 200", got)
	}
	if got := w.beginStep(t, w.owner, run, map[string]any{"step_code": published.steps[2]}); got != http.StatusOK {
		t.Fatalf("the third step: %d, want 200", got)
	}
}

func TestRunEngine_OwnerCannotDriveAStepWhoseRoleSheDoesNotHold(t *testing.T) {
	w := runEngineWalk(t)
	published := publishedReferralOf(t, w)

	_, run := w.startRun(t, w.owner, published.workflow, published.version)
	if run == "" {
		t.Fatal("the run did not start")
	}

	if got := w.beginStep(t, w.owner, run, map[string]any{"step_code": published.steps[0]}); got != http.StatusForbidden {
		t.Fatalf("the owner drives a step whose role she does not hold: %d, want 403", got)
	}
	w.ownerTakesRole(t, "Volunteer")
	if got := w.beginStep(t, w.owner, run, map[string]any{"step_code": published.steps[0]}); got != http.StatusOK {
		t.Fatalf("the first step once she holds its role: %d, want 200", got)
	}
	if got := w.beginStep(t, w.owner, run, map[string]any{"step_code": published.steps[1]}); got != http.StatusForbidden {
		t.Fatalf("the second step while she holds only the first role: %d, want 403", got)
	}
	w.ownerTakesRole(t, "Liaison")
	if got := w.beginStep(t, w.owner, run, map[string]any{"step_code": published.steps[1]}); got != http.StatusOK {
		t.Fatalf("the second step once she holds its role: %d, want 200", got)
	}
}
