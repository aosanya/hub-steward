package testruns

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	agencymodels "wakalaserver/modules/agency/models"
	mwanachamaai "wakalaserver/modules/ai"
	mwanachamamarket "wakalaserver/modules/market"
	marketmodels "wakalaserver/modules/market/models"
	marketroutes "wakalaserver/modules/market/routes"
	"wakalaserver/modules/shared/dispatch"
)

const (
	endpointSendGroupOrder = "market_send_group_order"
	moduleMarket           = "market"
	actionStartGroupOrder  = "market.group_order.start"
)

type ErrNoTestCopy struct {
	Module string
}

func (e ErrNoTestCopy) Error() string { return e.Module + " has no test copy yet" }

type Copy interface {
	Market(ctx context.Context, runID string) (mwanachamamarket.MarketManager, error)
	Stored(ctx context.Context, runID string) ([]Stored, error)
}

type Actor struct {
	Name        string
	Kind        agencymodels.ActorKind
	Permissions []string
}

type RunStage struct {
	copy    Copy
	modules []string
	actors  map[string]Actor
	Modules map[string]Module
	mu      sync.Mutex
	sent    map[string]string
	threads map[string]string
	derived map[string]map[string]bool
}

func NewStage(copy Copy, modules []string, actors []Actor) *RunStage {
	byName := make(map[string]Actor, len(actors))
	for _, a := range actors {
		byName[strings.ToLower(a.Name)] = a
	}
	stage := &RunStage{copy: copy, modules: modules, actors: byName, sent: map[string]string{}, threads: map[string]string{}, derived: map[string]map[string]bool{}}
	stage.Modules = map[string]Module{moduleMarket: newMarketModule(stage)}
	if src, ok := copy.(FormsSource); ok {
		stage.Modules[moduleForms] = perRun{moduleForms, func(runID string) Module {
			return sentFormDefault{stage: stage, runID: runID, inner: NewFormsModule(src, runID, stage.allowedActions)}
		}}
	}
	if src, ok := copy.(CommSource); ok {
		stage.Modules[moduleComm] = perRun{moduleComm, func(runID string) Module {
			return threadDefault{stage: stage, runID: runID, inner: NewCommModule(src, runID, stage.allowedActions)}
		}}
	}
	return stage
}

func (s *RunStage) Ready() error {
	for _, m := range s.modules {
		if _, ok := s.Modules[m]; !ok {
			return ErrNoTestCopy{Module: m}
		}
	}
	return nil
}

type marketShape struct{ mwanachamamarket.MarketManager }

var shapeTools = sync.OnceValues(func() ([]marketroutes.Tool, error) {
	return marketroutes.BuildTools(marketShape{}, marketroutes.Mount{})
})

func (s *RunStage) allowedActions(actor string) map[string]bool {
	out := map[string]bool{}
	held := s.actors[strings.ToLower(actor)]
	if held.Kind == agencymodels.ActorKindSystem {
		for _, p := range agencymodels.PermissionCatalog() {
			for _, a := range p.Actions {
				out[a] = true
			}
		}
		return out
	}
	s.mu.Lock()
	for action := range s.derived[strings.ToLower(actor)] {
		out[action] = true
	}
	s.mu.Unlock()
	for _, code := range held.Permissions {
		p, ok := agencymodels.LookupPermission(code)
		if !ok {
			continue
		}
		for _, a := range p.Actions {
			out[a] = true
		}
	}
	return out
}

func (s *RunStage) Tools(actor string) []mwanachamaai.ChatTool {
	if s.Ready() != nil {
		return nil
	}
	tools, err := shapeTools()
	if err != nil {
		return nil
	}
	allowed := s.allowedActions(actor)
	var out []mwanachamaai.ChatTool
	for _, t := range tools {
		if allowed[t.Action] {
			out = append(out, chatToolOf(t.Name, t.Description, t.InputSchema))
		}
	}
	return append(out, s.moduleTools(allowed)...)
}

func chatToolOf(name, description string, schema json.RawMessage) mwanachamaai.ChatTool {
	params := map[string]any{}
	_ = json.Unmarshal(schema, &params)
	return mwanachamaai.ChatTool{Name: name, Description: description, Parameters: params}
}

