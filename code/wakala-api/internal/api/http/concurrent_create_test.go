package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

const concurrentCreateRounds = 12

type concurrentCreateWorld struct {
	t        *testing.T
	walk     stepRunWalk
	instance string
}

func (w concurrentCreateWorld) send(method, path string, body any) *httptest.ResponseRecorder {
	return callOn(w.walk.handler, method, strings.ReplaceAll(path, "{instanceID}", w.instance), body, w.walk.owner)
}

func (w concurrentCreateWorld) made(path string, body any) map[string]any {
	w.t.Helper()
	rec := w.send("POST", path, body)
	if rec.Code < 200 || rec.Code > 299 {
		w.t.Fatalf("setup %s: %d %s", path, rec.Code, rec.Body.String())
	}
	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return out
}

func (w concurrentCreateWorld) idOf(path string, body any) string {
	w.t.Helper()
	id, _ := w.made(path, body)["id"].(string)
	if id == "" {
		w.t.Fatalf("setup %s: no id", path)
	}
	return id
}

func (w concurrentCreateWorld) rows(path string) int {
	rec := w.send("GET", path, nil)
	if rec.Code != http.StatusOK {
		return -1
	}
	var list []json.RawMessage
	if json.Unmarshal(rec.Body.Bytes(), &list) == nil {
		return len(list)
	}
	var object map[string]json.RawMessage
	if json.Unmarshal(rec.Body.Bytes(), &object) == nil {
		for _, raw := range object {
			if json.Unmarshal(raw, &list) == nil {
				return len(list)
			}
		}
	}
	return -1
}

type concurrentCreateCreate struct {
	post func(round int) (path string, body any)
	list string
}

type concurrentCreateCase struct {
	name  string
	build func(w concurrentCreateWorld) concurrentCreateCreate
}

type concurrentCreateOutcome struct {
	codes []int
	text  []string
}

func (o concurrentCreateOutcome) successes() int {
	n := 0
	for _, c := range o.codes {
		if c >= 200 && c < 300 {
			n++
		}
	}
	return n
}

func (o concurrentCreateOutcome) serverFault() bool {
	for _, c := range o.codes {
		if c >= 500 {
			return true
		}
	}
	return false
}

func newConcurrentCreateWorld(t *testing.T) concurrentCreateWorld {
	t.Helper()
	walk := newStepRunWalkOn(t, openSharedFile(t, filepath.Join(t.TempDir(), "wakala.db")), nil)
	return concurrentCreateWorld{t: t, walk: walk, instance: walk.instance}
}

func (w concurrentCreateWorld) twice(path string, body any, together bool) concurrentCreateOutcome {
	results := make([]*httptest.ResponseRecorder, 2)
	if together {
		start := make(chan struct{})
		var wg sync.WaitGroup
		for i := range results {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				<-start
				results[i] = w.send("POST", path, body)
			}(i)
		}
		close(start)
		wg.Wait()
	} else {
		for i := range results {
			results[i] = w.send("POST", path, body)
		}
	}
	var out concurrentCreateOutcome
	for _, rec := range results {
		out.codes = append(out.codes, rec.Code)
		out.text = append(out.text, concurrentCreateShort(rec.Body.String()))
	}
	return out
}

type concurrentCreateVerdict struct {
	name    string
	rounds  int
	defects []string
	shape   map[string]int
	sample  []string
}

