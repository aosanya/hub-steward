package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
	mwanachamaaudit "github.com/aosanya/mwanachama-backend-audit"
	mwanachamacouncil "github.com/aosanya/mwanachama-backend-council"
	mwanachamainsights "github.com/aosanya/mwanachama-backend-insights"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/session"
)

var stepRunDatabases atomic.Int64

func stepRunDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:wakala_step_runs_%d?mode=memory&cache=shared", stepRunDatabases.Add(1))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	return db
}

type stepRunWalk struct {
	handler  http.Handler
	deps     *Deps
	owner    *http.Cookie
	instance string
	draftID  string
	roles    map[string]string
	steps    map[string]string
	workflow string
	people   map[string]*http.Cookie
	subjects map[string]string
	db       *gorm.DB
}

func (w stepRunWalk) call(t *testing.T, method, path string, body any, as *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	return callOn(w.handler, method, path, body, as)
}

func callOn(handler http.Handler, method, path string, body any, as *http.Cookie) *httptest.ResponseRecorder {
	var reader *bytes.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			panic(err)
		}
		reader = bytes.NewReader(b)
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.AddCookie(as)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func (w stepRunWalk) cookieFor(t *testing.T, subject string) *http.Cookie {
	t.Helper()
	s, err := w.deps.Sessions.Mint(context.Background(), subject, time.Hour)
	if err != nil {
		t.Fatalf("mint session for %s: %v", subject, err)
	}
	as := &http.Cookie{Name: sessionCookieName, Value: s.Token}
	w.remember(as, subject)
	if group := w.homeOf(subject); group != "" {
		w.assumeDirectly(t, as, subject, group)
	}
	return as
}

func decodeObject(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode %q: %v", rec.Body.String(), err)
	}
	return out
}

func decodeObjects(t *testing.T, rec *httptest.ResponseRecorder) []map[string]any {
	t.Helper()
	var out []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode %q: %v", rec.Body.String(), err)
	}
	return out
}

type stepSpec struct {
	title, form, role string
	code              string
	description       string
	prompt            string
	questions         []agencymodels.StepQuestion
	kind              agencymodels.StepKind
	fork              *forkSpec
	approvesAbove     bool
	sendBackDecision  string
	sendBackReason    string
}

type forkSpec struct {
	sentTitle     string
	question      string
	cases         map[string]string
	caseOrder     []string
	otherwiseStep string
}

func newStepRunWalk(t *testing.T, plan []stepSpec, people ...string) stepRunWalk {
	t.Helper()
	return newStepRunWalkOn(t, stepRunDB(t), plan, people...)
}

func stepRunDeps(t *testing.T, db *gorm.DB, options ...agencies.Option) (*Deps, agencies.Registry) {
	t.Helper()
	var counted agencies.Registry
	options = append(options, agencies.WithTagRowCounter(TagRowCounter(func() agencies.Registry { return counted })))
	reg, err := agencies.NewRegistry(db, options...)
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	counted = reg
	insightSpec, err := mwanachamainsights.SpecFor("test")
	if err != nil {
		t.Fatalf("insights SpecFor: %v", err)
	}
	if err := mwanachamainsights.Provision(db, insightSpec); err != nil {
		t.Fatalf("insights Provision: %v", err)
	}
	insights, err := mwanachamainsights.NewInsightManager(db, insightSpec)
	if err != nil {
		t.Fatalf("NewInsightManager: %v", err)
	}
	auditSpec, err := mwanachamaaudit.SpecFor("test")
	if err != nil {
		t.Fatalf("audit SpecFor: %v", err)
	}
	if err := mwanachamaaudit.Provision(db, auditSpec); err != nil {
		t.Fatalf("audit Provision: %v", err)
	}
	auditLog, err := mwanachamaaudit.NewAuditManager(db, auditSpec)
	if err != nil {
		t.Fatalf("NewAuditManager: %v", err)
	}
	councilSpec, err := mwanachamacouncil.SpecFor("test")
	if err != nil {
		t.Fatalf("council SpecFor: %v", err)
	}
	if err := mwanachamacouncil.Provision(db, councilSpec); err != nil {
		t.Fatalf("council Provision: %v", err)
	}
	council, err := mwanachamacouncil.NewCouncilManager(db, councilSpec)
	if err != nil {
		t.Fatalf("NewCouncilManager: %v", err)
	}
	deps := &Deps{Registry: reg, Insights: insights, Audit: auditLog, Council: council, Sessions: session.NewHMACManager([]byte("test-secret"), nil, nil), AdminToken: "test-admin-token"}
	ApplyCaches(deps)
	return deps, reg
}

