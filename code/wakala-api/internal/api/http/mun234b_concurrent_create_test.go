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

const mun234bRounds = 12

type mun234bWorld struct {
	t        *testing.T
	walk     stepRunWalk
	instance string
}

func (w mun234bWorld) send(method, path string, body any) *httptest.ResponseRecorder {
	return callOn(w.walk.handler, method, strings.ReplaceAll(path, "{instanceID}", w.instance), body, w.walk.owner)
}

func (w mun234bWorld) made(path string, body any) map[string]any {
	w.t.Helper()
	rec := w.send("POST", path, body)
	if rec.Code < 200 || rec.Code > 299 {
		w.t.Fatalf("setup %s: %d %s", path, rec.Code, rec.Body.String())
	}
	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return out
}

func (w mun234bWorld) idOf(path string, body any) string {
	w.t.Helper()
	id, _ := w.made(path, body)["id"].(string)
	if id == "" {
		w.t.Fatalf("setup %s: no id", path)
	}
	return id
}

func (w mun234bWorld) rows(path string) int {
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

type mun234bCreate struct {
	post func(round int) (path string, body any)
	list string
}

type mun234bCase struct {
	name  string
	build func(w mun234bWorld) mun234bCreate
}

type mun234bOutcome struct {
	codes []int
	text  []string
}

func (o mun234bOutcome) successes() int {
	n := 0
	for _, c := range o.codes {
		if c >= 200 && c < 300 {
			n++
		}
	}
	return n
}

func (o mun234bOutcome) serverFault() bool {
	for _, c := range o.codes {
		if c >= 500 {
			return true
		}
	}
	return false
}

func newMUN234bWorld(t *testing.T) mun234bWorld {
	t.Helper()
	walk := newStepRunWalkOn(t, openSharedFile(t, filepath.Join(t.TempDir(), "wakala.db")), nil)
	return mun234bWorld{t: t, walk: walk, instance: walk.instance}
}

func (w mun234bWorld) twice(path string, body any, together bool) mun234bOutcome {
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
	var out mun234bOutcome
	for _, rec := range results {
		out.codes = append(out.codes, rec.Code)
		out.text = append(out.text, mun234bShort(rec.Body.String()))
	}
	return out
}

type mun234bVerdict struct {
	name    string
	rounds  int
	defects []string
	shape   map[string]int
	sample  []string
}

func mun234bProbe(t *testing.T, c mun234bCase) mun234bVerdict {
	t.Helper()
	together := newMUN234bWorld(t)
	alone := newMUN234bWorld(t)

	verdict := mun234bVerdict{name: c.name, shape: map[string]int{}}
	createTogether := c.build(together)
	createAlone := c.build(alone)
	for round := 0; round < mun234bRounds; round++ {
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

var mun234bFiled = map[string]string{
	"agency create_hazard":           "MUN698",
	"agency create_threat":           "MUN698",
	"agency create_consequence":      "MUN698",
	"taskmanager start_workflow_run": "MUN701",
	"taskmanager create_agent":       "MUN702",
	"taskmanager create_project":     "MUN703",
	"riskmanager create_control":     "MUN706",
}

func mun234bRun(t *testing.T, cases []mun234bCase) {
	for _, c := range cases {
		c := c
		t.Run(c.name, func(t *testing.T) {
			v := mun234bProbe(t, c)
			t.Logf("%s: %d rounds, shapes %v, defects %d, first round %q", v.name, v.rounds, v.shape, len(v.defects), v.sample)
			filed, known := mun234bFiled[c.name]
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

func mun234bNamed(path string, list string, field string, extra map[string]any) func(w mun234bWorld) mun234bCreate {
	return func(w mun234bWorld) mun234bCreate {
		return mun234bCreate{list: list, post: func(round int) (string, any) {
			body := map[string]any{field: fmt.Sprintf("Probe %d", round)}
			for k, v := range extra {
				body[k] = v
			}
			return path, body
		}}
	}
}

func TestMUN234b_Round1_Actor(t *testing.T) {
	const base = "/instances/{instanceID}/actor/"
	mun234bRun(t, []mun234bCase{
		{"actor create_group", mun234bNamed(base+"groups", base+"groups", "name", nil)},
		{"actor create_hierarchy", mun234bNamed(base+"hierarchies", base+"hierarchies", "name", nil)},
		{"actor create_role_kind", mun234bNamed(base+"role-kinds", base+"role-kinds", "name", nil)},
		{"actor create_actor same phone", func(w mun234bWorld) mun234bCreate {
			return mun234bCreate{list: base + "actors", post: func(round int) (string, any) {
				return base + "actors", map[string]any{"display_name": fmt.Sprintf("Person %d", round), "attributes": map[string]any{"phone": fmt.Sprintf("+3612345%04d", round)}}
			}}
		}},
		{"actor create_actor same name", func(w mun234bWorld) mun234bCreate {
			return mun234bCreate{list: base + "actors", post: func(round int) (string, any) {
				return base + "actors", map[string]any{"display_name": fmt.Sprintf("Person %d", round)}
			}}
		}},
		{"actor create_level", func(w mun234bWorld) mun234bCreate {
			h := w.idOf(base+"hierarchies", map[string]any{"name": "Tree"})
			return mun234bCreate{list: base + "levels", post: func(round int) (string, any) {
				return base + "levels", map[string]any{"hierarchy_id": h, "name": fmt.Sprintf("Level %d", round), "depth": round + 1}
			}}
		}},
		{"actor grant_role", func(w mun234bWorld) mun234bCreate {
			kind := w.idOf(base+"role-kinds", map[string]any{"name": "Chair"})
			group := w.idOf(base+"groups", map[string]any{"name": "Council"})
			actors := make([]string, mun234bRounds)
			for i := range actors {
				actors[i] = w.idOf(base+"actors", map[string]any{"display_name": fmt.Sprintf("Holder %d", i)})
			}
			return mun234bCreate{list: base + "role-assignments", post: func(round int) (string, any) {
				return base + "role-assignments", map[string]any{"actor_id": actors[round], "group_id": group, "kind_id": kind}
			}}
		}},
		{"actor invite_to_group", func(w mun234bWorld) mun234bCreate {
			group := w.idOf(base+"groups", map[string]any{"name": "Council"})
			actors := make([]string, mun234bRounds)
			for i := range actors {
				actors[i] = w.idOf(base+"actors", map[string]any{"display_name": fmt.Sprintf("Guest %d", i)})
			}
			return mun234bCreate{post: func(round int) (string, any) {
				return base + "groups/" + group + "/invitations", map[string]any{"actor_id": actors[round]}
			}}
		}},
		{"actor create_delegation", func(w mun234bWorld) mun234bCreate {
			subject := w.idOf(base+"actors", map[string]any{"display_name": "Subject"})
			delegates := make([]string, mun234bRounds)
			for i := range delegates {
				delegates[i] = w.idOf(base+"actors", map[string]any{"display_name": fmt.Sprintf("Delegate %d", i)})
			}
			return mun234bCreate{list: base + "delegations", post: func(round int) (string, any) {
				return base + "delegations", map[string]any{"delegate_id": delegates[round], "subject_id": subject}
			}}
		}},
		{"actor record_group_population", func(w mun234bWorld) mun234bCreate {
			group := w.idOf(base+"groups", map[string]any{"name": "Council"})
			return mun234bCreate{post: func(round int) (string, any) {
				return base + "groups/" + group + "/population", map[string]any{"population": 100 + round, "as_of": "2026-01-01", "source": "census"}
			}}
		}},
		{"actor create_group_type", func(w mun234bWorld) mun234bCreate {
			h := w.idOf(base+"hierarchies", map[string]any{"name": "Tree"})
			return mun234bCreate{list: base + "group-types", post: func(round int) (string, any) {
				return base + "group-types", map[string]any{"hierarchy_id": h, "name": fmt.Sprintf("Kind %d", round), "singular": "chapter", "plural": "chapters"}
			}}
		}},
	})
}

func mun234bDrafted(path, field string, extra func(w mun234bWorld, draft string) map[string]any) func(w mun234bWorld) mun234bCreate {
	const base = "/instances/{instanceID}/"
	return func(w mun234bWorld) mun234bCreate {
		draft := w.idOf(base+"drafts", map[string]any{"description": "Probe draft"})
		return mun234bCreate{list: base + path + "?draft_id=" + draft, post: func(round int) (string, any) {
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

func TestMUN234b_Round2_Agency(t *testing.T) {
	const base = "/instances/{instanceID}/"
	mun234bRun(t, []mun234bCase{
		{"agency create_draft", func(w mun234bWorld) mun234bCreate {
			return mun234bCreate{list: base + "drafts", post: func(round int) (string, any) {
				return base + "drafts", map[string]any{"description": fmt.Sprintf("Draft %d", round)}
			}}
		}},
		{"agency create_goal", mun234bDrafted("goals", "title", nil)},
		{"agency create_workflow", mun234bDrafted("workflows", "name", nil)},
		{"agency create_role", mun234bDrafted("roles", "name", nil)},
		{"agency create_value", mun234bDrafted("values", "text", nil)},
		{"agency create_rule", mun234bDrafted("rules", "text", nil)},
		{"agency create_control", mun234bDrafted("controls", "text", nil)},
		{"agency create_hazard", mun234bDrafted("hazards", "title", nil)},
		{"agency create_threat", mun234bDrafted("threats", "title", nil)},
		{"agency create_risk", mun234bDrafted("risks", "title", func(mun234bWorld, string) map[string]any { return map[string]any{"top_event": "Spill"} })},
		{"agency start_review", func(w mun234bWorld) mun234bCreate {
			draft := w.idOf(base+"drafts", map[string]any{"description": "Probe draft"})
			return mun234bCreate{post: func(round int) (string, any) {
				return base + "reviews", map[string]any{"draft_id": draft}
			}}
		}},
		{"agency link_workflow_objective", func(w mun234bWorld) mun234bCreate {
			draft := w.idOf(base+"drafts", map[string]any{"description": "Probe draft"})
			goal := w.idOf(base+"goals", map[string]any{"draft_id": draft, "title": "Goal"})
			workflows := make([]string, mun234bRounds)
			objectives := make([]string, mun234bRounds)
			for i := range workflows {
				workflows[i] = w.idOf(base+"workflows", map[string]any{"draft_id": draft, "name": fmt.Sprintf("Flow %d", i)})
				objectives[i] = w.idOf(base+"objectives", map[string]any{"draft_id": draft, "goal_id": goal, "title": fmt.Sprintf("Objective %d", i)})
			}
			return mun234bCreate{post: func(round int) (string, any) {
				return base + "workflow-objectives", map[string]any{"draft_id": draft, "workflow_id": workflows[round], "objective_id": objectives[round]}
			}}
		}},
	})
}

func mun234bShort(text string) string {
	text = strings.TrimSpace(text)
	if len(text) > 90 {
		return text[:90]
	}
	return text
}

func TestMUN234b_Round3_AgencyLinks(t *testing.T) {
	const base = "/instances/{instanceID}/"
	draftOf := func(w mun234bWorld) string {
		return w.idOf(base+"drafts", map[string]any{"description": "Probe draft"})
	}
	codeOf := func(w mun234bWorld, path string, body map[string]any) string {
		code, _ := w.made(path, body)["code"].(string)
		return code
	}
	mun234bRun(t, []mun234bCase{
		{"agency create_consequence", func(w mun234bWorld) mun234bCreate {
			draft := draftOf(w)
			hazard := codeOf(w, base+"hazards", map[string]any{"draft_id": draft, "title": "Fire"})
			return mun234bCreate{list: base + "consequences?draft_id=" + draft, post: func(round int) (string, any) {
				return base + "consequences", map[string]any{"draft_id": draft, "hazard_code": hazard, "title": fmt.Sprintf("Probe %d", round)}
			}}
		}},
		{"agency attach_value", func(w mun234bWorld) mun234bCreate {
			draft := draftOf(w)
			value := w.idOf(base+"values", map[string]any{"draft_id": draft, "text": "Care"})
			goals := make([]string, mun234bRounds)
			for i := range goals {
				goals[i] = w.idOf(base+"goals", map[string]any{"draft_id": draft, "title": fmt.Sprintf("Goal %d", i)})
			}
			return mun234bCreate{post: func(round int) (string, any) {
				return base + "values/" + value + "/attachments", map[string]any{"target_type": "goal", "target_id": goals[round]}
			}}
		}},
		{"agency attach_rule", func(w mun234bWorld) mun234bCreate {
			draft := draftOf(w)
			rule := w.idOf(base+"rules", map[string]any{"draft_id": draft, "text": "Rule"})
			goals := make([]string, mun234bRounds)
			for i := range goals {
				goals[i] = w.idOf(base+"goals", map[string]any{"draft_id": draft, "title": fmt.Sprintf("Goal %d", i)})
			}
			return mun234bCreate{post: func(round int) (string, any) {
				return base + "rules/" + rule + "/attachments", map[string]any{"target_type": "goal", "target_id": goals[round]}
			}}
		}},
		{"agency attach_control", func(w mun234bWorld) mun234bCreate {
			draft := draftOf(w)
			control := w.idOf(base+"controls", map[string]any{"draft_id": draft, "text": "Control"})
			goals := make([]string, mun234bRounds)
			for i := range goals {
				goals[i] = w.idOf(base+"goals", map[string]any{"draft_id": draft, "title": fmt.Sprintf("Goal %d", i)})
			}
			return mun234bCreate{post: func(round int) (string, any) {
				return base + "controls/" + control + "/attachments", map[string]any{"target_type": "goal", "target_id": goals[round]}
			}}
		}},
		{"agency create_risk_threat", func(w mun234bWorld) mun234bCreate {
			draft := draftOf(w)
			risk := codeOf(w, base+"risks", map[string]any{"draft_id": draft, "title": "Flood", "top_event": "Spill"})
			threats := make([]string, mun234bRounds)
			for i := range threats {
				threats[i] = codeOf(w, base+"threats", map[string]any{"draft_id": draft, "title": fmt.Sprintf("Threat %d", i)})
			}
			return mun234bCreate{post: func(round int) (string, any) {
				return base + "risk-threats", map[string]any{"draft_id": draft, "risk_code": risk, "threat_code": threats[round]}
			}}
		}},
		{"agency create_objective", func(w mun234bWorld) mun234bCreate {
			draft := draftOf(w)
			goal := w.idOf(base+"goals", map[string]any{"draft_id": draft, "title": "Goal"})
			return mun234bCreate{list: base + "objectives?draft_id=" + draft, post: func(round int) (string, any) {
				return base + "objectives", map[string]any{"draft_id": draft, "goal_id": goal, "title": fmt.Sprintf("Probe %d", round)}
			}}
		}},
		{"agency create_work_item", func(w mun234bWorld) mun234bCreate {
			draft := draftOf(w)
			workflow := w.idOf(base+"workflows", map[string]any{"draft_id": draft, "name": "Flow"})
			return mun234bCreate{list: base + "work-items?draft_id=" + draft, post: func(round int) (string, any) {
				return base + "work-items", map[string]any{"draft_id": draft, "workflow_id": workflow, "title": fmt.Sprintf("Probe %d", round)}
			}}
		}},
		{"agency create_scenario", func(w mun234bWorld) mun234bCreate {
			draft := draftOf(w)
			workflow := w.idOf(base+"workflows", map[string]any{"draft_id": draft, "name": "Flow"})
			return mun234bCreate{list: base + "scenarios?draft_id=" + draft, post: func(round int) (string, any) {
				return base + "scenarios", map[string]any{"draft_id": draft, "workflow_id": workflow, "name": fmt.Sprintf("Probe %d", round)}
			}}
		}},
		{"agency publish_agency", func(w mun234bWorld) mun234bCreate {
			draft := draftOf(w)
			return mun234bCreate{post: func(round int) (string, any) {
				return base + "publications", map[string]any{"draft_id": draft, "tag": fmt.Sprintf("v%d", round)}
			}}
		}},
	})
}

func TestMUN234b_Round4_Taskmanager(t *testing.T) {
	const base = "/instances/{instanceID}/taskmanager/"
	mun234bRun(t, []mun234bCase{
		{"taskmanager create_backlog", mun234bNamed(base+"backlogs", base+"backlogs", "name", nil)},
		{"taskmanager create_project", mun234bNamed(base+"projects", base+"projects", "name", nil)},
		{"taskmanager create_task", mun234bNamed(base+"tasks", base+"tasks", "title", nil)},
		{"taskmanager create_agent", mun234bNamed(base+"agents", base+"agents", "agent_id", nil)},
		{"taskmanager start_workflow_run", mun234bNamed(base+"workflow-runs", base+"workflow-runs", "name", nil)},
		{"taskmanager create_task_todo", func(w mun234bWorld) mun234bCreate {
			task := w.idOf(base+"tasks", map[string]any{"title": "Parent"})
			return mun234bCreate{post: func(round int) (string, any) {
				return base + "todos", map[string]any{"parent_task_id": task, "title": fmt.Sprintf("Todo %d", round)}
			}}
		}},
		{"taskmanager add_task_note", func(w mun234bWorld) mun234bCreate {
			task := w.idOf(base+"tasks", map[string]any{"title": "Parent"})
			return mun234bCreate{post: func(round int) (string, any) {
				return base + "tasks/" + task + "/notes", map[string]any{"kind": "person", "text": fmt.Sprintf("Note %d", round)}
			}}
		}},
		{"taskmanager add_task_reference", func(w mun234bWorld) mun234bCreate {
			task := w.idOf(base+"tasks", map[string]any{"title": "Parent"})
			return mun234bCreate{post: func(round int) (string, any) {
				return base + "tasks/" + task + "/references", map[string]any{"kind": "commit", "repo": "hub-steward", "target": fmt.Sprintf("abc%d", round)}
			}}
		}},
		{"taskmanager create_relationship", func(w mun234bWorld) mun234bCreate {
			from := w.idOf(base+"tasks", map[string]any{"title": "From"})
			tos := make([]string, mun234bRounds)
			for i := range tos {
				tos[i] = w.idOf(base+"tasks", map[string]any{"title": fmt.Sprintf("To %d", i)})
			}
			return mun234bCreate{post: func(round int) (string, any) {
				return base + "relationships", map[string]any{"from_task_id": from, "to_task_id": tos[round], "kind": "depends_on"}
			}}
		}},
		{"taskmanager add_step", func(w mun234bWorld) mun234bCreate {
			backlog := w.idOf(base+"backlogs", map[string]any{"name": "Board"})
			return mun234bCreate{post: func(round int) (string, any) {
				return base + "backlogs/" + backlog + "/steps", map[string]any{"name": fmt.Sprintf("Step %d", round)}
			}}
		}},
	})
}

func TestMUN234b_Round5_Modules(t *testing.T) {
	const base = "/instances/{instanceID}/"
	mun234bRun(t, []mun234bCase{
		{"voting create_poll", mun234bNamed(base+"voting/polls", base+"voting/polls", "question", map[string]any{"mode": "single", "per_group": false, "opens_at": "2026-12-01T00:00:00Z", "closes_at": "2026-12-02T00:00:00Z"})},
		{"digitaltwin create_node", mun234bNamed(base+"digitaltwin/nodes", base+"digitaltwin/nodes", "name", map[string]any{"kind": "pump"})},
		{"digitaltwin create_metric", mun234bNamed(base+"digitaltwin/metrics", base+"digitaltwin/metrics", "name", map[string]any{"unit": "l", "node_kind": "pump"})},
		{"engage create_post", mun234bNamed(base+"engage/posts", base+"engage/posts", "title", map[string]any{"kind": "event"})},
		{"riskmanager create_risk", mun234bNamed(base+"risks/risks", base+"risks/risks", "title", map[string]any{"top_event": "Spill"})},
		{"riskmanager create_control", mun234bNamed(base+"risks/controls", base+"risks/controls", "name", nil)},
		{"custody create_consent_version", func(w mun234bWorld) mun234bCreate {
			return mun234bCreate{post: func(round int) (string, any) {
				return base + "custody/consent/versions", map[string]any{"scope": "mechanics", "version": fmt.Sprint(round + 1), "language": "en", "text": "I agree"}
			}}
		}},
		{"agency create_agency", mun234bNamed(base+"agency", "", "name", nil)},
	})
}