func concurrentCreateProbe(t *testing.T, c concurrentCreateCase) concurrentCreateVerdict {
	t.Helper()
	together := newConcurrentCreateWorld(t)
	alone := newConcurrentCreateWorld(t)

	verdict := concurrentCreateVerdict{name: c.name, shape: map[string]int{}}
	createTogether := c.build(together)
	createAlone := c.build(alone)
	for round := 0; round < concurrentCreateRounds; round++ {
		pathT, bodyT := createTogether.post(round)
		pathA, bodyA := createAlone.post(round)
		beforeT, beforeA := -1, -1
		if createTogether.list != "" {
			beforeT, beforeA = together.rows(createTogether.list), alone.rows(createAlone.list)
		}
		gotT := together.twice(pathT, bodyT, true)
		gotA := alone.twice(pathA, bodyA, false)
		verdict.rounds++
		verdict.shape[fmt.Sprint(gotT.codes)]++
		if round == 0 {
			verdict.sample = gotT.text
		}
		if gotT.serverFault() {
			verdict.defects = append(verdict.defects, fmt.Sprintf("round %d: together %v %q", round, gotT.codes, gotT.text))
			continue
		}
		if gotT.successes() > gotA.successes() {
			verdict.defects = append(verdict.defects, fmt.Sprintf("round %d: together %v %q but one after the other %v %q", round, gotT.codes, gotT.text, gotA.codes, gotA.text))
		}
		if createTogether.list != "" && beforeT >= 0 {
			grewT := together.rows(createTogether.list) - beforeT
			grewA := alone.rows(createAlone.list) - beforeA
			if grewT != grewA {
				verdict.defects = append(verdict.defects, fmt.Sprintf("round %d: together %v grew the list by %d, one after the other %v by %d", round, gotT.codes, grewT, gotA.codes, grewA))
			}
		}
	}
	return verdict
}

var concurrentCreateFiled = map[string]string{
	"agency create_hazard":           "open",
	"agency create_threat":           "open",
	"agency create_consequence":      "open",
	"taskmanager start_workflow_run": "open",
	"taskmanager create_agent":       "open",
	"taskmanager create_project":     "open",
	"riskmanager create_control":     "open",
}

func concurrentCreateRun(t *testing.T, cases []concurrentCreateCase) {
	for _, c := range cases {
		c := c
		t.Run(c.name, func(t *testing.T) {
			v := concurrentCreateProbe(t, c)
			t.Logf("%s: %d rounds, shapes %v, defects %d, first round %q", v.name, v.rounds, v.shape, len(v.defects), v.sample)
			filed, known := concurrentCreateFiled[c.name]
			for _, d := range v.defects {
				if known {
					t.Logf("filed as %s: %s", filed, d)
				} else {
					t.Errorf("%s", d)
				}
			}
		})
	}
}

func concurrentCreateNamed(path string, list string, field string, extra map[string]any) func(w concurrentCreateWorld) concurrentCreateCreate {
	return func(w concurrentCreateWorld) concurrentCreateCreate {
		return concurrentCreateCreate{list: list, post: func(round int) (string, any) {
			body := map[string]any{field: fmt.Sprintf("Probe %d", round)}
			for k, v := range extra {
				body[k] = v
			}
			return path, body
		}}
	}
}

