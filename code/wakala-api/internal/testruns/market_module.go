package testruns

import (
	"context"
	"encoding/json"
	"sort"
	"strings"
	"sync"
	"time"

	agencymodels "wakalaserver/modules/agency/models"
	mwanachamamarket "wakalaserver/modules/market"
	marketmodels "wakalaserver/modules/market/models"
)

const (
	groupTrailEndpoint = "market_group_order_trail"
	orderTrailEndpoint = "market_order_trail"
)

type marketModule struct {
	stage *RunStage
	mu    sync.Mutex
	seen  map[string]int
}

func newMarketModule(stage *RunStage) *marketModule {
	return &marketModule{stage: stage, seen: map[string]int{}}
}

func (m *marketModule) Name() string { return moduleMarket }

func (m *marketModule) Play(ctx context.Context, call Call) (Outcome, error) {
	runID := RunOf(ctx)
	caller := m.stage.Caller(runID, call.Role)
	body, err := caller.Call(ctx, call.Endpoint, call.Args)
	if err != nil {
		return Outcome{}, err
	}
	answer := answerOf(body)
	group := strings.Contains(call.Endpoint, "group_order")
	id := subjectID(group, answer, call.Args)
	if id == "" {
		return Outcome{Answer: answer}, nil
	}
	endpoint := orderTrailEndpoint
	if group {
		endpoint = groupTrailEndpoint
	}
	fetch := func() ([]marketmodels.Trail, error) {
		raw, err := caller.Call(ctx, endpoint, map[string]any{trailKey(endpoint): id})
		if err != nil {
			return nil, err
		}
		var rows []marketmodels.Trail
		return rows, json.Unmarshal([]byte(raw), &rows)
	}
	return Outcome{Answer: answer, Trail: m.fresh(runID, id, endpoint, call, fetch)}, nil
}

func (m *marketModule) fresh(runID, id, endpoint string, call Call, fetch func() ([]marketmodels.Trail, error)) []TrailLine {
	rows, err := fetch()
	if err != nil {
		return nil
	}
	sort.SliceStable(rows, func(i, j int) bool { return rows[i].At < rows[j].At })
	key := runID + "/" + endpoint + "/" + id
	m.mu.Lock()
	known := m.seen[key]
	m.seen[key] = len(rows)
	m.mu.Unlock()
	if known > len(rows) {
		known = 0
	}
	var out []TrailLine
	for _, r := range rows[known:] {
		at, _ := time.Parse(time.RFC3339, r.At)
		who := r.ActorName
		if who == "" {
			who = r.Actor
		}
		out = append(out, TrailLine{StepID: call.StepID, Module: moduleMarket, Endpoint: endpoint, Text: strings.TrimSpace(who + " " + r.What), At: at})
	}
	return out
}

func (s *RunStage) Module(name string) (Module, bool) {
	m, ok := s.Modules[name]
	return m, ok
}

func answerOf(body string) map[string]any {
	var object map[string]any
	if json.Unmarshal([]byte(body), &object) == nil && object != nil {
		return object
	}
	var value any
	if json.Unmarshal([]byte(body), &value) != nil {
		value = body
	}
	return map[string]any{"result": value}
}

func subjectID(group bool, answer, args map[string]any) string {
	keys := []string{"order_id", "id"}
	if group {
		keys = []string{"group_order_id", "id"}
	}
	for _, source := range []map[string]any{answer, args} {
		for _, k := range keys {
			if v, ok := source[k].(string); ok && v != "" {
				return v
			}
		}
	}
	return ""
}

func trailKey(endpoint string) string {
	tools, err := shapeTools()
	if err != nil {
		return "id"
	}
	for _, t := range tools {
		if t.Name != endpoint {
			continue
		}
		var schema struct {
			Properties map[string]any `json:"properties"`
		}
		_ = json.Unmarshal(t.InputSchema, &schema)
		for k := range schema.Properties {
			if k != "caller" {
				return k
			}
		}
	}
	return "id"
}

func (s *RunStage) sentTrail(ctx context.Context, mm mwanachamamarket.MarketManager, runID, coordinator, id string, block agencymodels.ScenarioBlock) []agencymodels.TrailLine {
	module, ok := s.Modules[moduleMarket].(*marketModule)
	if !ok {
		return nil
	}
	fetch := func() ([]marketmodels.Trail, error) { return mm.GroupOrderTrail(ctx, coordinator, id) }
	lines := module.fresh(runID, id, groupTrailEndpoint, Call{StepID: block.StepID}, fetch)
	return modelLines(lines, block.Title)
}

func modelLines(lines []TrailLine, step string) []agencymodels.TrailLine {
	var out []agencymodels.TrailLine
	for _, l := range lines {
		at := ""
		if !l.At.IsZero() {
			at = l.At.UTC().Format(time.RFC3339)
		}
		out = append(out, agencymodels.TrailLine{StepID: l.StepID, Step: step, Module: l.Module, Endpoint: l.Endpoint, Text: l.Text, At: at})
	}
	return out
}