func newStepRunWalkOn(t *testing.T, db *gorm.DB, plan []stepSpec, people ...string) stepRunWalk {
	t.Helper()
	return newStepRunWalkCoded(t, db, "", plan, people...)
}

func newStepRunWalkCoded(t *testing.T, db *gorm.DB, workflowCode string, plan []stepSpec, people ...string) stepRunWalk {
	t.Helper()
	deps, reg := stepRunDeps(t, db)
	w := stepRunWalk{handler: NewRouter(deps), deps: deps, roles: map[string]string{}, steps: map[string]string{}, people: map[string]*http.Cookie{}, subjects: map[string]string{}, db: db}
	w.owner = w.cookieFor(t, "test-owner")

	rec := w.call(t, "POST", "/instances", map[string]any{"name": "Health program"}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create instance: %d %s", rec.Code, rec.Body.String())
	}
	w.instance, _ = decodeObject(t, rec)["id"].(string)
	w.tagGroup(t, w.ownerAssumesItsFirstGroup(t))

	ctx := context.Background()
	mgr, err := reg.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	if _, err := mgr.GetAgency(ctx); err != nil {
		if _, err := mgr.CreateAgency(ctx, agencymodels.Agency{Name: "Health program"}); err != nil {
			t.Fatalf("CreateAgency: %v", err)
		}
	}
	if len(plan) > 0 {
		draft, err := mgr.CreateDraft(ctx, "form steps", "", "")
		if err != nil {
			t.Fatalf("CreateDraft: %v", err)
		}
		w.draftID = draft.ID
		goal, _ := mgr.CreateGoal(ctx, agencymodels.Goal{DraftID: draft.ID, Title: "Every referral arrives"})
		objective, _ := mgr.CreateObjective(ctx, agencymodels.Objective{DraftID: draft.ID, GoalID: goal.ID, Title: "Follow each referral"})
		workflowCtx := ctx
		if workflowCode != "" {
			workflowCtx = mwanachamaagency.WithKeptCode(ctx, workflowCode)
		}
		workflow, err := mgr.CreateWorkflow(workflowCtx, agencymodels.Workflow{DraftID: draft.ID, Name: "Case referral"})
		if err != nil {
			t.Fatalf("CreateWorkflow: %v", err)
		}
		w.workflow = workflow.ID
		if _, err := mgr.CreateWorkflowObjective(ctx, agencymodels.WorkflowObjective{DraftID: draft.ID, WorkflowID: workflow.ID, ObjectiveID: objective.ID}); err != nil {
			t.Fatalf("CreateWorkflowObjective: %v", err)
		}
		for i, s := range plan {
			if _, ok := w.roles[s.role]; !ok && s.role != "" {
				role, err := mgr.CreateRole(ctx, agencymodels.Role{DraftID: draft.ID, Name: s.role, ApprovesAboveLimit: s.approvesAbove})
				if err != nil {
					t.Fatalf("CreateRole %s: %v", s.role, err)
				}
				w.roles[s.role] = role.ID
			}
			item := agencymodels.WorkItem{
				DraftID: draft.ID, WorkflowID: workflow.ID, Title: s.title, Description: s.description, Prompt: s.prompt, Ordinality: i + 1,
				Kind: agencymodels.StepKindFillForm, RoleID: w.roles[s.role], FormName: s.form, Questions: s.questions,
				SendBackDecision: s.sendBackDecision, SendBackReason: s.sendBackReason,
			}
			if s.kind != "" {
				item.Kind = s.kind
			}
			if item.Kind.AgencyOnly() {
				item.RoleID = ""
			}
			if item.Kind == agencymodels.StepKindSendForm {
				item.RecipientRoleID = w.roles[s.role]
			}
			keptCtx := ctx
			if s.code != "" {
				keptCtx = mwanachamaagency.WithKeptCode(ctx, s.code)
			}
			step, err := mgr.CreateWorkItem(keptCtx, item)
			if err != nil {
				t.Fatalf("CreateWorkItem %s: %v", s.title, err)
			}
			w.steps[s.title] = step.ID
		}
		for _, s := range plan {
			if s.fork == nil {
				continue
			}
			route, err := mgr.GetWorkItem(ctx, w.steps[s.title])
			if err != nil {
				t.Fatalf("GetWorkItem %s: %v", s.title, err)
			}
			route.SentStepID = w.steps[s.fork.sentTitle]
			for _, answer := range s.fork.caseOrder {
				route.Routes = append(route.Routes, agencymodels.StepRoute{
					Match:    agencymodels.RouteMatchAll,
					Rules:    []agencymodels.RouteRule{{Question: s.fork.question, Operator: agencymodels.RouteIs, Value: answer}},
					GoToStep: w.steps[s.fork.cases[answer]],
				})
			}
			route.OtherwiseStepID = w.steps[s.fork.otherwiseStep]
			if _, err := mgr.UpdateWorkItem(ctx, route); err != nil {
				t.Fatalf("UpdateWorkItem %s: %v", s.title, err)
			}
		}
		w.publish(t)

	}

	group := w.call(t, "POST", "/instances/"+w.instance+"/actor/groups", map[string]any{"name": "Staff"}, w.owner)
	if group.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", group.Code, group.Body.String())
	}
	groupID, _ := decodeObject(t, group)["id"].(string)
	w.reachingEveryRow(t, groupID)
	w.assumeDirectly(t, w.owner, "test-owner", groupID)
	um, err := reg.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	for _, name := range people {
		w.people[name] = w.seat(t, mgr, um, groupID, name)
	}
	return w
}

