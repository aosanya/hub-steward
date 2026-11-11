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

	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
	mwanachamainsights "wakalaserver/modules/insights"

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
	db       *gorm.DB
}

func (w stepRunWalk) call(t *testing.T, method, path string, body any, as *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
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
	w.handler.ServeHTTP(rec, req)
	return rec
}

func (w stepRunWalk) cookieFor(t *testing.T, subject string) *http.Cookie {
	t.Helper()
	s, err := w.deps.Sessions.Mint(context.Background(), subject, time.Hour)
	if err != nil {
		t.Fatalf("mint session for %s: %v", subject, err)
	}
	return &http.Cookie{Name: sessionCookieName, Value: s.Token}
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
	questions         []agencymodels.StepQuestion
}

func newStepRunWalk(t *testing.T, plan []stepSpec, people ...string) stepRunWalk {
	t.Helper()
	db := stepRunDB(t)
	reg, err := agencies.NewRegistry(db, agencies.StartingApproved())
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
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
	deps := &Deps{Registry: reg, Insights: insights, Sessions: session.NewHMACManager([]byte("test-secret"), nil, nil), AdminToken: "test-admin-token"}
	ApplyCaches(deps)
	w := stepRunWalk{handler: NewRouter(deps), deps: deps, roles: map[string]string{}, steps: map[string]string{}, people: map[string]*http.Cookie{}, db: db}
	w.owner = w.cookieFor(t, "test-owner")

	rec := w.call(t, "POST", "/instances", map[string]any{"name": "Health program"}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create instance: %d %s", rec.Code, rec.Body.String())
	}
	w.instance, _ = decodeObject(t, rec)["id"].(string)

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
		workflow, err := mgr.CreateWorkflow(ctx, agencymodels.Workflow{DraftID: draft.ID, Name: "Case referral"})
		if err != nil {
			t.Fatalf("CreateWorkflow: %v", err)
		}
		w.workflow = workflow.ID
		if _, err := mgr.CreateWorkflowObjective(ctx, agencymodels.WorkflowObjective{DraftID: draft.ID, WorkflowID: workflow.ID, ObjectiveID: objective.ID}); err != nil {
			t.Fatalf("CreateWorkflowObjective: %v", err)
		}
		for i, s := range plan {
			if _, ok := w.roles[s.role]; !ok {
				role, err := mgr.CreateRole(ctx, agencymodels.Role{DraftID: draft.ID, Name: s.role})
				if err != nil {
					t.Fatalf("CreateRole %s: %v", s.role, err)
				}
				w.roles[s.role] = role.ID
			}
			step, err := mgr.CreateWorkItem(ctx, agencymodels.WorkItem{
				DraftID: draft.ID, WorkflowID: workflow.ID, Title: s.title, Ordinality: i + 1,
				Kind: agencymodels.StepKindFillForm, RoleID: w.roles[s.role], FormName: s.form, Questions: s.questions,
			})
			if err != nil {
				t.Fatalf("CreateWorkItem %s: %v", s.title, err)
			}
			w.steps[s.title] = step.ID
		}
		w.publish(t)

	}

	group := w.call(t, "POST", "/instances/"+w.instance+"/actor/groups", map[string]any{"name": "Staff"}, w.owner)
	if group.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", group.Code, group.Body.String())
	}
	groupID, _ := decodeObject(t, group)["id"].(string)
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
	return w.cookieFor(t, actor.ID)
}

func (w stepRunWalk) available(t *testing.T, as *http.Cookie) []map[string]any {
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