func TestConcurrentCreate_Round1_Actor(t *testing.T) {
	const base = "/instances/{instanceID}/actor/"
	concurrentCreateRun(t, []concurrentCreateCase{
		{"actor create_group", concurrentCreateNamed(base+"groups", base+"groups", "name", nil)},
		{"actor create_hierarchy", concurrentCreateNamed(base+"hierarchies", base+"hierarchies", "name", nil)},
		{"actor create_role_kind", concurrentCreateNamed(base+"role-kinds", base+"role-kinds", "name", nil)},
		{"actor create_actor same phone", func(w concurrentCreateWorld) concurrentCreateCreate {
			return concurrentCreateCreate{list: base + "actors", post: func(round int) (string, any) {
				return base + "actors", map[string]any{"display_name": fmt.Sprintf("Person %d", round), "attributes": map[string]any{"phone": fmt.Sprintf("+3612345%04d", round)}}
			}}
		}},
		{"actor create_actor same name", func(w concurrentCreateWorld) concurrentCreateCreate {
			return concurrentCreateCreate{list: base + "actors", post: func(round int) (string, any) {
				return base + "actors", map[string]any{"display_name": fmt.Sprintf("Person %d", round)}
			}}
		}},
		{"actor create_level", func(w concurrentCreateWorld) concurrentCreateCreate {
			h := w.idOf(base+"hierarchies", map[string]any{"name": "Tree"})
			return concurrentCreateCreate{list: base + "levels", post: func(round int) (string, any) {
				return base + "levels", map[string]any{"hierarchy_id": h, "name": fmt.Sprintf("Level %d", round), "depth": round + 1}
			}}
		}},
		{"actor grant_role", func(w concurrentCreateWorld) concurrentCreateCreate {
			kind := w.idOf(base+"role-kinds", map[string]any{"name": "Chair"})
			group := w.idOf(base+"groups", map[string]any{"name": "Council"})
			actors := make([]string, concurrentCreateRounds)
			for i := range actors {
				actors[i] = w.idOf(base+"actors", map[string]any{"display_name": fmt.Sprintf("Holder %d", i)})
			}
			return concurrentCreateCreate{list: base + "role-assignments", post: func(round int) (string, any) {
				return base + "role-assignments", map[string]any{"actor_id": actors[round], "group_id": group, "kind_id": kind}
			}}
		}},
		{"actor invite_to_group", func(w concurrentCreateWorld) concurrentCreateCreate {
			group := w.idOf(base+"groups", map[string]any{"name": "Council"})
			actors := make([]string, concurrentCreateRounds)
			for i := range actors {
				actors[i] = w.idOf(base+"actors", map[string]any{"display_name": fmt.Sprintf("Guest %d", i)})
			}
			return concurrentCreateCreate{post: func(round int) (string, any) {
				return base + "groups/" + group + "/invitations", map[string]any{"actor_id": actors[round]}
			}}
		}},
		{"actor create_delegation", func(w concurrentCreateWorld) concurrentCreateCreate {
			subject := w.idOf(base+"actors", map[string]any{"display_name": "Subject"})
			delegates := make([]string, concurrentCreateRounds)
			for i := range delegates {
				delegates[i] = w.idOf(base+"actors", map[string]any{"display_name": fmt.Sprintf("Delegate %d", i)})
			}
			return concurrentCreateCreate{list: base + "delegations", post: func(round int) (string, any) {
				return base + "delegations", map[string]any{"delegate_id": delegates[round], "subject_id": subject}
			}}
		}},
		{"actor record_group_population", func(w concurrentCreateWorld) concurrentCreateCreate {
			group := w.idOf(base+"groups", map[string]any{"name": "Council"})
			return concurrentCreateCreate{post: func(round int) (string, any) {
				return base + "groups/" + group + "/population", map[string]any{"population": 100 + round, "as_of": "2026-01-01", "source": "census"}
			}}
		}},
		{"actor create_group_type", func(w concurrentCreateWorld) concurrentCreateCreate {
			h := w.idOf(base+"hierarchies", map[string]any{"name": "Tree"})
			return concurrentCreateCreate{list: base + "group-types", post: func(round int) (string, any) {
				return base + "group-types", map[string]any{"hierarchy_id": h, "name": fmt.Sprintf("Kind %d", round), "singular": "chapter", "plural": "chapters"}
			}}
		}},
	})
}

func concurrentCreateDrafted(path, field string, extra func(w concurrentCreateWorld, draft string) map[string]any) func(w concurrentCreateWorld) concurrentCreateCreate {
	const base = "/instances/{instanceID}/"
	return func(w concurrentCreateWorld) concurrentCreateCreate {
		draft := w.idOf(base+"drafts", map[string]any{"description": "Probe draft"})
		return concurrentCreateCreate{list: base + path + "?draft_id=" + draft, post: func(round int) (string, any) {
			body := map[string]any{"draft_id": draft, field: fmt.Sprintf("Probe %d", round)}
			if extra != nil {
				for k, v := range extra(w, draft) {
					body[k] = v
				}
			}
			return base + path, body
		}}
	}
}