func (w stepRunWalk) publish(t *testing.T) {
	t.Helper()
	rec := w.call(t, "POST", "/instances/"+w.instance+"/publications", map[string]any{"draft_id": w.draftID}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("publish: %d %s", rec.Code, rec.Body.String())
	}
}

func (w stepRunWalk) seat(t *testing.T, mgr mwanachamaagency.AgencyManager, um mwanachamaactor.UserManager, groupID, role string) *http.Cookie {
	t.Helper()
	ctx := context.Background()
	actor, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: role})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, actor.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	published, err := mgr.GetRole(ctx, w.roles[role])
	if err != nil {
		t.Fatalf("GetRole: %v", err)
	}
	kind, err := um.RoleKindForDefinitionRole(ctx, definitionRoleID(agencymodels.DocumentRole{ID: published.ID, Code: published.Code}))
	if err != nil {
		t.Fatalf("RoleKindForDefinitionRole %s: %v", role, err)
	}
	if _, err := um.GrantRole(ctx, mwanachamaactor.ActorRoleAssignment{ActorID: actor.ID, GroupID: groupID, KindID: kind.ID}); err != nil {
		t.Fatalf("GrantRole: %v", err)
	}
	w.subjects[role] = actor.ID
	return w.cookieAssuming(t, actor.ID, groupID)
}

func (w stepRunWalk) available(t *testing.T, as *http.Cookie) []map[string]any {
	t.Helper()
	designed := []map[string]any{}
	for _, item := range w.availableWithGenerated(t, as) {
		if item["generated"] != true {
			designed = append(designed, item)
		}
	}
	return designed
}

func (w stepRunWalk) availableWithGenerated(t *testing.T, as *http.Cookie) []map[string]any {
	t.Helper()
	rec := w.call(t, "GET", "/instances/"+w.instance+"/my-open-steps?available=true", nil, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("my-open-steps available: %d %s", rec.Code, rec.Body.String())
	}
	return decodeObjects(t, rec)
}

func (w stepRunWalk) submit(t *testing.T, as *http.Cookie, step string, answers map[string]string, orderID string) *httptest.ResponseRecorder {
	t.Helper()
	body := map[string]any{"answers": answers}
	if orderID != "" {
		body["order_id"] = orderID
	}
	return w.call(t, "POST", "/instances/"+w.instance+"/steps/"+w.steps[step]+"/answers", body, as)
}