type marketCaller struct {
	stage *RunStage
	runID string
	actor string
}

func (s *RunStage) Caller(runID, actor string) Caller {
	return marketCaller{stage: s, runID: runID, actor: actor}
}

func (c marketCaller) Call(ctx context.Context, tool string, args map[string]any) (string, error) {
	if err := c.stage.Ready(); err != nil {
		return "", err
	}
	mm, err := c.stage.copy.Market(ctx, c.runID)
	if err != nil {
		return "", err
	}
	mm.UseCoordinators(func(_ context.Context, caller string) bool {
		return c.stage.allowedActions(caller)[actionStartGroupOrder]
	})
	allowed := c.stage.allowedActions(c.actor)
	mount := marketroutes.Mount{
		Caller: func(context.Context) string { return c.actor },
		Authorize: func(_ context.Context, action string) error {
			if allowed[action] {
				return nil
			}
			return dispatch.ErrForbidden
		},
	}
	tools, err := marketroutes.BuildTools(mm, mount)
	if err != nil {
		return "", err
	}
	raw, err := json.Marshal(args)
	if err != nil {
		return "", err
	}
	for _, t := range tools {
		if t.Name != tool {
			continue
		}
		if !allowed[t.Action] {
			return "", fmt.Errorf("%s has no permission to use %s", c.actor, tool)
		}
		out, err := t.Invoke(ctx, raw)
		if err != nil {
			return "", err
		}
		body, err := json.Marshal(out)
		if err != nil {
			return "", err
		}
		return string(body), nil
	}
	return "", fmt.Errorf("%s is not a tool of the test copy", tool)
}

func (s *RunStage) Respond(ctx context.Context, runID string, block agencymodels.ScenarioBlock) ([]agencymodels.RunStep, error) {
	if err := s.Ready(); err != nil {
		return nil, err
	}
	actor, known := s.actors[strings.ToLower(block.Actor)]
	if !known || actor.Kind == agencymodels.ActorKindRole {
		return nil, nil
	}
	mm, err := s.copy.Market(ctx, runID)
	if err != nil {
		return nil, err
	}
	step := agencymodels.RunStep{StepID: block.StepID, Step: block.Title, Actor: block.Actor, PlayedBy: "Test agent · " + kindLabel(block.Kind)}
	if asksTheBuyer(block) {
		asked, err := s.askedTheBuyer(ctx, mm, step, block)
		return []agencymodels.RunStep{asked}, err
	}
	if !sendsGroupOrder(block) {
		return []agencymodels.RunStep{s.playSystemStep(ctx, runID, block, step)}, nil
	}
	orders, err := mm.ListGroupOrdersBy(ctx, block.Actor, 0, "", true, marketmodels.GroupOpen)
	if err != nil {
		return nil, err
	}
	for _, o := range orders {
		sent, err := mm.SendGroupOrder(ctx, o.Coordinator, o.ID)
		if err != nil {
			return []agencymodels.RunStep{failed(step, block.Action, err.Error())}, nil
		}
		step.Did = "Sent the group order of " + sent.Product
		step.Recorded = "Group order " + sent.ID + " is " + sent.State
		step.Module, step.Endpoint = moduleMarket, endpointSendGroupOrder
		step.Sent = map[string]any{"id": o.ID}
		step.Answer = map[string]any{"id": sent.ID, "state": sent.State}
		step.Trail = s.sentTrail(ctx, mm, runID, o.Coordinator, sent.ID, block)
		return []agencymodels.RunStep{step}, nil
	}
	return []agencymodels.RunStep{failed(step, block.Action, "There is no open group order to send")}, nil
}

func sendsGroupOrder(block agencymodels.ScenarioBlock) bool {
	action := strings.ToLower(block.Action)
	return strings.Contains(action, "send") && strings.Contains(action, "order")
}

func (s *RunStage) Stored(ctx context.Context, runID string) ([]Stored, error) {
	if err := s.Ready(); err != nil {
		return nil, err
	}
	return s.copy.Stored(ctx, runID)
}