func TestConcurrentCreate_Round2_Agency(t *testing.T) {
	const base = "/instances/{instanceID}/"
	concurrentCreateRun(t, []concurrentCreateCase{
		{"agency create_draft", func(w concurrentCreateWorld) concurrentCreateCreate {
			return concurrentCreateCreate{list: base + "drafts", post: func(round int) (string, any) {
				return base + "drafts", map[string]any{"description": fmt.Sprintf("Draft %d", round)}
			}}
		}},
		{"agency create_goal", concurrentCreateDrafted("goals", "title", nil)},
		{"agency create_workflow", concurrentCreateDrafted("workflows", "name", nil)},
		{"agency create_role", concurrentCreateDrafted("roles", "name", nil)},
		{"agency create_value", concurrentCreateDrafted("values", "text", nil)},
		{"agency create_rule", concurrentCreateDrafted("rules", "text", nil)},
		{"agency create_control", concurrentCreateDrafted("controls", "text", nil)},
		{"agency create_hazard", concurrentCreateDrafted("hazards", "title", nil)},
		{"agency create_threat", concurrentCreateDrafted("threats", "title", nil)},
		{"agency create_risk", concurrentCreateDrafted("risks", "title", func(concurrentCreateWorld, string) map[string]any { return map[string]any{"top_event": "Spill"} })},
		{"agency start_review", func(w concurrentCreateWorld) concurrentCreateCreate {
			draft := w.idOf(base+"drafts", map[string]any{"description": "Probe draft"})
			return concurrentCreateCreate{post: func(round int) (string, any) {
				return base + "reviews", map[string]any{"draft_id": draft}
			}}
		}},
		{"agency link_workflow_objective", func(w concurrentCreateWorld) concurrentCreateCreate {
			draft := w.idOf(base+"drafts", map[string]any{"description": "Probe draft"})
			goal := w.idOf(base+"goals", map[string]any{"draft_id": draft, "title": "Goal"})
			workflows := make([]string, concurrentCreateRounds)
			objectives := make([]string, concurrentCreateRounds)
			for i := range workflows {
				workflows[i] = w.idOf(base+"workflows", map[string]any{"draft_id": draft, "name": fmt.Sprintf("Flow %d", i)})
				objectives[i] = w.idOf(base+"objectives", map[string]any{"draft_id": draft, "goal_id": goal, "title": fmt.Sprintf("Objective %d", i)})
			}
			return concurrentCreateCreate{post: func(round int) (string, any) {
				return base + "workflow-objectives", map[string]any{"draft_id": draft, "workflow_id": workflows[round], "objective_id": objectives[round]}
			}}
		}},
	})
}

func concurrentCreateShort(text string) string {
	text = strings.TrimSpace(text)
	if len(text) > 90 {
		return text[:90]
	}
	return text
}