func (s *RunStage) Known(ctx context.Context, runID string) []string {
	known := append(s.knownShops(ctx, runID), s.knownGroupOrders(ctx, runID)...)
	known = append(known, s.knownOffers(ctx, runID)...)
	known = append(known, s.knownAsks(ctx, runID)...)
	return append(known, s.knownQuestions(ctx, runID)...)
}

func (s *RunStage) knownShops(ctx context.Context, runID string) []string {
	market, err := s.copy.Market(ctx, runID)
	if err != nil {
		return nil
	}
	posters, err := market.ListPosters(ctx, "")
	if err != nil {
		return nil
	}
	var out []string
	for _, p := range posters {
		out = append(out, fmt.Sprintf("Shop \"%s\" is poster_id %s", p.Name, p.ID))
	}
	return out
}

func (s *RunStage) knownQuestions(ctx context.Context, runID string) []string {
	s.mu.Lock()
	formID := s.sent[runID]
	s.mu.Unlock()
	source, ok := s.copy.(FormsSource)
	if formID == "" || !ok {
		return nil
	}
	forms, err := source.Forms(ctx, runID)
	if err != nil {
		return nil
	}
	questions, err := forms.ListQuestions(ctx, formID)
	if err != nil {
		return nil
	}
	out := []string{fmt.Sprintf("The form sent in this run is form_id %s", formID)}
	for _, q := range questions {
		out = append(out, fmt.Sprintf("The sent form's question \"%s\" (%s) is question_id %s", q.Prompt, q.AnswerType, q.ID))
	}
	return out
}

func (s *RunStage) knownGroupOrders(ctx context.Context, runID string) []string {
	market, err := s.copy.Market(ctx, runID)
	if err != nil {
		return nil
	}
	orders, err := market.ListGroupOrdersBy(ctx, "", 0, "", false, "")
	if err != nil {
		return nil
	}
	var out []string
	for _, g := range orders {
		out = append(out, fmt.Sprintf("The group order started in this run is group order id %s (state %s), not a form_id", g.ID, g.State))
	}
	return out
}

func (s *RunStage) knownOffers(ctx context.Context, runID string) []string {
	market, err := s.copy.Market(ctx, runID)
	if err != nil {
		return nil
	}
	offers, err := market.ListOffers(ctx, "")
	if err != nil {
		return nil
	}
	var out []string
	for _, o := range offers {
		out = append(out, fmt.Sprintf("The offer \"%s\" of poster_id %s is offer_id %s", o.ProductWords, o.PosterID, o.ID))
	}
	return out
}

func (s *RunStage) knownAsks(ctx context.Context, runID string) []string {
	market, err := s.copy.Market(ctx, runID)
	if err != nil {
		return nil
	}
	seen := map[string]bool{}
	var out []string
	for _, a := range s.actors {
		asks, err := market.ListAsksBy(ctx, a.Name, "", "")
		if err != nil {
			continue
		}
		for _, ask := range asks {
			if !seen[ask.ID] {
				seen[ask.ID] = true
				out = append(out, fmt.Sprintf("The ask made in this run is ask_id %s, put to poster_id %s", ask.ID, ask.PosterID))
			}
		}
	}
	return out
}

func (s *RunStage) Derive(blocks []agencymodels.ScenarioBlock) {
	actions := actionsOfTools()
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, block := range blocks {
		action, ok := actions[endpointOf(block)]
		if !ok || block.Actor == "" {
			continue
		}
		key := strings.ToLower(block.Actor)
		if s.derived[key] == nil {
			s.derived[key] = map[string]bool{}
		}
		s.derived[key][action] = true
	}
}

var actionsOfTools = sync.OnceValue(func() map[string]string {
	out := map[string]string{}
	if tools, err := shapeTools(); err == nil {
		for _, t := range tools {
			out[t.Name] = t.Action
		}
	}
	if tools, err := formsShapeTools(); err == nil {
		for _, t := range tools {
			out[t.Name] = t.Action
		}
	}
	if tools, err := commShapeTools(); err == nil {
		for _, t := range tools {
			out[t.Name] = t.Action
		}
	}
	return out
})