func TestConcurrentCreate_Round3_AgencyLinks(t *testing.T) {
	const base = "/instances/{instanceID}/"
	draftOf := func(w concurrentCreateWorld) string {
		return w.idOf(base+"drafts", map[string]any{"description": "Probe draft"})
	}
	codeOf := func(w concurrentCreateWorld, path string, body map[string]any) string {
		code, _ := w.made(path, body)["code"].(string)
		return code
	}
	concurrentCreateRun(t, []concurrentCreateCase{
		{"agency create_consequence", func(w concurrentCreateWorld) concurrentCreateCreate {
			draft := draftOf(w)
			hazard := codeOf(w, base+"hazards", map[string]any{"draft_id": draft, "title": "Fire"})
			return concurrentCreateCreate{list: base + "consequences?draft_id=" + draft, post: func(round int) (string, any) {
				return base + "consequences", map[string]any{"draft_id": draft, "hazard_code": hazard, "title": fmt.Sprintf("Probe %d", round)}
			}}
		}},
		{"agency attach_value", func(w concurrentCreateWorld) concurrentCreateCreate {
			draft := draftOf(w)
			value := w.idOf(base+"values", map[string]any{"draft_id": draft, "text": "Care"})
			goals := make([]string, concurrentCreateRounds)
			for i := range goals {
				goals[i] = w.idOf(base+"goals", map[string]any{"draft_id": draft, "title": fmt.Sprintf("Goal %d", i)})
			}
			return concurrentCreateCreate{post: func(round int) (string, any) {
				return base + "values/" + value + "/attachments", map[string]any{"target_type": "goal", "target_id": goals[round]}
			}}
		}},
		{"agency attach_rule", func(w concurrentCreateWorld) concurrentCreateCreate {
			draft := draftOf(w)
			rule := w.idOf(base+"rules", map[string]any{"draft_id": draft, "text": "Rule"})
			goals := make([]string, concurrentCreateRounds)
			for i := range goals {
				goals[i] = w.idOf(base+"goals", map[string]any{"draft_id": draft, "title": fmt.Sprintf("Goal %d", i)})
			}
			return concurrentCreateCreate{post: func(round int) (string, any) {
				return base + "rules/" + rule + "/attachments", map[string]any{"target_type": "goal", "target_id": goals[round]}
			}}
		}},
		{"agency attach_control", func(w concurrentCreateWorld) concurrentCreateCreate {
			draft := draftOf(w)
			control := w.idOf(base+"controls", map[string]any{"draft_id": draft, "text": "Control"})
			goals := make([]string, concurrentCreateRounds)
			for i := range goals {
				goals[i] = w.idOf(base+"goals", map[string]any{"draft_id": draft, "title": fmt.Sprintf("Goal %d", i)})
			}
			return concurrentCreateCreate{post: func(round int) (string, any) {
				return base + "controls/" + control + "/attachments", map[string]any{"target_type": "goal", "target_id": goals[round]}
			}}
		}},
		{"agency create_risk_threat", func(w concurrentCreateWorld) concurrentCreateCreate {
			draft := draftOf(w)
			risk := codeOf(w, base+"risks", map[string]any{"draft_id": draft, "title": "Flood", "top_event": "Spill"})
			threats := make([]string, concurrentCreateRounds)
			for i := range threats {
				threats[i] = codeOf(w, base+"threats", map[string]any{"draft_id": draft, "title": fmt.Sprintf("Threat %d", i)})
			}
			return concurrentCreateCreate{post: func(round int) (string, any) {
				return base + "risk-threats", map[string]any{"draft_id": draft, "risk_code": risk, "threat_code": threats[round]}
			}}
		}},
		{"agency create_objective", func(w concurrentCreateWorld) concurrentCreateCreate {
			draft := draftOf(w)
			goal := w.idOf(base+"goals", map[string]any{"draft_id": draft, "title": "Goal"})
			return concurrentCreateCreate{list: base + "objectives?draft_id=" + draft, post: func(round int) (string, any) {
				return base + "objectives", map[string]any{"draft_id": draft, "goal_id": goal, "title": fmt.Sprintf("Probe %d", round)}
			}}
		}},
		{"agency create_work_item", func(w concurrentCreateWorld) concurrentCreateCreate {
			draft := draftOf(w)
			workflow := w.idOf(base+"workflows", map[string]any{"draft_id": draft, "name": "Flow"})
			return concurrentCreateCreate{list: base + "work-items?draft_id=" + draft, post: func(round int) (string, any) {
				return base + "work-items", map[string]any{"draft_id": draft, "workflow_id": workflow, "title": fmt.Sprintf("Probe %d", round)}
			}}
		}},
		{"agency create_scenario", func(w concurrentCreateWorld) concurrentCreateCreate {
			draft := draftOf(w)
			workflow := w.idOf(base+"workflows", map[string]any{"draft_id": draft, "name": "Flow"})
			return concurrentCreateCreate{list: base + "scenarios?draft_id=" + draft, post: func(round int) (string, any) {
				return base + "scenarios", map[string]any{"draft_id": draft, "workflow_id": workflow, "name": fmt.Sprintf("Probe %d", round)}
			}}
		}},
		{"agency publish_agency", func(w concurrentCreateWorld) concurrentCreateCreate {
			draft := draftOf(w)
			return concurrentCreateCreate{post: func(round int) (string, any) {
				return base + "publications", map[string]any{"draft_id": draft, "tag": fmt.Sprintf("v%d", round)}
			}}
		}},
	})
}

func TestConcurrentCreate_Round4_Taskmanager(t *testing.T) {
	const base = "/instances/{instanceID}/taskmanager/"
	concurrentCreateRun(t, []concurrentCreateCase{
		{"taskmanager create_backlog", concurrentCreateNamed(base+"backlogs", base+"backlogs", "name", nil)},
		{"taskmanager create_project", concurrentCreateNamed(base+"projects", base+"projects", "name", nil)},
		{"taskmanager create_task", concurrentCreateNamed(base+"tasks", base+"tasks", "title", nil)},
		{"taskmanager create_agent", concurrentCreateNamed(base+"agents", base+"agents", "agent_id", nil)},
		{"taskmanager start_workflow_run", concurrentCreateNamed(base+"workflow-runs", base+"workflow-runs", "name", nil)},
		{"taskmanager create_task_todo", func(w concurrentCreateWorld) concurrentCreateCreate {
			task := w.idOf(base+"tasks", map[string]any{"title": "Parent"})
			return concurrentCreateCreate{post: func(round int) (string, any) {
				return base + "todos", map[string]any{"parent_task_id": task, "title": fmt.Sprintf("Todo %d", round)}
			}}
		}},
		{"taskmanager add_task_note", func(w concurrentCreateWorld) concurrentCreateCreate {
			task := w.idOf(base+"tasks", map[string]any{"title": "Parent"})
			return concurrentCreateCreate{post: func(round int) (string, any) {
				return base + "tasks/" + task + "/notes", map[string]any{"kind": "person", "text": fmt.Sprintf("Note %d", round)}
			}}
		}},
		{"taskmanager add_task_reference", func(w concurrentCreateWorld) concurrentCreateCreate {
			task := w.idOf(base+"tasks", map[string]any{"title": "Parent"})
			return concurrentCreateCreate{post: func(round int) (string, any) {
				return base + "tasks/" + task + "/references", map[string]any{"kind": "commit", "repo": "hub-steward", "target": fmt.Sprintf("abc%d", round)}
			}}
		}},
		{"taskmanager create_relationship", func(w concurrentCreateWorld) concurrentCreateCreate {
			from := w.idOf(base+"tasks", map[string]any{"title": "From"})
			tos := make([]string, concurrentCreateRounds)
			for i := range tos {
				tos[i] = w.idOf(base+"tasks", map[string]any{"title": fmt.Sprintf("To %d", i)})
			}
			return concurrentCreateCreate{post: func(round int) (string, any) {
				return base + "relationships", map[string]any{"from_task_id": from, "to_task_id": tos[round], "kind": "depends_on"}
			}}
		}},
		{"taskmanager add_step", func(w concurrentCreateWorld) concurrentCreateCreate {
			backlog := w.idOf(base+"backlogs", map[string]any{"name": "Board"})
			return concurrentCreateCreate{post: func(round int) (string, any) {
				return base + "backlogs/" + backlog + "/steps", map[string]any{"name": fmt.Sprintf("Step %d", round)}
			}}
		}},
	})
}

func TestConcurrentCreate_Round5_Modules(t *testing.T) {
	const base = "/instances/{instanceID}/"
	concurrentCreateRun(t, []concurrentCreateCase{
		{"voting create_poll", concurrentCreateNamed(base+"voting/polls", base+"voting/polls", "question", map[string]any{"mode": "single", "per_group": false, "opens_at": "2026-12-01T00:00:00Z", "closes_at": "2026-12-02T00:00:00Z"})},
		{"digitaltwin create_node", concurrentCreateNamed(base+"digitaltwin/nodes", base+"digitaltwin/nodes", "name", map[string]any{"kind": "pump"})},
		{"digitaltwin create_metric", concurrentCreateNamed(base+"digitaltwin/metrics", base+"digitaltwin/metrics", "name", map[string]any{"unit": "l", "node_kind": "pump"})},
		{"engage create_post", concurrentCreateNamed(base+"engage/posts", base+"engage/posts", "title", map[string]any{"kind": "event"})},
		{"riskmanager create_risk", concurrentCreateNamed(base+"risks/risks", base+"risks/risks", "title", map[string]any{"top_event": "Spill"})},
		{"riskmanager create_control", concurrentCreateNamed(base+"risks/controls", base+"risks/controls", "name", nil)},
		{"custody create_consent_version", func(w concurrentCreateWorld) concurrentCreateCreate {
			return concurrentCreateCreate{post: func(round int) (string, any) {
				return base + "custody/consent/versions", map[string]any{"scope": "mechanics", "version": fmt.Sprint(round + 1), "language": "en", "text": "I agree"}
			}}
		}},
		{"agency create_agency", concurrentCreateNamed(base+"agency", "", "name", nil)},
	})
}
